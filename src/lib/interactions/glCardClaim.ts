import { pipe, RA, RNEA, RTE, TE } from '@that-hatter/scrapi-factory/fp';
import { Ctx } from '../../Ctx';
import { Greenlight } from '../../ygo';
import { currentState, page, State } from '../commands/dev/claim';
import { dd, Err, Interaction, Menu, Op, str } from '../modules';

const splitOn = (lines: ReadonlyArray<string>, start: string, incl: string) =>
  pipe(
    lines,
    RA.spanLeft((ln) => !ln.startsWith(start) || !ln.includes(incl)),
    ({ init, rest }) => {
      if (rest.length < 1) return [init, rest] as const;
      return [[...init, rest[0]!], rest.slice(1)] as const;
    }
  );

const prepareEdit = (
  current: string,
  pack: string,
  theme: string,
  card: string,
  user: string
): string => {
  const lines = current.split('\n');
  const [prePack, postPack] = splitOn(lines, '# ', pack);
  if (postPack.length === 0) return current;

  const [preTheme, postTheme] =
    theme === '???' ? [[], postPack] : splitOn(postPack, '## ', theme);
  if (postTheme.length === 0) return current;

  const [preCard, postCard] = splitOn(postTheme, '### ', card);
  if (postCard.length === 0) return current;

  const [toEdit_, rest] = splitOn(postCard, '#', '');
  const toEdit = toEdit_.join('\n');

  const edit = toEdit
    .replace('- [ ] Claimed [ ]', `- [ ] Claimed []`)
    .replace('- [ ] Claimed []', `- [x] Claimed [${user}]`);

  if (toEdit === edit) return current;

  return pipe(
    [prePack, preTheme, preCard, [edit], rest],
    RA.flatten,
    str.intercalate('\n')
  );
};

const processClaims =
  (state: State, cards: RNEA.ReadonlyNonEmptyArray<string>) =>
  (user: string): Op.Op<unknown> =>
    pipe(
      Greenlight.fetchRawIssues,
      RTE.flatMapOption(
        RA.findFirst(({ number }) => state.issue === number),
        Err.ignore
      ),
      RTE.flatMapNullable(({ body }) => body, Err.ignore),
      RTE.map((body) =>
        pipe(
          cards,
          RA.reduce(body, (curr, card) =>
            prepareEdit(curr, state.pack, state.theme, card, user)
          )
        )
      ),
      RTE.flatMap((edit) => Greenlight.editIssue(state.issue, edit)),
      RTE.orElseW(RTE.right) // always return as success even if it fails
    );

const getClaimer = (user: dd.User) => (ctx: Ctx) =>
  TE.right(ctx.dev.users[user.id?.toString()] ?? user.discriminator);

export const glCardClaim = Menu.interaction({
  name: 'glCardClaim',
  devOnly: true,
  execute: (_, interaction, cards) => {
    return pipe(
      currentState(interaction.message),
      RTE.flatMap((state) =>
        pipe(
          getClaimer(interaction.user),
          RTE.flatMap(processClaims(state, cards)),
          RTE.flatMap(() => page(state))
        )
      ),
      RTE.flatMap(Interaction.sendUpdate(interaction))
    );
  },
});
