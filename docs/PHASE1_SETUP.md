# Phase 1 setup

Steps to run once, after Claude wrote the Phase 1 code.

## 1. Update the database (Supabase)

Supabase → **SQL Editor** → **New query** → paste the contents of
`supabase/migrations/20261015000000_phase1.sql` → **Run**.
You should see "Success. No rows returned".

For easier testing, also turn off email confirmation:
Supabase → **Authentication** → **Sign In / Providers** → **Email** → turn off **Confirm email** → Save.
(Turn it back on before other people use the app.)

## 2. Install the new app packages

In a terminal (not the one running Expo):

```
cd "C:\Users\liams\OneDrive\Desktop\Trajectory\app"
npx expo install @supabase/supabase-js expo-sqlite
```

## 3. Start the backend so your phone can reach it

```
cd "C:\Users\liams\OneDrive\Desktop\Trajectory\backend"
.venv\Scripts\activate
python -m uvicorn main:app --reload --host 0.0.0.0
```

`--host 0.0.0.0` lets your iPhone/iPad reach the backend over Wi-Fi.
If Windows Firewall asks, click **Allow** (private networks).

## 4. Start the app

```
cd "C:\Users\liams\OneDrive\Desktop\Trajectory\app"
npx expo start -c
```

Scan the QR code with your iPhone/iPad camera.

## Running the importer tests (optional)

```
cd "C:\Users\liams\OneDrive\Desktop\Trajectory\backend"
.venv\Scripts\activate
pip install pytest
python -m pytest
```

## What the app does now

- Email + password accounts (Supabase Auth). Each person only sees their own data.
- Onboarding: pick the semester, then add courses by code. The backend reads the UQ course
  profile and imports assessments, weightings and due dates. Weekly quizzes become separate
  items; "Week 9"-style dates and exam periods are flagged **Check date**.
- If a course can't be found: paste its course profile link, or add it by hand.
- Courses tab: + to add more courses; tap a course for its priority list.
- Course page: tap any assessment to edit it (name, date, weighting, hours, type, status,
  hurdle) or delete it; **+ Add** for your own; **Start** / **Mark done** buttons;
  **Edit** (top right) to rename or remove the course.
- Today: the highest-priority work across all courses, with Start / Mark done.
