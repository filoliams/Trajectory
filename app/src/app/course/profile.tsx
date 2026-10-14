import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

import { Button, ErrorText } from '@/components/form';
import { T } from '@/constants/trajectory';
import { PROFILE_LINK, courseInfoUrl, importFromPage, termCode } from '@/lib/api';
import { parseSemester, useStore } from '@/lib/store';

/**
 * Opens a course's UQ page inside the app. UQ blocks downloads from the
 * backend, but this is an ordinary visit from the user's own device: the app
 * opens the right semester's course profile, and "Import assessments" sends
 * the page the user is looking at to the backend to read.
 */
export default function CourseProfileScreen() {
  const params = useLocalSearchParams<{ code: string }>();
  const code = (params.code ?? '').toUpperCase();
  const { profile, saveImportedCourse } = useStore();
  const { year, semester } = parseSemester(profile?.semester ?? '2026 S2');
  const term = termCode(year, semester);

  const webview = useRef<WebView>(null);
  const autoOpened = useRef(false);
  const [startUrl] = useState(() => courseInfoUrl(code));
  const [url, setUrl] = useState(startUrl);
  const [pageLoading, setPageLoading] = useState(true);
  const [noProfile, setNoProfile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const match = PROFILE_LINK.exec(url);
  const onProfile = !!match && match[1] === code;
  const wrongSemester = onProfile && match[2] !== term;

  // Runs after every page load. On the course page it looks for this
  // semester's "Course Profile" link and opens it, so the user lands on the
  // right profile without hunting for it.
  const findProfileScript = useMemo(
    () => `
      (function () {
        if (location.hostname !== 'programs-courses.uq.edu.au') return;
        var pattern = /course-profiles\\.uq\\.edu\\.au\\/course-profiles\\/${code}-\\d+-${term}/;
        var links = Array.prototype.slice.call(document.querySelectorAll('a[href]'));
        var link = links.find(function (a) { return pattern.test(a.href); });
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'profile-link', href: link ? link.href : null }));
      })();
      true;`,
    [code, term],
  );

  function onNavigation(nav: WebViewNavigation) {
    setUrl(nav.url);
    setError(null);
  }

  // Only UQ pages open in here; anything else is blocked. Embedded frames
  // (videos, maps) inside a UQ page are left alone.
  function allowLoad(req: ShouldStartLoadRequest) {
    if (req.isTopFrame === false) return true;
    try {
      const { protocol, hostname } = new URL(req.url);
      if (protocol === 'about:') return true;
      return hostname === 'uq.edu.au' || hostname.endsWith('.uq.edu.au');
    } catch {
      return false;
    }
  }

  async function onMessage(event: WebViewMessageEvent) {
    let msg: { type?: string; href?: string | null; url?: string; html?: string };
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }

    if (msg.type === 'profile-link') {
      // Only jump to the profile the first time; if the user comes back to
      // the course page they can pick a different offering themselves.
      if (autoOpened.current) return;
      autoOpened.current = true;
      if (msg.href) {
        webview.current?.injectJavaScript(`location.href = ${JSON.stringify(msg.href)}; true;`);
      } else {
        setNoProfile(true);
      }
      return;
    }

    if (msg.type === 'page' && msg.url && msg.html) {
      try {
        const imported = await importFromPage(code, msg.url, msg.html);
        if (imported.assessments.length === 0) throw new Error('No assessments were found on this page.');
        await saveImportedCourse(imported);
        router.dismissAll();
        router.push({ pathname: '/course/[code]', params: { code } });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    }
  }

  function importPage() {
    setError(null);
    setBusy(true);
    // Read the page exactly as it's shown, including anything it loaded after opening.
    webview.current?.injectJavaScript(`
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'page', url: location.href, html: document.documentElement.outerHTML
      }));
      true;`);
  }

  let hint: string;
  if (onProfile && wrongSemester) hint = `This profile is for a different semester. Go back and open Semester ${semester}, ${year}.`;
  else if (onProfile) hint = `Check this is ${code} for Semester ${semester}, ${year}, then import.`;
  else if (noProfile) hint = `No Semester ${semester}, ${year} profile is linked yet. Tap a Course Profile link if you can see one.`;
  else hint = `Opening ${code}'s course profile…`;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>{code} course profile</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.close}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>

      <View style={styles.webWrap}>
        <WebView
          ref={webview}
          source={{ uri: startUrl }}
          injectedJavaScript={findProfileScript}
          onMessage={onMessage}
          onNavigationStateChange={onNavigation}
          onShouldStartLoadWithRequest={allowLoad}
          onLoadStart={() => setPageLoading(true)}
          onLoadEnd={() => setPageLoading(false)}
          setSupportMultipleWindows={false}
          style={styles.web}
        />
        {pageLoading ? (
          <View style={styles.loading} pointerEvents="none">
            <ActivityIndicator color={T.ink} />
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Text style={[styles.hint, wrongSemester && styles.warn]}>{hint}</Text>
        <ErrorText>{error}</ErrorText>
        <Button
          title="Import assessments"
          onPress={importPage}
          loading={busy}
          disabled={!onProfile || pageLoading}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.ground },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 },
  title: { fontSize: 20, fontWeight: '700', color: T.ink, flexShrink: 1 },
  close: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  closeText: { fontSize: 16, fontWeight: '600', color: T.accent },
  webWrap: { flex: 1, marginTop: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: T.line },
  web: { flex: 1, backgroundColor: T.surface },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  footer: { gap: 10, padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  hint: { fontSize: 14, lineHeight: 20, color: T.inkSoft },
  warn: { color: T.warn },
});
