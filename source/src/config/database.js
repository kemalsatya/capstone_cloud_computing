import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

export const pool = new Pool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
});

export async function query(text, params) {
    return pool.query(text, params);
}

export async function withTransaction(fn) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        try {
            await client.query('ROLLBACK');
        } catch {
            // The original error is more useful than a rollback failure.
        }
        throw err;
    } finally {
        client.release();
    }
}

export function pgBossDbAdapter(client) {
    return {
        executeSql: (text, values) => client.query(text, values),
    };
}
