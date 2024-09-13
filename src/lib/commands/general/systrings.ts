import { identity, pipe, R, RNEA, RTE } from '@that-hatter/scrapi-factory/fp';
import { Systrings } from '../../../ygo';
import { Command, Err, Nav, SearchCommand, str } from '../../modules';

export const systrings: Command.Command = {
  name: 'systrings',
  description:
    'Search system strings by name or value. ' +
    'Name matches are case-insensitive and can be partial.',
  syntax: 'systrings <query>',
  aliases: [],
  execute: (parameters, message) => {
    const query = parameters.join(' ');
    return pipe(
      Systrings.findMatches('system')(query),
      R.map(RNEA.fromReadonlyArray),
      RTE.fromReader,
      RTE.flatMapOption(identity, () =>
        Err.forUser('No matches found for ' + str.inlineCode(query))
      ),
      RTE.map(
        (items): Nav.Nav<Systrings.Systring> => ({
          title: SearchCommand.title(items.length, 'system string', query),
          items,
          selectHint: 'Select system string to display',
          bulletList: true,
          messageId: message.id,
          channelId: message.channelId,
          itemName: (ct) => ct.name,
          itemListDescription: Systrings.itemListDescription,
          itemEmbed: Systrings.itemEmbed,
        })
      ),
      RTE.flatMap(Nav.sendInitialPage(message))
    );
  },
};
