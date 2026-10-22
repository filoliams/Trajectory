import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { T, mono, radius } from '@/constants/trajectory';
import { importFromFile, type PickedFile } from '@/lib/api';
import { parseSemester, useStore } from '@/lib/store';

type Upload = {
  id: number;
  name: string;
  status: 'reading' | 'done' | 'failed';
  code?: string;
  count?: number;
  review?: number;
  error?: string;
};

const ACCEPT = ['application/pdf', 'text/html'];
const ACCEPT_EXT = /\.(pdf|html?)$/i;
const OFFLINE_UPLOAD = "You're offline. Connect to the internet to upload course profiles.";

/**
 * A drop box for course profiles. Tap to choose files (or drag them in on a
 * computer); each one is read by the backend and its course and assessments
 * saved. Several files can go in at once.
 */
export function ProfileUpload({ profileName }: { profileName: string }) {
  const { profile, saveImportedCourse, online } = useStore();
  // Reading a profile happens on our server, so uploads need the internet.
  const onlineRef = useRef(online);
  useEffect(() => {
    onlineRef.current = online;
  }, [online]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);
  const nextId = useRef(1);
  const queue = useRef(Promise.resolve());
  const zone = useRef<ComponentRef<typeof Pressable>>(null);

  function update(id: number, fields: Partial<Upload>) {
    setUploads((list) => list.map((u) => (u.id === id ? { ...u, ...fields } : u)));
  }

  function add(files: PickedFile[]) {
    const { year, semester } = parseSemester(profile?.semester ?? '2026 S2');
    for (const file of files) {
      const id = nextId.current++;
      setUploads((list) => [{ id, name: file.name, status: 'reading' }, ...list]);
      // One at a time, so courses are saved in order and the backend isn't flooded.
      queue.current = queue.current.then(async () => {
        try {
          if (!ACCEPT_EXT.test(file.name) && !ACCEPT.includes(file.mimeType ?? '')) throw new Error('Upload a PDF or a saved web page (.html).');
          if (!onlineRef.current) throw new Error(OFFLINE_UPLOAD);
          const imported = await importFromFile(file, year, semester);
          await saveImportedCourse(imported);
          update(id, {
            status: 'done',
            code: imported.code,
            count: imported.assessments.length,
            review: imported.assessments.filter((a) => a.needs_review).length,
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          const lostConnection = /failed to fetch|network request failed|load failed/i.test(message);
          update(id, { status: 'failed', error: lostConnection ? OFFLINE_UPLOAD : message });
        }
      });
    }
  }

  async function pick() {
    if (!online) return;
    const result = await DocumentPicker.getDocumentAsync({ type: ACCEPT, multiple: true, copyToCacheDirectory: true });
    if (result.canceled) return;
    add(result.assets.map((a) => ({ name: a.name, uri: a.uri, mimeType: a.mimeType, file: a.file })));
  }

  // On the web, files can also be dragged onto the box.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = zone.current as unknown as HTMLElement | null;
    if (!el) return;
    const over = (e: DragEvent) => {
      e.preventDefault();
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (!el.contains(e.relatedTarget as Node | null)) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) add(files.map((f) => ({ name: f.name, mimeType: f.type, file: f })));
    };
    el.addEventListener('dragover', over);
    el.addEventListener('dragleave', leave);
    el.addEventListener('drop', drop);
    return () => {
      el.removeEventListener('dragover', over);
      el.removeEventListener('dragleave', leave);
      el.removeEventListener('drop', drop);
    };
    // add() only reads refs and the semester, which can't change while the box is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const web = Platform.OS === 'web';

  return (
    <View style={styles.wrap}>
      <Pressable
        ref={zone}
        accessibilityRole="button"
        accessibilityLabel={`Upload ${profileName}s`}
        accessibilityState={{ disabled: !online }}
        disabled={!online}
        onPress={pick}
        style={({ pressed }) => [styles.zone, dragging && styles.zoneOn, pressed && styles.zonePressed, !online && styles.zoneOffline]}>
        <View style={styles.icon}>
          <Text style={styles.iconText}>↑</Text>
        </View>
        <Text style={styles.zoneTitle}>{dragging ? 'Drop to upload' : web ? `Drop your ${profileName}s here` : `Upload your ${profileName}s`}</Text>
        <Text style={styles.zoneBody}>
          {online ? `${web ? 'or click to choose files' : 'Tap to choose files'} · PDF or .html` : OFFLINE_UPLOAD}
        </Text>
      </Pressable>

      {uploads.map((u) => (
        <View key={u.id} style={[styles.row, u.status === 'failed' && styles.rowFailed]}>
          {u.status === 'reading' ? <ActivityIndicator color={T.muted} /> : null}
          <View style={styles.rowMain}>
            <Text style={u.code ? styles.rowCode : styles.rowName} numberOfLines={1}>
              {u.code ?? u.name}
            </Text>
            <Text style={[styles.rowText, u.status === 'failed' && styles.rowError, !!u.review && styles.rowWarn]}>
              {u.status === 'reading'
                ? 'Reading…'
                : u.status === 'failed'
                  ? u.error
                  : `${u.count} assessment${u.count === 1 ? '' : 's'} imported${u.review ? ` · ${u.review} to check` : ''}`}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  zone: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 20,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: T.lineStrong,
    backgroundColor: T.surface,
  },
  zoneOn: { borderColor: T.accent, backgroundColor: T.accentSoft },
  zonePressed: { opacity: 0.8 },
  zoneOffline: { opacity: 0.6 },
  icon: { width: 44, height: 44, borderRadius: radius.lg, backgroundColor: T.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  iconText: { fontSize: 22, fontWeight: '700', color: T.accent },
  zoneTitle: { fontSize: 16, fontWeight: '600', color: T.ink, textAlign: 'center' },
  zoneBody: { fontSize: 13, color: T.muted, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: radius.md, padding: 12 },
  rowFailed: { borderColor: T.dangerLine },
  rowMain: { flex: 1, gap: 2 },
  rowCode: { fontFamily: mono, fontSize: 14, color: T.ink },
  rowName: { fontSize: 14, fontWeight: '600', color: T.ink },
  rowText: { fontSize: 13, lineHeight: 18, color: T.muted },
  rowWarn: { color: T.warn },
  rowError: { color: T.urgent },
});
