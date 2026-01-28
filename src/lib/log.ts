type Fields = Record<string, unknown>;

export function logError(msg: string, fields?: Fields) {
   
  console.error(`[error] ${msg}`, fields ?? {});
}

export function logInfo(msg: string, fields?: Fields) {
   
  console.info(`[info] ${msg}`, fields ?? {});
}

export function logWarning(msg: string, fields?: Fields) {
   
  console.warn(`[warn] ${msg}`, fields ?? {});
}
