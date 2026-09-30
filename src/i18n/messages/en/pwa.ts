import type { pwa as zhPwa } from '../zh-CN/pwa';

export const pwa: Record<keyof typeof zhPwa, string> = {
  'pwa.update.title': 'A new version is available',
  'pwa.update.description': 'Refresh to load it.',
  'pwa.update.action': 'Refresh now',
  'pwa.update.dismiss': 'Later',
  'pwa.offline': 'Offline — your data lives on this device, so the app keeps working',
  'pwa.install.title': 'Install to home screen',
  'pwa.install.description': 'Once installed it opens offline, just like a native app.',
  'pwa.install.action': 'Install',
  'pwa.install.dismiss': 'Do not ask again',
};
