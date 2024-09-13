import { flow, O, pipe, RA, RNEA, TE } from '@that-hatter/scrapi-factory/fp';
import { SelectOption } from 'discordeno';
import { Ctx, dd, Err, Menu, Op, str } from '../lib/modules';
import { utils } from '../lib/utils';

// -----------------------------------------------------------------------------
// github requests
// -----------------------------------------------------------------------------

const REPO = {
  owner: 'ProjectIgnis',
  repo: 'Greenlight',
  state: 'open',
} as const;

export const fetchRawIssues = (ctx: Ctx.Ctx) =>
  pipe(
    utils.taskify(() => ctx.octokit.rest.issues.listForRepo(REPO)),
    TE.map(({ data }) => data),
    TE.mapError(Err.forDev)
  );

export const getIssues: Op.Op<ReadonlyArray<Issue>> = flow(
  fetchRawIssues,
  TE.map(
    RA.filterMap(({ title, body, number }) => {
      if (!body) return O.none;
      return pipe(
        body,
        str.split('\n'),
        RA.filter((ln) => ln.startsWith('#') || ln.startsWith('- [')),
        str.intercalate('\n'),
        parseIssue(number, title)
      );
    })
  )
);

export const editIssue = (num: number, body: string) => (ctx: Ctx.Ctx) =>
  utils.taskify(() =>
    ctx.octokit.issues.update({ ...REPO, issue_number: num, body })
  );

// -----------------------------------------------------------------------------
// types
// -----------------------------------------------------------------------------

const statusSteps = [
  'Unclaimed',
  'Claimed',
  'Scripted',
  'Finalised',
  'Added',
] as const;

export type StatusStep = (typeof statusSteps)[number];
export type StatusSteps = RNEA.ReadonlyNonEmptyArray<StatusStep>;
export type AssignedStep = Exclude<StatusStep, 'Unclaimed'>;

export type Assigned = {
  readonly user: string;
  readonly step: AssignedStep;
};

export type Card = {
  readonly id: string;
  readonly link: O.Option<string>;
  readonly enName: O.Option<string>;
  readonly jpName: O.Option<string>;
  readonly status: O.Option<Assigned>;
};

export type Theme = {
  readonly name: string;
  readonly cards: RNEA.ReadonlyNonEmptyArray<Card>;
};

export type Pack = {
  readonly name: string;
  readonly code: O.Option<string>;
  readonly range: O.Option<string>;
  readonly link: O.Option<string>;
  readonly themes: RNEA.ReadonlyNonEmptyArray<Theme>;
};

export type Issue = {
  readonly id: number;
  readonly title: string;
  readonly packs: RNEA.ReadonlyNonEmptyArray<Pack>;
};

export type Issues = RNEA.ReadonlyNonEmptyArray<Issue>;

// -----------------------------------------------------------------------------
// issue parsing
// -----------------------------------------------------------------------------

type CheckBoxes = Readonly<[string, string, string, string]>;
const parseStatus = (cbs: CheckBoxes): O.Option<Assigned> => {
  const TICKED = '- [x] ';
  const claimed = cbs[0].trim();
  if (!claimed.toLowerCase().startsWith(TICKED)) return O.none;

  const user = claimed.substring(
    (TICKED + 'Claimed [').length,
    claimed.length - 1
  );

  const step = cbs[3].toLowerCase().startsWith(TICKED)
    ? 'Added'
    : cbs[2].toLowerCase().startsWith(TICKED)
    ? 'Finalised'
    : cbs[1].toLowerCase().startsWith(TICKED)
    ? 'Scripted'
    : 'Claimed';

  return O.some({ user, step });
};

export const parseCardHead = flow(str.split(' | '), ([id_, en_, jp_]) => {
  const id__ = id_.trim();
  const id =
    id__.startsWith('`') && id__.endsWith('`')
      ? id__.substring(1, id__.length - 1)
      : id__;

  const jpName = str.unempty(jp_ ?? '');

  const en = en_?.trim();
  if (!en || en.length === 0)
    return O.some({ id, link: O.none, enName: O.none, jpName });

  if (en.startsWith('[') && en.endsWith(')')) {
    const [enName_, link_] = en.substring(1, en.length - 1).split('](');
    const enName = O.fromNullable(enName_?.trim());

    if (!link_) return O.some({ id, link: O.none, enName, jpName });

    const link__ = link_.trim();
    const link = O.some(
      link__.startsWith('<') && link__.endsWith('>')
        ? link__.substring(1, link__.length - 1)
        : link__
    );

    return O.some({ id, link, enName, jpName });
  }

  return O.some({ id, link: O.none, enName: O.some(en), jpName });
});

const parseCard = flow(
  str.split('\n'),
  RNEA.unprepend,
  ([head, cbs]): O.Option<Card> => {
    if (cbs.length < 4) return O.none;
    return pipe(
      parseCardHead(head),
      // safe to cast because of the check above
      O.map((c) => ({ ...c, status: parseStatus(cbs as CheckBoxes) }))
    );
  }
);

const splitHead = flow(
  str.split('\n'),
  RNEA.unprepend,
  ([fst, rest]) => [fst, rest.join('\n')] as const
);

