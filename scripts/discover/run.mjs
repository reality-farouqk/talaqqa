// Discovery engine: finds YouTube lecture series, scores them and writes course files.
// Trusted channels above the bar are published; the rest become drafts for review.
// Usage: YOUTUBE_API_KEY=... node scripts/discover/run.mjs   (writes a summary to discovery-summary.json)
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { classify, scorePlaylist, decide, toCourseYaml, slugify, contentMismatch, decodeEntities, orderLessons } from './engine.mjs';

const KEY = process.env.YOUTUBE_API_KEY;
if (!KEY) { console.error('YOUTUBE_API_KEY is not set'); process.exit(1); }

const COURSES = 'content/courses';
const config = JSON.parse(readFileSync('content/discovery/config.json', 'utf8'));
const trusted = new Set(config.trusted_channels.map((c) => c.id ?? c));
const blocked = new Set([...config.blocked_channels, ...(config.blocked_playlists ?? [])]);
const today = new Date().toISOString().slice(0, 10);

async function yt(resource, params) {
  const url = `https://www.googleapis.com/youtube/v3/${resource}?${new URLSearchParams({ ...params, key: KEY })}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    // Comments disabled is normal; everything else is a real failure.
    if (resource === 'commentThreads' && res.status === 403) return { items: [] };
    throw new Error(`${resource} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

async function playlistVideoIds(playlistId, max = 150) {
  const ids = [];
  let pageToken;
  do {
    const r = await yt('playlistItems', { part: 'contentDetails', playlistId, maxResults: 50, ...(pageToken && { pageToken }) });
    ids.push(...r.items.map((i) => i.contentDetails.videoId));
    pageToken = r.nextPageToken;
  } while (pageToken && ids.length < max);
  return ids.slice(0, max);
}

const seconds = (iso) => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso) ?? []; return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0); };

async function videoDetails(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const r = await yt('videos', { part: 'snippet,contentDetails,statistics,status', id: ids.slice(i, i + 50).join(',') });
    out.push(...r.items);
  }
  // Keep playlist order; deleted videos simply don't come back and count as unusable.
  const byId = new Map(out.map((v) => [v.id, v]));
  return ids.map((id) => {
    const v = byId.get(id);
    if (!v) return { id, title: '', views: 0, likes: 0, durationSec: 0, embeddable: false, public: false };
    return {
      id, title: v.snippet.title, lang: v.snippet.defaultAudioLanguage,
      views: +(v.statistics.viewCount ?? 0), likes: +(v.statistics.likeCount ?? 0),
      durationSec: seconds(v.contentDetails.duration), captions: v.contentDetails.caption === 'true',
      embeddable: v.status.embeddable === true, public: v.status.privacyStatus === 'public'
    };
  });
}

async function sampleComments(videos) {
  const picks = [...new Set([videos[0], videos[Math.floor(videos.length / 2)], videos.at(-1)])];
  const all = [];
  for (const v of picks) {
    const r = await yt('commentThreads', { part: 'snippet', videoId: v.id, maxResults: 100, order: 'relevance', textFormat: 'plainText' });
    all.push(...r.items.map((t) => ({ text: t.snippet.topLevelComment.snippet.textDisplay, likes: t.snippet.topLevelComment.snippet.likeCount })));
  }
  return all;
}

// Playlists already in the catalog (published or draft) are never re-added.
const known = new Set(readdirSync(COURSES).flatMap((f) => [...readFileSync(`${COURSES}/${f}`, 'utf8').matchAll(/list=([\w-]+)/g)].map((m) => m[1])));

