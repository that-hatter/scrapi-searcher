import { identity, pipe, R, RNEA, RTE } from '@that-hatter/scrapi-factory/fp';
import { Babel, Card } from '../../../ygo';
import { Command, Nav, SearchCommand } from '../../modules';

export const card: Command.Command = {
  name: 'card',
  description: 'Search cards by name. Matches can be fuzzy.',
  syntax: 'card <query>',
  aliases: [],
  execute: (parameters, message) => {
    const query = parameters.join(' ');
    return pipe(
      Card.fuzzyMatches(query),
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
