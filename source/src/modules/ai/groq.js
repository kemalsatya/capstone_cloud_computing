import { env } from '../../config/env.js';
import { AiSchemaError, validateScopeOutput } from './schema.js';

function promptFor({ aimScope, abstract, keywords }) {
    return [
        'Anda adalah asisten penilaian kecocokan topik naskah jurnal.',
        'Nilai hanya kecocokan abstrak dan kata kunci terhadap aim and scope jurnal.',
        'Jangan menilai kualitas isi, plagiarisme, atau kelayakan penerimaan.',
        'Balas HANYA dengan JSON valid tanpa markdown, dengan skema:',
        '{"fit_level":"high|medium|low","rationale":"maksimal 3 kalimat","matched_topics":["..."],"suggestions":["maksimal 3 saran"]}',
        'Gunakan bahasa Indonesia.',
        '',
        `Aim and scope jurnal:\n${aimScope}`,
        `Abstrak:\n${abstract}`,
        `Kata kunci: ${keywords.join(', ')}`,
    ].join('\n');
}

export async function checkScopeGroq({ aimScope, abstract, keywords = [] }) {
    if (!env.GROQ_API_KEY) {
        const err = new Error('GROQ_API_KEY belum dikonfigurasi.');
        err.code = 'AI_CONFIG';
        throw err;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);

    try {
        const response = await fetch(`${env.GROQ_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${env.GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: env.GROQ_MODEL,
                temperature: 0.2,
                response_format: { type: 'json_object' },
                messages: [
                    {
                        role: 'system',
                        content: 'Anda hanya mengembalikan JSON valid sesuai skema yang diminta.',
                    },
                    {
                        role: 'user',
                        content: promptFor({ aimScope, abstract, keywords }),
                    },
                ],
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            const body = await response.text();
            const err = new Error(
                `Groq mengembalikan ${response.status}: ${body.slice(0, 200)}`
            );
            err.code = response.status === 429 ? 'AI_RATE_LIMIT' : 'AI_ERROR';
            throw err;
        }

        const payload = await response.json();
        const content = payload?.choices?.[0]?.message?.content;

        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch {
            throw new AiSchemaError('Output AI bukan JSON yang valid.');
        }

        const output = validateScopeOutput(parsed);

        return {
            ...output,
            ai_provider: 'groq',
            ai_model: env.GROQ_MODEL,
            tokens_in: Number(payload?.usage?.prompt_tokens || 0),
            tokens_out: Number(payload?.usage?.completion_tokens || 0),
        };
    } catch (err) {
        if (err.name === 'AbortError') {
            const timeout = new Error('Permintaan AI melebihi batas waktu.');
            timeout.code = 'AI_TIMEOUT';
            throw timeout;
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }
}
