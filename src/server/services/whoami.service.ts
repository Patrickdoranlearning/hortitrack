import type { ServerUser } from "@/server/auth/getUser";

export async function whoami(user: ServerUser) {
  return {
    uid: user.uid,
    email: user.email,
    role: user.orgId ? "user" : "guest",
  };
}