async function gatherPlaylists() {
  const found = new Map(); // playlistId -> { snippet, prior }
  for (const seed of config.seeds) {
    const r = await yt('search', { part: 'snippet', type: 'playlist', q: seed.q, maxResults: 10, relevanceLanguage: seed.lang });
    for (const item of r.items) {
      const id = item.id.playlistId;
      if (!found.has(id)) found.set(id, { id, title: decodeEntities(item.snippet.title), description: decodeEntities(item.snippet.description), channelId: item.snippet.channelId, channelTitle: decodeEntities(item.snippet.channelTitle), prior: seed, lang: seed.lang });
    }
  }
  for (const channelId of trusted) {
    const r = await yt('playlists', { part: 'snippet', channelId, maxResults: 50 });
    for (const p of r.items) {
      if (!found.has(p.id)) found.set(p.id, { id: p.id, title: p.snippet.title, description: p.snippet.description, channelId, channelTitle: p.snippet.channelTitle, prior: null });
    }
  }
  return [...found.values()].filter((p) => !known.has(p.id) && !blocked.has(p.id) && !blocked.has(p.channelId));
}

const taken = new Set();
function uniqueFileName(title, id) {
  const base = slugify(title) || `playlist-${id.slice(-8).toLowerCase()}`;
  let name = base, n = 2;
  while (taken.has(name) || existsSync(`${COURSES}/${name}.yaml`)) name = `${base}-${n++}`;
  taken.add(name);
  return name;
}

const results = [];
const playlists = await gatherPlaylists();
console.log(`Scoring ${playlists.length} new playlists`);

for (const p of playlists) {
  try {
    const labels = classify(p.title, p.prior);
    const videos = await videoDetails(await playlistVideoIds(p.id));
    const usable = orderLessons(videos.filter((v) => v.embeddable && v.public));
    const mismatch = labels && contentMismatch({ title: p.title, description: p.description, track: labels.track, lang: p.lang ?? 'en', videoLangs: usable.map((v) => v.lang) });
    // Skip the comment calls (quota) when the playlist is already ruled out.
    const comments = usable.length >= 3 && !mismatch ? await sampleComments(usable) : [];
    const scored = mismatch ? { score: 0, reason: mismatch } : scorePlaylist(videos, comments);
    const action = decide({ score: scored.score, classified: !!labels, trusted: trusted.has(p.channelId) }, config);
    results.push({ playlist: p.id, title: p.title, channel: p.channelTitle, channelId: p.channelId, labels, score: scored.score, reason: scored.reason, action, videos: usable.length });
    if (action === 'skip') continue;
    const r = results.at(-1);
    r.file = `${COURSES}/${uniqueFileName(p.title, p.id)}.yaml`;
    r.pending = { playlist: { id: p.id, title: p.title, description: p.description ?? '' }, channel: { id: p.channelId, title: p.channelTitle }, videos: usable, labels, language: p.lang ?? usable[0].lang?.slice(0, 2) ?? 'en', score: scored.score };
  } catch (err) {
    console.error(`Playlist ${p.id} failed: ${err.message}`);
    results.push({ playlist: p.id, title: p.title, action: 'error', error: err.message });
  }
}

// Highest scores first; respect the per-run caps.
const ranked = results.filter((r) => r.pending).sort((a, b) => b.score - a.score);
let published = 0, reviewed = 0;
for (const r of ranked) {
  if (r.action === 'publish' && published >= config.auto_publish.max_new_courses_per_run) r.action = 'review';
  if (r.action === 'review' && reviewed >= config.review.max_candidates) { r.action = 'skip'; delete r.file; delete r.pending; continue; }
  writeFileSync(r.file, toCourseYaml({ ...r.pending, status: r.action === 'publish' ? 'published' : 'draft', today }));
  r.action === 'publish' ? published++ : reviewed++;
  delete r.pending;
}

writeFileSync('discovery-summary.json', JSON.stringify({ date: today, published, reviewed, results: results.sort((a, b) => (b.score ?? -1) - (a.score ?? -1)) }, null, 2));
console.log(`Published ${published}, drafts for review ${reviewed}, errors ${results.filter((r) => r.action === 'error').length}`);
if (results.length && results.every((r) => r.action === 'error')) process.exit(1);
