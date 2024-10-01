import { identity, pipe, R, RNEA, RTE } from '@that-hatter/scrapi-factory/fp';
import { Card } from '../../../ygo';
import { Command, Nav, SearchCommand } from '../../modules';

export const card: Command.Command = {
  name: 'card',
  description: 'Find cards by name. Supports fuzzy matching.',
  syntax: 'card <query>',
  aliases: [],
  execute: (parameters, message) => {
    const query = parameters.join(' ');
    return pipe(
      Card.fuzzyMatches(query),
      R.map(RNEA.fromReadonlyArray),
      RTE.fromReader,
      RTE.flatMapOption(identity, () => SearchCommand.noMatches(query)),
      RTE.map((items) =>
        Card.nav(
          SearchCommand.title(items.length, 'card', query),
          items,
          message
        )
      ),
      RTE.flatMap(Nav.sendInitialPage(message))
    );
  },
};
