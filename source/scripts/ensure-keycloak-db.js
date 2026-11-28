import pg from 'pg';
import { databaseConnectionString, env } from '../src/config/env.js';

const { Client } = pg;

function adminConnectionString() {
    const url = new URL(databaseConnectionString());
    url.pathname = '/postgres';
    return url.toString();
}

async function main() {
    const dbName = env.KEYCLOAK_DB_NAME;
    const quotedDbName = dbName.replace(/"/g, '""');
    const quotedOwner = env.DB_USER.replace(/"/g, '""');
    const client = new Client({ connectionString: adminConnectionString() });

    await client.connect();

    try {
        const exists = await client.query(
            'SELECT 1 FROM pg_database WHERE datname = $1',
            [dbName]
        );

        if (exists.rowCount === 0) {
            await client.query(
                `CREATE DATABASE "${quotedDbName}" OWNER "${quotedOwner}"`
            );
            console.log(`[keycloak-db] Database '${dbName}' dibuat.`);
        } else {
            console.log(`[keycloak-db] Database '${dbName}' sudah ada.`);
        }
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error('[keycloak-db] Gagal:', err.message);
    process.exit(1);
});
