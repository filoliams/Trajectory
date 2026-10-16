from datetime import date, timedelta

from notes.footprint import assessment_multiplier, build_course_footprint
from notes.models import ContentDepth as D, Level, PageReading, PageRecord, TopicEvidence

TODAY = date(2026, 10, 16)


def page(i, topics, days_ago=3, course="STAT2201", notebook="STAT2201 Lectures.pdf"):
    return PageRecord(
        notebook=notebook, page_index=i, page_hash=f"h{i}", course_code=course,
        seen_on=TODAY - timedelta(days=days_ago),
        reading=PageReading(course_code=course, topics=topics),
    )


def ev(topic, depth, attempted=0, correct=0, incorrect=0, unfinished=False):
    return TopicEvidence(topic=topic, depth=depth, practice_attempted=attempted,
                         practice_correct=correct, practice_incorrect=incorrect,
                         unfinished=unfinished)


def stat2201_pages():
    return [
        # Hypothesis testing: notes + 12 problems, mostly right, recent
        page(0, [ev("Hypothesis testing", D.detailed_notes)], 6),
        page(1, [ev("Hypothesis testing", D.worked_example)], 6),
        page(2, [ev("Hypothesis testing", D.brief_notes, 6, 5, 1)], 4),
        page(3, [ev("Hypothesis testing", D.brief_notes, 6, 5, 1)], 4),
        # Linear regression: three pages of notes, no practice
        page(4, [ev("Linear regression", D.brief_notes)], 10),
        page(5, [ev("Linear regression", D.brief_notes)], 10),
        page(6, [ev("Linear regression", D.brief_notes)], 10),
        # Confidence intervals: headings only
        page(7, [ev("Confidence intervals", D.heading_only)], 12),
        # Residual analysis: good notes, no practice
        page(8, [ev("Residual analysis", D.detailed_notes)], 5),
        page(9, [ev("Residual analysis", D.worked_example)], 5),
    ]


def test_labels_match_intuition():
    fp = build_course_footprint("STAT2201", stat2201_pages(), today=TODAY)
    by = {t.topic: t for t in fp.topics}
    assert by["Hypothesis testing"].level == Level.strong
    assert by["Hypothesis testing"].evidence == "4 pages, 12 practice problems, mostly right"
    assert by["Confidence intervals"].level == Level.weak
    assert by["Confidence intervals"].evidence == "Headings only"
    assert by["Linear regression"].level == Level.weak
    assert by["Linear regression"].evidence == "3 pages, no practice problems"
    # Good notes but no practice can't be Strong
    assert by["Residual analysis"].level == Level.okay


def test_syllabus_gaps_show_as_weak():
    fp = build_course_footprint("STAT2201", stat2201_pages(),
                                syllabus_topics=["Probability distributions", "Hypothesis testing"],
                                today=TODAY)
    gap = next(t for t in fp.topics if t.topic == "Probability distributions")
    assert gap.level == Level.weak and gap.evidence == "Not in your notes yet"
    # Name matching ignores case so syllabus and notes don't duplicate
    assert sum(t.topic.lower() == "hypothesis testing" for t in fp.topics) == 1


def test_old_material_fades():
    fresh = build_course_footprint("X", [page(0, [ev("T", D.detailed_notes, 8, 7, 1)], 2, "X")], today=TODAY)
    stale = build_course_footprint("X", [page(0, [ev("T", D.detailed_notes, 8, 7, 1)], 70, "X")], today=TODAY)
    assert fresh.topics[0].score > stale.topics[0].score
    assert "last touched 10 weeks ago" in stale.topics[0].evidence


def test_mostly_wrong_practice_is_not_strong():
    fp = build_course_footprint("X", [
        page(0, [ev("T", D.detailed_notes)], 2, "X"),
        page(1, [ev("T", D.worked_example, 8, 1, 7)], 2, "X"),
    ], today=TODAY)
    assert fp.topics[0].level == Level.weak
    assert "mostly wrong" in fp.topics[0].evidence


def test_unfinished_notes_flagged_until_finished():
    half = build_course_footprint("X", [page(0, [ev("Phase-line stability", D.brief_notes, unfinished=True)], 2, "X")], today=TODAY)
    assert half.topics[0].evidence.startswith("Notes stop partway through")
    done = build_course_footprint("X", [
        page(0, [ev("Phase-line stability", D.brief_notes, unfinished=True)], 2, "X"),
        page(1, [ev("Phase-line stability", D.detailed_notes)], 1, "X"),
        page(2, [ev("Phase-line stability", D.worked_example)], 1, "X"),
    ], today=TODAY)
    assert not done.topics[0].evidence.startswith("Notes stop")


def test_course_without_notes_is_none_and_neutral():
    fp = build_course_footprint("MECH2100", [], syllabus_topics=["Bolted joints"], today=TODAY)
    assert fp.level == Level.none and fp.summary == "No notes yet"
    assert fp.weakness_multiplier == 1.0


def test_assessment_multiplier_uses_covered_topics():
    fp = build_course_footprint("STAT2201", stat2201_pages(), today=TODAY)
    regression = assessment_multiplier(fp, ["Linear regression", "Residual analysis"])
    hypothesis = assessment_multiplier(fp, ["Hypothesis testing"])
    assert regression > hypothesis           # weak topics push the assignment up
    assert assessment_multiplier(fp, None) == fp.weakness_multiplier
