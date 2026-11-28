import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {
    GetObjectCommand,
    ListObjectsV2Command,
    S3Client,
} from '@aws-sdk/client-s3';
import { env } from '../src/config/env.js';

function createClient() {
    return new S3Client({
        endpoint: env.S3_ENDPOINT,
        region: env.S3_REGION,
        forcePathStyle: env.S3_FORCE_PATH_STYLE,
        credentials: {
            accessKeyId: env.S3_ACCESS_KEY,
            secretAccessKey: env.S3_SECRET_KEY,
        },
    });
}

async function listObjects(client, bucket) {
    const objects = [];
    let continuationToken;

    do {
        const response = await client.send(new ListObjectsV2Command({
            Bucket: bucket,
            ContinuationToken: continuationToken,
        }));

        objects.push(...(response.Contents || []));
        continuationToken = response.IsTruncated
            ? response.NextContinuationToken
            : undefined;
    } while (continuationToken);

    return objects;
}

async function bodyToBuffer(body) {
    const chunks = [];
    for await (const chunk of body) {
        chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

async function main() {
    if (!env.S3_ENDPOINT || !env.S3_BUCKET || !env.S3_ACCESS_KEY || !env.S3_SECRET_KEY) {
        throw new Error('Konfigurasi S3 belum lengkap untuk backup Garage.');
    }

    const backupDir = path.resolve(
        process.argv[2] || process.env.BACKUP_DIR || 'garage-backup'
    );
    const objectsDir = path.join(backupDir, 'objects');
    await fs.mkdir(objectsDir, { recursive: true });

    const client = createClient();
    const objects = await listObjects(client, env.S3_BUCKET);
    const manifest = {
        bucket: env.S3_BUCKET,
        generated_at: new Date().toISOString(),
        objects: [],
    };

    for (const object of objects) {
        const key = object.Key;
        if (!key) continue;

        const response = await client.send(new GetObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: key,
        }));
        const buffer = await bodyToBuffer(response.Body);

        const target = path.resolve(objectsDir, key);
        if (!target.startsWith(`${objectsDir}${path.sep}`)) {
            throw new Error(`Object key tidak aman: ${key}`);
        }

        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, buffer);

        manifest.objects.push({
            key,
            size: buffer.length,
            sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
        });
    }

    await fs.writeFile(
        path.join(backupDir, 'manifest.json'),
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf8'
    );

    console.log(`[garage-backup] ${manifest.objects.length} objek disimpan di ${backupDir}`);
}

main().catch((err) => {
    console.error('[garage-backup] Gagal:', err.message);
    process.exit(1);
});
