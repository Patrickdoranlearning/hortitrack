import { getAuth } from 'firebase/auth';

export async function fetchWithAuth(input: RequestInfo | URL, init?: RequestInit) {
  const auth = getAuth();
  const user = auth.currentUser || (await new Promise(resolve => {
    const unsub = auth.onAuthStateChanged(u => { unsub(); resolve(u); });
  })) as any;

  const token = user ? await user.getIdToken() : null;
  if (!token) throw new Error('Not signed in');

  const headers = new Headers(init?.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  return fetch(input, { ...init, headers });
}
