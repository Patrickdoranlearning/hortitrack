ts
import type { DecodedIdToken } from "firebase-admin/auth";

export async function whoami(user: DecodedIdToken) {
  // Extend with roles/claims/tenancy when ready
  return { uid: user.uid, email: user.email, role: (user as any).role ?? "user" };
}