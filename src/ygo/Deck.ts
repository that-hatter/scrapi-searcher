import {
  E,
  flow,
  O,
  pipe,
  R,
  RA,
  RNEA,
  RTE,
  TE,
} from '@that-hatter/scrapi-factory/fp';
import { array as A, readerTask as RT } from 'fp-ts';
import * as buffer from 'node:buffer';
import sharp from 'sharp';
import { Babel, Pics } from '.';
import { Ctx } from '../Ctx';
import { LIMITS } from '../lib/constants';
import { Attachment, Button, dd, Err, Fetch, Op, str } from '../lib/modules';
import { utils } from '../lib/utils';

export type Deck = {
  readonly name: O.Option<string>;
  readonly createdBy: O.Option<string>;
  readonly main: ReadonlyArray<number>;
  readonly extra: ReadonlyArray<number>;
  readonly side: ReadonlyArray<number>;
};

export const fromYdkeString = (ydke: string): TE.TaskEither<string, Deck> =>
  pipe(
    ydke,
    TE.fromPredicate(
      str.startsWith('ydke://'),
      () => 'Invalid ydke string: ' + ydke
    ),
    TE.map((y) => y.slice(7)),
    TE.map(str.split('!')),
    TE.filterOrElse(
      (parts) => parts.length >= 3,
      () => 'Missing ydke component'
    ),
    TE.map(
      RNEA.map((base64) =>
        utils.fallibleIO(() =>
          Array.from(
            new Uint32Array(
              Uint8Array.from(Buffer.from(base64, 'base64')).buffer
            )
          )
        )
      )
    ),
    TE.map(RNEA.map(TE.fromIOEither)),
    TE.flatMap(TE.sequenceArray),
    TE.map(([main, extra, side]) => ({
      name: O.none,
      createdBy: O.none,
      main: main!,
      extra: extra!,
      side: side!,
    }))
  );

export const toYdkeString = (deck: Deck): string =>
  pipe(
    [deck.main, deck.extra, deck.side],
    RNEA.map((passcodes) =>
      Buffer.from(
        new Uint8Array(new Uint32Array(passcodes).buffer).buffer
      ).toString('base64')
    ),
    str.join('!'),
    str.append('!'),
    str.prepend('ydke://')
  );

export const fromYdkFile = (
  contents: string,
  name: string
): E.Either<string, Deck> => {
  const [preSide, side] = str.split('!side')(contents);
  if (side === undefined) return E.left('Missing side deck section.');
  const [preExtra, extra] = str.split('#extra')(preSide);
  if (extra === undefined) return E.left('Missing extra deck section.');
  const [preMain, main] = str.split('#main')(preExtra);
  if (main === undefined) return E.left('Missing main deck section.');

  return pipe(
    [main, extra, side],
    RA.map(
      flow(
        str.split('\n'),
        RA.map((passcode) => +passcode),
        RA.filter((passcode) => !isNaN(passcode) && passcode > 0)
      )
    ),
    ([main, extra, side]) =>
      E.right({
        name: O.some(name),
        createdBy: pipe(
          preMain,
          str.after('#created by '),
          str.before('\n'),
          str.unempty
        ),
        main: main!,
        extra: extra!,
        side: side!,
      })
  );
};

export const toYdkFile = (deck: Deck): dd.FileContent =>
  pipe(
    [deck.main, deck.extra, deck.side],
    RA.map(
      flow(
        RA.map((passcode) => passcode.toString()),
        str.join('\n')
      )
    ),
    ([main, extra, side]) =>
      str.joinParagraphs([
        pipe(
          deck.createdBy,
          O.getOrElse(() => 'Player'),
          str.prepend('#created by ')
        ),
        '#main',
        main ?? '',
        '#extra',
        extra ?? '',
        '!side',
        side ?? '',
      ]),

    Attachment.text(
      pipe(
        deck.name,
        O.getOrElseW(() => 'decklist.ydk')
      )
    )
  );

