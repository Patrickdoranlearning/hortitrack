const getRequiredEnvVar = (name: string, ...fallbackNames: string[]): string => {
  const allNames = [name, ...fallbackNames];
  for (const varName of allNames) {
    const value = process.env[varName];
    if (value) return value;
  }
  const error = `Missing required environment variable: ${allNames.join(' or ')}`;
  console.error(`[ENV] ${error}`);
  throw new Error(error);
};

export const SUPABASE_URL = getRequiredEnvVar('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
export const SUPABASE_ANON_KEY = getRequiredEnvVar('SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
// Support both SUPABASE_SERVICE_ROLE_KEY and SUPABASE_SERVICE_ROLE (used in src/env.ts)
export const SUPABASE_SERVICE_ROLE_KEY = getRequiredEnvVar('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE');
