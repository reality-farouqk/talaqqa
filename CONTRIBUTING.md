# Contributing

Thank you for helping. Please read the [Code of Conduct](CODE_OF_CONDUCT.md).

## Suggest a course
Open a "Suggest a course" issue with the teacher, the playlist link, the path (Arabic or Islam) and the level. Maintainers decide what is published.

## Add or fix a course file
1. Copy a file in `content/courses/` and rename it (the file name becomes the URL).
2. Fill in the fields:
   - `track`: `arabic` or `islam`
   - `level`: `foundations`, `beginner`, `intermediate` or `advanced`
   - `subject`: one of the subjects for that track in `src/lib/taxonomy.ts` (for example `grammar`, `aqeedah`, `fiqh`)
   - `order`: position inside its level (1 = take first)
   - `prerequisites`: course file names to finish first (optional)
   - `source.name`, `source.url` and, if there is one, `source.playlist_url`
   - `verified_at`: the date you checked every video
   - for each lesson: `slug`, `title` and the 11-character `youtube_id`
3. Run `npm run build`. It tells you exactly what is wrong.
4. Open a pull request saying who the teacher is and why the course is worth including.

## Content guidelines
- Credit the teacher or channel and link to the original source.
- Use only videos that are public and allow embedding. Never invent or guess a video ID.
- Do not add videos from creators who have asked not to be included.
- Prefer clear, well-structured series from recognised teachers. Keep lesson order logical for a beginner.
- Titles and summaries should be accurate and neutral.

## Code
Keep changes small and focused. Open an issue first for large features. CI must pass before merging.
