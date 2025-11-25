import { flow, pipe, RA, RR, TE } from '@that-hatter/scrapi-factory/fp';
import { setTimeout } from 'timers/promises';
import { URLS } from '../lib/constants';
import { Decoder, Fetch, str } from '../lib/modules';
import { utils } from '../lib/utils';

export const url =
  (limit: number, offset: number) => (query: ReadonlyArray<string>) =>
    flow(
      paramsSection,
      RA.of,
      RA.prepend(querySection(query)),
      RA.append(`limit=${limit}|offset=${offset}&format=json`),
      str.intercalate('|'),
      str.prepend(URLS.YUGIPEDIA_API)
    );

export const querySection = flow(
  RA.map(encodeURIComponent),
  str.intercalate('||'),
  str.clamped('[[', ']]')
);

export const paramsSection = flow(
  RA.map(encodeURIComponent),
  RA.map(str.prepend('?')),
  str.intercalate('|')
);

export const fetchCards = (delaySecs: number, url: string) =>
  pipe(
    utils.taskify(() => setTimeout(delaySecs * 1000)),
    TE.flatMap(() => Fetch.json(url))
  );

export const fetchedResultDecoder = <A>(dc: Decoder.Decoder<unknown, A>) =>
  pipe(
    Decoder.struct({
      query: Decoder.struct({
        results: Decoder.record(Decoder.struct({ printouts: dc })),
      }),
    }),
    Decoder.map(({ query }) =>
      pipe(
        query.results,
        RR.map(({ printouts }) => printouts)
      )
    )
  );
