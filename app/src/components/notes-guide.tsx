import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Segmented } from '@/components/form';
import { T } from '@/constants/trajectory';

type NotesApp = 'obsidian' | 'goodnotes' | 'onenote';
type Step = { title: string; body: string };

const APPS: { value: NotesApp; label: string }[] = [
  { value: 'obsidian', label: 'Obsidian' },
  { value: 'goodnotes', label: 'GoodNotes' },
  { value: 'onenote', label: 'OneNote' },
];

/** How to get each notes app's notes into a cloud folder Trajectory can read. */
const APP_STEPS: Record<NotesApp, Step[]> = {
  obsidian: [
    {
      title: 'Keep your vault in a cloud folder',
      body:
        'An Obsidian vault is a normal folder of notes. In Obsidian, choose Open folder as vault and pick a folder ' +
        'inside OneDrive, iCloud Drive or Google Drive.',
    },
    {
      title: 'Already have a vault?',
      body: 'Close Obsidian, move the vault folder into your cloud folder, then open it again from its new place.',
    },
    {
      title: 'On iPhone or iPad',
      body: 'Obsidian there syncs through iCloud Drive, so keep the vault in iCloud Drive if you take notes on a phone or tablet.',
    },
  ],
  goodnotes: [
    {
      title: 'Turn on backup',
      body: 'In GoodNotes, open Settings, then Backup (Auto-backup in older versions), and turn it on.',
    },
    {
      title: 'Choose a cloud service',
      body: 'Pick OneDrive, Google Drive, Dropbox or Box. GoodNotes then copies your notebooks there as you write.',
    },
    {
      title: 'Back up as PDF',
      body: 'Set the backup format to PDF so your handwriting and text can be read.',
    },
  ],
  onenote: [
    {
      title: 'Sign in with your uni account',
      body: 'Sign in to OneNote with your university Microsoft account. New notebooks are saved to its OneDrive automatically.',
    },
    {
      title: 'Check older notebooks',
      body:
        'If a notebook is saved on your computer instead, open it in OneNote for Windows, go to File, then Share, ' +
        'and move it to OneDrive.',
    },
  ],
};

const ORGANISE: Record<NotesApp, string> = {
  obsidian: 'Make a folder for each course named with its code (e.g. STAT2201), and one note per topic.',
  goodnotes: 'Put the course code in each notebook’s name (e.g. STAT2201 Lectures) and use a heading or page title for each topic.',
  onenote: 'Make a section for each course named with its code (e.g. STAT2201), and one page per topic.',
};

/** Onboarding page: how Trajectory uses your notes, and how to get them into the cloud. */
export function NotesGuide() {
  const [app, setApp] = useState<NotesApp>('goodnotes');

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>How notes work in Trajectory</Text>
        <Point>Your notes stay in your notes app. Trajectory only reads them from the cloud folder they sync to.</Point>
        <Point>Each course page lists its topics and shows which ones you have notes for, so gaps stand out before exams.</Point>
        <Point>Topics come from your course profile. You can add your own on any course page.</Point>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Link your notes app</Text>
        <Segmented options={APPS} value={app} onChange={setApp} />
        {APP_STEPS[app].map((step, i) => (
          <View key={step.title} style={styles.step}>
            <View style={styles.num}>
              <Text style={styles.numText}>{i + 1}</Text>
            </View>
            <View style={styles.stepMain}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepBody}>{step.body}</Text>
            </View>
          </View>
        ))}
        <View style={styles.tip}>
          <Text style={styles.stepTitle}>Name things by course</Text>
          <Text style={styles.stepBody}>{ORGANISE[app]} That’s how Trajectory matches your notes to topics.</Text>
        </View>
        <Text style={styles.small}>
          Connecting the cloud folder to Trajectory comes in a later update. Until then, tap the notes marker next to each topic
          on a course page.
        </Text>
      </View>

      <View style={styles.cardQuiet}>
        <Text style={styles.quietTitle}>Not saving to the cloud yet?</Text>
        <Text style={styles.stepBody}>
          Your university Microsoft account usually includes OneDrive storage. Sign in to OneDrive with it (it’s built into
          Windows, and there are apps for Mac, iPhone and iPad), then keep your notes folder inside OneDrive. On a Windows PC
          you can also back up your Documents and Desktop folders from OneDrive’s settings, under Sync and backup.
        </Text>
      </View>
    </View>
  );
}

function Point({ children }: { children: string }) {
  return (
    <View style={styles.point}>
      <View style={styles.bullet} />
      <Text style={[styles.stepBody, styles.flex]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  flex: { flex: 1 },
  card: { gap: 12, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 16, padding: 16 },
  cardQuiet: { gap: 4, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C9CDD4', borderRadius: 16, padding: 14 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: T.ink },
  quietTitle: { fontSize: 14, fontWeight: '700', color: T.ink },
  point: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.accent, marginTop: 7 },
  step: { flexDirection: 'row', gap: 10 },
  num: { width: 22, height: 22, borderRadius: 11, backgroundColor: T.accentSoft, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  numText: { fontSize: 12, fontWeight: '700', color: T.accentDark },
  stepMain: { flex: 1, gap: 2 },
  stepTitle: { fontSize: 14, fontWeight: '600', color: T.ink },
  stepBody: { fontSize: 13, lineHeight: 19, color: T.inkSoft },
  tip: { gap: 2, backgroundColor: T.ground, borderRadius: 12, padding: 12 },
  small: { fontSize: 12, lineHeight: 17, color: T.muted },
});
