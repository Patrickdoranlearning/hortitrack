type Fields = Record<string, unknown>;

export function logError(msg: string, fields?: Fields) {
  // eslint-disable-next-line no-console
  console.error(`[error] ${msg}`, fields ?? {});
}

export function logInfo(msg: string, fields?: Fields) {
  // eslint-disable-next-line no-console
  console.info(`[info] ${msg}`, fields ?? {});
}
