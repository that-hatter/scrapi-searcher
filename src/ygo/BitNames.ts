import * as sf from '@that-hatter/scrapi-factory';
import { flow, O, pipe, RA } from '@that-hatter/scrapi-factory/fp';
import { Ctx } from '../Ctx';
import { str } from '../lib/modules';
import { utils } from '../lib/utils';
import { Systrings } from './Systrings';

export type BitNameMap = ReadonlyMap<bigint, string>;

export type BitNames = {
  readonly scopes: BitNameMap;
  readonly archetypes: BitNameMap;
  readonly types: BitNameMap;
  readonly attributes: BitNameMap;
  readonly races: BitNameMap;
  readonly linkArrows: BitNameMap;
  readonly skillCharacters: BitNameMap;
};

const ascendingBitsMap = flow(
  RA.mapWithIndex((i, s: string) => [0x1n << utils.safeBigInt(i), s] as const),
  (entries): BitNameMap => new Map(entries)
);

const toText = (ct: sf.Constant) =>
  O.isSome(ct.summary) ? str.fromAST(ct.summary.value).trim() : ct.name;

const enumValMap = (en: string) =>
  flow(
    RA.filter((ct: sf.Constant) => ct.enum === en),
    RA.map((ct) => [utils.safeBigInt(ct.value), toText(ct)] as const),
    (entries): BitNameMap => new Map(entries)
  );

const toNames =
  (key: keyof BitNames) =>
  (int: bigint) =>
  ({ bitNames }: Ctx) =>
    pipe(
      int,
      utils.bigBits,
      RA.filter((b) => b !== 0n),
      RA.map((b) => bitNames[key].get(b) ?? '???')
    );

export const toInt =
  (key: keyof BitNames) =>
  (names: ReadonlyArray<string>) =>
  ({ bitNames }: Ctx) =>
    pipe(
      [...bitNames[key].entries()],
      RA.filter(([_, name]) => names.includes(name)),
      RA.map(([val]) => val),
      RA.reduce(0n, (b, a) => b | a)
    );

export const archetypesInt =
  (names: ReadonlyArray<string>) =>
  ({ bitNames }: Ctx) => {
    const vals = pipe(
      [...bitNames.archetypes.entries()],
      RA.filter(([_, name]) => names.includes(name)),
      RA.map(([val]) => val)
    );
    return pipe(
      vals,
      // remove superarchetypes that also have subarchetypes in the array
      RA.filter(
        (super_) =>
          !vals.some((sub) => sub > super_ && (sub & 0xfffn) === super_)
      ),
      RA.reduce(0n, (b, a) => (b << 16n) | a)
    );
  };

const SCOPES = ascendingBitsMap([
  'OCG',
  'TCG',
  'Anime/Manga',
  'Illegal',
  'Video Game',
  'Custom',
  'Speed',
  '???',
  'Pre-release',
  'Rush',
  'Legend',
  'Non-card',
]);

// TODO: auto-generate this by fetching strings.conf
const SKILL_CHARACTERS = ascendingBitsMap([
  'Yami Yugi',
  'Ishizu',
  'Pegasus',
  'Kaiba',
  'Joey',
  'Mai',
  'Bonz',
  'Mako',
  'Rex',
  'Weevil',
  'Keith',
  'Christine',
  'Emma',
  'Andrew',
  'David',
  'Bakura',
  'Marik',
  'Esper Roba',
  'Odion',
  'Umbra & Lumis',
  'Arkana',
  'Téa',
  '???',
  '???',
  'VRAINS',
]);

export const load = (cs: ReadonlyArray<sf.Constant>, ss: Systrings) => ({
  scopes: SCOPES,
  archetypes: pipe(
    ss,
    RA.filter(({ kind }) => kind === 'setname'),
    RA.map(({ name, value }) => [utils.safeBigInt(value), name] as const),
    (entries) => new Map(entries)
  ),
  types: enumValMap('CardType')(cs),
  attributes: enumValMap('MonsterAttribute')(cs),
  races: enumValMap('MonsterRace')(cs),
  linkArrows: enumValMap('LinkMarker')(cs),
  skillCharacters: SKILL_CHARACTERS,
});

export const scopes = toNames('scopes');

export const archetypes =
  (setcode: bigint) =>
  ({ bitNames }: Ctx) =>
    pipe(
      [
        (setcode >> 48n) & 0xffffn,
        (setcode >> 32n) & 0xffffn,
        (setcode >> 16n) & 0xffffn,
        setcode & 0xffffn,
      ],
      RA.filter((b) => b > 0n),
      RA.map((b) => bitNames.archetypes.get(b) ?? '???')
    );

export const types = toNames('types');

export const linkArrows = toNames('linkArrows');

export const race = toNames('races');

export const attribute = toNames('attributes');

export const skillCharacters = toNames('skillCharacters');