const parseTheme = (s: string) =>
  pipe(
    // some cards don't have themes
    s.startsWith('\n### ') ? '\n???' + s : s,
    splitHead,
    ([head, body]) =>
      pipe(
        body,
        str.prepend('\n'),
        str.split('\n### '),
        RA.filterMap(parseCard),
        RNEA.fromReadonlyArray,
        O.map(
          (cards): Theme => ({
            name: pipe(head, str.split('\n'), RNEA.head, str.trim) || '???',
            cards,
          })
        )
      )
  );

const parsePack = flow(splitHead, ([head, body]) =>
  pipe(
    body,
    str.prepend('\n'),
    str.split('\n## '),
    RA.filterMap(parseTheme),
    RNEA.fromReadonlyArray,
    O.flatMap((themes): O.Option<Pack> => {
      const [nl_, code_, range_] = pipe(
        head,
        str.split('\n'),
        RNEA.head,
        str.split(' | ')
      );

      const nl = nl_.trim();
      if (nl.length === 0) return O.none;

      const code = O.fromNullable(code_?.trim());
      const range = O.fromNullable(range_?.trim());

      if (nl.startsWith('[') && nl.endsWith(')')) {
        const [name_, link_] = nl.split('](');

        const name = name_?.trim();
        if (!name || name.length === 0) return O.none;
        const link = link_?.trim();
        if (!link || link.length === 0)
          return O.some({ name, link: O.none, code, range, themes });

        return O.some({
          name: name.substring(1),
          link: O.some(link.substring(0, link.length - 1)),
          code,
          range,
          themes,
        });
      }

      return O.some({ name: nl, link: O.none, code, range, themes });
    })
  )
);

const parseIssue = (id: number, title: string) =>
  flow(
    str.prepend('\n'),
    str.split('\n# '),
    RNEA.unprepend,
    ([_, rest]): O.Option<Issue> =>
      pipe(
        rest,
        RA.filterMap(parsePack),
        RNEA.fromReadonlyArray,
        O.map((packs) => ({ id, title, packs }))
      )
  );

// -----------------------------------------------------------------------------
// formatting
// -----------------------------------------------------------------------------

const optionalLink = (name: string, url: O.Option<string>) =>
  O.isSome(url) ? str.link(name, url.value) : name;

export const formatStatus = O.map(({ user, step }: Assigned) =>
  str.subtext(
    '    ╰ Claimed: ' + user + (step === 'Claimed' ? '' : ', ' + step)
  )
);

export const formatCardHead = (c: Card) => {
  const enName = O.getOrElseW(() => '???')(c.enName);
  return str.join(' | ')([
    str.inlineCode(c.id),
    optionalLink(enName, c.link),
    c.jpName,
  ]);
};

export const formatCard = (c: Card) =>
  str.joinParagraphs([formatCardHead(c), formatStatus(c.status)]);

export const formatPack = (p: Pack) =>
  pipe(
    [optionalLink(p.name, p.link), p.code, p.range],
    str.join(' | '),
    str.bold,
    str.subtext
  );

export const formatIssue = (is: Issue) =>
  pipe(
    [
      str.link(
        'Issue #' + is.id,
        'https://github.com/ProjectIgnis/Greenlight/issues/' + is.id
      ),
      is.title,
    ],
    str.join(' | '),
    str.bold,
    str.subtext
  );

export const cardOption = (c: Card): SelectOption => ({
  label: c.id,
  value: c.id,
  description: pipe(
    c.enName,
    O.orElse(() => c.jpName),
    O.getOrElseW(() => '')
  ),
});

export const statusMenu = (statuses: ReadonlyArray<string>): dd.ActionRow =>
  pipe(
    statusSteps,
    RA.map((label) => ({
      label,
      value: label,
      default: statuses.includes(label),
    })),
    (options) => ({
      maxValues: 25,
      customId: 'glStatusSelect',
      options,
      placeholder: 'Filter card status',
    }),
    Menu.row
  );

// -----------------------------------------------------------------------------
// additional helpers
// -----------------------------------------------------------------------------

export const allCards = flow(
  RA.flatMap((is: Issue) => is.packs),
  RA.flatMap((p) => p.themes),
  RA.flatMap((th) => th.cards)
);

export const cardHasStatus = (statuses: StatusSteps) => (c: Card) =>
  O.isNone(c.status)
    ? statuses.includes('Unclaimed')
    : statuses.includes(c.status.value.step);

export const asStatusSteps = (strs: ReadonlyArray<string>) =>
  pipe(
    statusSteps,
    RA.filter((s) => strs.includes(s)),
    RNEA.fromReadonlyArray,
    O.getOrElse((): StatusSteps => ['Unclaimed'])
  );

export const pageStatuses = (message: dd.Message) =>
  pipe(
    O.fromNullable(message.components),
    O.map(RA.filterMap(Menu.extract)),
    O.flatMap(
      RA.findFirst((menu) => menu.customId.startsWith('glStatusSelect'))
    ),
    O.map(({ options }) =>
      pipe(
        options,
        RA.filter((op) => op.default === true),
        RA.map((op) => op.value)
      )
    ),
    O.getOrElseW(() => []),
    asStatusSteps
  );
