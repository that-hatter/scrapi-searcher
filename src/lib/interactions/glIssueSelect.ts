import { pipe, RTE } from '@that-hatter/scrapi-factory/fp';
import { currentState, page } from '../commands/dev/claim';
import { Interaction, Menu } from '../modules';

export const glIssueSelect = Menu.interaction({
  name: 'glIssueSelect',
  devOnly: true,
  execute: (_, interaction, [issue]) =>
    pipe(
      currentState(interaction.message),
      RTE.flatMap((state) => page({ ...state, issue: +issue })),
      RTE.flatMap(Interaction.sendUpdate(interaction))
    ),
});
