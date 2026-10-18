# Study Tracker

A study tracker app that keeps track of your courses and assessments, reads your notes to gauge progress in each subject, and recommends what to work on first and how much time to spend.

## Features (planned)

- **Onboarding** – pick your university and courses on first launch
- **Assessment import** – pull assessments automatically from online course profiles instead of entering them by hand
- **Notes import** – connect notes from GoodNotes, Obsidian and OneNote
- **AI progress analysis** – reads your notes to estimate how far along you are in each subject
- **Study recommendations** – prioritises tasks and allocates more time to subjects that need it

## Getting started

### Prerequisites

- Git
- _Add your runtime here (e.g. Python 3.12 or Node 20)_

### Setup

```bash
git clone https://github.com/<your-username>/study-tracker.git
cd study-tracker
```

Copy the example environment file and fill in your own keys:

```bash
copy .env.example .env
```

_Add install and run commands here once the backend is set up._

## Project structure

```
study-tracker/
├── .env.example     # Template for environment variables
├── .gitignore
└── README.md
```

## Roadmap

- [x] Backend setup
- [x] Course and assessment data model
- [x] Frontend / onboarding flow
- [x] Notes import from Markdown and text files (Obsidian vaults, exported notes)
- [x] Study time recommendations (daily plan sized by your study hours; courses with weaker notes get more time)
- [ ] Notes import straight from cloud folders (OneDrive, Google Drive) and GoodNotes PDFs
- [ ] AI progress analysis (today: notes coverage of each course's topics)
