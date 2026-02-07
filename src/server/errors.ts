// src/server/errors.ts
export class FirebaseCredentialError extends Error {
  readonly code = "FIREBASE_CREDENTIALS";
  constructor(message = "Firebase Admin credentials are not available/valid") {
    super(message);
    this.name = "FirebaseCredentialError";
  }
}

export function mapFirebaseAdminError(err: unknown): Error {
  const msg = String((err as Error | { message?: string })?.message ?? err);
  if (msg.includes("Could not refresh access token") || msg.includes("metadata from plugin failed")) {
    return new FirebaseCredentialError();
  }
  return err as Error;
}
