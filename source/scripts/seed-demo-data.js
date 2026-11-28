import { seedDemoData } from './lib/seed-demo.js';

async function main() {
    const force = process.argv.includes('--force');
    const seeded = await seedDemoData({ force });

    for (const item of seeded) {
        console.log(`[seed] ${item.tenantId}: active rule template ${item.templateId}`);
    }
}

main()
    .then(() => {
        console.log('[seed] Selesai.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('[seed] Gagal:', err);
        process.exit(1);
    });
