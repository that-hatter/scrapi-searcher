import { identity, pipe, R, RNEA, RTE } from '@that-hatter/scrapi-factory/fp';
import { Systrings } from '../../../ygo';
import { Command, Nav, SearchCommand } from '../../modules';

export const systrings: Command.Command = {
  name: 'systrings',
  description:
    ' Find system strings by name or value. Case-insensitive, partial matches allowed.',
  syntax: 'systrings <query>',
  aliases: [],
  execute: (parameters, message) => {
    const query = parameters.join(' ').toLowerCase();
    return pipe(
      Systrings.findMatches('system')(query),
      R.map(RNEA.fromReadonlyArray),
      RTE.fromReader,
      RTE.flatMapOption(identity, () => SearchCommand.noMatches(query)),
      RTE.map(
        (items): Nav.Nav<Systrings.Systring> => ({
          title: SearchCommand.title(items.length, 'system string', query),
          items,
          selectHint: 'Select system string to display',
          bulletList: true,
          messageId: message.id,
          channelId: message.channelId,
          itemId: (ct) => ct.value.toString(),
          itemName: (ct) => RTE.right(ct.name),
          itemListDescription: Systrings.itemListDescription,
          itemMenuDescription: Systrings.itemMenuDescription,
          itemEmbed: Systrings.itemEmbed,
        })
      ),
      RTE.flatMap(Nav.sendInitialPage(message))
    );
  },
};
