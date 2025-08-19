import type { DecodedIdToken } from "firebase-admin/auth";

export async function whoami(user: DecodedIdToken) {
  return { uid: user.uid, email: user.email, role: (user as any).role ?? "user" };
}
