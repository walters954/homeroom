export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

function timestampToSeconds(ts: string): number {
  const parts = ts.trim().split(":");
  const seconds = parseFloat(parts.pop() ?? "0");
  const minutes = parseInt(parts.pop() ?? "0", 10);
  const hours = parseInt(parts.pop() ?? "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
}

/** Parse WebVTT caption content into plain text + timed segments. */
export function parseVtt(vtt: string): {
  text: string;
  segments: TranscriptSegment[];
} {
  const segments: TranscriptSegment[] = [];
  const blocks = vtt.replace(/\r/g, "").split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    const timingIdx = lines.findIndex((l) => l.includes("-->"));
    if (timingIdx === -1) continue;

    const [startRaw, endRaw] = lines[timingIdx].split("-->");
    const text = lines
      .slice(timingIdx + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (!text) continue;

    segments.push({
      start: timestampToSeconds(startRaw),
      end: timestampToSeconds(endRaw.split(" ")[0] ?? endRaw),
      text,
    });
  }

  // Collapse consecutive duplicate lines (common in auto-captions).
  const deduped = segments.filter(
    (s, i) => i === 0 || s.text !== segments[i - 1].text,
  );

  return {
    text: deduped.map((s) => s.text).join(" "),
    segments: deduped,
  };
}
