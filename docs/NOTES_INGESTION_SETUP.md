# Note ingestion setup (ingest-core)

One-time steps to put the note-ingestion functions live. Spec: [SPEC-ingest-core.md](../SPEC-ingest-core.md).
Run the commands in a terminal in the `Trajectory` folder. `npx supabase` downloads the Supabase CLI
on first use, so nothing needs installing globally.

## 1. Run the migration

Supabase → **SQL Editor** → **New query** → paste the contents of
`supabase/migrations/20261021000000_note_ingestion.sql` → **Run**.
You should see "Success. No rows returned".

The app keeps working before and after this step.

## 2. Link the project (once)

```
npx supabase login
npx supabase link --project-ref jarzcxayhjfyffcfcyet
```

`login` opens a browser window to sign in.

## 3. Add the Anthropic API key (as a server secret, never in the app)

Create a key at <https://console.anthropic.com> → **API keys**, then:

```
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

Set a monthly spend limit in the Anthropic console too. For a handful of testers, $20 is plenty.

## 4. Deploy the functions

```
npx supabase functions deploy notes-check notes-ingest
```

**Two things to watch on the first deploy. I couldn't test either of these from here:**
- **401 "Invalid JWT" from the gateway** before the function even runs (this can happen on projects
  using the new publishable/secret API keys). Redeploy with
  `npx supabase functions deploy notes-check notes-ingest --no-verify-jwt`. Both functions still
  check the caller's sign-in themselves (`asCaller`), so this doesn't open them up.
- **"SUPABASE_URL and SUPABASE_ANON_KEY must be set"** in the function logs. Run
  `npx supabase secrets set SUPABASE_ANON_KEY=<your publishable key>`. The publishable key is the
  same one in `app/src/config.ts`.

## 5. Run the live check

This costs two small Claude calls, a few cents. Run it in PowerShell:

```
$env:SUPABASE_URL="https://jarzcxayhjfyffcfcyet.supabase.co"
$env:SUPABASE_KEY="<publishable key>"
$env:TEST_EMAIL="<test account email>"; $env:TEST_PASSWORD="<password>"
node supabase/tests/ingest-live.mjs
```

Optional extras:
- `$env:OTHER_EMAIL` / `$env:OTHER_PASSWORD` for a second account, to prove it can't see the first
  account's notes.
- `$env:PDF_PATH="C:\path\to\a GoodNotes backup.pdf"` to time a real 30–50 page handwritten PDF
  against the Edge Function time limit. This costs about $0.30.

The test account needs MATH1051 with a few topics; the existing test account already has them.

## Where to look when something fails

- **Function logs:** Supabase → **Edge Functions** → `notes-ingest` → **Logs**. Logs contain ids,
  sizes and token counts, never note text.
- **Per-file errors:** the `documents` table's `status` and `error` columns.
- **Every run, with token usage:** the `sync_jobs` table.