const safeFields = flow(
  A.filter(({ value }: dd.EmbedField) => value.length > 0),
  A.map((field) => ({
    ...field,
    value:
      field.value.length > LIMITS.EMBED_FIELD
        ? str.subtext('Unable to fit contents here.')
        : field.value,
  }))
);

export const toEmbed = (deck: Deck): Op.Op<Omit<dd.Embed, 'timestamp'>> =>
  pipe(
    [deck.main, deck.extra, deck.side],
    RA.map((passcodes) =>
      pipe(
        [...new Set(passcodes)],
        RA.map((p) => {
          const amount = str.inlineCode(
            passcodes.filter((p_) => p === p_).length.toString()
          );
          return pipe(
            Babel.getCard(p),
            R.map(O.map(({ name }) => name)),
            R.map(O.getOrElse(() => '???')),
            R.map(str.prepend(amount + ' '))
          );
        })
      )
    ),
    RA.map(R.sequenceArray),
    RA.map(R.map(str.join('\n'))),
    R.sequenceArray,
    R.map(([main, extra, side]) =>
      TE.right({
        title: O.toUndefined(deck.name),
        fields: safeFields([
          { name: 'Main Deck', value: main ?? '', inline: true },
          { name: 'Extra Deck', value: extra ?? '', inline: true },
          { name: 'Side Deck', value: side ?? '', inline: true },
        ]),
        footer: pipe(
          deck.createdBy,
          O.map((cb) => ({ text: 'Created by ' + cb })),
          O.toUndefined
        ),
      })
    )
  );

const CARD_PIC_WIDTH = 177;
const CARD_PIC_HEIGHT = 254;
const IMAGE_WIDTH = CARD_PIC_WIDTH * 10;

const rowInputs = (
  cards: ReadonlyArray<buffer.Buffer>,
  yOffset: number,
  rowLength = cards.length
) => {
  const xInterval = Math.ceil(
    (IMAGE_WIDTH - CARD_PIC_WIDTH) / Math.max(9, rowLength - 1)
  );
  return pipe(
    cards,
    RA.mapWithIndex(
      (i, card): sharp.OverlayOptions => ({
        input: card,
        top: yOffset,
        left: xInterval * i,
      })
    )
  );
};

const renderImage = (
  main: ReadonlyArray<buffer.Buffer>,
  extra: ReadonlyArray<buffer.Buffer>,
  side: ReadonlyArray<buffer.Buffer>
) => {
  const mainDeckRows = Math.max(1, Math.ceil(Math.min(40, main.length) / 10));
  const cardsPerRow = Math.max(10, Math.ceil(main.length / 4));

  return pipe(
    main,
    RA.chunksOf(cardsPerRow),
    RA.mapWithIndex((i, cs) =>
      rowInputs(cs, i * CARD_PIC_HEIGHT + 60, cardsPerRow)
    ),
    RA.flatten,
    RA.concat(rowInputs(extra, mainDeckRows * CARD_PIC_HEIGHT + 120)),
    RA.concat(rowInputs(side, (mainDeckRows + 1) * CARD_PIC_HEIGHT + 180)),
    RA.concatW([
      {
        input: {
          text: { text: 'Main Deck (' + main.length + ')', dpi: 250 },
        },
        top: 10,
        left: 10,
      },
      {
        input: {
          text: { text: 'Extra Deck (' + extra.length + ')', dpi: 250 },
        },
        top: mainDeckRows * CARD_PIC_HEIGHT + 70,
        left: 10,
      },
      {
        input: {
          text: { text: 'Side Deck (' + side.length + ')', dpi: 250 },
        },
        top: (mainDeckRows + 1) * CARD_PIC_HEIGHT + 130,
        left: 10,
      },
    ]),
    (inputs) =>
      utils.taskify(() =>
        sharp({
          create: {
            width: IMAGE_WIDTH,
            height: (mainDeckRows + 2) * CARD_PIC_HEIGHT + 180,
            channels: 3,
            background: 'black',
          },
        })
          .composite([...inputs])
          .toFormat('jpg')
          .toBuffer()
      )
  );
};

