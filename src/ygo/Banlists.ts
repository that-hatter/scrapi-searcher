import {
  flow,
  O,
  pipe,
  RA,
  RNEA,
  RR,
  TE,
} from '@that-hatter/scrapi-factory/fp';
import { Babel, BitNames } from '.';
import { Ctx, CtxWithoutResources } from '../Ctx';
import { FS, Github, str } from '../lib/modules';

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
  if (O.isNone(ctx.sources.banlists)) return O.none;
  const banlists = ctx.sources.banlists.value;

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
            str.link(list.name, Github.blobURL(banlists) + list.filename),
            dateString(list),
          ])
        )
      )
    ),
    str.joinParagraphs,
    str.unempty
  );
};

const loadSingleBanlist = (src: Github.Source) => (filepath: string) =>
  pipe(
    filepath,
    FS.readTextFile,
    TE.map((contents) =>
      parse(
        filepath.substring(Github.localPath(src).length + 1),
        contents.toString()
      )
    )
  );

export const load = (
  ctx: CtxWithoutResources
): TE.TaskEither<string, Banlists> => {
  if (O.isNone(ctx.sources.banlists)) return TE.right([]);
  return pipe(
    ctx.sources.banlists.value,
    Github.localPath,
    FS.getFilepathsWithExt('.lflist.conf'),
    TE.map(RA.map(loadSingleBanlist(ctx.sources.banlists.value))),
    TE.flatMap(TE.sequenceArray),
    TE.map(RA.compact)
  );
};
