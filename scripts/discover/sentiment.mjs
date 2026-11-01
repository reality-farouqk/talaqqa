// Free, bilingual (English + Arabic) word-list sentiment. Crude by design:
// it only needs to tell "this series helped me" from "this is wrong / bad audio".

const POSITIVE = [
  // English
  'jazakallah', 'jazakallahu', 'jazakallahkhair', 'jzk', 'barakallah', 'barakallahu', 'mashallah', 'mashaallah', 'subhanallah',
  'alhamdulillah', 'thank', 'thanks', 'grateful', 'helpful', 'beneficial', 'benefit', 'benefited', 'amazing', 'excellent',
  'great', 'clear', 'clearly', 'understand', 'understood', 'learned', 'learnt', 'love', 'loved', 'best', 'beautiful',
  'brilliant', 'masterpiece', 'recommend', 'recommended', 'gem', 'easy', 'simple', 'perfect', 'useful', 'informative',
  // Arabic
  'جزاك', 'جزاكم', 'بارك', 'ماشاء', 'ماشاءالله', 'شكرا', 'شكراً', 'مفيد', 'مفيدة', 'رائع', 'رائعة', 'ممتاز', 'ممتازة',
  'جميل', 'جميلة', 'استفدت', 'نفع', 'نفعنا', 'أحسنت', 'احسنت', 'واضح', 'سهل'
];

const NEGATIVE = [
  // English
  'wrong', 'incorrect', 'mistake', 'mistakes', 'error', 'misguided', 'misguidance', 'deviant', 'misleading', 'fake', 'lies',
  'lie', 'boring', 'confusing', 'confused', 'unclear', 'useless', 'waste', 'bad', 'worst', 'terrible', 'poor', 'noise',
  'noisy', 'inaudible', 'quiet', 'echo', 'disappointed', 'disappointing', 'beware', 'warning', 'dislike', 'hate',
  // Arabic
  'خطأ', 'خطا', 'أخطاء', 'اخطاء', 'ضلال', 'باطل', 'كذب', 'سيء', 'سيئ', 'ممل', 'مملة', 'غير', 'احذروا', 'تحذير'
];

const NEGATORS = new Set(['not', "don't", 'dont', 'never', 'no', "isn't", 'isnt', "wasn't", 'wasnt', 'لا', 'ليس', 'لم', 'ما']);

const pos = new Set(POSITIVE);
const neg = new Set(NEGATIVE);

export function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '') // Arabic diacritics + tatweel
    .replace(/(jazak|barak|masha)\s*a?llah/g, '$1allah') // join common phrases
    .split(/[^\p{L}\p{N}']+/u)
    .filter(Boolean);
}

/** Score one comment: +1 positive, -1 negative, 0 neutral. */
export function commentPolarity(text) {
  const words = tokenize(text);
  let score = 0;
  words.forEach((w, i) => {
    const flip = NEGATORS.has(words[i - 1]) ? -1 : 1;
    // "غير" (not/other) is only negative on its own, so treat it as a negator-ish word, not a hit.
    if (w === 'غير') return;
    if (pos.has(w)) score += flip;
    else if (neg.has(w)) score -= flip;
  });
  return Math.sign(score);
}

/**
 * Summarise comments. Comments with many likes count more (log-weighted).
 * Returns { positive, negative, neutral, ratio } where ratio is in [-1, 1].
 */
export function summarise(comments) {
  let positive = 0, negative = 0, neutral = 0, wp = 0, wn = 0;
  for (const c of comments) {
    const p = commentPolarity(c.text);
    const w = 1 + Math.log10(1 + (c.likes ?? 0));
    if (p > 0) { positive++; wp += w; } else if (p < 0) { negative++; wn += w; } else neutral++;
  }
  const ratio = wp + wn === 0 ? 0 : (wp - wn) / (wp + wn);
  return { positive, negative, neutral, ratio };
}
