import { E, flow, O, pipe, RA } from '@that-hatter/scrapi-factory/fp';
import { nonEmptyArray } from 'fp-ts';
import * as Decoder from 'io-ts/Decoder';
import { utils } from '../utils';

export const decode = <I, A>(dc: Decoder.Decoder<I, A>) =>
  flow(dc.decode, E.mapLeft(Decoder.draw));

export const option = <A>(
  value: Decoder.Decoder<unknown, A>
): Decoder.Decoder<unknown, O.Option<A>> =>
  Decoder.union(
    pipe(
      Decoder.struct({ _tag: Decoder.literal('None') }),
      Decoder.map(() => O.none)
    ),
    Decoder.struct({ _tag: Decoder.literal('Some'), value })
  );

export const numString = pipe(
  Decoder.string,
  Decoder.refine((s): s is string => s.length > 0, 'proper number'),
  Decoder.map((n) => +n),
  Decoder.refine((n): n is number => n !== null && !isNaN(n), 'proper number')
);

export const bigintString = pipe(
  Decoder.string,
  Decoder.refine((s): s is string => s.length > 0, 'proper number'),
  Decoder.parse((s) => {
    const n = utils.safeBigInt(s);
    if (n === 0n && +s !== 0) return Decoder.failure(s, 'proper number');
    return Decoder.success(n);
  })
);

export const head = flow(Decoder.array, Decoder.map(RA.head));

export const headReq = flow(
  Decoder.array,
  Decoder.refine(
    <A>(xs: ReadonlyArray<A>): xs is nonEmptyArray.NonEmptyArray<A> =>
      xs.length > 0,
    'non-empty'
  ),
  Decoder.map(nonEmptyArray.head)
);

export * from 'io-ts/Decoder';
