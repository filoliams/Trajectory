import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.118.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** An error whose message is safe and useful to show a student. */
export class Friendly extends Error {}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

export const preflight = () => new Response('ok', { headers: CORS });

/** A Supabase client acting as the caller, so row-level security authorises everything it reads and writes. */
export async function asCaller(req: Request): Promise<{ db: SupabaseClient; user: User } | null> {
  const authorization = req.headers.get('Authorization');
  if (!authorization) return null;
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
  const db = createClient(url, key, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data, error } = await db.auth.getUser(authorization.replace(/^Bearer\s+/i, ''));
  if (error || !data.user) return null;
  return { db, user: data.user };
}
