import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

/** Calls an Edge Function and turns its error body into the sentence the function wrote. */
export async function callFunction<T = unknown>(name: string, body: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const reply = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
    throw new Error(reply?.error ?? fallback);
  }
  return data as T;
}
