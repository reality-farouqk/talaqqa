// 24x24 stroke icons (Lucide-style paths, drawn inline so there is no icon dependency).
export const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  browse: 'M4 5h16M4 12h16M4 19h10',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4.35-4.35',
  library: 'M5 4v16M10 4v16M15 4l4 16',
  check: 'M20 6 9 17l-5-5',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  plus: 'M12 5v14M5 12h14',
  notes: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3',
  share: 'M12 3v13M7 8l5-5 5 5M5 14v6h14v-6',
  play: 'M7 4v16l13-8z'
} as const;
export type IconName = keyof typeof ICONS;
