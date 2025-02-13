import { flow, O, pipe, RA, RNEA } from '@that-hatter/scrapi-factory/fp';
import { ActionRow, dd, Interaction, Op, str } from '.';
import { CanBeReadonly } from '../utils';

export const MessageComponentType: dd.MessageComponentTypes.SelectMenu = 3;

export type Menu = dd.SelectMenuComponent;

export type Params = CanBeReadonly<Omit<Menu, 'type'>>;

export type Row = dd.ActionRow;

const limitStr100 = str.limit('...', 100);

const safeOptions = flow(
  RA.uniq<dd.SelectOption>({ equals: (a, b) => a.value === b.value }),
  RA.takeLeft(25),
  RA.map(
    (opt): dd.SelectOption => ({
      ...opt,
      label: limitStr100(opt.label),
      description: opt.description ? limitStr100(opt.description) : undefined,
    })
  ),
  RA.toArray
);

export const menu = (params: Params): Menu => {
  if (params.options.length === 0) return dummy(params);
  return {
    ...params,
    type: MessageComponentType,
    options: safeOptions(params.options),
    maxValues: Math.min(params.maxValues ?? 1, params.options.length),
    minValues: Math.max(params.minValues ?? 1, 1),
  };
};

export const row = (params: Params): Row => ({
  type: ActionRow.MessageComponentType,
  components: [menu(params)],
});

export const dummy = (params: Omit<Params, 'options' | 'disabled'>): Menu =>
  menu({
    ...params,
    options: [{ label: '---', value: 'DUMMY_OPTION' }],
    disabled: true,
  });

export const dummyRow = flow(dummy, row);

export const extract = (row: dd.Component): O.Option<Menu> => {
  if (row.type !== ActionRow.MessageComponentType) return O.none;
  if (!row.components || row.components.length !== 1) return O.none;

  const menu = row.components[0]!;
  if (!('type' in menu) || !('customId' in menu)) return O.none;
  if (menu.type !== MessageComponentType) return O.none;

  return O.some(menu as dd.SelectMenuComponent);
};

export const updateDefault =
  (fn: (opt: dd.SelectOption) => boolean) =>
  (menu: Menu): Menu => ({
    ...menu,
    options: menu.options.map((opt) => ({ ...opt, default: fn(opt) })),
  });

export type Execution = (
  parameters: ReadonlyArray<string>,
  interaction: Interaction.WithMsg,
  values: RNEA.ReadonlyNonEmptyArray<string>
) => Op.Op<unknown>;

export const interaction = (ev: {
  readonly name: string;
  readonly execute: Execution;
  readonly devOnly?: boolean;
}): Interaction.Component => ({
  ...ev,
  type: MessageComponentType,
  execute: (parameters, interaction) =>
    pipe(
      O.Do,
      O.bind('ixn', () => Interaction.updateable(interaction)),
      O.bind('values', () =>
        pipe(
          interaction.data?.values,
          O.fromNullable,
          O.flatMap(RNEA.fromReadonlyArray)
        )
      ),
      O.map(({ ixn, values }) => ev.execute(parameters, ixn, values)),
      O.getOrElseW(() => Op.noopReader)
    ),
});
