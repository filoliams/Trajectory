import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Supabase project details. The publishable key is designed to be public:
 * your database's row-level security rules are what keep each user's data private.
 * Find both in Supabase → the green "Connect" button.
 */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://jarzcxayhjfyffcfcyet.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_JuA6kEDLo-jUP8G17nBjdw_5AId4H4H';

/**
 * Where the Python backend is running. In development this is your PC:
 * Expo already knows your PC's network address (it's in the QR code),
 * so we reuse it with the backend's port, 8000.
 */
function backendUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;

  // In a browser, the backend is on the same computer as the page.
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `http://${window.location.hostname}:8000`;
  }

  // On a phone, use the PC address Expo is already connected to (e.g. 192.168.1.23).
  const candidates = [
    Constants.expoConfig?.hostUri,
    Constants.expoGoConfig?.debuggerHost,
    Constants.linkingUri,
    Constants.experienceUrl,
  ];
  for (const uri of candidates) {
    const host = uri ? /^(?:[a-z]+:\/\/)?([^:/?#]+)/i.exec(uri)?.[1] : undefined;
    if (host && host !== 'localhost' && host !== '127.0.0.1') return `http://${host}:8000`;
  }
  return 'http://localhost:8000';
}

export const API_URL = backendUrl();

/** The semester the app plans for. */
export const CURRENT_YEAR = 2026;
export const UNIVERSITY = 'The University of Queensland';
