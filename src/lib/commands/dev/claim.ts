import {
  flow,
  O,
  pipe,
  RA,
  RNEA,
  RTE,
  TE,
} from '@that-hatter/scrapi-factory/fp';
import { Greenlight } from '../../../ygo';
import { COLORS } from '../../constants';
import { Command, dd, Err, Interaction, Menu, Op, str } from '../../modules';

export type Ids = {
  readonly issue: number;
  readonly pack: string;
  readonly theme: string;
};

export type Section = {
  readonly issues: Greenlight.Issues;
  readonly theme: Greenlight.Theme;
  readonly pack: Greenlight.Pack;
  readonly issue: Greenlight.Issue;
};

const sectionFromIds = (ids: Partial<Ids>): Op.Op<Section> =>
  flow(
    Greenlight.getIssues,
    TE.flatMap((issues) => {
      if (!RA.isNonEmpty(issues))
        return TE.left(Err.forAll('No open issues in the repository'));

      const issue = ids.issue
        ? issues.find((is) => is.id === ids.issue)
        : RNEA.head(issues);
      if (!issue)
        return TE.left(Err.forAll('Could not find issue: ' + ids.issue));

      const pack = ids.pack
        ? issue.packs.find((p) => p.name === ids.pack)
        : RNEA.head(issue.packs);
      if (!pack) return TE.left(Err.forAll('Could not find pack: ' + ids.pack));

      const theme = ids.theme
        ? pack.themes.find((th) => th.name === ids.theme)
        : RNEA.head(pack.themes);
      if (!theme)
        return TE.left(Err.forAll('Could not find theme: ' + ids.theme));

      return TE.right({ theme, pack, issue, issues });
    })
  );

const issueMenu = (
  current: Greenlight.Issue,
  issues: Greenlight.Issues
): dd.ActionRow =>
  pipe(
    issues,
    RA.map((is) => ({
      label: 'Issue #' + is.id,
      value: is.id.toString(),
      description: is.title,
      default: current.id === is.id,
    })),
    (options) => ({
      customId: 'glIssueSelect ' + current.id,
      options,
      placeholder: 'Select issue to display',
      disabled: options.length < 2,
    }),
    Menu.row
  );

const packMenu = (
  pack: Greenlight.Pack,
  issue: Greenlight.Issue
): dd.ActionRow =>
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

const themeMenu = (
  theme: Greenlight.Theme,
  pack: Greenlight.Pack
): dd.ActionRow =>
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

const cardMenu = (section: Section): dd.ActionRow =>
  pipe(
    section.theme.cards,
    RA.filter((c) => O.isNone(c.status)),
    RA.map(Greenlight.cardOption),
    (options) => ({
      customId: 'glCardClaim',
      options,
      placeholder: 'Select card to claim',
    }),
    Menu.row
  );

const page =
  (statuses: Greenlight.StatusSteps) =>
  (section: Section): Interaction.UpdateData => {
    const title = section.theme.name === '???' ? undefined : section.theme.name;
    const cardStrs = pipe(
      section.theme.cards,
      RA.filter(Greenlight.cardHasStatus(statuses)),
      RA.map(Greenlight.formatCard),
      RNEA.fromReadonlyArray,
      O.getOrElseW(() => [str.subtext('No cards match the current filters.')])
    );
    const description = str.joinParagraphs([
      ...cardStrs,
      '',
      Greenlight.formatPack(section.pack),
      Greenlight.formatIssue(section.issue),
    ]);

    const components = [
      Greenlight.statusMenu(statuses),
      issueMenu(section.issue, section.issues),
      packMenu(section.pack, section.issue),
      themeMenu(section.theme, section.pack),
      cardMenu(section),
    ];

    const color = COLORS.GREENLIGHT_GREEN;

    return { embeds: [{ color, title, description }], components };
  };

export const pageByIds = (statuses: Greenlight.StatusSteps) =>
  flow(sectionFromIds, RTE.map(page(statuses)));

export const switchSection = (ixn: Interaction.Updateable) =>
  flow(
    sectionFromIds,
    RTE.map(page(Greenlight.pageStatuses(ixn.message))),
    RTE.flatMap(Interaction.sendUpdate(ixn))
  );

const getMenuParam = (
  customId: string,
  menus: ReadonlyArray<dd.SelectMenuComponent>
) =>
  pipe(
    menus,
    RA.findFirst((m) => m.customId.startsWith(customId + ' ')),
    O.map((a) => str.split(' ')(a.customId)),
    O.map(RNEA.unprepend),
    O.map(([_, params]) => params.join(' ')),
    O.flatMap(str.unempty)
  );

export const currentPageIds = (message: dd.Message): Op.Op<Ids> =>
  pipe(
    O.Do,
    O.bind('components', () => O.fromNullable(message.components)),
    O.let('menus', ({ components }) => RA.filterMap(Menu.extract)(components)),
    O.bind('issue', ({ menus }) =>
      pipe(
        getMenuParam('glIssueSelect', menus),
        O.map((is) => +is),
        O.filter((is) => !isNaN(is) && is > 0)
      )
    ),
    O.bind('pack', ({ menus }) => getMenuParam('glPackSelect', menus)),
    O.bind('theme', ({ menus }) => getMenuParam('glThemeSelect', menus)),
    RTE.fromOption(() => Err.forAll('Could not parse page ids'))
  );

export const filterStatus =
  (statuses: Greenlight.StatusSteps) => (ixn: Interaction.Updateable) =>
    pipe(
      currentPageIds(ixn.message),
      RTE.flatMap(pageByIds(statuses)),
      RTE.flatMap(Interaction.sendUpdate(ixn))
    );

const initialPage = (issues: RNEA.ReadonlyNonEmptyArray<Greenlight.Issue>) => {
  const issue = RNEA.head(issues);
  const pack = RNEA.head(issue.packs);
  const theme = RNEA.head(pack.themes);
  const statuses = pipe(
    theme.cards[0].status,
    O.map(({ step }) => ['Unclaimed', step] as const),
    O.getOrElseW(() => ['Unclaimed'] as const)
  );
  return page(statuses)({ theme, pack, issue, issues });
};

export const claim: Command.Command = {
  name: 'claim',
  description: 'View and claim cards in open Greenlight issues.',
  syntax: 'claim',
  aliases: [],
  devOnly: true,
  execute: (_, message) =>
    pipe(
      Greenlight.getIssues,
      RTE.flatMapOption(RNEA.fromReadonlyArray, () =>
        Err.forUser('There are currently no applicable Greenlight issues.')
      ),
      RTE.map(initialPage),
      RTE.flatMap(Op.sendReply(message))
    ),
};
