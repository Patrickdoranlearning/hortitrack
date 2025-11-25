// This file is a placeholder to allow the project to build while we migrate away from Firebase.
// Any usage of adminDb, adminAuth, or adminStorage will throw a runtime error.

const throwError = () => {
    throw new Error("Firebase Admin SDK has been removed. Please migrate this feature to Supabase.");
};

const dummyProxy = new Proxy({}, {
    get: () => throwError,
    apply: () => throwError(),
});

export const adminDb = dummyProxy as any;
export const adminAuth = dummyProxy as any;
export const adminStorage = dummyProxy as any;
