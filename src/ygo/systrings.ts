import {
  flow,
  O,
  pipe,
  RA,
  RNEA,
  RTE,
  TE,
} from '@that-hatter/scrapi-factory/fp';
import fetch from 'node-fetch';
import { Ctx, Nav, str } from '../lib/modules';
import { utils } from '../lib/utils';

const kinds = ['system', 'victory', 'counter', 'setname'] as const;

type Kind = (typeof kinds)[number];

export type Systring = {
  readonly kind: Kind;
  readonly name: string;
  readonly value: number;
  readonly repo: string;
  readonly line: number;
};

export type Systrings = ReadonlyArray<Systring>;

export const parse = (repo: string) =>
  flow(
    str.split('\n'),
    RA.filterMapWithIndex((i, s): O.Option<Systring> => {
      if (!s.startsWith('!')) return O.none;

      const split = s.substring(1).split(' ');
      const [kind_, value_] = split;
      if (!kind_ || !value_) return O.none;

      const kind = kinds.find((k) => k === kind_.trim());
      if (!kind) return O.none;

      const value = parseInt(value_);
      if (value === null || isNaN(value)) return O.none;

      const name = split.slice(2).join(' ') || '???';

      return O.some({ kind, value, name, line: i + 1, repo });
    })
  );

const fetchAndParse = (repo: string) => {
  const url =
    'https://raw.githubusercontent.com/ProjectIgnis/' +
    repo +
    '/master/' +
    (repo === 'Distribution' ? 'config/strings.conf' : 'strings.conf');
  return pipe(
    utils.taskify(() => fetch(url).then((response) => response.text())),
    TE.map(parse(repo))
  );
};

export const updateSystrings = () =>
  pipe(
    fetchAndParse('DeltaPuppetOfStrings'),
    TE.flatMap((delta) =>
      pipe(
        fetchAndParse('Distribution'),
        TE.map(
          RA.filter(
            ({ kind, value }) =>
              !delta.some((d) => d.kind === kind && d.value === value)
          )
        ),
        TE.map(RA.concat(delta))
      )
    )
  );

export const initSystrings = updateSystrings;

const hexString = (ct: Systring): string => '0x' + ct.value.toString(16);

const setnameConstant = (s: Systring) => (ctx: Ctx.Ctx) =>
  pipe(
    ctx.yard.api.constants.array,
    RA.findFirst((c) => c.enum === 'Archetype' && Number(c.value) === s.value)
  );

export const itemListDescription: Nav.Nav<Systring>['itemListDescription'] =
  (pageItems) => (item) => {
    const maxLength = (fn: (ct: Systring) => string): number =>
      pipe(
        pageItems,
        RNEA.reduce(0, (max, x) => {
          const s = fn(x);
          return s.length > max ? s.length : max;
        })
      );

    const paddedDec = str.leftPaddedCode(
      maxLength(({ value }) => value.toString())
    );
    const paddedHex = str.leftPaddedCode(maxLength(hexString));

    return pipe(
      [
        paddedDec(item.value.toString()),
        item.kind === 'system' ? O.none : paddedHex(hexString(item)),
        item.name,
      ],
      str.joinWords,
      str.trim,
      RTE.right
    );
  };

export const url = (s: Systring) =>
  'https://github.com/ProjectIgnis/' +
  s.repo +
  '/blob/master/' +
  (s.repo === 'Distribution' ? 'config/strings.conf#L' : 'strings.conf#L') +
  s.line;

export const itemEmbed = (s: Systring) => (ctx: Ctx.Ctx) =>
  TE.right({
    title: s.kind + ' string',
    url: url(s),
    description: str.joinParagraphs([
      s.name,
      str.bold('DEC:') + ' ' + str.inlineCode(s.value.toString()),
      s.kind === 'system'
        ? O.none
        : str.bold('HEX:') + ' ' + str.inlineCode(hexString(s)),
    ]),
  });

export const findMatches =
  (kind: Kind) => (query: string) => (ctx: Ctx.Ctx) => {
    const value = +query;
    if (value && !isNaN(value)) {
      const valMatches = ctx.systrings.filter(
        (s) => s.kind === kind && s.value === value
      );
      if (valMatches.length > 0) return valMatches;
    }
    return ctx.systrings.filter(
      (s) => s.kind === kind && s.name.toLowerCase().includes(query)
    );
  };
