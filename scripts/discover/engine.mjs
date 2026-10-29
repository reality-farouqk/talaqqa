// Pure logic of the discovery engine: classify, score, decide, write course files.
// No network or disk access here, so it is easy to test.
import { summarise } from './sentiment.mjs';

const LEVEL_WORDS = [
  ['foundations', /\b(from zero|absolute beginners?|basics|qaida|alphabet|noorani)\b|للمبتدئين|القاعدة/i],
  ['beginner', /\b(beginners?|introduction|intro|level 1|book 1|part 1)\b|مقدمة/i],
  ['intermediate', /\b(intermediate|level 2|book 2|book 3)\b|متوسط/i],
  ['advanced', /\b(advanced|level 3|alfiyy?ah|qatr)\b|متقدم|ألفية/i]
];

// Keyword guesses for playlists found on trusted channels (no seed query to go by).
const SUBJECT_WORDS = [
  ['arabic', 'reading', /\b(qaida|alphabet|read(ing)? arabic)\b|القاعدة النورانية/i],
  ['arabic', 'grammar', /\b(nahw|grammar|ajurr?umiyy?ah|madinah arabic)\b|النحو|الآجرومية/i],
  ['arabic', 'morphology', /\b(sarf|morphology)\b|الصرف/i],
  ['arabic', 'quranic-arabic', /\bquranic arabic\b/i],
  ['arabic', 'balagha', /\b(balagh?a|rhetoric)\b|البلاغة/i],
  ['islam', 'quran', /\b(tafs[ei]e?r|tajweed|tajwid)\b|تفسير|تجويد/i],
  ['islam', 'hadith', /\b(hadith|nawawi|bukhari|muslim)\b|الحديث|الأربعين/i],
  ['islam', 'seerah', /\b(seerah|sirah|biography of the prophet)\b|السيرة/i],
  ['islam', 'aqeedah', /\b(aq[ie]+dah|tawh?eed|creed|usool ath-thalatha|three fundamental)\b|العقيدة|التوحيد|الأصول الثلاثة/i],
  ['islam', 'usul', /\busu?u?l al-?fiqh\b|أصول الفقه/i],
  ['islam', 'fiqh', /\b(fiqh|salah|prayer|wudu|purification|fasting|zakat)\b|الفقه|الصلاة|الطهارة/i],
  ['islam', 'tazkiyah', /\b(tazkiyah|purification of the heart|character|akhlaq)\b|التزكية|الأخلاق/i]
];

/** Best guess of { track, subject, level } from a title, or null if unsure. `prior` comes from the seed query. */
export function classify(text, prior) {
  const subject = SUBJECT_WORDS.find(([, , re]) => re.test(text));
  const level = LEVEL_WORDS.find(([, re]) => re.test(text))?.[0];
  if (prior) return { track: prior.track, subject: prior.subject, level: level ?? prior.level };
  if (!subject) return null;
  return { track: subject[0], subject: subject[1], level: level ?? 'beginner' };
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

/**
 * Score a playlist 0-100. `videos`: [{ views, likes, durationSec, captions, embeddable, public }] in playlist order.
 * `comments`: [{ text, likes }] sampled from the series. Weights favour reach, likes and comments.
 */
export function scorePlaylist(videos, comments) {
  const ok = videos.filter((v) => v.embeddable && v.public);
  if (ok.length < 3) return { score: 0, reason: 'fewer than 3 public, embeddable videos' };
  if (ok.length / videos.length < 0.8) return { score: 0, reason: 'too many private or non-embeddable videos' };
  if (median(ok.map((v) => v.durationSec)) < 180) return { score: 0, reason: 'mostly short clips, not lessons' };

  const views = ok.reduce((s, v) => s + v.views, 0);
  const likes = ok.reduce((s, v) => s + v.likes, 0);
  const sentiment = summarise(comments);
  const rated = sentiment.positive + sentiment.negative;

  const parts = {
    reach: clamp01(Math.log10(1 + views / ok.length) / 6), // 1M average views per video = full marks
    likes: clamp01(views ? likes / views / 0.04 : 0), // 4% like rate = full marks
    // Few rated comments means little evidence either way, so pull towards neutral.
    comments: 0.5 + ((sentiment.ratio / 2) * Math.min(1, rated / 20)),
    completion: clamp01((ok.at(-1).views / Math.max(1, ok[0].views)) / 0.3), // learners who reach the last lesson
    structure: (ok.length >= 5 && ok.length <= 120 ? 0.6 : 0.3) + 0.4 * (ok.filter((v) => v.captions).length / ok.length)
  };
  const weights = { reach: 25, likes: 25, comments: 20, completion: 15, structure: 15 };
  const score = Math.round(Object.entries(weights).reduce((s, [k, w]) => s + w * parts[k], 0));
  return { score, parts, sentiment, views, likes };
}

/** 'publish' | 'review' | 'skip'. Only trusted channels can publish without a human. */
export function decide({ score, classified, trusted }, config) {
  if (!classified || score < config.review.min_score) return 'skip';
  return trusted && score >= config.auto_publish.min_score ? 'publish' : 'review';
}

export function slugify(text) {
  const s = text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
  return s.length >= 3 ? s : '';
}

const MODULE_SIZE = 10;
const q = (s) => JSON.stringify(s); // JSON strings are valid YAML scalars

/** Course YAML for a playlist. `videos` are the public, embeddable ones in order. */
export function toCourseYaml({ playlist, channel, videos, labels, language, score, status, today }) {
  const used = new Set();
  const lessons = videos.map((v, i) => {
    let slug = slugify(v.title) || `lesson-${i + 1}`;
    if (used.has(slug)) slug = `${slug}-${i + 1}`;
    used.add(slug);
    return { slug, title: v.title, id: v.id };
  });
  const modules = [];
  for (let i = 0; i < lessons.length; i += MODULE_SIZE) {
    const part = lessons.slice(i, i + MODULE_SIZE);
    modules.push({ slug: `part-${modules.length + 1}`, title: lessons.length > MODULE_SIZE ? `Lessons ${i + 1}–${i + part.length}` : 'Lessons', lessons: part });
  }
  const summary = (playlist.description || '').split('\n').find((l) => l.trim().length > 20)?.trim().slice(0, 200) || `A ${videos.length}-lesson series by ${channel.title}.`;
  return [
    `# Found by the discovery engine (score ${score}/100). Every video was confirmed public and embeddable on ${today}.`,
    `title: ${q(playlist.title)}`,
    `summary: ${q(summary)}`,
    `track: ${labels.track}`,
    `subject: ${labels.subject}`,
    `level: ${labels.level}`,
    `language: ${language}`,
    `status: ${status}`,
    `verified_at: ${today}`,
    'source:',
    `  name: ${q(channel.title)}`,
    `  url: ${q(`https://www.youtube.com/channel/${channel.id}`)}`,
    `  playlist_url: ${q(`https://www.youtube.com/playlist?list=${playlist.id}`)}`,
    'modules:',
    ...modules.flatMap((m) => [
      `  - slug: ${m.slug}`,
      `    title: ${q(m.title)}`,
      '    lessons:',
      ...m.lessons.flatMap((l) => [`      - slug: ${l.slug}`, `        title: ${q(l.title)}`, `        youtube_id: ${q(l.id)}`])
    ]),
    ''
  ].join('\n');
}
