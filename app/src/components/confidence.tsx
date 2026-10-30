import { StyleSheet, Text, View } from 'react-native';

import { T, mono, radius } from '@/constants/trajectory';
import type { Topic } from '@/data/courses';
import { band, courseConfidence, topicConfidence, trend, weekChange, weekStart, type Band, type Trend } from '@/lib/confidence';

const BAND_COLOR: Record<Band, string> = { confident: T.done, 'getting-there': T.warn, shaky: T.urgent };
const BAND_LABEL: Record<Band, string> = { confident: 'Confident', 'getting-there': 'Getting there', shaky: 'Shaky' };
const TREND: Record<Trend, { arrow: string; color: string; label: string }> = {
  up: { arrow: '↑', color: T.done, label: 'Improving since the last quiz' },
  down: { arrow: '↓', color: T.urgent, label: 'Getting worse since the last quiz' },
  same: { arrow: '–', color: T.warn, label: 'No change since the last quiz' },
};

/** A topic's confidence bar, the round trend bubble (after its first quiz), and the change this week. */
export function ConfidenceLine({ topic, now }: { topic: Topic; now: number }) {
  const value = topicConfidence(topic);
  const direction = trend(topic);
  const change = weekChange(topic, now);
  return (
    <View style={styles.line}>
      <View style={styles.track} accessible accessibilityLabel={`Confidence ${value}%, ${BAND_LABEL[band(value)]}`}>
        <View style={[styles.fill, { width: `${value}%`, backgroundColor: BAND_COLOR[band(value)] }]} />
      </View>
      <Text style={styles.pct}>{value}%</Text>
      {direction ? (
        <View style={[styles.bubble, { backgroundColor: TREND[direction].color }]} accessible accessibilityRole="image" accessibilityLabel={TREND[direction].label}>
          <Text style={styles.arrow}>{TREND[direction].arrow}</Text>
        </View>
      ) : null}
      {direction ? <Delta value={change} suffix=" this week" /> : <Text style={styles.meta}>notes only, no quiz yet</Text>}
    </View>
  );
}

/** Overall confidence for a course, its change since Monday, and how many topics sit in each band. */
export function CourseConfidence({ code, topics, now }: { code: string; topics: Topic[]; now: number }) {
  const value = courseConfidence(topics);
  if (value === null) return null;
  const before = courseConfidence(topics, weekStart(now) - 1) ?? value;
  const counts: Record<Band, number> = { confident: 0, 'getting-there': 0, shaky: 0 };
  for (const t of topics) counts[band(topicConfidence(t))]++;
  return (
    <View style={styles.summary}>
      <View style={styles.row}>
        <Text style={styles.eyebrow}>{code} confidence</Text>
        <Delta value={value - before} suffix=" this week" />
      </View>
      <View style={styles.row}>
        <Text style={styles.big}>{value}%</Text>
        <Text style={styles.meta}>was {before}% on Monday</Text>
      </View>
      <View style={styles.bands}>
        {(Object.keys(counts) as Band[]).filter((b) => counts[b] > 0).map((b) => (
          <Text key={b} style={[styles.band, { color: BAND_COLOR[b], borderColor: BAND_COLOR[b] }]}>
            {counts[b]} {BAND_LABEL[b]}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Delta({ value, suffix }: { value: number; suffix: string }) {
  const color = value > 0 ? T.done : value < 0 ? T.urgent : T.muted;
  const text = value > 0 ? `↑ +${value}${suffix}` : value < 0 ? `↓ ${-value}${suffix}` : `no change${suffix}`;
  return <Text style={[styles.delta, { color }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  track: { width: 88, height: 6, borderRadius: 3, backgroundColor: T.track, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  pct: { fontFamily: mono, fontSize: 12, color: T.inkSoft },
  bubble: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  arrow: { fontFamily: mono, fontSize: 13, fontWeight: '700', color: T.onAccent },
  delta: { fontFamily: mono, fontSize: 12, fontWeight: '600' },
  meta: { fontSize: 12, color: T.muted },
  summary: { backgroundColor: T.surface, borderRadius: radius.lg, padding: 14, gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  eyebrow: { fontSize: 13, fontWeight: '600', color: T.muted },
  big: { fontFamily: mono, fontSize: 26, color: T.ink },
  bands: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  band: { fontSize: 12, fontWeight: '600', borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2, overflow: 'hidden' },
});
