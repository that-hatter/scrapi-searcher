import { pipe, RTE } from '@that-hatter/scrapi-factory/fp';
import { Greenlight } from '../../ygo';
import { getState, page, State } from '../commands/dev/stage';
import { Interaction, Menu } from '../modules';

const response = (state: State, ids: ReadonlyArray<string>) =>
  page({ ...state, staged: state.staged.filter((c) => !ids.includes(c.id)) });

export const glCardUnstage = Menu.interaction({
  name: 'glCardUnstage',
  execute: (_, interaction, ids) =>
    pipe(
      interaction.message,
      getState,
      RTE.flatMap((state) =>
        pipe(Greenlight.getIssues, RTE.map(response(state, ids)))
      ),
      RTE.flatMap(Interaction.sendUpdate(interaction))
    ),
});
