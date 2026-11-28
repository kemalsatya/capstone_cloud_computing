import fs from 'node:fs/promises';
import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
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

async function main() {
    if (!env.S3_ENDPOINT || !env.S3_BUCKET || !env.S3_ACCESS_KEY || !env.S3_SECRET_KEY) {
        throw new Error('Konfigurasi S3 belum lengkap untuk restore Garage.');
    }

    const backupDir = path.resolve(
        process.argv[2] || process.env.BACKUP_DIR || 'garage-backup'
    );
    const manifest = JSON.parse(
        await fs.readFile(path.join(backupDir, 'manifest.json'), 'utf8')
    );

    const client = createClient();
    let restored = 0;

    for (const object of manifest.objects || []) {
        const source = path.resolve(path.join(backupDir, 'objects'), object.key);
        const buffer = await fs.readFile(source);

        await client.send(new PutObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: object.key,
            Body: buffer,
            ContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }));
        restored += 1;
    }

    console.log(`[garage-restore] ${restored} objek dipulihkan ke bucket ${env.S3_BUCKET}`);
}

main().catch((err) => {
    console.error('[garage-restore] Gagal:', err.message);
    process.exit(1);
});
