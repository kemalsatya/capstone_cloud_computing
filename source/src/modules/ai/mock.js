function tokenize(text) {
    return (String(text || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
}

function estimateTokens(text) {
    return Math.max(1, Math.ceil(String(text || '').length / 4));
}

export async function checkScopeMock({ aimScope, abstract, keywords = [] }) {
    const aimTokens = new Set(tokenize(aimScope).filter((token) => token.length > 3));
    const contentTokens = [
        ...tokenize(abstract),
        ...keywords.flatMap((keyword) => tokenize(keyword)),
    ].filter((token) => token.length > 3);

    const matches = [...new Set(contentTokens.filter((token) => aimTokens.has(token)))];
    const ratio = aimTokens.size > 0
        ? matches.length / Math.min(aimTokens.size, 30)
        : 0;

    const fitLevel = ratio >= 0.2 ? 'high' : ratio >= 0.08 ? 'medium' : 'low';

    const rationale = fitLevel === 'high'
        ? 'Abstrak dan kata kunci selaras dengan aim and scope jurnal.'
        : fitLevel === 'medium'
            ? 'Abstrak memiliki sebagian keterkaitan dengan aim and scope jurnal, tetapi topik utama belum sepenuhnya selaras.'
            : 'Abstrak dan kata kunci belum menunjukkan keterkaitan yang jelas dengan aim and scope jurnal.';

    const suggestions = fitLevel === 'high'
        ? []
        : [
            'Perkuat keterkaitan abstrak dengan ruang lingkup jurnal.',
            'Tambahkan kata kunci yang relevan dengan aim and scope.',
        ].slice(0, 3);

    const matchedTopics = matches.slice(0, 5);
    const tokensIn = estimateTokens(aimScope) + estimateTokens(abstract)
        + keywords.reduce((total, keyword) => total + estimateTokens(keyword), 0);
    const tokensOut = estimateTokens(rationale)
        + suggestions.reduce((total, suggestion) => total + estimateTokens(suggestion), 0);

    return {
        fit_level: fitLevel,
        rationale,
        matched_topics: matchedTopics,
        suggestions,
        ai_provider: 'mock',
        ai_model: 'mock',
        tokens_in: tokensIn,
        tokens_out: Math.max(1, tokensOut),
    };
}
