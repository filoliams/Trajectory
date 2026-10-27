// Privacy Policy, Terms of Use and Data Consent: the one source for the app's legal screen and
// the landing page's legal pages (frontend/*.html, written by scripts/legal-pages.mjs).
// Import-free so plain node can render and check it.

/** Bump when the wording changes; sign-up saves the version a student agreed to. */
export const LEGAL_VERSION = '2026-10-27';
export const LEGAL_UPDATED = '27 October 2026';

// Fill these in before launch.
export const OPERATOR = '[your full name]';
export const CONTACT_EMAIL = '[contact email]';

export type LegalSlug = 'privacy' | 'terms' | 'data-consent';
export type LegalSection = { heading: string; paragraphs?: string[]; bullets?: string[] };
export type LegalDoc = { slug: LegalSlug; title: string; summary: string; sections: LegalSection[] };

const contact = `If you have a question, want a copy of your information, or want your account or waitlist entry deleted, email ${CONTACT_EMAIL}.`;

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    summary:
      'What Trajectory collects, why, who helps us run it, and how to see or delete your information. The short version: we keep your study plan, not your notes.',
    sections: [
      {
        heading: 'Who we are',
        paragraphs: [
          `Trajectory is a study planner for university students, run by ${OPERATOR} in Queensland, Australia ("we", "us"). This policy covers the Trajectory app (iPhone, iPad, Android and web) and the Trajectory website and waitlist.`,
          'We handle personal information in line with the Australian Privacy Principles in the Privacy Act 1988 (Cth).',
        ],
      },
      {
        heading: 'What we collect',
        paragraphs: ['We only collect what Trajectory needs to work:'],
        bullets: [
          'Waitlist: your email address, your university if you add it, and the web page that linked you to us. Your IP address is held in memory for about a minute to stop spam sign-ups, then forgotten. It is never saved.',
          'Account: your email address and password. Your password is stored scrambled (hashed) by our sign-in provider, so we never see it.',
          'Study details you enter or import: your university, semester, courses, assessments (names, types, weights, due dates and anything you write in them), weekly topics, how many hours a day you want to study, and the time you log with the study timer.',
          'Course profiles you upload: we read the file to pull out your course, assessments and topics. The file itself is not kept.',
          'Notes you choose to add: the file name, the folder name it came from, its size, and a fingerprint (hash) so we can tell when it changes. After analysis we keep, for each topic, a level (none, weak, okay or strong) and a one-line reason. The note file is deleted as soon as it has been read, and the text of your notes is never stored.',
          'Daily plans: the study plan made for you each day.',
          'Service records: whether syncing and note analysis worked, error messages, and how much AI processing each request used (counts only, never content).',
        ],
      },
      {
        heading: 'What we do not collect',
        bullets: [
          'We do not access your OneDrive, iCloud, GoodNotes, OneNote or any folder. We only see files you pick yourself.',
          'We do not collect your location, contacts or photos.',
          'We do not use advertising, analytics or tracking tools, and we never sell your information.',
        ],
      },
      {
        heading: 'How we use it',
        bullets: [
          'To run your account and sync your plan across your devices.',
          'To import your courses and assessments, rate how well your notes cover each topic, and build your daily study plan.',
          'To email you about your account, and, if you joined the waitlist, to tell you when your spot opens. Waitlist emails are about Trajectory only.',
          'To keep Trajectory secure, fix problems and stay within fair-use limits.',
        ],
      },
      {
        heading: 'AI processing',
        paragraphs: [
          'Trajectory uses Claude, an AI model made by Anthropic. Anthropic processes this information for us under its commercial terms, which do not allow it to use our requests to train its models. Claude is used for two things:',
        ],
        bullets: [
          'Note analysis: when you add a note, its contents are sent to Claude to work out which course it belongs to and how well it covers each topic.',
          'Daily plans: your courses, assessments, due dates, topic levels and study hours are sent to Claude to suggest what to study today.',
        ],
      },
      {
        heading: 'Who helps us run Trajectory',
        paragraphs: ['We share information only with the services Trajectory runs on, and only so they can provide that service:'],
        bullets: [
          'Supabase: our database, sign-in, temporary file storage and server functions.',
          'Anthropic: AI note analysis and daily plans, as described above.',
          'Google Fonts: the website loads its fonts from Google, which receives your IP address when the page loads. The app does not.',
        ],
      },
      {
        heading: 'Storage outside Australia',
        paragraphs: [
          'Supabase and Anthropic may store or process your information outside Australia, including in the United States. We choose providers with strong security practices and contracts that limit how they can use your information.',
        ],
      },
      {
        heading: 'How we protect it',
        bullets: [
          'Information travels over encrypted connections (HTTPS).',
          'Each account can only read its own records; this is enforced by the database itself.',
          'Secret keys stay on our servers and are never put in the app.',
          'The app keeps a copy of your plan on your device so it works offline. Signing out of the app removes your session from that device.',
        ],
      },
      {
        heading: 'How long we keep it',
        bullets: [
          'Note files: deleted as soon as they have been read.',
          'Account and study information: until you delete your account.',
          'Waitlist entries: until you ask to be removed or we stop running the waitlist.',
        ],
      },
      {
        heading: 'Your rights',
        paragraphs: [
          'You can ask to see the personal information we hold about you, correct it, or delete it. Most study details can be edited or deleted in the app itself.',
          `${contact} We will reply within 30 days.`,
          'If you are not happy with our reply, you can complain to the Office of the Australian Information Commissioner at oaic.gov.au.',
        ],
      },
      {
        heading: 'Age',
        paragraphs: [
          'Trajectory is for people aged 16 and over. If you are under 16, you may only use Trajectory with the permission of a parent or guardian.',
        ],
      },
      {
        heading: 'Changes to this policy',
        paragraphs: [
          'If we change this policy in a way that matters, we will tell you in the app or by email before the change applies. The date at the top shows when it last changed.',
        ],
      },
    ],
  },
  {
    slug: 'terms',
    title: 'Terms of Use',
    summary: 'The agreement between you and Trajectory when you use the app, the website or the waitlist.',
    sections: [
      {
        heading: 'Agreeing to these terms',
        paragraphs: [
          `These terms are an agreement between you and ${OPERATOR}, who runs Trajectory. By creating an account or joining the waitlist, you agree to these terms, the Privacy Policy and the Data Consent. If you do not agree, please do not use Trajectory.`,
        ],
      },
      {
        heading: 'Who can use Trajectory',
        paragraphs: [
          'You must be 16 or older, or have permission from a parent or guardian who agrees to these terms for you.',
        ],
      },
      {
        heading: 'Early access',
        paragraphs: [
          'Trajectory is in early access. It is free for now, features may change or be removed, and there may be bugs. We may limit how much you can use it, such as how many notes can be analysed each day or how large a file can be. We will give reasonable notice before Trajectory stops being free, and you will never be charged without agreeing first.',
        ],
      },
      {
        heading: 'Your account',
        paragraphs: [
          'Keep your password private and tell us if you think someone else has used your account. You are responsible for what happens in your account.',
        ],
      },
      {
        heading: 'Your content',
        paragraphs: [
          'You own your notes, course details and everything else you add. You give us permission to store and process it only as needed to run Trajectory for you, as described in the Privacy Policy. That permission ends when you delete it or your account.',
          "Only add notes and files you have the right to use. Do not upload other people's personal information.",
        ],
      },
      {
        heading: 'Fair use',
        paragraphs: ['Please do not:'],
        bullets: [
          'try to access other accounts or data that is not yours;',
          'interfere with, overload or probe Trajectory for weaknesses (if you find a security problem, please tell us instead);',
          'use automated tools to sign up, scrape or send large numbers of requests;',
          'upload anything unlawful, harmful or that you do not have the right to share.',
        ],
      },
      {
        heading: 'Check your dates',
        paragraphs: [
          'Trajectory reads course profiles and notes for you, and its AI ratings and study plans are estimates. They can be wrong or out of date. Your university is the official source for assessment details, weightings and due dates. Always check them there, and use your own judgement about what to study.',
        ],
      },
      {
        heading: 'Universities',
        paragraphs: [
          'Trajectory is independent. It is not made, endorsed or supported by The University of Queensland or any other university.',
        ],
      },
      {
        heading: 'Ending your use',
        paragraphs: [
          `You can stop using Trajectory at any time and ask us to delete your account by emailing ${CONTACT_EMAIL}. We may suspend or close an account that breaks these terms, and will tell you why unless the law or safety prevents it.`,
        ],
      },
      {
        heading: 'Our responsibility',
        paragraphs: [
          'Nothing in these terms limits your rights under the Australian Consumer Law or any other law that cannot be excluded.',
          'Apart from those rights, Trajectory is provided as it is, and to the extent the law allows, we are not responsible for missed deadlines, marks or results, or for indirect loss, arising from your use of Trajectory.',
        ],
      },
      {
        heading: 'Changes and governing law',
        paragraphs: [
          'We may update these terms. If a change matters, we will tell you in the app or by email before it applies, and continuing to use Trajectory after that means you accept the new terms.',
          'These terms are governed by the laws of Queensland, Australia.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: [`Questions about these terms: ${CONTACT_EMAIL}.`],
      },
    ],
  },
  {
    slug: 'data-consent',
    title: 'Data Consent',
    summary:
      'What you agree to when you create an account or join the waitlist, in plain terms, and how to change your mind.',
    sections: [
      {
        heading: 'When you join the waitlist, you agree that',
        bullets: [
          'we store your email address, your university if you add it, and the page that linked you to us;',
          'we may email you about Trajectory, such as when your spot opens. You can ask us to stop at any time.',
        ],
      },
      {
        heading: 'When you create an account, you agree that',
        bullets: [
          'we store the study details you add or import (courses, assessments, topics, study hours and study time) so Trajectory can plan your study and sync it across your devices;',
          'when you add a note, its contents are sent to Anthropic\'s Claude AI to rate how well it covers each topic. We keep only the rating and a one-line reason for each topic, and delete the note file as soon as it has been read;',
          'your courses, assessments, topic ratings and study hours are sent to Claude to make your daily plan;',
          'Supabase and Anthropic may store or process this information outside Australia, including in the United States, as explained in the Privacy Policy.',
        ],
      },
      {
        heading: 'What we will never do',
        bullets: [
          'look through your files, folders or note apps. We only see files you pick;',
          'keep the text of your notes;',
          'sell your information or use it for advertising.',
        ],
      },
      {
        heading: 'Changing your mind',
        paragraphs: [
          'Agreeing is your choice, but Trajectory cannot work without it. You can withdraw at any time:',
        ],
        bullets: [
          'To stop AI note analysis, simply stop adding notes. Nothing is sent unless you add a note. Your plan then uses topic names only.',
          `To withdraw entirely, email ${CONTACT_EMAIL} and we will delete your account or waitlist entry and the information linked to it within 30 days.`,
        ],
      },
      {
        heading: 'Our record of your consent',
        paragraphs: [
          'When you create an account, we save the date you agreed and which version of these documents you saw. If these documents change in a way that matters, we will ask you again.',
        ],
      },
    ],
  },
];

