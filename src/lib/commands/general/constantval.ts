import type * as sf from '@that-hatter/scrapi-factory';
import { TE } from '@that-hatter/scrapi-factory/fp';
import { itemEmbed, itemListDescription } from '../../../yard/Constant';
import { Topic } from '../../../yard/shared';
import { Command, SearchCommand } from '../../modules';
import { utils } from '../../utils';

const searchCmd = SearchCommand.searchCommand<sf.Constant>({
  name: 'constantval',
  aliases: ['cval'],
  itemCollection: (ctx) => TE.right(ctx.yard.api.constants),
  itemId: ({ name }) => name,
  customFilter: (params) => (ct) => {
    const query = params.join(' ');
    if (typeof ct.value === 'string')
      return ct.value.toLowerCase().includes(query);
    const b = utils.safeBigInt(query);
    if (b === 0n && +query !== 0) return false;
    return utils.safeBigInt(ct.value) === b;
  },
  itemListDescription,
  itemMenuDescription: Topic.defaultMenuDescription,
  itemEmbed,
});

// Once a general filter system is implemented, this command may be removed
// in favor of having 'value' as a filter for constants
export const constantval: Command.Command = {
  ...searchCmd,
  description: 'Search constants by value. Number values must be exact.',
};
