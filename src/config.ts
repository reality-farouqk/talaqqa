// Change the name here (and in astro.config.mjs manifest) to rename the app.
export const SITE = {
  name: 'Talaqqa',
  tagline: 'Free Islamic courses, curated from public sources',
  description:
    'A free, open-source library of structured Islamic courses built from publicly available lectures. Pick a course, follow it lesson by lesson, and track your progress.',
  repo: 'https://github.com/reality-farouqk/talaqqa',
  // Shown on the report page. Leave empty until a real inbox exists.
  contactEmail: ''
};

export const issueUrl = (template: string, title = '') =>
  `${SITE.repo}/issues/new?template=${template}${title ? `&title=${encodeURIComponent(title)}` : ''}`;
