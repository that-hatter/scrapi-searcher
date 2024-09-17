import { O, pipe, RTE } from '@that-hatter/scrapi-factory/fp';
import { executeUpdates, parseKeys } from '../commands/dev/update';
import { Err, Interaction, Menu } from '../modules';

export const update = Menu.interaction({
  name: 'update',
  devOnly: true,
  execute: (_, interaction, params) => {
    const keys = parseKeys(params);

    if (O.isNone(keys))
      return RTE.left(Err.forDev('Failed to parse update keys'));

    return pipe(
      Interaction.sendUpdate(interaction)({
        content: 'Starting update',
        components: [],
      }),
      RTE.flatMap(() => executeUpdates(keys.value)(interaction.message))
    );
  },
});
