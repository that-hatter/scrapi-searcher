import { O, pipe, TE } from '@that-hatter/scrapi-factory/fp';
import { Collection, Event, Interaction, Op, str } from '../modules';

export const interactionCreate: Event.Event<'interactionCreate'> = {
  name: 'interactionCreate',
  handle: (_, interaction) => (ctx) =>
    pipe(
      interaction.data?.customId,
      O.fromNullable,
      O.map(str.split(' ')),
      O.flatMap(([id, ...parameters]) =>
        pipe(
          id,
          Collection.findByKey(ctx.componentInteractions),
          O.filter((cmp) => cmp.type === interaction.data?.componentType),
          O.filter(
            (cmp) => !cmp.devOnly || Interaction.devCheck(interaction)(ctx)
          ),
          O.map((cmp) =>
            pipe(
              cmp.execute(parameters, interaction)(ctx),
              TE.mapError(Interaction.err(cmp, interaction))
            )
          )
        )
      ),
      O.getOrElseW(() => Op.noop)
    ),
};
