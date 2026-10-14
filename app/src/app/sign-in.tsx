import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ErrorText, Field, Segmented } from '@/components/form';
import { T } from '@/constants/trajectory';
import { supabase } from '@/lib/supabase';

type Mode = 'sign_in' | 'sign_up';

export default function SignInScreen() {
  const [mode, setMode] = useState<Mode>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setNotice(null);
    if (!email.includes('@')) return setError('Enter your email address.');
    if (password.length < 6) return setError('Passwords need at least 6 characters.');
    setBusy(true);
    try {
      if (mode === 'sign_in') {
        const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (e) setError(e.message);
      } else {
        const { data, error: e } = await supabase.auth.signUp({ email: email.trim(), password });
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

          <ErrorText>{error}</ErrorText>
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <Button title={mode === 'sign_in' ? 'Sign in' : 'Create account'} onPress={submit} loading={busy} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.ground },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16, maxWidth: 480, width: '100%', alignSelf: 'center' },
  brand: { gap: 6, marginBottom: 16 },
  logo: { fontSize: 36, fontWeight: '700', color: T.ink, letterSpacing: -0.8 },
  tagline: { fontSize: 16, color: T.muted },
  notice: { fontSize: 14, lineHeight: 20, color: T.accentDark, backgroundColor: T.accentSoft, padding: 12, borderRadius: 12, overflow: 'hidden' },
});
