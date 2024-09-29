import { E, pipe, RNEA, RTE, TE } from '@that-hatter/scrapi-factory/fp';
import { readerTask as RT } from 'fp-ts';
import { Ctx } from '../../Ctx';
import { Data, Interaction, Menu, Op, str } from '../modules';

const statusEdit =
  (keys: RNEA.ReadonlyNonEmptyArray<string>) =>
  (status: string) =>
  (ctx: Ctx) =>
    pipe(
      keys,
      RNEA.map(str.inlineCode),
      str.intercalate(', '),
      str.prepend(status + ' '),
      str.append('.\nSee details in ' + str.channel(ctx.dev.logs) + '.'),
      (content) => TE.right({ content, components: [] })
    );

export const update = Menu.interaction({
  name: 'update',
  devOnly: true,
  execute: (_, interaction, keys) => {
    const msg = interaction.message;
    return pipe(
      'Manually updating',
      statusEdit(keys),
      RTE.flatMap(Interaction.sendUpdate(interaction)),
      RTE.flatMap(() => Data.manualUpdate(interaction, keys)),
      RT.tap((res) =>
        pipe(
          E.isRight(res) ? 'Successfully updated' : 'Failed to update',
          statusEdit(keys),
          RTE.flatMap(Op.editMessage(msg.channelId)(msg.id))
        )
      )
    );
  },
});
