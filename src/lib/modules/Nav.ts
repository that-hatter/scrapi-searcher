import { flow, O, pipe, RA, RNEA, RTE } from '@that-hatter/scrapi-factory/fp';
import {
  ActionRow,
  Button,
  Cache,
  dd,
  Err,
  Interaction,
  Menu,
  Op,
  str,
} from '.';
import { LIMITS } from '../constants';

const ITEM_PER_PAGE = 10;

export type Formatter<T, R> = (item: T) => Op.SubOp<R>;

export type Formatters<T> = {
  readonly itemName?: Formatter<T, string>;
  readonly itemMenuDescription?: Formatter<T, string>;
  readonly itemEmbed?: Formatter<T, dd.Embed>;
  readonly itemComponents?: Formatter<T, dd.MessageComponents>;
  readonly itemListDescription?: (
    pageItems: RNEA.ReadonlyNonEmptyArray<T>
  ) => Formatter<T, string>;
};

export type Nav<T> = {
  readonly items: ReadonlyArray<T>;
  readonly title: string;
  readonly selectHint: string;
  readonly messageId: dd.BigString;
  readonly channelId: dd.BigString;
  readonly bulletList?: boolean;
  // the name is needed for immediate operations, so it shouldn't be an RTE
  readonly itemId: (item: T) => string;
} & Formatters<T>;

// -----------------------------------------------------------------------------
// caching/registry
// -----------------------------------------------------------------------------

// existential type emulation (https://stackoverflow.com/a/65129942)
type ENav = <R>(fn: <T>(nav: Nav<T>) => R) => R;
const eNav =
  <T>(nav: Nav<T>): ENav =>
  (fn) =>
    fn(nav);

const TIME_TO_LIVE = 10 * 60 * 1000; // 10 minutes
const registry = Cache.create<ENav>(TIME_TO_LIVE);

const register = Cache.put(registry);

const getRegisteredNav = (ixn: Interaction.WithMsg) =>
  pipe(
    ixn.message.id.toString(),
    Cache.get(registry),
    RTE.fromTaskEither,
    RTE.mapError(Err.ignore)
  );

export const apply = <R>(
  ixn: Interaction.WithMsg,
  fn: <T>(nav: Nav<T>) => Op.Op<R>
): Op.Op<R> =>
  pipe(
    getRegisteredNav(ixn),
    RTE.flatMap((eNav) => eNav(fn))
  );

const formatAll = <T, R>(fn: Formatter<T, R>) =>
  flow(
    RNEA.map(fn),
    RTE.sequenceArray,
    RTE.filterOrElse(RA.isNonEmpty, () => 'Empty array after formatting'),
    RTE.mapError(Err.forDev)
  );

// -----------------------------------------------------------------------------
// message components
// -----------------------------------------------------------------------------

const prevButton = (currentPage: number): Button.Params => ({
  style: dd.ButtonStyles.Secondary,
  label: '',
  emoji: { name: '⬅️' },
  customId: 'navPageSwitch ' + (currentPage - 1),
  disabled: currentPage <= 1,
});

const nextButton = (currentPage: number, maxPage: number): Button.Params => ({
  style: dd.ButtonStyles.Secondary,
  label: '',
  emoji: { name: '➡️' },
  customId: 'navPageSwitch ' + (currentPage + 1),
  disabled: currentPage >= maxPage,
});

const currentPageButton = (
  currentPage: number,
  maxPage: number
): Button.Params => ({
  style: dd.ButtonStyles.Primary,
  label: `Page ${currentPage}/${maxPage}`,
  customId: 'navPageCurrent',
  disabled: true,
});

const listButtonRow = <T>(currentPage: number, nav: Nav<T>): dd.ActionRow =>
  Button.row([
    prevButton(currentPage),
    currentPageButton(currentPage, maxPage(nav)),
    nextButton(currentPage, maxPage(nav)),
  ]);

const menuOption =
  <T>(nav: Nav<T>): Formatter<T, dd.SelectOption> =>
  (item) =>
    pipe(
      RTE.Do,
      RTE.let('value', () => nav.itemId(item)),
      RTE.bind('label', ({ value }) =>
        nav.itemName ? nav.itemName(item) : RTE.right(value)
      ),
      RTE.bind('description', () =>
        nav.itemMenuDescription
          ? nav.itemMenuDescription(item)
          : RTE.right(undefined)
      ),
      RTE.map(({ label, value, description }) => ({
        label,
        value,
        description,
      }))
    );

const selectMenu = <T>(nav: Nav<T>) =>
  flow(
    formatAll(menuOption(nav)),
    RTE.map((options) => ({
      customId: 'navSelect',
      options,
      placeholder: nav.selectHint,
      disabled: !nav.itemComponents && !nav.itemEmbed,
    })),
    RTE.map(Menu.row)
  );

// -----------------------------------------------------------------------------
// helper functions
// -----------------------------------------------------------------------------

const maxPage = <T>(nav: Nav<T>) => Math.ceil(nav.items.length / ITEM_PER_PAGE);

