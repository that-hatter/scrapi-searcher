import { identity, pipe, R, RNEA, RTE } from '@that-hatter/scrapi-factory/fp';
import { Babel, Card } from '../../../ygo';
import { Command, Ctx, Nav, SearchCommand } from '../../modules';

const getMatches = (query: string) => (ctx: Ctx.Ctx) =>
  ctx.babel.array.filter(
    (c) =>
      c.name.toLowerCase().includes(query) ||
      c.desc.toLowerCase().includes(query)
  );

export const search: Command.Command = {
  name: 'search',
  description:
    'Search cards by name and text. Matches are case-insensitive and can be partial.',
  syntax: 'search <query>',
  aliases: ['cardsearch'],
  execute: (parameters, message) => {
    const query = parameters.join(' ');
    return pipe(
      getMatches(query),
      R.map(RNEA.fromReadonlyArray),
      RTE.fromReader,
      RTE.flatMapOption(identity, () => SearchCommand.noMatches(query)),
      RTE.map(
        (items): Nav.Nav<Babel.Card> => ({
          title: SearchCommand.title(items.length, 'card', query),
          items,
          selectHint: 'Select card to display',
          messageId: message.id,
          channelId: message.channelId,
          itemName: (c) => c.name,
          itemListDescription: () => (c) => RTE.right(c.name),
          itemMenuDescription: (c) => RTE.right(c.id.toString()),
          itemEmbed: Card.itemEmbed,
        })
      ),
      RTE.flatMap(Nav.sendInitialPage(message))
    );
  },
};
