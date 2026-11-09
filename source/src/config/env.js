import 'dotenv/config';

export const env = {
    PORT: process.env.PORT || 3000,
    DB_HOST: process.env.DB_HOST || "",
    DB_PORT: process.env.DB_PORT || 5432,
    DB_USER: process.env.DB_USER || "",
    DB_PASSWORD: process.env.DB_PASSWORD || "",
    DB_NAME: process.env.DB_NAME || "",
}