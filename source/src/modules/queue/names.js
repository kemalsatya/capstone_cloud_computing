import { env } from '../../config/env.js';

export const FORMAT_QUEUE = env.FORMAT_QUEUE;
export const FORMAT_DLQ = `${env.FORMAT_QUEUE}-dlq`;
export const SCOPE_QUEUE = env.SCOPE_QUEUE;
export const SCOPE_DLQ = `${env.SCOPE_QUEUE}-dlq`;
