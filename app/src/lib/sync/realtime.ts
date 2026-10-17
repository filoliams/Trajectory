/**
 * Live updates: tell us when this user's data changes on another device.
 * Inserts and updates are filtered to the user's own rows on the server.
 * Deletes can't be filtered (that would need `replica identity full`, which
 * also leaks deleted rows), so they arrive with just the id and we ignore ids we don't have.
 */
import { supabase } from '@/lib/supabase';

const OWNED = ['courses', 'assessments', 'topics', 'study_time'] as const;
const DELETABLE = ['courses', 'assessments', 'topics'] as const;

export function subscribeToChanges(
  userId: string,
  opts: { onChange: () => void; isKnownId: (table: string, id: string) => boolean },
): () => void {
  let subscribedBefore = false;
  let channel = supabase.channel(`sync:${userId}`);

  for (const table of OWNED) {
    for (const event of ['INSERT', 'UPDATE'] as const) {
      channel = channel.on(
        'postgres_changes',
        { event, schema: 'public', table, filter: `user_id=eq.${userId}` },
        () => opts.onChange(),
      );
    }
  }
  channel = channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, () =>
    opts.onChange(),
  );
  for (const table of DELETABLE) {
    channel = channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, (payload) => {
      const id = (payload.old as { id?: number | string } | undefined)?.id;
      if (id !== undefined && opts.isKnownId(table, String(id))) opts.onChange();
    });
  }

  channel.subscribe((status) => {
    // After a dropped connection comes back, catch up on anything we missed.
    if (status === 'SUBSCRIBED') {
      if (subscribedBefore) opts.onChange();
      subscribedBefore = true;
    }
  });

  return () => {
    supabase.removeChannel(channel);
  };
}
