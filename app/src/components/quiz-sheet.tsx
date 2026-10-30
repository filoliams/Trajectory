import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ErrorText } from '@/components/form';
import { T, mono, radius, typo } from '@/constants/trajectory';
import type { Topic } from '@/data/courses';
import { startQuiz, type Quiz } from '@/lib/quiz';
import { useStore } from '@/lib/store';

/**
 * "Quiz me" on one topic: three questions, one at a time, each marked right or wrong with a short
 * explanation. Finishing saves the score and closes; the topic row shows it. No separate result screen.
 */
export function QuizSheet({ topic, onClose }: { topic: Topic; onClose: (score?: { score: number; total: number }) => void }) {
  const { saveQuiz } = useStore();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [right, setRight] = useState(0);

  useEffect(() => {
    let live = true;
    startQuiz(topic.id).then(
      (q) => live && setQuiz(q),
      (e) => live && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      live = false;
    };
  }, [topic.id]);

  const question = quiz?.questions[index];
  const last = quiz ? index === quiz.questions.length - 1 : false;

  function pick(i: number) {
    if (picked !== null || !question) return;
    setPicked(i);
    if (i === question.correct) setRight((n) => n + 1);
  }

  function next() {
    if (!quiz) return;
    if (!last) {
      setIndex((i) => i + 1);
      setPicked(null);
      return;
    }
    const total = quiz.questions.length;
    saveQuiz(topic.id, quiz.attemptId, right, total);
    onClose({ score: right, total });
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => onClose()}>
      <View style={styles.scrim}>
        <Pressable accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={() => onClose()} />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.head}>
            <Text style={styles.title} numberOfLines={2}>
              {topic.name}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => onClose()} style={styles.textBtn}>
              <Text style={styles.textBtnLabel}>Close</Text>
            </Pressable>
          </View>

          {!quiz && !error ? (
            <View style={styles.loading}>
              <ActivityIndicator color={T.accent} />
              <Text style={styles.meta}>Writing three questions…</Text>
            </View>
          ) : null}
          <ErrorText>{error}</ErrorText>

          {quiz && question ? (
            <ScrollView contentContainerStyle={styles.body}>
              <View style={styles.progress} accessibilityLabel={`Question ${index + 1} of ${quiz.questions.length}`}>
                {quiz.questions.map((_, i) => (
                  <View key={i} style={[styles.dash, (i < index || (i === index && picked !== null)) && styles.dashOn]} />
                ))}
              </View>
              <Text style={styles.question}>{question.question}</Text>
              <View style={styles.answers}>
                {question.answers.map((a, i) => {
                  const shown = picked !== null;
                  const isRight = shown && i === question.correct;
                  const isWrong = shown && i === picked && i !== question.correct;
                  return (
                    <Pressable
                      key={i}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: shown, selected: i === picked }}
                      accessibilityLabel={`${a}${isRight ? ', correct answer' : isWrong ? ', your answer, wrong' : ''}`}
                      disabled={shown}
                      onPress={() => pick(i)}
                      style={({ pressed }) => [styles.answer, isRight && styles.answerRight, isWrong && styles.answerWrong, pressed && styles.pressed]}>
                      <Text style={[styles.answerText, isRight && styles.rightText, isWrong && styles.wrongText]}>{a}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {picked !== null ? (
                <>
                  <Text style={styles.explain}>
                    {picked === question.correct ? 'Correct. ' : 'Not quite. '}
                    {question.explanation}
                  </Text>
                  <Pressable accessibilityRole="button" onPress={next} style={({ pressed }) => [styles.next, pressed && styles.pressed]}>
                    <Text style={styles.nextText}>{last ? 'Finish' : 'Next question'}</Text>
                  </Pressable>
                </>
              ) : null}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  sheet: { width: '100%', maxWidth: 540, maxHeight: '88%', backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: radius.lg, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 18 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { ...typo.heading, flex: 1 },
  textBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  textBtnLabel: { fontSize: 17, fontWeight: '600', color: T.accent },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 },
  meta: { fontSize: 13, color: T.muted },
  body: { gap: 14 },
  progress: { flexDirection: 'row', gap: 4 },
  dash: { flex: 1, height: 4, borderRadius: 2, backgroundColor: T.track },
  dashOn: { backgroundColor: T.accent },
  question: { fontSize: 17, lineHeight: 24, fontWeight: '600', color: T.ink },
  answers: { gap: 8 },
  answer: { padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: T.line, backgroundColor: T.ground },
  answerRight: { borderColor: T.done, backgroundColor: '#10261A' },
  answerWrong: { borderColor: T.urgent, backgroundColor: '#24130F' },
  answerText: { fontFamily: mono, fontSize: 14, color: T.ink },
  rightText: { color: T.done },
  wrongText: { color: T.urgent },
  explain: { fontSize: 14, lineHeight: 20, color: T.inkSoft, backgroundColor: T.ground, borderRadius: radius.md, padding: 12, overflow: 'hidden' },
  next: { minHeight: 44, borderRadius: 999, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center' },
  nextText: { fontSize: 15, fontWeight: '600', color: T.onAccent },
  pressed: { opacity: 0.7 },
});
