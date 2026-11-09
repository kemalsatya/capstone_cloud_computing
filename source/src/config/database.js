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
