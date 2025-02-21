import { pipe, RA, RNEA, RR, TE } from '@that-hatter/scrapi-factory/fp';
import fetch from 'node-fetch';
import { Ctx } from '../Ctx';
import type { Data } from '../lib/modules';
import { Decoder, str } from '../lib/modules';
import { DeepReadonly, utils } from '../lib/utils';

const decoder = pipe(
  Decoder.record(Decoder.array(Decoder.string)),
  Decoder.map(RR.toEntries),
  Decoder.map(
    RA.flatMap(([full, aliases]) => aliases.map((a) => [a, full] as const))
  ),
  Decoder.map(RR.fromEntries)
);

export type Shortcuts = DeepReadonly<Decoder.TypeOf<typeof decoder>>;

const URL =
  'https://raw.githubusercontent.com/that-hatter/' +
  'scrapi-searcher-data/main/data/shortcuts.json';

const update = pipe(
  utils.taskify(() => fetch(URL).then((response) => response.json())),
  TE.flatMapEither(Decoder.parse(decoder))
);

export const data: Data.Data<'shortcuts'> = {
  key: 'shortcuts',
  description: 'Card search shortcuts.',
  update,
  init: update,
  commitFilter: (repo, files) =>
    repo === 'scrapi-searcher' && files.includes('data/shortcuts.json'),
};

export const resolveShortcuts = (query: string) => (ctx: Ctx) =>
  pipe(
    query,
    str.split(/\s+/),
    RNEA.map((s) => {
      // TODO: instead of replacing the original string then searching,
      // use shortcuts as alternative search results
      if (s.startsWith('(') && s.endsWith(')')) return s;
      const key = s.toLowerCase().replaceAll(/[\p{P}\p{S}]+/gu, '');
      return ctx.shortcuts[key] ?? s;
    }),
    str.intercalate(' ')
  );
