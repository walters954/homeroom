# Draft a lesson from a video transcript

When the creator asks you to draft a lesson from a video:

1. Fetch the lesson with `get_lesson`. If it has no transcript, stop and
   report that the transcript pipeline hasn't run for it yet.
2. Read the full transcript. Identify the 3–7 core teaching points in the
   order they are taught.
3. Draft the lesson body: a short intro paragraph, one section per teaching
   point (with timestamps when segments exist), and a summary of key
   takeaways. Match the instructor's voice from the transcript — do not
   formalize casual explanations into textbook prose.
4. Draft SEO metadata: a title under 60 characters and a description under
   155 characters, both from what the lesson actually teaches.
5. File one `file_suggestion` of type `LESSON_DRAFT` with the body and SEO
   fields in the payload, and the transcript excerpts you drew from in the
   evidence.

Never publish directly. The creator approves every draft.
