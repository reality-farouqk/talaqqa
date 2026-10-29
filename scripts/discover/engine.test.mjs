import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, scorePlaylist, decide, toCourseYaml, slugify } from './engine.mjs';
import { commentPolarity, summarise } from './sentiment.mjs';

const config = { auto_publish: { min_score: 70 }, review: { min_score: 45 } };
const video = (views, extra = {}) => ({ views, likes: views * 0.04, durationSec: 1800, captions: true, embeddable: true, public: true, ...extra });
const praise = Array.from({ length: 30 }, () => ({ text: 'JazakAllah khair, very beneficial and clear', likes: 5 }));

test('sentiment reads English, Arabic and negation', () => {
  assert.equal(commentPolarity('Jazak Allahu khayran, this helped me so much'), 1);
  assert.equal(commentPolarity('جزاك الله خيرا درس مفيد'), 1);
  assert.equal(commentPolarity('the audio is bad and the explanation is wrong'), -1);
  assert.equal(commentPolarity('not helpful'), -1);
  assert.equal(commentPolarity('what time is the next class?'), 0);
  assert.ok(summarise(praise).ratio > 0.9);
});

test('popular, well-liked, praised series scores high', () => {
  const r = scorePlaylist([video(900000), video(500000), video(400000), video(350000), video(300000)], praise);
  assert.ok(r.score >= 80, `score ${r.score}`);
});

test('hard filters reject unusable playlists', () => {
  assert.equal(scorePlaylist([video(1000), video(1000)], []).score, 0);
  assert.equal(scorePlaylist([video(1000), video(1000), video(1000, { embeddable: false }), video(1000, { public: false })], []).score, 0);
  assert.equal(scorePlaylist([video(1000, { durationSec: 40 }), video(1000, { durationSec: 40 }), video(1000, { durationSec: 40 })], []).score, 0);
});

test('negative comments pull the score down', () => {
  const vids = [video(50000), video(40000), video(30000), video(25000), video(20000)];
  const bad = Array.from({ length: 30 }, () => ({ text: 'misleading and wrong, beware', likes: 5 }));
  assert.ok(scorePlaylist(vids, bad).score < scorePlaylist(vids, praise).score - 15);
});

test('only trusted channels auto-publish', () => {
  assert.equal(decide({ score: 90, classified: true, trusted: true }, config), 'publish');
  assert.equal(decide({ score: 90, classified: true, trusted: false }, config), 'review');
  assert.equal(decide({ score: 60, classified: true, trusted: true }, config), 'review');
  assert.equal(decide({ score: 90, classified: false, trusted: true }, config), 'skip');
  assert.equal(decide({ score: 30, classified: true, trusted: false }, config), 'skip');
});

test('classify uses the seed and level keywords', () => {
  assert.deepEqual(classify('Madinah Arabic Book 1', null), { track: 'arabic', subject: 'grammar', level: 'beginner' });
  assert.deepEqual(classify('شرح الآجرومية', null), { track: 'arabic', subject: 'grammar', level: 'beginner' });
  assert.equal(classify('Friday khutbah collection', null), null);
  assert.deepEqual(classify('Advanced series', { track: 'islam', subject: 'fiqh', level: 'beginner' }), { track: 'islam', subject: 'fiqh', level: 'advanced' });
});

test('course YAML has the fields the schema needs and safe slugs', () => {
  const yaml = toCourseYaml({
    playlist: { id: 'PLabc', title: 'Learn "Nahw": Part 1', description: '' },
    channel: { id: 'UCxyz', title: 'Some Channel' },
    videos: [{ id: 'aaaaaaaaaaa', title: 'Lesson 1' }, { id: 'bbbbbbbbbbb', title: 'Lesson 1' }, { id: 'ccccccccccc', title: 'الدرس' }],
    labels: { track: 'arabic', subject: 'grammar', level: 'beginner' }, language: 'en', score: 80, status: 'draft', today: '2026-10-29'
  });
  for (const field of ['track: arabic', 'status: draft', 'verified_at: 2026-10-29', 'title: "Learn \\"Nahw\\": Part 1"', 'slug: lesson-1-2', 'slug: lesson-3', 'playlist_url:']) {
    assert.ok(yaml.includes(field), `missing ${field}`);
  }
  assert.equal(slugify('ab'), '');
});
