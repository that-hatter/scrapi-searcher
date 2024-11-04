import { pipe, RTE, TE } from '@that-hatter/scrapi-factory/fp';
import { Ctx } from '../../Ctx';
import * as Function from '../../yard/Function';
import { Err, Interaction, Menu, Nav, Op } from '../modules';

const functionTypeUpdate =
  (name: string, ixn: Interaction.WithMsg) =>
  (sig: number): Op.Op<void> =>
    RTE.left(Err.forDev('Function Type signature view is unimplemented'));

const findFunction = (name: string) => (ctx: Ctx) =>
  TE.fromNullable('Function not found: ' + name)(
    ctx.yard.api.functions.record[name]
  );

const functionUpdate =
  (name: string, ixn: Interaction.WithMsg) =>
  (sig: number): Op.Op<unknown> =>
    pipe(
      RTE.Do,
      RTE.bind('fn', () => findFunction(name)),
      RTE.bind('embed', ({ fn }) => Function.embed(sig)(fn)),
      RTE.bind('component', ({ fn }) => Function.components(sig)(fn)),
      RTE.mapError(Err.forDev),
      RTE.flatMap(({ embed, component }) =>
        Nav.updateDisplay(embed, component)(ixn)
      )
    );

const update =
  (ixn: Interaction.WithMsg) =>
  (sig: number): Op.Op<unknown> => {
    const embed = ixn.message.embeds?.at(0);
    const name = embed?.title;
    if (!name) return RTE.left(Err.forDev('Failed to parse name'));

    const typ = embed?.footer?.text.split(' | ')[0];
    if (!typ) return RTE.left(Err.forDev('Failed to parse doctype'));
    if (typ === 'function type') return functionTypeUpdate(name, ixn)(sig);

    return functionUpdate(name, ixn)(sig);
  };

export const signature = Menu.interaction({
  name: 'signature',
  execute: (_, interaction, [sig]) =>
    pipe(
      +sig,
      RTE.fromPredicate(
        (n) => !isNaN(n),
        () => Err.forDev('Could not parse signature: ' + sig)
      ),
      RTE.flatMap(update(interaction))
    ),
});