export function legalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A complete, standalone web page for one document, styled like the landing page. */
export function legalHtml(doc: LegalDoc): string {
  const sections = doc.sections
    .map((s) => {
      const ps = (s.paragraphs ?? []).map((p) => `      <p>${escape(p)}</p>`);
      const list = s.bullets?.length ? [`      <ul>`, ...s.bullets.map((b) => `        <li>${escape(b)}</li>`), `      </ul>`] : [];
      return [`    <section>`, `      <h2>${escape(s.heading)}</h2>`, ...ps, ...list, `    </section>`].join('\n');
    })
    .join('\n');
  const others = LEGAL_DOCS.filter((d) => d.slug !== doc.slug)
    .map((d) => `<a href="${d.slug}.html">${escape(d.title)}</a>`)
    .join('\n      ');
  return `<!doctype html>
<!-- Generated from app/src/lib/legal.ts by app/scripts/legal-pages.mjs. Edit that file, not this one. -->
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(doc.title)} · Trajectory</title>
  <meta name="description" content="${escape(doc.summary)}">
  <link rel="icon" href="icon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=IBM+Plex+Sans:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root { --ground: #F5F1E6; --surface: #FCF9F1; --ink: #1C3A3A; --ink-soft: #36504E; --muted: #5B6E6B; --line: #E2DAC7; --accent: #EE8162; color-scheme: light; }
    @media (prefers-color-scheme: dark) {
      :root:not([data-theme="light"]) { --ground: #102221; --surface: #18302F; --ink: #F1ECD9; --ink-soft: #D2D3C5; --muted: #9CB0AC; --line: #2A4443; color-scheme: dark; }
    }
    :root[data-theme="dark"] { --ground: #102221; --surface: #18302F; --ink: #F1ECD9; --ink-soft: #D2D3C5; --muted: #9CB0AC; --line: #2A4443; color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--ground); color: var(--ink-soft); font: 400 16px/1.65 "IBM Plex Sans", system-ui, -apple-system, sans-serif; }
    .wrap { max-width: 720px; margin: 0 auto; padding: 0 16px; }
    nav { display: flex; align-items: center; justify-content: space-between; padding-block: 22px; }
    .logo { display: flex; align-items: center; gap: 9px; color: var(--ink); text-decoration: none; font: 700 20px "Space Grotesk", "Helvetica Neue", Arial, sans-serif; }
    .logo img { width: 34px; height: 34px; border-radius: 9px; }
    nav > a:last-child { color: var(--muted); font-size: 14px; }
    h1, h2 { color: var(--ink); font-family: "Space Grotesk", "Helvetica Neue", Arial, sans-serif; letter-spacing: -.02em; text-wrap: balance; }
    h1 { font-size: clamp(34px, 7vw, 48px); line-height: 1.05; margin: 28px 0 10px; }
    h2 { font-size: 21px; line-height: 1.25; margin: 0 0 8px; }
    .updated { color: var(--muted); font-size: 14px; margin: 0 0 20px; }
    .summary { background: var(--surface); border: 1px solid var(--line); border-left: 4px solid var(--accent); border-radius: 14px; padding: 16px 18px; color: var(--ink); margin: 0 0 36px; }
    section { margin-bottom: 30px; }
    p { margin: 0 0 12px; }
    ul { margin: 0 0 12px; padding-left: 22px; }
    li { margin-bottom: 8px; }
    a { color: inherit; }
    footer { border-top: 1px solid var(--line); margin-top: 48px; padding-block: 24px 40px; display: flex; flex-wrap: wrap; gap: 8px 20px; color: var(--muted); font-size: 14px; }
  </style>
</head>
<body>
  <div class="wrap">
    <nav>
      <a class="logo" href="./" aria-label="Trajectory home"><img src="icon.svg" alt="" width="34" height="34">Trajectory</a>
      <a href="./#join">Join the waitlist</a>
    </nav>
    <h1>${escape(doc.title)}</h1>
    <p class="updated">Last updated ${LEGAL_UPDATED}</p>
    <p class="summary">${escape(doc.summary)}</p>
${sections}
    <footer>
      <a href="./">Home</a>
      ${others}
    </footer>
  </div>
</body>
</html>
`;
}
