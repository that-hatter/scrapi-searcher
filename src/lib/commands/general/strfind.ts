import {
  identity,
  pipe,
  R,
  RA,
  RNEA,
  RTE,
  TE,
} from '@that-hatter/scrapi-factory/fp';
import { Ctx } from '../../../Ctx';
import { Card } from '../../../ygo';
import { Command, Nav, SearchCommand, str } from '../../modules';
import { stringsEmbed } from './strings';

const getMatches = (query: string) => (ctx: Ctx) =>
  pipe(
    ctx.babel.array,
    RA.flatMap(Card.getCdbStrings),
    RA.filter(([_, __, s]) => s.toLowerCase().includes(query))
  );

export const strfind: Command.Command = {
  name: 'strfind',
  description:
    'Search card database strings. Case-insensitive, partial matches allowed.',
  syntax: 'strfind <query>',
  aliases: [],
  execute: (parameters, message) => {
    const query = parameters.join(' ').toLowerCase();
    return pipe(
      getMatches(query),
      R.map(RNEA.fromReadonlyArray),
      RTE.fromReader,
      RTE.flatMapOption(identity, () => SearchCommand.noMatches(query)),
      RTE.map(
        (items): Nav.Nav<Readonly<[number, number, string]>> => ({
          title: SearchCommand.title(items.length, 'strings', query),
          items,
          selectHint: 'Select card strings to display',
          messageId: message.id,
          channelId: message.channelId,
          bulletList: true,
          itemId: ([id, i]) => id + ',' + i,
          itemListDescription:
            () =>
            ([id, i, s]) =>
              RTE.right(str.inlineCode(id + ',' + i) + ' ' + s),
          itemMenuDescription: ([_, __, s]) => RTE.right(s),
          itemEmbed:
            ([id]) =>
            (ctx) =>
              pipe(
                ctx.babel.record[id.toString()],
                TE.fromNullable('Failed to find card: ' + id),
                TE.map((c) => stringsEmbed(c)(ctx))
              ),
        })
      ),
      RTE.flatMap(Nav.sendInitialPage(message))
    );
  },
};
