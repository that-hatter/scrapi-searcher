import { E, O, pipe, RA, RTE, TE } from '@that-hatter/scrapi-factory/fp';
import { readerTask as RT } from 'fp-ts';
import { Ctx } from '../../Ctx';
import { Github, Interaction, Menu, Op, Resource, str } from '../modules';

const keyToRepo =
  ({ sources }: Ctx) =>
  (key: string): O.Option<Github.Source> => {
    if (key === 'yard') return O.some(sources.yard);
    if (key === 'base') return O.some(sources.base);
    if (key === 'banlists') return sources.banlists;
    if (key === 'misc') return sources.misc;

    const expKey = 'expansions ';
    if (!key.startsWith(expKey)) return O.none;
    const idx = parseInt(key.substring(expKey.length));
    if (isNaN(idx) || idx === null) return O.none;
    return O.fromNullable(sources.expansions[idx]);
  };

const repoNameLink = (src: Github.Source) =>
  str.link(str.inlineCode(src.repo), Github.treeURL(src));

const statusEdit =
  (repos: ReadonlyArray<Github.Source>) => (status: string) => (ctx: Ctx) =>
    pipe(
      repos,
      RA.map(repoNameLink),
      str.intercalate(', '),
      str.prepend(status + ' '),
      str.append('.\nSee details in ' + str.channel(ctx.dev.logs) + '.'),
      (content) => TE.right({ content, components: [] })
    );

export const update = Menu.interaction({
  name: 'update',
  devOnly: true,
  execute: (_, interaction, keys) => (ctx) => {
    const msg = interaction.message;
    const repos = RA.filterMap(keyToRepo(ctx))(keys);
    return pipe(
      'Manually updating',
      statusEdit(repos),
      RTE.flatMap(Interaction.sendUpdate(interaction)),
      RTE.flatMap(() =>
        pipe(repos, RA.map(Resource.manualUpdate(msg)), RTE.sequenceSeqArray)
      ),
      RT.tap((res) =>
        pipe(
          E.isRight(res) ? 'Successfully updated' : 'Failed to update',
          statusEdit(repos),
          RTE.flatMap(Op.editMessage(msg.channelId)(msg.id))
        )
      )
    )(ctx);
  },
});
