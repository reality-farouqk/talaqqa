import meta from '../../content/meta/videos.json';

// YouTube metadata cached by scripts/metadata.mjs (refreshed weekly). Videos added since the
// last refresh have no entry yet and are treated as playable.
export interface VideoMeta { status: 'ok' | 'private' | 'removed' | 'not_embeddable'; duration?: number; published?: string; }
const videos = meta.videos as Record<string, VideoMeta>;

export const videoMeta = (id?: string): VideoMeta | undefined => (id ? videos[id] : undefined);
export const isPlayable = (id?: string) => !!id && (videos[id]?.status ?? 'ok') === 'ok';

/** 754 -> "12:34", 3723 -> "1:02:03" (as on YouTube thumbnails). */
export function clock(sec?: number) {
  if (!sec) return '';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Total length in words: "45 min", "3 h 20 min". */
export function totalLength(ids: (string | undefined)[]) {
  const sec = ids.reduce((sum, id) => sum + (videoMeta(id)?.duration ?? 0), 0);
  if (!sec) return '';
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}

/** ISO 8601 duration for structured data: 754 -> "PT12M34S". */
export const isoDuration = (sec?: number) => (sec ? `PT${Math.floor(sec / 3600) ? `${Math.floor(sec / 3600)}H` : ''}${Math.floor((sec % 3600) / 60)}M${sec % 60}S` : undefined);
