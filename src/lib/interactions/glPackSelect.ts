import { pipe, RTE } from '@that-hatter/scrapi-factory/fp';
import { currentState, page } from '../commands/dev/claim';
import { Interaction, Menu } from '../modules';

export const glPackSelect = Menu.interaction({
  name: 'glPackSelect',
  devOnly: true,
  execute: (_, interaction, [pack]) =>
    pipe(
      currentState(interaction.message),
      RTE.flatMap((state) => page({ ...state, pack })),
      RTE.flatMap(Interaction.sendUpdate(interaction))
    ),
});
