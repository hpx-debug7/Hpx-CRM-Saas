import 'server-only';
import { getEnv } from '@/lib/env';
const env = getEnv();

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const SENSITIVE_KEYS = [
    'password',
    'secret',
    'token',
    'authorization',
    'cookie',
    'jwt',
    'key',
    'credential',
];

function redact(obj: unknown): unknown {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return obj;
    if (typeof obj !== 'object') return obj;
    if (obj instanceof Error) {
        return { name: obj.name, message: obj.message, stack: obj.stack };
    }
    if (Array.isArray(obj)) return obj.map(redact);

    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s))) {
            result[k] = '[REDACTED]';
        } else {
            result[k] = redact(v);
        }
    }
    return result;
}

function emit(level: LogLevel, args: unknown[]): void {
    const minLevel: LogLevel = env.NODE_ENV === 'production' ? 'info' : 'debug';

    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) return;

    const message = args
        .map((a) => (typeof a === 'string' ? a : JSON.stringify(redact(a))))
        .join(' ');

    const entry = {
        timestamp: new Date().toISOString(),
        level,
        message,
    };

    const json = JSON.stringify(entry);

    switch (level) {
        case 'error':
        case 'warn':
            process.stderr.write(json + '\n');
            break;
        default:
            process.stdout.write(json + '\n');
            break;
    }
}

export const logger = {
    debug: (...args: unknown[]) => emit('debug', args),
    info: (...args: unknown[]) => emit('info', args),
    warn: (...args: unknown[]) => emit('warn', args),
    error: (...args: unknown[]) => emit('error', args),
};
