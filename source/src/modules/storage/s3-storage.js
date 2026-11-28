import {
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3';
import { env } from '../../config/env.js';

const DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function notFound(error) {
    return error?.name === 'NotFound'
        || error?.name === 'NoSuchKey'
        || error?.$metadata?.httpStatusCode === 404;
}

export class S3Storage {
    constructor({ client = null, bucket = env.S3_BUCKET } = {}) {
        this.bucket = bucket;
        this.client = client || new S3Client({
            endpoint: env.S3_ENDPOINT,
            region: env.S3_REGION,
            forcePathStyle: env.S3_FORCE_PATH_STYLE,
            credentials: {
                accessKeyId: env.S3_ACCESS_KEY,
                secretAccessKey: env.S3_SECRET_KEY,
            },
        });
    }

    async put(key, buffer) {
        await this.client.send(new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: buffer,
            ContentType: DOCX_CONTENT_TYPE,
        }));
        return key;
    }

    async get(key) {
        const response = await this.client.send(new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        }));

        if (!response.Body) {
            throw new Error(`Objek '${key}' tidak memiliki body.`);
        }

        const chunks = [];
        for await (const chunk of response.Body) {
            chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
    }

    async delete(key) {
        await this.client.send(new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
        }));
    }

    async exists(key) {
        try {
            await this.client.send(new HeadObjectCommand({
                Bucket: this.bucket,
                Key: key,
            }));
            return true;
        } catch (error) {
            if (notFound(error)) return false;
            throw error;
        }
    }
}
