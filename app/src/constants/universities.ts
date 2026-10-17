/** One step of a university's "how to download your course profile" guide. */
export type GuideStep = { title: string; body: string; link?: { label: string; url: string } };

export type University = {
  id: string;
  name: string;
  /** What the university calls the document, e.g. "course profile". */
  profileName: string;
  /** Steps for getting a course profile the backend can read, for a semester like "Semester 2, 2026". */
  guide: (semesterLabel: string) => GuideStep[];
  /** A short extra note under the guide. */
  guideTip?: string;
};

/** Universities whose course profiles the backend can read. Add more here as their parsers are built. */
export const UNIVERSITIES: University[] = [
  {
    id: 'uq',
    name: 'The University of Queensland',
    profileName: 'course profile',
    guide: (semesterLabel) => [
      {
        title: 'Find your course',
        body: 'Search for the course code on UQ Programs and Courses.',
        link: { label: 'Open UQ Programs and Courses ↗', url: 'https://programs-courses.uq.edu.au/' },
      },
      {
        title: 'Open the course profile',
        body: `Under Course offerings, find ${semesterLabel} and tap Course Profile.`,
      },
      {
        title: 'Go to the Assessment tab',
        body: 'Only the tab you have open gets saved, so switch to Assessment first.',
      },
      {
        title: 'Save it as a PDF',
        body:
          'On a computer, press Ctrl+P (⌘P on a Mac) and choose Save as PDF. ' +
          'On a phone, tap Share, then Print, then save the PDF to your files.',
      },
      {
        title: 'Upload it here',
        body: 'Drop the PDF in the box. Repeat for each course you are taking.',
      },
    ],
    guideTip: 'A page saved with Ctrl+S (⌘S) as an .html file works too.',
  },
];

/** "2026 S2" → "Semester 2, 2026" */
export function semesterLabel(semester: string): string {
  const m = /^(\d{4})\s*S([12])$/.exec(semester);
  return m ? `Semester ${m[2]}, ${m[1]}` : semester;
}
