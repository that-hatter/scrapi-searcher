import {
  E,
  flow,
  identity,
  O,
  pipe,
  R,
  RA,
  RNEA,
  RR,
  RTE,
  TE,
} from '@that-hatter/scrapi-factory/fp';
import { readerTask as RT } from 'fp-ts';
import { Ctx } from '../../Ctx';
import { Babel, Card, KonamiIds, Pics } from '../../ygo';
import { Data, dd, Err, Interaction, Menu, Op, str } from '../modules';

const MALISS: RR.ReadonlyRecord<string, string> = {
  ['86993168']: 'Why is a raven like a writing desk?',
  ['69272449']: 'Oh dear! Oh dear! I shall be too late!',
  ['96676583']:
    "Oh, you can't help that, we're all mad here. I'm mad. You're mad.",
  ['32061192']:
    'Once upon a time there were three little sisters, ' +
    'and their names were Elsie, Lacie, and Tillie',
  ['68059897']:
    "You may call it 'nonsense' if you like, but I've heard nonsense " +
    'compared with which that would be as sensible as a dictionary!',
  ['95454996']:
    "Why, sometimes I've believed as many as " +
    'six impossible things before breakfast',
  ['21848500']: 'Off with her head!',
  ['68337209']: 'Down, down, down. Would the fall never come to an end!',
  ['94722358']:
    "The Hatter's remark seemed to have no sort of meaning in it, " +
    'and yet it was certainly English.',
  ['20726052']:
    'and this time it vanished quite slowly, ' +
    'beginning with the end of the tail, and ending with the grin, ' +
    'which remained some time after the rest of it had gone.',
  ['57111661']:
    'Imagine her surprise, when the White Rabbit read out, ' +
    "at the top of his shrill little voice, the name 'Alice!'",
  ['20938824']:
    'Suppose we change the subject, ' +
    "I'm getting tired of this. I vote the young lady tells us a story.",
  ['93453053']:
    'And certainly the glass was beginning to melt away, ' +
    'just like a bright silvery mist.',
};

const extraContent = (id: number) =>
  pipe(
    MALISS,
    RR.lookup(id.toString()),
    O.map(flow(str.italic, str.spoiler, str.subtext)),
    O.getOrElse(() => '')
  );

type Result = {
  readonly index: number;
  readonly query: string;
  readonly match: E.Either<string, Babel.Card>;
};

const initialMenu = (
  current: Result,
  matches: RNEA.ReadonlyNonEmptyArray<Result>
): dd.ActionRow =>
  Menu.row({
    customId: 'cardSelect ' + current.index,
    options: matches.map((m) => ({
      label: pipe(
        m.match,
        E.match(
          () => '(No matches found)',
          (card) => card.id + ' | ' + card.name
        )
      ),
      description: '[' + m.query + ']',
      value: m.index.toString(),
      default: current.index === m.index,
    })),
    placeholder: 'Select result to display',
  });

const resultMessage = (
  result: Result
): RT.ReaderTask<Ctx, dd.CreateMessageOptions> =>
  pipe(
    result.match,
    RTE.fromEither,
    RTE.flatMap(Card.itemEmbed),
    RTE.matchW(
      (error) => ({ content: error, embeds: [] }),
      (embed) => ({ content: '', embeds: [embed] })
    )
  );

const updateMissingInfo = (msg: dd.Message) => {
  const currEmbed = msg.embeds?.at(0);
  if (!currEmbed) return Op.noopReader;

  const currFooter = currEmbed.footer?.text;
  if (!currFooter) return Op.noopReader;

  const id = str.before(' | ')(currFooter);
  if (id.length == 0) return Op.noopReader;

  const currPic = currEmbed.thumbnail?.url;
  const currKid = str.after(' | Konami ID #')(currFooter);
  if (currPic && currKid.length > 0) return Op.noopReader;

  return pipe(
    id,
    Babel.getCard,
    R.map(TE.fromOption(() => 'Failed to find card to update info: ' + id)),
    RTE.bindTo('card'),
    RTE.bind('embed', ({ card }) => Card.itemEmbedWithFetch(card)),
    RTE.tap(({ embed }) =>
      (embed.thumbnail && !currPic) ||
      embed.footer?.text !== currEmbed.footer?.text
        ? Op.editMessage(msg.channelId)(msg.id)({ embeds: [embed] })
        : Op.noopReader
    ),
    RTE.bindW('pics', ({ embed }) =>
      embed.thumbnail && !currPic
        ? Pics.addToFile(embed.thumbnail.url)
        : Pics.current
    ),
    RTE.bindW('konamiIds', ({ card, embed }) => {
      const newKid = embed.footer?.text.split(' | Konami ID #')[1];
      return newKid && !currKid
        ? KonamiIds.addToFile(card, +newKid)
        : KonamiIds.current;
    }),
    RTE.map(({ pics, konamiIds }) => Data.asUpdate({ pics, konamiIds })),
    RTE.mapError((e) => (typeof e === 'string' ? Err.forDev(e) : e))
  );
};

const sendResultsSingly = (msg: dd.Message) => (result: Result) => {
  const reply = resultMessage(result);
  if (E.isLeft(result.match)) return pipe(reply, RT.flatMap(Op.sendReply(msg)));

  const card = result.match.right;
  return pipe(
    reply,
    RT.map((opts) => ({ ...opts, content: extraContent(card.id) })),
    RT.flatMap(Op.sendReply(msg)),
    card.id === 92901944 ? RTE.tap(Op.react('searcher')) : identity
  );
};

