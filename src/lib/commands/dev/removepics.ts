import { RA, RTE, TE } from '@that-hatter/scrapi-factory/fp';
import { pipe } from 'fp-ts/lib/function';
import { Deck, Pics } from '../../../ygo';
import { LIMITS } from '../../constants';
import { Command, Err, Op, str } from '../../modules';

const parseParam = (param: string) => {
  if (param.startsWith('ydke://')) {
    return pipe(
      param,
      Deck.fromYdkeString,
      TE.mapError(Err.ignore),
      TE.map((deck) => [deck.main, deck.extra, deck.side]),
      TE.map(RA.flatten)
    );
  }

  return pipe(
    +param,
    TE.fromPredicate(
      (a) => !isNaN(a) && a > 0,
      () => Err.ignore()
    ),
    TE.map(RA.of)
  );
};

const successMessage = (ids: ReadonlyArray<number>) =>
  pipe(
    ids,
    RA.map((id) => str.inlineCode(id.toString())),
    str.join(', '),
    str.prepend('Removed ' + ids.length + ' card(s) from pics.json.\n'),
    str.limit('...', LIMITS.MESSAGE_CONTENT)
  );

export const removepics: Command.Command = {
  name: 'removepics',
  description: 'Remove reuploaded card pic urls from pics.json.',
  syntax: 'removepics <ydke|id1> <ydke2|id2?> <ydke3|id3?...>',
  aliases: ['rempics', 'rmpics'],
  devOnly: true,
  execute: (params, message) =>
    pipe(
      params,
      RA.map(parseParam),
      TE.sequenceArray,
      TE.map(RA.flatten),
      TE.map((ids) => [...new Set(ids)]),
      RTE.fromTaskEither,
      RTE.filterOrElse(
        (s) => s.length > 0,
        () => Err.forUser('Must include at least one id or ydke string.')
      ),
      RTE.flatMap((ids) =>
        pipe(
          ids,
          Pics.remove,
          RTE.mapError(Err.forDev),
          RTE.tap(() => Op.sendReply(message)(successMessage(ids)))
        )
      )
    ),
};
