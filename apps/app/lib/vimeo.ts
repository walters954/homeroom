import { env } from "@homeroom/env";

interface VimeoTextTrack {
  uri: string;
  active: boolean;
  language: string;
  link: string;
  type: string;
}

/**
 * Fetch caption/transcript VTT for a Vimeo video.
 * Prefers an active English track, falls back to any track.
 */
export async function fetchVimeoCaptions(
  videoId: string,
): Promise<{ vtt: string; language: string } | { error: string }> {
  if (!env.VIMEO_ACCESS_TOKEN) {
    return { error: "VIMEO_ACCESS_TOKEN is not configured." };
  }

  const res = await fetch(
    `https://api.vimeo.com/videos/${encodeURIComponent(videoId)}/texttracks`,
    {
      headers: {
        Authorization: `Bearer ${env.VIMEO_ACCESS_TOKEN}`,
        Accept: "application/vnd.vimeo.*+json;version=3.4",
      },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    return { error: `Vimeo API error ${res.status}: ${await res.text()}` };
  }

  const data = (await res.json()) as { data: VimeoTextTrack[] };
  const tracks = data.data ?? [];
  if (tracks.length === 0) {
    return {
      error:
        "No caption tracks on this Vimeo video. Enable auto-captions in Vimeo (or upload captions), then retry.",
    };
  }

  const track =
    tracks.find((t) => t.active && t.language.startsWith("en")) ??
    tracks.find((t) => t.active) ??
    tracks[0];

  const vttRes = await fetch(track.link, { cache: "no-store" });
  if (!vttRes.ok) {
    return { error: `Failed to download caption file (${vttRes.status}).` };
  }

  return { vtt: await vttRes.text(), language: track.language ?? "en" };
}
