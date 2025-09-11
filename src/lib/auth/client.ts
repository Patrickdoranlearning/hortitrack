
export async function getIdTokenOrNull(): Promise<string | null> {
  try {
    const m = await import("firebase/auth"); // dynamic to avoid SSR issues
    const { getAuth } = m;
    const auth = getAuth();
    const u = auth?.currentUser;
    if (!u) return null;
    return await u.getIdToken();
  } catch {
    return null;
  }
}
