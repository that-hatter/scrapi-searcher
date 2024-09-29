import * as path from 'node:path';

export const LIMITS = {
  MESSAGE_CONTENT: 2000,
  EMBED_DESCRIPTION: 4000,
  EMBED_FIELD: 1000,
} as const;

export const COLORS = {
  GREENLIGHT_GREEN: 0x40c463, // or 0x7aa585
  // consistent with colors on scrapi-book
  BOOK_ORANGE: 0xe4712a,
  BOOK_LIGHTER_ORANGE: 0xfba731,
  BOOK_PURPLE: 0xb185fc,
  // discord colors
  DISCORD_TRANSPARENT: 0x36393f,
  DISCORD_ERROR_RED: 0xed4245,
  DISCORD_SUCCESS_GREEN: 0x3ba55c,
} as const;

export const URLS = {
  SCRAPI_BOOK: 'https://projectignis.github.io/scrapi-book',
  YUGIPEDIA_WIKI: 'https://yugipedia.com/wiki/',
  YUGIPEDIA_API: 'https://yugipedia.com/api.php?action=ask&query=',
  CARDSCRIPTS: 'https://github.com/ProjectIgnis/CardScripts/',
  BABEL_CDB: 'https://github.com/ProjectIgnis/BabelCDB/',
  YGORESOURCES_DB: 'https://db.ygoresources.com/',
  YGORESOURCES_DIFFS: 'https://texts.ygoresources.com/',
  KONAMI_DB_MASTER: 'https://www.db.yugioh-card.com/yugiohdb',
  KONAMI_DB_RUSH: 'https://www.db.yugioh-card.com/rushdb',
} as const;

export const EMOJI = {
  FACTORY: '<:factory:1283971929769902131>',
  SEARCHER: '<:searcher:1283971880885162130>',
  MIND_READER: '<:mindreader:1283972011256975390>',
  YARD: '<:yard:1283971971310293032>',
};

const CWD = process.cwd();
export const PATHS = {
  CWD,
  DATA: path.join(CWD, 'data'),
};
