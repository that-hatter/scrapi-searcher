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
import { Babel, Card } from '../../ygo';
import { EMOJI, LIMITS } from '../constants';
import { Ctx, dd, Err, Interaction, Menu, Op, str } from '../modules';

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
    "Why, sometimes I've believed as many as six impossible things before breakfast",
  ['21848500']: 'Off with her head!',
  ['68337209']: 'Down, down, down. Would the fall never come to an end!',
  ['94722358']:
    "The Hatter's remark seemed to have no sort of meaning in it, and yet it was certainly English.",
  ['20726052']:
    'and this time it vanished quite slowly, beginning with the end of the tail, ' +
    'and ending with the grin, which remained some time after the rest of it had gone.',
  ['57111661']:
    'Imagine her surprise, when the White Rabbit read out, ' +
    "at the top of his shrill little voice, the name 'Alice!'",
};

const content = (id: string) =>
  pipe(
    RR.lookup(id)(MALISS),
    O.map(flow(str.italic, str.spoiler, str.subtext)),
    O.getOrElse(() => '')
  );

const initMenu = (
  curr: Babel.Card,
  cs: RNEA.ReadonlyNonEmptyArray<Babel.Card>
): dd.ActionRow =>
  Menu.row({
    customId: 'cardSelect ' + curr.id,
    options: cs.map((c) => ({
      label: c.name,
      value: c.id.toString(),
      description: c.id.toString(),
      default: curr.id === c.id,
    })),
    placeholder: 'Select card to display',
  });

const initMessage =
  (cs: RNEA.ReadonlyNonEmptyArray<Babel.Card>) => (c: Babel.Card) =>
    pipe(
      Card.itemEmbed(c),
      RTE.mapError(Err.forDev),
      RTE.map((embed) => [embed]),
      RTE.map(
        (embeds): dd.CreateMessage => ({
          content: content(c.id.toString()),
          embeds,
          components: cs.length > 1 ? [initMenu(cs[0], cs)] : undefined,
        })
      )
    );

const handleQuery = (query: string) => {
  const q = query.substring(1, query.length - 1);
  return pipe(q, str.trim, Card.bestMatch, R.map(E.fromOption(() => q)));
};

const sendFoundCards = (
  msg: dd.Message,
  cards: ReadonlyArray<Babel.Card>
): Op.Op<unknown> => {
  if (!RA.isNonEmpty(cards)) return Op.noopReader;
  const head = RNEA.head(cards);
  return pipe(
    head,
    initMessage(cards),
    RTE.flatMap(Op.sendReply(msg)),
    head.id === 92901944 ? RTE.tap(Op.react(EMOJI.SEARCHER)) : identity
  );
};

const sendNoMatches = (
  msg: dd.Message,
  queries: ReadonlyArray<string>
): Op.Op<unknown> => {
  if (!RA.isNonEmpty(queries)) return Op.noopReader;
  const lineLimit = Math.floor(LIMITS.MESSAGE_CONTENT - 200 / queries.length);
  return pipe(
    queries,
    RA.map(str.limit('...', lineLimit)),
    RA.map(str.inlineCode),
    str.unorderedList,
    str.prepend('No matches found for:\n'),
    str.limit('', LIMITS.MESSAGE_CONTENT),
    Op.sendReply(msg)
  );
};

export const cardBracketSearch = (msg: dd.Message): Op.Op<unknown> => {
  const texts = str.getTextParts(msg.content);
  if (!RA.isNonEmpty(texts)) return Op.noopReader;
  return pipe(
    texts,
    RA.flatMap((s) => s.match(/\{(.+?)\}/g) ?? []),
    RA.map(handleQuery),
    R.sequenceArray,
    R.map(RA.separate),
    RTE.fromReader,
    RTE.flatMap(({ left: errs, right: cards }) =>
      pipe(
        sendFoundCards(msg, cards),
        RTE.tap(() => sendNoMatches(msg, errs))
      )
    )
  );
};

const findCard = (id: string) => (ctx: Ctx.Ctx) =>
  pipe(
    ctx.babel.record[id],
    TE.fromNullable('Could not find selected card: ' + id)
  );

const switchDefault = (card: Babel.Card, message: dd.Message) =>
  message.components?.map((comp) => {
    const menu = Menu.extract(comp);
    if (O.isNone(menu)) return comp as dd.ActionRow;
    if (!menu.value.customId.startsWith('cardSelect'))
      return comp as dd.ActionRow;
    return pipe(
      menu.value,
      Menu.updateDefault((opt) => opt.value === card.id.toString()),
      Menu.row
    );
  });

export const cardSelect = Menu.interaction({
  name: 'cardSelect',
  execute: (_, interaction, [id]) =>
    pipe(
      RTE.Do,
      RTE.bind('card', () => findCard(id)),
      RTE.bind('embed', ({ card }) => Card.itemEmbed(card)),
      RTE.mapError(Err.forDev),
      RTE.let('components', ({ card }) =>
        switchDefault(card, interaction.message)
      ),
      RTE.flatMap(({ embed, components }) =>
        Interaction.sendUpdate(interaction)({
          content: content(id),
          embeds: [embed],
          components,
        })
      )
    ),
});