const parseCurrentPage = (msg: dd.Message): Op.Op<number> =>
  pipe(
    msg.components,
    O.fromNullable,
    O.map(Button.extractAll),
    O.flatMap(RA.findFirst((b) => b.label?.startsWith('Page '))),
    O.chainNullableK((b) => b.label?.substring('Page '.length).split('/')[0]),
    O.map((pageStr) => +pageStr),
    O.filter((page) => page > 0 && !isNaN(page)),
    RTE.fromOption(() => Err.forDev('Could not parse current page'))
  );

const getPageItems = <T>(pageNum: number, nav: Nav<T>) =>
  pipe(
    pageNum,
    O.fromPredicate((p) => p > 0),
    O.map((p) => nav.items.slice((p - 1) * ITEM_PER_PAGE, p * ITEM_PER_PAGE)),
    O.flatMap(RNEA.fromArray),
    RTE.fromOption(Err.ignore)
  );

const listPageContent = <T>(
  pageNum: number,
  pageItems: RNEA.ReadonlyNonEmptyArray<T>,
  nav: Nav<T>
): Op.Op<string> => {
  const listPageContent_ = (fn: Formatter<T, string>) =>
    pipe(
      pageItems,
      formatAll(fn),
      RTE.map((descs) =>
        nav.bulletList
          ? str.unorderedList(descs)
          : str.orderedList(descs, (pageNum - 1) * 10 + 1)
      ),
      RTE.map(str.prepend(str.bold(nav.title) + '\n'))
    );

  const nameRTE = nav.itemName ?? flow(nav.itemId, RTE.right);
  return pipe(
    nav.itemListDescription ? nav.itemListDescription(pageItems) : nameRTE,
    listPageContent_,
    RTE.flatMap((content) =>
      content.length <= LIMITS.MESSAGE_CONTENT
        ? RTE.right(content)
        : listPageContent_(nameRTE)
    )
  );
};

export const listPageMessage = <T>(
  pageNum: number,
  nav: Nav<T>
): Op.Op<dd.CreateMessage> =>
  pipe(
    RTE.Do,
    RTE.bind('pageItems', () => getPageItems(pageNum, nav)),
    RTE.bind('content', ({ pageItems }) =>
      listPageContent(pageNum, pageItems, nav)
    ),
    RTE.bind('menu', ({ pageItems }) => selectMenu(nav)(pageItems)),
    RTE.map(({ content, menu }) => ({
      content,
      embeds: [],
      components:
        nav.items.length > ITEM_PER_PAGE
          ? [menu, listButtonRow(pageNum, nav)]
          : [menu],
    }))
  );

// -----------------------------------------------------------------------------
// operations
// -----------------------------------------------------------------------------

// if the nav has only one item, automatically display it as if selected,
// and remove the menu component
const withSoleResult =
  <T>(nav: Nav<T>) =>
  (msg: dd.CreateMessage): Op.Op<dd.CreateMessage> => {
    if (nav.items.length !== 1) return RTE.right(msg);
    const item = nav.items[0]!;
    return pipe(
      RTE.Do,
      RTE.bind('embed', () =>
        nav.itemEmbed ? nav.itemEmbed(item) : RTE.right(undefined)
      ),
      RTE.let('embeds', ({ embed }) => (embed ? [embed] : [])),
      RTE.bind('components', () =>
        nav.itemComponents ? nav.itemComponents(item) : RTE.right([])
      ),
      RTE.map(({ embeds, components }) => ({ ...msg, embeds, components })),
      RTE.mapError(Err.forDev)
    );
  };

export const sendInitialPage =
  (cmdMsg: dd.Message) =>
  <T>(nav: Nav<T>): Op.Op<dd.Message> =>
    pipe(
      listPageMessage(1, nav),
      RTE.flatMap(withSoleResult(nav)),
      RTE.flatMap(Op.sendReply(cmdMsg)),
      RTE.tapIO((m) => register(m.id.toString())(eNav(nav)))
    );

const asNavComponent = (select?: string) => (row: dd.ActionRow) =>
  pipe(
    row,
    Menu.extract,
    O.filter((m) => m.customId?.startsWith('navSelect')),
    O.map(Menu.updateDefault((opt) => opt.value === select)),
    O.map(Menu.row),
    O.orElse(() =>
      pipe(
        row,
        Button.extract,
        RNEA.fromReadonlyArray,
        O.filter((bs) => bs.length === 3),
        O.map(RA.every((b) => b.label?.startsWith('nav'))),
        O.map(() => row)
      )
    )
  );

export const updateDisplay =
  (embed?: dd.Embed, comps?: dd.MessageComponents, select?: string) =>
  (ixn: Interaction.WithMsg): Op.Op<void> =>
    pipe(
      ixn.message.components ?? [],
      ActionRow.rows,
      RA.filterMap(asNavComponent(select)),
      (navComps) => ({
        content: ixn.message.content,
        embeds: embed ? [embed] : ixn.message.embeds,
        components: ActionRow.rows([...(navComps ?? []), ...(comps ?? [])]),
      }),
      Interaction.sendUpdate(ixn)
    );
