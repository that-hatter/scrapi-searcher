import { pipe, RA, RTE, TE } from '@that-hatter/scrapi-factory/fp';
import { Greenlight } from '../../ygo';
import { createPageFromIds, currentPageIds, Ids } from '../commands/dev/claim';
import { Ctx, dd, Err, Interaction, Menu, Op, str } from '../modules';

const splitOn = (lines: ReadonlyArray<string>, start: string, incl: string) =>
  pipe(
    lines,
    RA.spanLeft((ln) => !ln.startsWith(start) || !ln.includes(incl)),
    ({ init, rest }) => {
      if (rest.length < 1) return [init, rest] as const;
      return [[...init, rest[0]!], rest.slice(1)] as const;
    }
  );

const prepareEdit =
  (pack: string, theme: string, card: string, user: string) =>
  (s: string): Op.Op<string> => {
    const lines = s.split('\n');
    const [prePack, postPack] = splitOn(lines, '# ', pack);
    if (postPack.length === 0) return RTE.left(Err.ignore());

    const [preTheme, postTheme] =
      theme === '???' ? [[], postPack] : splitOn(postPack, '## ', theme);
    if (postTheme.length === 0) return RTE.left(Err.ignore());

    const [preCard, postCard] = splitOn(postTheme, '### ', card);
    if (postCard.length === 0) return RTE.left(Err.ignore());

    const [toEdit_, rest] = splitOn(postCard, '#', '');
    const toEdit = toEdit_.join('\n');

    const edit = toEdit
      .replace('- [ ] Claimed [ ]', `- [ ] Claimed []`)
      .replace('- [ ] Claimed []', `- [x] Claimed [${user}]`);

    if (toEdit === edit) return RTE.left(Err.ignore());

    return pipe(
      [prePack, preTheme, preCard, [edit], rest],
      RA.flatten,
      str.intercalate('\n'),
      RTE.right
    );
  };

const processClaim =
  (ids: Ids, card: string) =>
  (user: string): Op.Op<unknown> =>
    pipe(
      Greenlight.fetchRawIssues,
      RTE.flatMapOption(
        RA.findFirst(({ number }) => ids.issue === number),
        Err.ignore
      ),
      RTE.flatMapNullable(({ body }) => body, Err.ignore),
      RTE.flatMap(prepareEdit(ids.pack, ids.theme, card, user)),
      RTE.flatMap((edit) => Greenlight.editIssue(ids.issue, edit)),
      RTE.orElseW(RTE.right) // always return as success even if it fails
    );

const getClaimer = (user: dd.User) => (ctx: Ctx.Ctx) =>
  TE.right(ctx.dev.users[user.id.toString()] ?? user.discriminator);

export const glCardClaim = Menu.interaction({
  name: 'glCardClaim',
  execute: (_, interaction, [card]) => {
    const statuses = Greenlight.pageStatuses(interaction.message);
    return pipe(
      currentPageIds(interaction.message),
      RTE.flatMap((ids) =>
        pipe(
          getClaimer(interaction.user),
          RTE.flatMap(processClaim(ids, card)),
          RTE.flatMap(() =>
            createPageFromIds(statuses)(interaction.message)(ids)
          )
        )
      ),
      RTE.flatMap(Interaction.sendUpdate(interaction))
    );
  },
});
