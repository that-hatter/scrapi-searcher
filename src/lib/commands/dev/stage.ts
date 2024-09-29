import { O, pipe, RA, RNEA, RTE } from '@that-hatter/scrapi-factory/fp';
import { Greenlight } from '../../../ygo';
import { COLORS } from '../../constants';
import {
  Button,
  Command,
  dd,
  Err,
  Interaction,
  Menu,
  Op,
  str,
} from '../../modules';

export type State = {
  readonly filename: string;
  readonly staged: ReadonlyArray<Greenlight.Card>;
  readonly statuses: Greenlight.StatusSteps;
};

const finishButton = (staged: ReadonlyArray<Greenlight.Card>) =>
  Button.row([
    {
      style: dd.ButtonStyles.Success,
      customId: 'glFinishStage',
      label: 'Finish',
      disabled: staged.length === 0,
    },
  ]);

const cardStageMenu = (
  statuses: Greenlight.StatusSteps,
  staged: ReadonlyArray<Greenlight.Card>,
  issues: ReadonlyArray<Greenlight.Issue>
): dd.ActionRow =>
  pipe(
    issues,
    Greenlight.allCards,
    RA.filter(
      (c) =>
        O.isSome(c.enName) &&
        Greenlight.cardHasStatus(statuses)(c) &&
        !staged.some((sc) => sc.id === c.id)
    ),
    RA.map(Greenlight.cardOption),
    (options) => ({
      customId: 'glCardStage',
      maxValues: 25,
      options,
      placeholder: 'Select cards to stage',
    }),
    Menu.row
  );

const cardUnstageMenu = (cards: ReadonlyArray<Greenlight.Card>): dd.ActionRow =>
  pipe(cards, RA.map(Greenlight.cardOption), (options) =>
    Menu.row({
      customId: 'glCardUnstage',
      maxValues: 25,
      options,
      placeholder: 'Select cards to unstage',
    })
  );

export const page =
  (state: State) =>
  (issues: ReadonlyArray<Greenlight.Issue>): Interaction.UpdateData => {
    const title = 'Staging cards for ' + str.inlineCode(state.filename);
    const description =
      state.staged.length === 0
        ? undefined
        : state.staged.map(Greenlight.formatCardHead).join('\n');
    const color = COLORS.GREENLIGHT_GREEN;
    const footer =
      'The status filters below apply to the card choices to be staged, ' +
      'NOT to the already staged cards listed above.';

    return {
      embeds: [{ title, description, color, footer: { text: footer } }],
      components: [
        finishButton(state.staged),
        cardUnstageMenu(state.staged),
        cardStageMenu(state.statuses, state.staged, issues),
        Greenlight.statusMenu(state.statuses),
      ],
    };
  };

export const getState = (message: dd.Message): Op.Op<State> =>
  pipe(
    O.Do,
    O.bind('embed', () => O.fromNullable(message.embeds[0])),
    O.bind('filename', ({ embed }) =>
      pipe(
        embed.title,
        O.fromNullable,
        O.map((n) => n.substring('Staging cards for `'.length, n.length - 1)),
        O.flatMap(str.unempty)
      )
    ),
    O.let('statuses', () => Greenlight.pageStatuses(message)),
    O.let('staged', ({ embed }) => {
      if (!embed.description || embed.description.length === 0) return [];

      return pipe(
        embed.description,
        str.split('\n'),
        RA.filterMap(Greenlight.parseCardHead),
        RA.map((c): Greenlight.Card => ({ ...c, status: O.none }))
      );
    }),
    O.map(({ filename, staged, statuses }) => ({ filename, staged, statuses })),
    RTE.fromOption(() => Err.forDev('Could not parse staging state'))
  );

export const filterStatus =
  (statuses: Greenlight.StatusSteps) => (ixn: Interaction.WithMsg) =>
    pipe(
      getState(ixn.message),
      RTE.flatMap((state) =>
        pipe(Greenlight.getIssues, RTE.map(page({ ...state, statuses })))
      ),
      RTE.flatMap(Interaction.sendUpdate(ixn))
    );

export const stage: Command.Command = {
  name: 'stage',
  description:
    'Prepare a cdb file with selected cards from the Greenlight repo.',
  syntax: 'stage <cdb-name>',
  aliases: ['prepdb'],
  devOnly: true,
  execute: (parameters, message) => {
    const name = parameters.join(' ').trim();
    if (name.length === 0)
      return RTE.left(Err.forUser('You must specify a name for the cdb file.'));

    return pipe(
      Greenlight.getIssues,
      RTE.flatMapOption(RNEA.fromReadonlyArray, () =>
        Err.forUser('There are currently no applicable Greenlight issues.')
      ),
      RTE.map(
        page({
          filename: name.endsWith('.cdb') ? name : name + '.cdb',
          staged: [],
          statuses: ['Unclaimed', 'Claimed', 'Scripted'],
        })
      ),
      RTE.flatMap(Op.sendReply(message))
    );
  },
};
