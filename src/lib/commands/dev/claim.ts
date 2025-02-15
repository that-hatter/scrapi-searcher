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
  readonly issue: number;
  readonly pack: string;
  readonly theme: string;
  readonly displayClaimed: boolean;
};

const getMenuState = (
  index: number,
  customId: string,
  components: ReadonlyArray<dd.Component>
): Op.Op<string> =>
  pipe(
    components.at(index),
    O.fromNullable,
    O.flatMap(Menu.extract),
    O.filter((m) => m.customId.startsWith(customId + ' ')),
    O.map((a) => str.split(' ')(a.customId)),
    O.map(RNEA.unprepend),
    O.map(([_, params]) => params.join(' ')),
    O.flatMap(str.unempty),
    RTE.fromOption(() =>
      Err.forDev('Failed to parse claiming menu state: ' + index)
    )
  );

export const currentState = (message: dd.Message): Op.Op<State> =>
  pipe(
    O.Do,
    O.bind('comps', () => O.fromNullable(message.components)),
    O.bind('displayClaimed', ({ comps }) =>
      pipe(
        comps.at(0),
        O.fromNullable,
        O.map(Button.extract),
        O.chainNullableK((buttons) => buttons.at(1)?.customId),
        O.filter((id) => id.startsWith('glDisplayClaimed ')),
        O.map((id) => id.endsWith(' true'))
      )
    ),
    RTE.fromOption(() =>
      Err.forDev('Could not parse claiming interface state.')
    ),
    RTE.bind('issues', () => Greenlight.getIssues),
    RTE.bind('issue', ({ comps }) =>
      pipe(
        getMenuState(1, 'glIssueSelect', comps),
        RTE.map((n) => +n),
        RTE.filterOrElse(
          (n) => !isNaN(n) && n > 0,
          () => Err.forDev('Invalid issue number')
        )
      )
    ),
    RTE.bind('pack', ({ comps }) => getMenuState(2, 'glPackSelect', comps)),
    RTE.bind('theme', ({ comps }) => getMenuState(3, 'glThemeSelect', comps))
  );

export type Section = {
  readonly issues: Greenlight.Issues;
  readonly theme: Greenlight.Theme;
  readonly pack: Greenlight.Pack;
  readonly issue: Greenlight.Issue;
};

const sectionFromState = (
  state: Partial<State>,
  issues: RNEA.ReadonlyNonEmptyArray<Greenlight.Issue>
): Section => {
  const issue = issues.find((is) => is.id === state.issue) ?? RNEA.head(issues);
  const pack =
    issue.packs.find((pk) => pk.name === state.pack) ?? RNEA.head(issue.packs);
  const theme =
    pack.themes.find((th) => th.name === state.theme) ?? RNEA.head(pack.themes);
  return { issues, issue, pack, theme };
};

const buttonRow = ({ displayClaimed }: State): dd.ActionRow =>
  Button.row([
    Button.button({
      label: 'Refresh',
      style: Button.Styles.Secondary,
      customId: 'glClaimRefresh',
    }),
    Button.button({
      label: (displayClaimed ? 'Exclude' : 'Show') + ' claimed cards',
      style: displayClaimed ? Button.Styles.Secondary : Button.Styles.Primary,
      customId: 'glDisplayClaimed ' + displayClaimed,
    }),
  ]);

const issueMenu = ({ issues, issue }: Section): dd.ActionRow =>
  pipe(
    issues,
    RA.map((is) => ({
      label: 'Issue #' + is.id,
      value: is.id.toString(),
      description: is.title,
      default: issue.id === is.id,
    })),
    (options) => ({
      customId: 'glIssueSelect ' + issue.id,
      options,
      placeholder: 'Select issue to display',
      disabled: options.length < 2,
    }),
    Menu.row
  );

const packMenu = ({ issue, pack }: Section): dd.ActionRow =>
  pipe(
    issue.packs,
    RA.map((p) => ({
      label: p.name,
      value: p.name,
      description: str.join(' | ')([p.code, p.range]) || undefined,
      default: pack.name === p.name,
    })),
    (options) => ({
      customId: 'glPackSelect ' + pack.name,
      options,
      placeholder: 'Select pack to display',
      disabled: options.length < 2,
    }),
    Menu.row
  );

const themeMenu = ({ pack, theme }: Section): dd.ActionRow =>
  pipe(
    pack.themes,
    RA.map(
      (th): dd.SelectOption => ({
        label: th.name,
        value: th.name,
        default: theme.name === th.name,
      })
    ),
    (options) => ({
      customId: 'glThemeSelect ' + theme.name,
      options,
      placeholder: 'Select theme to display',
      disabled: options.length < 2,
    }),
    Menu.row
  );

const cardMenu = ({ theme }: Section): dd.ActionRow =>
  pipe(
    theme.cards,
    RA.filter((c) => O.isNone(c.status)),
    RA.map(Greenlight.cardOption),
    (options) => ({
      customId: 'glCardClaim',
      options,
      placeholder: 'Select card(s) to claim',
      maxValues: options.length || 1,
      disabled: options.length === 0,
    }),
    Menu.row
  );

export const page = (state: State): Op.Op<Interaction.UpdateData> =>
  pipe(
    Greenlight.getIssues,
    RTE.map((issues) => {
      const section = sectionFromState(state, issues);
      const title = section.theme.name;

      const cardStrings = pipe(
        section.theme.cards,
        RA.filter((c) => state.displayClaimed || O.isNone(c.status)),
        RA.map(Greenlight.formatCard),
        RNEA.fromReadonlyArray,
        O.getOrElseW(() => [str.subtext('No cards match the current filters.')])
      );
      const description = str.joinParagraphs([
        ...cardStrings,
        '',
        Greenlight.formatPack(section.pack),
        Greenlight.formatIssue(section.issue),
      ]);

      const components = [
        buttonRow(state),
        issueMenu(section),
        packMenu(section),
        themeMenu(section),
        cardMenu(section),
      ];

      const color = COLORS.GREENLIGHT_GREEN;

      return { embeds: [{ color, title, description }], components };
    })
  );

export const claim: Command.Command = {
  name: 'claim',
  description: 'View and claim cards in open Greenlight issues.',
  syntax: 'claim',
  aliases: [],
  devOnly: true,
  execute: (_, message) =>
    pipe(
      // dummy state that will default to the first issue, pack, and theme
      page({ issue: -1, pack: '', theme: '', displayClaimed: false }),
      RTE.flatMap(Op.sendReply(message))
    ),
};