const addDropdownReminder = (amount: number, content?: string) =>
  (content ? content + '\n' : '') +
  str.subtext(
    `Collapsed ${amount} results into one message. ` +
      'Use the drop-down menu to switch cards.'
  );

const cardMessageWithMenu = (matches: RNEA.ReadonlyNonEmptyArray<Result>) =>
  flow(
    resultMessage,
    RT.map((opts) => ({
      ...opts,
      content: addDropdownReminder(matches.length, opts.content),
      components: [initialMenu(RNEA.head(matches), matches)],
    }))
  );

const sendResultsCollapsed =
  (msg: dd.Message) =>
  (results: RNEA.ReadonlyNonEmptyArray<Result>): Op.Op<unknown> => {
    if (!RA.isNonEmpty(results)) return Op.noopReader;
    const initialResult = RNEA.head(results);
    return pipe(
      initialResult,
      cardMessageWithMenu(results),
      RT.flatMap(Op.sendReply(msg))
    );
  };

const queryFilter = (query: string) => {
  const s = query.toLowerCase();
  // Maximum [L] and [R] pieces have brackets in their names
  if (s === 'l' || s === 'r') return false;
  // users may share script errors without enclosing them in code blocks
  if (s === 'script error') return false;
  return !s.startsWith('string "') || !s.endsWith('.lua"');
};

const getQueries = (msg: dd.Message): ReadonlyArray<string> =>
  msg.content
    .toLowerCase()
    .match(/\[.+?\]/g)
    ?.map((q) => str.crop(1)(q).trim())
    .filter(queryFilter) ?? [];

const getQueryResult = (index: number, query: string) =>
  pipe(
    query,
    Card.bestMatch,
    RTE.mapError(Err.toAlertString),
    RT.map((match): Result => ({ index, query, match }))
  );

export const cardBracketSearch = (msg: dd.Message): Op.Op<unknown> => {
  if (!msg.content) return Op.noopReader;

  const queries = getQueries(msg).filter(queryFilter);
  if (queries.length === 0) return Op.noopReader;

  // TODO: should also update missing info if there are <5 cards.
  // Right now, the current updating mechanism doesn't support
  // multiple separate updates to pics.json and konamiIds.json
  if (queries.length === 1) {
    return pipe(
      getQueryResult(0, queries[0]!),
      RT.flatMap(sendResultsSingly(msg)),
      RTE.flatMap(updateMissingInfo)
    );
  }

  if (queries.length <= 4) {
    return pipe(
      queries,
      RA.mapWithIndex(flow(getQueryResult, RT.flatMap(sendResultsSingly(msg)))),
      RTE.sequenceSeqArray
    );
  }

  return pipe(
    queries,
    RA.mapWithIndex(getQueryResult),
    RT.sequenceArray,
    RT.flatMap((res) =>
      sendResultsCollapsed(msg)(res as RNEA.ReadonlyNonEmptyArray<Result>)
    )
  );
};

const extractResultsMenu = (msg: dd.Message) =>
  pipe(
    msg.components,
    RA.findFirstMap((comp) => Menu.extract(comp)),
    O.filter((comp) => !!comp.customId?.startsWith('cardSelect')),
    RTE.fromOption(() => 'Could not find card selection menu.')
  );

const indexToResult =
  (idx: string, menu: dd.SelectMenuComponent) =>
  (ctx: Ctx): O.Option<Result> => {
    const index = Number(idx);
    const selection = menu.options.at(index);
    if (!selection) return O.none;

    const query = str.crop(1)(selection.description ?? '');

    if (selection.label === '(No matches found)') {
      const match = E.left(
        'No matches found for ' + str.inlineCode(str.limit('...', 50)(query))
      );
      return O.some({ index, query, match });
    }

    const match = ctx.babel.record[str.before(' | ')(selection.label)];
    if (!match) return O.none;
    return O.some({ index, query, match: E.right(match) });
  };

const switchCurrentSelection = (index: string, menu: dd.SelectMenuComponent) =>
  pipe(
    menu,
    Menu.updateDefault((opt) => opt.value === index),
    (updated) => [Menu.row(updated)]
  );

export const cardSelect = Menu.interaction({
  name: 'cardSelect',
  execute: (_, interaction, [index]) => {
    const msg = interaction.message;
    return pipe(
      RTE.Do,
      RTE.bind('menu', () => extractResultsMenu(msg)),
      RTE.bind('result', ({ menu }) =>
        pipe(
          indexToResult(index, menu),
          R.map(TE.fromOption(() => 'Could not find card selection menu.'))
        )
      ),
      RTE.bindW('message', ({ result }) =>
        pipe(result, resultMessage, RT.map(E.right))
      ),
      RTE.mapError(Err.forDev),
      RTE.let('components', ({ menu }) => switchCurrentSelection(index, menu)),
      RTE.flatMap(({ message, components, menu }) =>
        Interaction.sendUpdate(interaction)({
          ...message,
          content: addDropdownReminder(menu.options.length, message.content),
          components,
        })
      )
    );
  },
});
