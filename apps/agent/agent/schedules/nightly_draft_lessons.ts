import { defineSchedule } from "eve/schedules";

/**
 * Nightly content ops (07:00 UTC ≈ 2–3am US Eastern): turn transcripts the
 * creator uploaded during the day into lesson drafts waiting for approval.
 * Nothing publishes — every draft lands in the suggestion queue with its
 * evidence.
 */
export default defineSchedule({
  cron: "0 7 * * *",
  markdown: `Run tonight's content ops pass.

1. Call \`find_undrafted_lessons\` (limit 5) to get lessons that have a transcript but no written body and no draft already waiting.
2. If it returns zero lessons, stop — do nothing and report that there was no work.
3. Otherwise, for each lesson returned, follow the \`draft_lesson_from_transcript\` skill: read the lesson with \`get_lesson\`, draft the body and SEO metadata in the instructor's own voice using only what the transcript actually contains, then file it with \`file_suggestion\` (type LESSON_DRAFT) including the transcript evidence.

Draft one lesson at a time and finish each before starting the next. Never publish anything directly — the creator approves every draft.`,
});
