import {
  flow,
  identity,
  O,
  pipe,
  RA,
  RNEA,
  RR,
  RTE,
  TE,
} from '@that-hatter/scrapi-factory/fp';
import { readerTask as RT } from 'fp-ts';
import { Ctx } from '../../Ctx';
import { Babel, Card, KonamiIds, Pics } from '../../ygo';
import { EMOJI, LIMITS } from '../constants';
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

const handleQuery = (query: string) =>
  pipe(query.substring(1, query.length - 1), str.trim, Card.bestMatch);

const afterReply = (card: Babel.Card) => (msg: dd.Message) => {
  const oldEmbed = msg.embeds[0];
  if (!oldEmbed) return Op.noopReader;
  const oldPic = oldEmbed.thumbnail?.url;
  const oldKid = oldEmbed.footer?.text.split(' | Konami ID #')[1];
  if (oldPic && oldKid) return Op.noopReader;

  return pipe(
    card,
    Card.itemEmbedWithFetch,
    RTE.mapError(Err.forDev),
    RTE.tap((embed) =>
      msg.components && msg.components.length > 0
        ? Op.noopReader
        : Op.editMessage(msg.channelId)(msg.id)({ embeds: [embed] })
    ),
    RTE.bindTo('embed'),
    RTE.bindW('pics', ({ embed }) =>
      embed.thumbnail && !oldPic
        ? Pics.addToFile(embed.thumbnail.url)
        : Pics.current
    ),
    RTE.bindW('konamiIds', ({ embed }) => {
      const newKid = embed.footer?.text.split(' | Konami ID #')[1];
      return newKid && !oldKid
        ? KonamiIds.addToFile(card, +newKid)
        : KonamiIds.current;
    }),
    RTE.map(({ pics, konamiIds }) => Data.asUpdate({ pics, konamiIds })),
    RTE.mapError((e) => (typeof e === 'string' ? Err.forDev(e) : e))
  );
};

const sendFoundCards = (
  msg: dd.Message,
  cards: ReadonlyArray<Babel.Card>
): Op.Op<unknown> => {
  if (!RA.isNonEmpty(cards)) return Op.noopReader;
  const uniqCards = pipe(cards, RNEA.uniq({ equals: (c, d) => c.id === d.id }));
  const head = RNEA.head(uniqCards);
  return pipe(
    head,
    initMessage(uniqCards),
    RTE.flatMap(Op.sendReply(msg)),
    head.id === 92901944 ? RTE.tap(Op.react(EMOJI.SEARCHER)) : identity,
    RTE.flatMap(afterReply(head))
  );
};

const sendNoMatches = (
  msg: dd.Message,
  errs: ReadonlyArray<Err.Err>
): Op.Op<unknown> =>
  pipe(
    errs,
    RA.map((e) => e.userAlert),
    str.joinParagraphs,
    str.limit('', LIMITS.MESSAGE_CONTENT),
    (content) =>
      content.length > 0 ? Op.sendReply(msg)(content) : Op.noopReader
  );

const queryFilter = (query: string) => {
  const s = query.toLowerCase();
  // Maximum [L] and [R] pieces have brackets in their names
  if (s === '[l]' || s === '[r]') return false;
  // users may share script errors without enclosing them in code blocks
  if (s === '[script error]') return false;
  return !s.startsWith('[string "') || !s.endsWith('.lua"]');
};

export const cardBracketSearch = (msg: dd.Message): Op.Op<unknown> => {
  const queries = str.getTextParts(msg.content).match(/\[.+?\]/g) ?? [];
  const validQueries = queries.filter(queryFilter);
  if (validQueries.length === 0) return Op.noopReader;
  return pipe(
    validQueries,
    RA.map(handleQuery),
    RT.sequenceArray,
    RT.map(RA.separate),
    RT.flatMap(({ left: errs, right: cards }) =>
      pipe(
        sendFoundCards(msg, cards),
        RTE.tap(() => sendNoMatches(msg, errs))
      )
    )
  );
};

const findCard = (id: string) => (ctx: Ctx) =>
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
