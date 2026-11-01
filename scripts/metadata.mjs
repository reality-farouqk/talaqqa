// Refresh YouTube metadata for every lesson video: duration, upload date, availability.
// Writes content/meta/videos.json (read by the site at build time) and lists unavailable
// videos in metadata-report.md for the weekly issue.
// Usage: YOUTUBE_API_KEY=... node scripts/metadata.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const KEY = process.env.YOUTUBE_API_KEY;
if (!KEY) { console.error('YOUTUBE_API_KEY is not set'); process.exit(1); }
const COURSES = 'content/courses';
const OUT = 'content/meta/videos.json';

// video id -> where it is used, for the report
const uses = new Map();
for (const f of readdirSync(COURSES).filter((f) => f.endsWith('.yaml'))) {
  for (const [, id] of readFileSync(`${COURSES}/${f}`, 'utf8').matchAll(/youtube_id:\s*"?([A-Za-z0-9_-]{11})"?/g)) {
    uses.set(id, [...(uses.get(id) ?? []), f.replace(/\.yaml$/, '')]);
  }
}

const seconds = (iso) => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso) ?? []; return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0); };
const ids = [...uses.keys()].sort();
const videos = {};
for (let i = 0; i < ids.length; i += 50) {
  const batch = ids.slice(i, i + 50);
  const url = `https://www.googleapis.com/youtube/v3/videos?${new URLSearchParams({ part: 'contentDetails,status,snippet', id: batch.join(','), key: KEY })}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`videos.list ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const found = new Map((await res.json()).items.map((v) => [v.id, v]));
  for (const id of batch) {
    const v = found.get(id);
    // Missing from the response means deleted or never existed.
    if (!v) { videos[id] = { status: 'removed' }; continue; }
    const status = v.status.privacyStatus !== 'public' ? 'private' : v.status.embeddable === false ? 'not_embeddable' : 'ok';
    videos[id] = { status, duration: seconds(v.contentDetails.duration), published: v.snippet.publishedAt.slice(0, 10) };
  }
}

// One video per line keeps weekly diffs small and readable.
const lines = ids.map((id) => `  ${JSON.stringify(id)}: ${JSON.stringify(videos[id])}`);
writeFileSync(OUT, `{\n "checked": ${JSON.stringify(new Date().toISOString().slice(0, 10))},\n "videos": {\n${lines.join(',\n')}\n }\n}\n`);
const bad = ids.filter((id) => videos[id].status !== 'ok');
writeFileSync('metadata-report.md', bad.length
  ? ['These lesson videos are no longer playable. Their lesson pages now say so; replace or remove them in the course files.', '',
     '| Video | Status | Courses |', '|---|---|---|', ...bad.map((id) => `| [${id}](https://www.youtube.com/watch?v=${id}) | ${videos[id].status} | ${uses.get(id).join(', ')} |`)].join('\n')
  : '');
console.log(`${ids.length} videos checked, ${bad.length} unavailable`);
