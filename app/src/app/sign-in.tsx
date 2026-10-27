import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ErrorText, Field, Segmented } from '@/components/form';
import { T, radius, typo } from '@/constants/trajectory';
import { LEGAL_VERSION, type LegalSlug } from '@/lib/legal';
import { supabase } from '@/lib/supabase';

type Mode = 'sign_in' | 'sign_up';

export default function SignInScreen() {
  const [mode, setMode] = useState<Mode>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setNotice(null);
    if (!email.includes('@')) return setError('Enter your email address.');
    if (password.length < 6) return setError('Passwords need at least 6 characters.');
    if (mode === 'sign_up' && !agreed) return setError('Tick the box to agree to the terms before creating your account.');
    setBusy(true);
    try {
      if (mode === 'sign_in') {
        const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (e) setError(e.message);
      } else {
        // Saved on the account as the record of what the student agreed to, and when.
        const { data, error: e } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { legal_version: LEGAL_VERSION, legal_accepted_at: new Date().toISOString() } },
        });
        if (e) setError(e.message);
        else if (!data.session) {
          setNotice('Check your email for a confirmation link, then come back and sign in.');
          setMode('sign_in');
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Check your internet connection.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Text style={styles.logo}>Trajectory</Text>
            <Text style={styles.tagline}>Know what to study next, every day.</Text>
          </View>

          <Segmented
            options={[
              { value: 'sign_in', label: 'Sign in' },
              { value: 'sign_up', label: 'Create account' },
            ]}
            value={mode}
            onChange={(m) => {
              setMode(m);
              setError(null);
            }}
          />

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'sign_in' ? 'current-password' : 'new-password'}
            textContentType={mode === 'sign_in' ? 'password' : 'newPassword'}
            placeholder="At least 6 characters"
            onSubmitEditing={submit}
          />

          {mode === 'sign_up' ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreed }}
              onPress={() => setAgreed((a) => !a)}
              style={styles.consent}>
              <View style={[styles.box, agreed && styles.boxOn]}>{agreed ? <Text style={styles.tick}>✓</Text> : null}</View>
              <Text style={styles.consentText}>
                I agree to the <LegalLink slug="terms">Terms of Use</LegalLink>, <LegalLink slug="privacy">Privacy Policy</LegalLink> and{' '}
                <LegalLink slug="data-consent">Data Consent</LegalLink>, including AI analysis of notes I add.
              </Text>
            </Pressable>
          ) : null}

          <ErrorText>{error}</ErrorText>
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <Button title={mode === 'sign_in' ? 'Sign in' : 'Create account'} onPress={submit} loading={busy} />

          {mode === 'sign_in' ? (
            <Text style={styles.legal}>
              <LegalLink slug="privacy">Privacy Policy</LegalLink>
              {'  ·  '}
              <LegalLink slug="terms">Terms of Use</LegalLink>
              {'  ·  '}
              <LegalLink slug="data-consent">Data Consent</LegalLink>
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LegalLink({ slug, children }: { slug: LegalSlug; children: string }) {
  return (
    <Text accessibilityRole="link" style={styles.link} onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: slug } })}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.ground },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16, maxWidth: 480, width: '100%', alignSelf: 'center' },
  brand: { gap: 6, marginBottom: 16 },
  logo: { ...typo.display, fontSize: 48, letterSpacing: -1.8 },
  tagline: { fontSize: 16, color: T.muted },
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: T.lineStrong, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  boxOn: { backgroundColor: T.accent, borderColor: T.accent },
  tick: { color: T.onAccent, fontSize: 14, fontWeight: '700' },
  consentText: { flex: 1, fontSize: 14, lineHeight: 20, color: T.muted },
  link: { color: T.ink, fontWeight: '600', textDecorationLine: 'underline' },
  legal: { fontSize: 13, color: T.muted, textAlign: 'center' },
  notice: { fontSize: 14, lineHeight: 20, color: T.accentDark, backgroundColor: T.accentSoft, padding: 12, borderRadius: radius.md, overflow: 'hidden' },
});
