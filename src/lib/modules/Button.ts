import { O, pipe, RA, RNEA } from '@that-hatter/scrapi-factory/fp';
import { dd, Interaction, Op } from '.';
import { CanBeReadonly } from '../utils';

export type Button = dd.ButtonComponent;

export type Params = CanBeReadonly<Omit<Button, 'type'>>;

export type Row = dd.ActionRow;

export const button = (opts: Params): Button => ({
  ...opts,
  type: dd.MessageComponentTypes.Button,
});

export const row = (opts: RNEA.ReadonlyNonEmptyArray<Params>): Row => ({
  type: dd.MessageComponentTypes.ActionRow,
  components: pipe(opts, RA.takeLeft(5), RA.map(button)) as Row['components'],
});

export const isButton = (comp: dd.Component): comp is Button =>
  'type' in comp && comp.type === dd.MessageComponentTypes.Button;

export const extract = (row: dd.Component): ReadonlyArray<Button> => {
  if (row.type !== dd.MessageComponentTypes.ActionRow) return [];
  if (!row.components || row.components.length < 1) return [];
  return row.components.filter(isButton);
};

export const extractAll = RA.flatMap(extract);

export type Execution = (
  parameters: ReadonlyArray<string>,
  interaction: Interaction.Updateable
) => Op.Op<unknown>;

export const interaction = (ev: {
  readonly name: string;
  readonly execute: Execution;
  readonly devOnly?: boolean;
}): Interaction.Component => ({
  ...ev,
  type: dd.MessageComponentTypes.Button,
  execute: (parameters, interaction) =>
    pipe(
      interaction,
      Interaction.updateable,
      O.map((ixn) => ev.execute(parameters, ixn)),
      O.getOrElseW(() => Op.noopReader)
    ),
});
