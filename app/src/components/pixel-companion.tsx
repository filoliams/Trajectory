import { memo, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { mono } from '@/constants/trajectory';
import type { CompanionKind, StudyMode } from '@/lib/study-session';

import { CRITTER_W, critterFrames, SPECIES, type Pose } from '@/components/critter-sprites';

/** One character per pixel; '.' is transparent. Critters add their own body colours (see critter-sprites). */
const PALETTE: Record<string, string> = {
  k: '#15171C', // outline
  w: '#FFFFFF',
  p: '#FF9BB0', // cheeks, petals
  n: '#F27C96', // noses, ears, tongues
  r: '#B5452A', // book cover
  y: '#FFF4D6', // book pages
  l: '#B9AE93', // lines of text
  g: '#4CC15E', // leaf
  G: '#23803A', // dark leaf
  s: '#2F9A44', // stem
  o: '#D9692A', // pot
  O: '#9A4510', // pot shade
  c: '#FFD23F', // flower centre
};

const W = 16; // plant width; critters are drawn wider for more detail
const BLANK = '.'.repeat(W);

// ---- Plant ---------------------------------------------------------------

const POT = ['..kkkkkkkkkkkk..', '..kooooooooook..', '...koooooooOk...', '....kOOOOOOk....'];
const LEAVES = ['..ggg..ss..ggg..', '.gGGgg.ss.ggGGg.', '....gggssggg....', '.......ss.......'];

/** Five growth stages, from seed to bloom. Each is 11 rows above the pot. */
const STAGES: string[][] = [
  [...Array(9).fill(BLANK), '.......gg.......', '.......ss.......'],
  [...Array(7).fill(BLANK), '......g..g......', '.....gg..gg.....', '......gssg......', '.......ss.......'],
  [...Array(4).fill(BLANK), '.......gg.......', '......gGGg......', '.......ss.......', ...LEAVES],
  [BLANK, BLANK, '.......pp.......', '......gppg......', '.......gg.......', '......gGGg......', '.......ss.......', ...LEAVES],
  [BLANK, '.......pp.......', '.....pppppp.....', '....pppccppp....', '.....ppccpp.....', '......pppp......', '.......ss.......', ...LEAVES],
];

/** Lean the top of the plant one pixel left or right. */
function sway(rows: string[], dir: -1 | 1): string[] {
  return rows.map((row, i) => {
    if (i > 5) return row;
    return dir === 1 ? '.' + row.slice(0, -1) : row.slice(1) + '.';
  });
}

function plantFrames(stage: number, swaying: boolean): string[][] {
  const top = STAGES[stage];
  if (!swaying) return [[...top, ...POT]];
  return [[...sway(top, -1), ...POT], [...top, ...POT], [...sway(top, 1), ...POT], [...top, ...POT]];
}

// ---- Rendering -----------------------------------------------------------

/** Draws a sprite, merging runs of the same colour into one view per run. */
const Sprite = memo(function Sprite({ rows, px, colors }: { rows: string[]; px: number; colors: Record<string, string> }) {
  return (
    <View style={{ width: rows[0].length * px, height: rows.length * px }}>
      {rows.map((row, y) => {
        const runs: { x: number; len: number; color: string }[] = [];
        for (let x = 0; x < row.length; x++) {
          const color = colors[row[x]];
          if (!color) continue;
          const last = runs[runs.length - 1];
          if (last && last.x + last.len === x && last.color === color) last.len++;
          else runs.push({ x, len: 1, color });
        }
        // Rows overlap by half a pixel so no seams show between them.
        return runs.map((r) => (
          <View
            key={`${y}-${r.x}`}
            style={{ position: 'absolute', left: r.x * px, top: y * px, width: r.len * px, height: px + 0.5, backgroundColor: r.color }}
          />
        ));
      })}
    </View>
  );
});

/** A little "z" that drifts up and fades, on repeat. */
function Snore({ delay, left, size }: { delay: number; left: number; size: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }), -1));
    return () => cancelAnimation(t);
  }, [delay, t]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.15 ? t.value / 0.15 : 1 - t.value,
    transform: [{ translateY: -t.value * 26 }, { translateX: t.value * 8 }],
  }));
  return <Animated.Text style={[styles.z, { left, fontSize: size }, style]}>z</Animated.Text>;
}

/** Flip through frames: fast while walking or reading, a blink now and then when idle. */
function useFrame(frames: string[][], pose: Pose): string[] {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (frames.length < 2) return;
    const id = setInterval(() => setTick((n) => n + 1), pose === 'walk' ? 200 : pose === 'read' ? 420 : 650);
    return () => clearInterval(id);
  }, [frames.length, pose]);
  if (pose === 'idle') return frames[tick % 6 === 5 ? 1 : 0];
  return frames[tick % frames.length];
}

type Props = {
  kind: CompanionKind;
  mode: StudyMode;
  /** Today's progress, 0 to 1. Grows the plant. */
  progress: number;
  /** Something was just finished. */
  happy?: boolean;
  /** Size of one critter pixel. The plant has fewer, bigger pixels at the same overall size. */
  px?: number;
};

const SPEED = 42; // px per second
const PAD = 12;

/**
 * The strip the companion lives in. Critters wander it: while you study they
 * walk to a spot and read for a while, on a break they find a spot and nap,
 * and otherwise they mooch about. The plant stays put and grows. Tap to poke.
 */