const toImageFile = (deck: Deck) => {
  const ids = [deck.main, deck.extra, deck.side] as const;
  return pipe(
    ids,
    RA.flatten,
    Pics.fetchMultipleRaws,
    RTE.flatMapTaskEither((images) =>
      pipe(
        ids,
        RA.map(RA.filterMap((id) => O.fromNullable(images[id]))),
        ([main, extra, side]) => renderImage(main!, extra!, side!)
      )
    ),
    RTE.map(
      (buf): dd.FileContent => ({
        name: pipe(
          deck.name,
          O.getOrElse(() => 'deck image'),
          str.append('.jpg')
        ),
        blob: new buffer.Blob([new Uint8Array(buf)]),
      })
    )
  );
};

const parseFromMessageContent = (msg: dd.Message) =>
  pipe(
    msg.content.match(
      /ydke:\/\/[A-Za-z0-9+/=]*?![A-Za-z0-9+/=]*?![A-Za-z0-9+/=]*?!/g
    ) ?? [],
    RA.map(fromYdkeString),
    TE.sequenceArray,
    RTE.fromTaskEither
  );

const parseFromMessageFiles = (msg: dd.Message) =>
  pipe(
    msg.attachments ?? [],
    RA.filter((file) => file.filename.endsWith('.ydk')),
    RA.map((file) =>
      pipe(
        file.url,
        Fetch.text,
        TE.flatMapEither((contents) => fromYdkFile(contents, file.filename))
      )
    ),
    TE.sequenceArray,
    RTE.fromTaskEither
  );

export const parseDecks = (msg: dd.Message) =>
  pipe(
    [parseFromMessageContent(msg), parseFromMessageFiles(msg)],
    RTE.sequenceArray,
    RTE.map(RA.flatten)
  );

const sendImageBreakdown = (deck: Deck, msg: dd.Message, index: number) =>
  pipe(
    deck,
    toImageFile,
    RTE.mapError(Err.forDev),
    RTE.map((file) => ({
      files: [file],
      components: [
        Button.row([
          {
            style: Button.Styles.Primary,
            label: 'View card names',
            customId: 'deckCardNames ' + index,
          },
          {
            style: Button.Styles.Primary,
            label: 'Import',
            customId: 'deckImport ' + index,
          },
        ]),
      ],
    })),
    RTE.flatMap(Op.sendReply(msg))
  );

// const sendTextualBreakdown = (deck: Deck, msg: dd.Message, index: number) =>
//   pipe(
//     deck,
//     toEmbed,
//     RTE.map((embed) => ({
//       embeds: [embed],
//       components: [
//         Button.row([
//           {
//             style: Button.Styles.Primary,
//             label: 'Import',
//             customId: 'deckImport ' + index,
//           },
//         ]),
//       ],
//     })),
//     RTE.flatMap(Op.sendReply(msg))
//   );

export const breakdown = (msg: dd.Message) => (ctx: Ctx) =>
  pipe(
    msg,
    parseDecks,
    RTE.mapError(Err.forDev),
    RTE.flatMap((decks) => {
      if (decks.length === 0) return Op.noopReader;
      return pipe(
        RTE.right(decks),
        RTE.tap(() => Op.react('⌛')(msg)),
        RTE.map(
          RA.mapWithIndex((i, deck) => {
            const size =
              deck.main.length + deck.extra.length + deck.side.length;
            if (size <= 200) return sendImageBreakdown(deck, msg, i);
            return Op.sendReply(msg)(
              'Deck contains too many cards (' + size + ' / 200)'
            );
          })
        ),
        RTE.flatMap(RTE.sequenceSeqArray),
        RT.tap(() => Op.deleteOwnReaction('⌛')(msg))
      );
    })
  )(ctx);
