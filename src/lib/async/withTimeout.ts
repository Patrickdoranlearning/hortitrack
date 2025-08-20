// src/lib/async/withTimeout.ts
export class TimeoutError extends Error {
  constructor(msg: string) { super(msg); this.name = "TimeoutError"; }
}

export async function withTimeout<T>(p: Promise<T>, ms: number, reason = "timed out"): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new TimeoutError(reason)), Math.max(ms, 1));
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