export function Playground({ kind, mode, progress, happy = false, px = 3 }: Props) {
  const size = CRITTER_W * px;
  const [roam, setRoam] = useState(0);
  const [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState<1 | -1>(1);
  const [pokes, setPokes] = useState(0);
  const x = useSharedValue(0);
  const xNow = useRef(0);

  const isPlant = kind === 'plant';

  // The wander loop, restarted whenever the mode changes.
  useEffect(() => {
    if (isPlant || roam === 0) {
      x.value = roam / 2;
      xNow.current = roam / 2;
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const walkTo = (target: number, then: () => void) => {
      const ms = Math.max(300, (Math.abs(target - xNow.current) / SPEED) * 1000);
      setFacing(target >= xNow.current ? 1 : -1);
      setWalking(true);
      x.value = withTiming(target, { duration: ms, easing: Easing.linear });
      xNow.current = target;
      timer = setTimeout(() => {
        if (!alive) return;
        setWalking(false);
        then();
      }, ms);
    };
    const spot = () => Math.round(Math.random() * roam);
    const loop = () => {
      if (mode === 'break') return walkTo(spot(), () => {}); // find a spot, then nap until the break ends
      const pause = mode === 'study' ? 5000 + Math.random() * 6000 : 2500 + Math.random() * 3000;
      walkTo(spot(), () => {
        timer = setTimeout(loop, pause);
      });
    };
    loop();
    return () => {
      alive = false;
      clearTimeout(timer);
      cancelAnimation(x);
      xNow.current = x.value;
      setWalking(false);
    };
  }, [isPlant, mode, roam, x]);

  const pose: Pose = happy ? 'happy' : walking ? 'walk' : mode === 'break' ? 'nap' : mode === 'study' ? 'read' : 'idle';
  const stage = Math.min(STAGES.length - 1, Math.floor(Math.min(progress, 1) * (STAGES.length - 1)));
  const frames = isPlant ? plantFrames(stage, mode === 'study' || happy) : critterFrames(SPECIES[kind], pose);
  const frame = useFrame(frames, isPlant ? (mode === 'study' ? 'read' : 'idle') : pose);
  const colors = isPlant ? PALETTE : { ...PALETTE, ...SPECIES[kind].colors };

  // Body motion: hop when happy or poked, bob while walking, slow breathing on a nap.
  const y = useSharedValue(0);
  const breathe = useSharedValue(1);
  useEffect(() => {
    cancelAnimation(y);
    cancelAnimation(breathe);
    y.value = 0;
    breathe.value = 1;
    const hop = withSequence(
      withTiming(-px * 4, { duration: 200, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) }),
    );
    if (happy) y.value = withRepeat(hop, -1);
    else if (pose === 'walk') y.value = withRepeat(withSequence(withTiming(-px * 0.75, { duration: 200 }), withTiming(0, { duration: 200 })), -1);
    else if (pose === 'nap') breathe.value = withRepeat(withSequence(withTiming(1.04, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1);
    else if (pokes > 0) y.value = hop;
  }, [breathe, happy, pokes, pose, px, y]);

  const place = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const motion = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { scaleY: breathe.value }] }));

  return (
    <View
      style={[styles.stage, { height: size + 30 }]}
      onLayout={(e: LayoutChangeEvent) => setRoam(Math.max(0, e.nativeEvent.layout.width - PAD * 2 - size))}
      accessibilityLabel={label(kind, mode, happy)}>
      <View style={styles.ground} />
      <Animated.View style={[styles.actor, place]}>
        <Pressable onPress={() => setPokes((n) => n + 1)} accessibilityRole="button" accessibilityLabel="Poke your companion">
          <Animated.View style={[{ transformOrigin: 'bottom' }, motion, mode === 'break' && styles.dim]}>
            <View style={{ transform: [{ scaleX: facing }] }}>
              <Sprite rows={frame} px={isPlant ? size / W : px} colors={colors} />
            </View>
          </Animated.View>
        </Pressable>
        {mode === 'break' && !walking ? (
          <>
            <Snore delay={0} left={size * 0.62} size={13} />
            <Snore delay={1100} left={size * 0.74} size={10} />
          </>
        ) : null}
      </Animated.View>
    </View>
  );
}

export const COMPANIONS: { kind: CompanionKind; name: string }[] = [
  { kind: 'critter', name: SPECIES.critter.name },
  { kind: 'cat', name: SPECIES.cat.name },
  { kind: 'frog', name: SPECIES.frog.name },
  { kind: 'plant', name: 'Plant' },
];

function label(kind: CompanionKind, mode: StudyMode, happy: boolean): string {
  const who = `Your ${(COMPANIONS.find((c) => c.kind === kind)?.name ?? 'companion').toLowerCase()}`;
  if (happy) return `${who} is celebrating`;
  if (mode === 'study') return kind === 'plant' ? `${who} is growing` : `${who} is studying with you`;
  if (mode === 'break') return `${who} is resting`;
  return `${who} is waiting`;
}

const styles = StyleSheet.create({
  stage: { borderRadius: 14, backgroundColor: '#22252D', overflow: 'hidden' },
  ground: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 8, backgroundColor: '#2C3039' },
  actor: { position: 'absolute', left: PAD, bottom: 6 },
  dim: { opacity: 0.8 },
  z: { position: 'absolute', top: -2, fontFamily: mono, fontWeight: '700', color: '#B8BCC6' },
});
