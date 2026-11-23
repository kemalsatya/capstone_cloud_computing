import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import swaggerUi from 'swagger-ui-express';

const here = path.dirname(fileURLToPath(import.meta.url));
const specPath = path.join(here, 'openapi.yaml');
const specSource = fs.readFileSync(specPath, 'utf8');

export const openApiSpec = YAML.parse(specSource);

export function mountApiDocs(app, { enabled = false } = {}) {
    if (!enabled) return false;

    app.get('/openapi.yaml', (req, res) => {
        res.set('Content-Type', 'application/yaml; charset=utf-8');
        res.set('Cache-Control', 'no-store');
        res.status(200).send(specSource);
    });

    app.use(
        '/docs',
        swaggerUi.serve,
        swaggerUi.setup(openApiSpec, {
            customSiteTitle: 'JournalFit API Docs',
            swaggerOptions: {
                persistAuthorization: true,
                displayRequestDuration: true,
                docExpansion: 'list',
                filter: true,
                tryItOutEnabled: true,
            },
        })
    );

    return true;
}
