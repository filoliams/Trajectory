// POST /api/waitlist on Vercel: the same job as the backend's endpoint in backend/main.py,
// so the landing page's forms work when frontend/ is deployed on its own.
// Needs SUPABASE_URL and SUPABASE_SECRET_KEY set in the Vercel project's environment variables;
// the key stays on the server and never reaches the page.

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Simple per-IP limit so a script can't flood the waitlist table. In-memory, so it only
// holds within one warm function instance; the honeypot and unique emails do the rest.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;
const recentSignups = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const hits = (recentSignups.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  const limited = hits.length >= RATE_LIMIT;
  if (!limited) hits.push(now);
  recentSignups.set(ip, hits);
  return limited;
}

const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ detail: 'Use POST to join the waitlist.' });
  }

  let body = req.body ?? {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  // Honeypot: hidden on the page, so only bots fill it in. Pretend it worked.
  if (text(body.website, 200)) return res.status(201).json({ ok: true });

  const email = text(body.email, 254).toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(422).json({ detail: 'Please enter a valid email address.' });

  const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ detail: 'Too many sign-ups. Try again in a minute.' });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error('Waitlist: SUPABASE_URL or SUPABASE_SECRET_KEY is not set');
    return res.status(500).json({ detail: 'Something went wrong. Please try again.' });
  }

  const row = {
    email,
    university: text(body.university, 120) || null,
    referrer: text(req.headers.referer, 500) || null,
  };
  try {
    // Ignore duplicates so signing up twice is harmless and doesn't reveal who's already on the list.
    const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/waitlist?on_conflict=email`, {
      method: 'POST',
      headers: {
        apikey: key,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify(row),
    });
    if (!r.ok) throw new Error(`Supabase replied ${r.status}: ${(await r.text()).slice(0, 300)}`);
  } catch (err) {
    // Public endpoint: log the real cause, show visitors a plain message.
    console.error('Waitlist insert failed:', err);
    return res.status(500).json({ detail: 'Something went wrong. Please try again.' });
  }
  return res.status(201).json({ ok: true });
}
