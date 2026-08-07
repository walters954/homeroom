import type { VideoProvider } from "@homeroom/db";

const EMBED_URLS: Record<Exclude<VideoProvider, "NONE">, (id: string) => string> = {
  VIMEO: (id) => `https://player.vimeo.com/video/${id}`,
  YOUTUBE: (id) => `https://www.youtube-nocookie.com/embed/${id}`,
  MUX: (id) => `https://player.mux.com/${id}`,
};

export function VideoEmbed({
  provider,
  videoId,
  title,
}: {
  provider: VideoProvider;
  videoId: string | null;
  title: string;
}) {
  if (provider === "NONE" || !videoId) return null;
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-ink">
      <iframe
        src={EMBED_URLS[provider](videoId)}
        title={title}
        className="absolute inset-0 h-full w-full"
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
      />
    </div>
  );
}
