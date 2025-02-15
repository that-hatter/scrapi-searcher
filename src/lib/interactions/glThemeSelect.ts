import { pipe, RTE } from '@that-hatter/scrapi-factory/fp';
import { currentState, page } from '../commands/dev/claim';
import { Interaction, Menu } from '../modules';

export const glThemeSelect = Menu.interaction({
  name: 'glThemeSelect',
  devOnly: true,
  execute: (_, interaction, [theme]) =>
    pipe(
      currentState(interaction.message),
      RTE.flatMap((state) => page({ ...state, theme })),
      RTE.flatMap(Interaction.sendUpdate(interaction))
    ),
});
