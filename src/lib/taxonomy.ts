// The curriculum structure. Every course belongs to one track, one level and
// one subject inside that track. Order here is the order learners see.

export const LEVELS = [
  { id: 'foundations', label: 'Foundations' },
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' }
] as const;

export type LevelId = (typeof LEVELS)[number]['id'];
export const LEVEL_IDS = LEVELS.map((l) => l.id) as [LevelId, ...LevelId[]];

export interface Subject { id: string; label: string; arabic: string; }
export interface Track { id: string; label: string; short: string; arabic: string; blurb: string; subjects: Subject[]; }

export const TRACKS: Track[] = [
  {
    id: 'arabic',
    label: 'Learn Arabic',
    short: 'Arabic',
    arabic: 'اللغة العربية',
    blurb: 'From reading the letters to understanding the Quran and classical texts in Arabic.',
    subjects: [
      { id: 'reading', label: 'Reading & writing', arabic: 'القراءة والكتابة' },
      { id: 'grammar', label: 'Grammar (Nahw)', arabic: 'النحو' },
      { id: 'morphology', label: 'Morphology (Sarf)', arabic: 'الصرف' },
      { id: 'vocabulary', label: 'Vocabulary & conversation', arabic: 'المفردات والمحادثة' },
      { id: 'quranic-arabic', label: 'Quranic Arabic', arabic: 'لغة القرآن' },
      { id: 'balagha', label: 'Rhetoric (Balagha)', arabic: 'البلاغة' }
    ]
  },
  {
    id: 'islam',
    label: 'Learn Islam',
    short: 'Islamic studies',
    arabic: 'العلوم الشرعية',
    blurb: 'A path through the Islamic sciences, from the basics of belief and worship to advanced study.',
    subjects: [
      { id: 'aqeedah', label: 'Aqeedah (Belief)', arabic: 'العقيدة' },
      { id: 'fiqh', label: 'Fiqh (Worship & law)', arabic: 'الفقه' },
      { id: 'quran', label: 'Quran & Tafsir', arabic: 'القرآن والتفسير' },
      { id: 'hadith', label: 'Hadith', arabic: 'الحديث' },
      { id: 'seerah', label: 'Seerah & history', arabic: 'السيرة والتاريخ' },
      { id: 'tazkiyah', label: 'Tazkiyah (Character)', arabic: 'التزكية' },
      { id: 'usul', label: 'Usul (Principles)', arabic: 'الأصول' }
    ]
  }
];

export const getTrack = (id: string) => TRACKS.find((t) => t.id === id);
export const getSubject = (track: string, subject: string) => getTrack(track)?.subjects.find((s) => s.id === subject);
export const getLevel = (id: string) => LEVELS.find((l) => l.id === id);
export const levelIndex = (id: string) => LEVEL_IDS.indexOf(id as LevelId);
export const trackUrl = (id: string) => `/learn/${id}/`;
export const levelUrl = (track: string, level: string) => `/learn/${track}/#${level}`;
export const topicUrl = (track: string, subject: string) => `/learn/${track}/${subject}/`;
