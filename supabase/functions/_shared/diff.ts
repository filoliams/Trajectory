/** The hash check: which picked files the server still needs. Pure, so Node can test it. */

export type PickedFile = { path: string; contentHash: string };
export type KnownDoc = { id: number; externalId: string; analyzedHash: string | null };
export type Decision = { path: string; contentHash: string; need: boolean; documentId: number | null };

/** A file is needed when it's new or its contents changed since it was last analysed (failed ones retry). */
export function filesNeeded(files: PickedFile[], known: KnownDoc[]): Decision[] {
  const byPath = new Map(known.map((d) => [d.externalId, d]));
  // The same path twice in one request: the last one wins.
  const unique = new Map(files.map((f) => [f.path, f]));
  return [...unique.values()].map((f) => {
    const doc = byPath.get(f.path);
    return { path: f.path, contentHash: f.contentHash, need: !doc || doc.analyzedHash !== f.contentHash, documentId: doc?.id ?? null };
  });
}

/** A safe file extension for the storage path, from the file name. */
export function extensionOf(name: string): string {
  const ext = name.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1];
  return ext ?? 'bin';
}
