import { O, pipe, RA, RNEA, RTE } from '@that-hatter/scrapi-factory/fp';
import { Greenlight } from '../../ygo';
import { getState, page, State } from '../commands/dev/stage';
import { Err, Interaction, Menu } from '../modules';

const response =
  (state: State, ids: ReadonlyArray<string>) => (issues: Greenlight.Issues) =>
    pipe(
      issues,
      Greenlight.allCards,
      RA.filter((c) => O.some(c.enName) && ids.includes(c.id)),
      (cards) => page({ ...state, staged: [...state.staged, ...cards] })(issues)
    );

export const glCardStage = Menu.interaction({
  name: 'glCardStage',
  execute: (_, interaction, ids) =>
    pipe(
      interaction.message,
      getState,
      RTE.flatMap((state) =>
        pipe(
          Greenlight.getIssues,
          RTE.flatMapOption(RNEA.fromReadonlyArray, Err.ignore),
          RTE.map(response(state, ids))
        )
      ),
      RTE.flatMap(Interaction.sendUpdate(interaction))
    ),
});
