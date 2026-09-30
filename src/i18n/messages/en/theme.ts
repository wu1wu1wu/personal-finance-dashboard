import type { theme as zhTheme } from '../zh-CN/theme';

export const theme: Record<keyof typeof zhTheme, string> = {
  'theme.title': 'Appearance',
  'theme.description': 'Pick a palette you like — it applies instantly.',
  'theme.modeLabel': 'Appearance mode',
  'theme.system.label': 'Match system',
  'theme.system.description': 'Follows your system light/dark setting',
  'theme.light.label': 'Light',
  'theme.light.description': 'Always use the light palette',
  'theme.dark.label': 'Dark',
  'theme.dark.description': 'Always use the dark palette',
  'theme.contrastNote':
    'Both palettes meet WCAG AA contrast, and the dark values are locked down by unit tests.',
  'theme.language.title': 'Language',
  'theme.language.description':
    'Applies immediately; historical data such as category names is left untouched.',
  'theme.language.label': 'Interface language',
};
