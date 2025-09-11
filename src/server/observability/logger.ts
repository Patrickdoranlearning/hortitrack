import pino from 'pino';

const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
});

type Level = "info" | "warn" | "error";
export function log(level: Level, msg: string, ctx: Record<string, any> = {}) {
  logger[level](ctx, msg);
}