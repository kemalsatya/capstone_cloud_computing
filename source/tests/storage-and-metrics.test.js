import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { S3Storage } from '../src/modules/storage/s3-storage.js';
import { renderPrometheusMetrics } from '../src/common/utils/metrics.js';

function fakeClient(handler = async () => ({})) {
    const commands = [];
    return {
        commands,
        async send(command) {
            commands.push(command);
            return handler(command);
        },
    };
}

describe('S3Storage', () => {
    test('put sends a PutObjectCommand with the bucket and key', async () => {
        const client = fakeClient();
        const storage = new S3Storage({ client, bucket: 'journalfit-manuscripts' });

        await storage.put('tenants/tenant-a/manuscripts/ms-1.docx', Buffer.from('abc'));

        assert.equal(client.commands.length, 1);
        assert.equal(client.commands[0].input.Bucket, 'journalfit-manuscripts');
        assert.equal(client.commands[0].input.Key, 'tenants/tenant-a/manuscripts/ms-1.docx');
        assert.equal(client.commands[0].input.Body.toString(), 'abc');
    });

    test('get concatenates the response body stream', async () => {
        const client = fakeClient(async () => ({
            Body: (async function* stream() {
                yield Buffer.from('hello ');
                yield Buffer.from('world');
            })(),
        }));
        const storage = new S3Storage({ client, bucket: 'bucket' });

        const buffer = await storage.get('key.docx');

        assert.equal(buffer.toString(), 'hello world');
    });

    test('delete sends a DeleteObjectCommand', async () => {
        const client = fakeClient();
        const storage = new S3Storage({ client, bucket: 'bucket' });

        await storage.delete('key.docx');

        assert.equal(client.commands[0].input.Bucket, 'bucket');
        assert.equal(client.commands[0].input.Key, 'key.docx');
    });

    test('exists returns false only for a not-found response', async () => {
        const found = new S3Storage({ client: fakeClient(), bucket: 'bucket' });
        assert.equal(await found.exists('key.docx'), true);

        const missing = new S3Storage({
            client: fakeClient(async () => {
                const error = new Error('not found');
                error.name = 'NotFound';
                throw error;
            }),
            bucket: 'bucket',
        });
        assert.equal(await missing.exists('key.docx'), false);

        const broken = new S3Storage({
            client: fakeClient(async () => {
                throw new Error('network down');
            }),
            bucket: 'bucket',
        });
        await assert.rejects(() => broken.exists('key.docx'), /network down/);
    });
});

describe('Queue depth metric', () => {
    test('renders one gauge per queue', () => {
        const text = renderPrometheusMetrics({
            queueDepths: {
                'format-check': 2,
                'scope-check': 0,
            },
        });

        assert.match(text, /journalfit_queue_depth\{queue="format-check"\} 2/);
        assert.match(text, /journalfit_queue_depth\{queue="scope-check"\} 0/);
    });
});
