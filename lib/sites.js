export const LANGS = [['en', 'English'], ['fr', 'French'], ['both', 'French + English']];
export const SITE_TYPES = ['anime', 'movie', 'series'];
// Legal services only. Availability depends on your country, so check each one.
export const SUGGESTED = [
  { name: 'JustWatch (shows where a title streams)', url: 'https://www.justwatch.com', language: 'both', types: ['anime', 'movie', 'series'] },
];
export const siteHost = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
export const searchLink = (title, url) => `https://www.google.com/search?q=${encodeURIComponent(`${title} site:${siteHost(url)}`)}`;
