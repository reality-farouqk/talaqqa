// The curriculum structure. Every course belongs to one track, one level and
// one subject inside that track. Order here is the order learners see.

export const LEVELS = [
  { id: 'foundations', label: 'Foundations', blurb: 'Start here. No prior knowledge needed.' },
  { id: 'beginner', label: 'Beginner', blurb: 'Build the core after the foundations.' },
  { id: 'intermediate', label: 'Intermediate', blurb: 'Go deeper with structured study of key texts.' },
  { id: 'advanced', label: 'Advanced', blurb: 'Detailed study for committed students.' }
] as const;

export type LevelId = (typeof LEVELS)[number]['id'];
export const LEVEL_IDS = LEVELS.map((l) => l.id) as [LevelId, ...LevelId[]];

export interface Subject { id: string; label: string; arabic: string; blurb: string; }
export interface Track { id: string; label: string; short: string; arabic: string; blurb: string; subjects: Subject[]; }

export const TRACKS: Track[] = [
  {
    id: 'arabic',
    label: 'Learn Arabic',
    short: 'Arabic',
    arabic: 'اللغة العربية',
    blurb: 'From reading the letters to understanding the Quran and classical texts in Arabic.',
    subjects: [
      { id: 'reading', label: 'Reading & writing', arabic: 'القراءة والكتابة', blurb: 'Letters, sounds, vowels and fluent reading.' },
      { id: 'grammar', label: 'Grammar (Nahw)', arabic: 'النحو', blurb: 'How sentences are built and words change their endings.' },
      { id: 'morphology', label: 'Morphology (Sarf)', arabic: 'الصرف', blurb: 'Word patterns, roots and verb forms.' },
      { id: 'vocabulary', label: 'Vocabulary & conversation', arabic: 'المفردات والمحادثة', blurb: 'Everyday words and speaking practice.' },
      { id: 'quranic-arabic', label: 'Quranic Arabic', arabic: 'لغة القرآن', blurb: 'The language of the Quran, word by word.' },
      { id: 'balagha', label: 'Rhetoric (Balagha)', arabic: 'البلاغة', blurb: 'The eloquence and style of the Arabic language.' }
    ]
  },
  {
    id: 'islam',
    label: 'Learn Islam',
    short: 'Islamic studies',
    arabic: 'العلوم الشرعية',
    blurb: 'A path through the Islamic sciences, from the basics of belief and worship to advanced study.',
    subjects: [
      { id: 'aqeedah', label: 'Aqeedah (Belief)', arabic: 'العقيدة', blurb: 'What a Muslim believes about Allah, the prophets and the unseen.' },
      { id: 'fiqh', label: 'Fiqh (Worship & law)', arabic: 'الفقه', blurb: 'Purification, prayer, fasting and the rulings of daily life.' },
      { id: 'quran', label: 'Quran & Tafsir', arabic: 'القرآن والتفسير', blurb: 'Recitation, tajweed and the meaning of the Quran.' },
      { id: 'hadith', label: 'Hadith', arabic: 'الحديث', blurb: 'The sayings of the Prophet ﷺ and how they are studied.' },
      { id: 'seerah', label: 'Seerah & history', arabic: 'السيرة والتاريخ', blurb: 'The life of the Prophet ﷺ and Islamic history.' },
      { id: 'tazkiyah', label: 'Tazkiyah (Character)', arabic: 'التزكية', blurb: 'Purifying the heart, manners and character.' },
      { id: 'usul', label: 'Usul (Principles)', arabic: 'الأصول', blurb: 'Principles of fiqh, tafsir and hadith for advanced students.' }
    ]
  }
];

export const getTrack = (id: string) => TRACKS.find((t) => t.id === id);
export const getSubject = (track: string, subject: string) => getTrack(track)?.subjects.find((s) => s.id === subject);
export const getLevel = (id: string) => LEVELS.find((l) => l.id === id);
export const levelIndex = (id: string) => LEVEL_IDS.indexOf(id as LevelId);
export const trackUrl = (id: string) => `/learn/${id}/`;
export const levelUrl = (track: string, level: string) => `/learn/${track}/#${level}`;
