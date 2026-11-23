import { PgBoss } from 'pg-boss';
import { databaseConnectionString, env } from '../../config/env.js';
import { AppError } from '../../common/middlewares/errorHandler.js';
import { FORMAT_DLQ, FORMAT_QUEUE, SCOPE_DLQ, SCOPE_QUEUE } from './names.js';

let boss = null;
let ready = false;

export function isQueueReady() {
    return ready;
}

export function getBoss() {
    return boss;
}

export async function startQueue() {
    if (ready && boss) return boss;

    const instance = new PgBoss({
        connectionString: databaseConnectionString(),
        schema: env.PG_BOSS_SCHEMA,
    });

    instance.on('error', (err) => {
        console.error('[pg-boss] error:', err.message);
    });

    await instance.start();

    await instance.createQueue(FORMAT_DLQ);
    await instance.createQueue(FORMAT_QUEUE, {
        policy: 'exclusive',
        retryLimit: 2,
        retryDelay: 5,
        expireInSeconds: 120,
        deadLetter: FORMAT_DLQ,
    });

    await instance.createQueue(SCOPE_DLQ);
    await instance.createQueue(SCOPE_QUEUE, {
        policy: 'exclusive',
        retryLimit: 3,
        retryDelay: 5,
        retryBackoff: true,
        expireInSeconds: 180,
        deadLetter: SCOPE_DLQ,
    });

    boss = instance;
    ready = true;
    return boss;
}

export async function stopQueue() {
    if (!boss) return;
    await boss.stop({ graceful: true, timeout: 10000 });
    boss = null;
    ready = false;
}

export const queueService = {
    async enqueueFormatCheck(manuscriptId, tenantId, db) {
        if (!ready || !boss) {
            throw new AppError(
                'Antrean pemeriksaan belum siap.',
                503,
                null,
                'QUEUE_UNAVAILABLE'
            );
        }

        return boss.send(FORMAT_QUEUE, { manuscriptId, tenantId }, {
            singletonKey: manuscriptId,
            retryLimit: 2,
            retryDelay: 5,
            expireInSeconds: 120,
            db,
        });
    },
};
