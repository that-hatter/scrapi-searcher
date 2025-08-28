import {
  flow,
  O,
  pipe,
  RA,
  RNEA,
  RR,
  RTE,
  TE,
} from '@that-hatter/scrapi-factory/fp';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Babel, BitNames } from '.';
import { Ctx, CtxWithoutResources } from '../Ctx';
import { PATHS } from '../lib/constants';
import type { Resource } from '../lib/modules';
import { Github, str } from '../lib/modules';
import { utils } from '../lib/utils';

const REPO_PATH = path.join(PATHS.DATA, 'LFLists');

export type Banlist = {
  readonly filename: string;
  readonly name: string;
  readonly date: Date;
  readonly whitelist: boolean;
  readonly cards: RR.ReadonlyRecord<string, number>;
};

export type Banlists = ReadonlyArray<Banlist>;

const parse = (filename: string, contents: string): O.Option<Banlist> => {
  const lines = contents.split('\n');

  const heading = lines.find((v) => v.startsWith('!'));
  if (!heading) return O.none;

  const [date_, name_] = pipe(heading, str.split(' '), RNEA.unprepend);

  const name = name_.join(' ').trim().replace('Rush Duel', 'Rush');
  if (name.length === 0) return O.none;
  const date = new Date(date_);
  if (date.toString() === 'Invalid Date') return O.none;

  const whitelist = contents.includes('$whitelist');

  return pipe(
    lines,
    RA.filterMap((ln) => {
      const [id, count_] = ln.split(' ');
      if (!id || (+id).toString() !== id) return O.none;
      if (!count_) return O.none;
      const count = +count_;
      if (count === null || isNaN(count)) return O.none;

      return O.some([id, count] as const);
    }),
    RR.fromEntries,
    (cards) => O.some({ filename, name, date, whitelist, cards })
  );
};

export const getAllowed =
  (id: number) =>
  (banlist: Banlist): O.Option<number> => {
    const count = banlist.cards[id.toString()];
    if (banlist.whitelist) return O.fromNullable(count);
    return O.some(count ?? 3);
  };

const dateString = (b: Banlist) => {
  const month = b.date.getMonth().toString();
  return str.parenthesized(
    b.date.getFullYear() + '.' + '0'.repeat(2 - month.length) + month
  );
};

export const limitsBreakdown = (c: Babel.Card) => (ctx: Ctx) => {
  const scopes = BitNames.scopes(c.ot)(ctx);

  const rush = scopes.includes('Rush');
  const ocg = scopes.includes('OCG');
  const tcg = scopes.includes('TCG');

  const getLimit = rush
    ? flow(
        O.fromPredicate((b: Banlist) => b.name.startsWith('Rush')),
        O.flatMap((b) =>
          scopes.includes('Legend')
            ? O.some('Legend')
            : pipe(getAllowed(c.id)(b), O.map(String))
        )
      )
    : flow(getAllowed(c.id), O.map(String));

  return pipe(
    ctx.banlists,
    RA.filterMap((list: Banlist) =>
      pipe(
        list,
        O.fromPredicate(({ name }) => {
          if (name === 'World') return ocg && tcg;
          if (name === 'OCG') return ocg;
          if (name === 'Traditional' || name === 'TCG') return tcg;
          return true;
        }),
        O.flatMap(getLimit),
        O.map((lmt) =>
          str.joinWords([
            str.inlineCode(lmt),
            str.link(
              list.name,
              Github.blobURL(ctx.sources.banlists) + list.filename
            ),
            dateString(list),
          ])
        )
      )
    ),
    str.joinParagraphs,
    str.unempty
  );
};

const getAllLflistPaths = (dir: string) =>
  pipe(
    utils.taskify(() => fs.readdir(dir, { withFileTypes: true })),
    TE.map(
      RA.filterMap((file) => {
        if (file.name.endsWith('.lflist.conf') && !file.isDirectory())
          return O.some(file.name);
        return O.none;
      })
    )
  );

const loadBanlist = (filename: string) =>
  pipe(
    utils.taskify(() => fs.readFile(path.join(REPO_PATH, filename))),
    TE.map((c) => parse(filename, c.toString()))
  );

const loadBanlists = (): TE.TaskEither<string, Banlists> =>
  pipe(
    getAllLflistPaths(REPO_PATH),
    TE.map(RA.map(loadBanlist)),
    TE.flatMap(TE.sequenceArray),
    TE.map(RA.compact),
    TE.flatMapOption(RNEA.fromReadonlyArray, () => 'No valid banlists found.')
  );

const update = pipe(
  RTE.ask<CtxWithoutResources>(),
  RTE.map(({ sources }) => Github.pullOrClone('LFLists', sources.banlists)),
  RTE.flatMapTaskEither(loadBanlists),
  RTE.mapError(utils.stringify)
);

export const resource: Resource.Resource<'banlists'> = {
  key: 'banlists',
  description: 'Banlist data.',
  update,
  init: pipe(
    loadBanlists,
    RTE.orElse(() => update)
  ),
  commitFilter: (ctx) => (src, files) =>
    Github.isSource(src, ctx.sources.banlists) &&
    files.some((f) => f.endsWith('.lflist.conf')),
};
