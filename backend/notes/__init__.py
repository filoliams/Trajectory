"""Notes pipeline: read GoodNotes exports and score each topic Strong / Okay / Weak.

Flow:
    goodnotes.py  find notebook PDFs, render pages, spot which pages changed
    reader.py     send changed pages to a vision model, get structured evidence
    footprint.py  turn evidence into a per-topic Strong / Okay / Weak footprint
    store.py      remember page hashes and evidence (local JSON or Supabase)
    pipeline.py   glue: scan a folder end to end
    router.py     FastAPI routes the app calls
"""
