import {
  E,
  flow,
  O,
  pipe,
  RA,
  RR,
  RTE,
  TE,
} from '@that-hatter/scrapi-factory/fp';
import fetch from 'node-fetch';
import * as buffer from 'node:buffer';
import { Babel, Card } from '.';
import { Ctx } from '../Ctx';
import { URLS } from '../lib/constants';
import type { Data, dd } from '../lib/modules';
import { Decoder, Err, Github, Op, str } from '../lib/modules';
import { utils } from '../lib/utils';

const OWNER = 'that-hatter';
const REPO = 'scrapi-searcher-data';
const PATH = 'data/pics.json';
const BRANCH = 'main';
const URL = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${PATH}`;

export type Pics = RR.ReadonlyRecord<string, string>;

const decoder = Decoder.record(Decoder.string);

const update = pipe(
  utils.taskify(() => fetch(URL).then((resp) => resp.json())),
  TE.flatMapEither(Decoder.parse(decoder))
);

export const data: Data.Data<'pics'> = {
  key: 'pics',
  description: 'Reuploaded card artwork urls saved in `pics.json.`',
  update,
  init: update,
  commitFilter: (repo, files) =>
    repo === 'scrapi-searcher' && files.includes('data/pics.json'),
};

export const getExisting = (id: number) => (ctx: Ctx) =>
  pipe(
    ctx.pics[id.toString()],
    O.fromNullable,
    O.filter((pid) => pid !== 'N/A'),
    O.map((pid) => `${URLS.DISCORD_MEDIA}/${pid}/${id}.jpg`)
  );

const fetchFromSourceAndReupload = (id: number) => (ctx: Ctx) => {
  const source = ctx.picsSource;
  const channel = ctx.picsChannel;
  if (O.isNone(source) || O.isNone(channel)) return TE.right(O.none);
  return pipe(
    utils.taskify(() =>
      fetch(source.value.replace('%id%', id.toString())).then((resp) =>
        resp.arrayBuffer()
      )
    ),
    TE.map(
      (arrayBuf): dd.FileContent => ({
        name: id + '.jpg',
        blob: new buffer.Blob([new Uint8Array(arrayBuf)]),
      })
    ),
    TE.flatMap((file) =>
      pipe(
        Op.sendMessage(channel.value)({ files: [file] })(ctx),
        TE.mapError(Err.toAlertString)
      )
    ),
    TE.flatMapNullable(
      (msg) => msg.attachments?.at(0)?.url.split('?ex')[0],
      () => 'Failed to upload pic'
    ),
    TE.map(O.some)
  );
};

export const addToFile = (url: string) => (ctx: Ctx) => {
  const [_, __, ___, ____, ch, att, _id] = url.split('/');
  if (!ch || !att || !_id) return TE.left('Invalid pic url: ' + url);
  const id = _id.substring(0, _id.length - 4);
  return pipe(
    ctx.pics,
    RR.upsertAt(id, ch + '/' + att),
    TE.right,
    TE.tap((content) =>
      Github.updateFile(
        OWNER,
        REPO,
        BRANCH,
        PATH,
        utils.stringify(content),
        'add pic for ' + id
      )(ctx)
    )
  );
};

export const getOrFetchMissing = (c: Babel.Card) => (ctx: Ctx) => {
  const id = c.id.toString();
  const saved = ctx.pics[id];
  if (saved) {
    return pipe(
      saved,
      O.fromPredicate((pid) => pid !== 'N/A'),
      O.map((pid) => `${URLS.DISCORD_MEDIA}/${pid}/${id}.jpg`),
      TE.right
    );
  }

  return Card.isNonCard(c)
    ? TE.right(O.none)
    : fetchFromSourceAndReupload(c.id)(ctx);
};

export const current = (ctx: Ctx) => TE.right(ctx.pics);

const generateNewUrls =
  (channel: string, defaultSource: string) => (urls: string) =>
    pipe(
      urls,
      Op.sendMessage(channel),
      RTE.map((msg) => {
        if (msg.embeds) {
          return pipe(
            msg.embeds,
            RA.filterMap((embed) => O.fromNullable(embed.thumbnail?.url))
          );
        }
        return pipe(
          urls,
          str.split('\n'),
          RA.map(flow(str.afterLast('/'), str.before('.jpg'))),
          RA.map((id) => defaultSource.replace('%id%', id))
        );
      })
    );

const fetchReuploadedPics = (
  urls: ReadonlyArray<string>,
  channel: string,
  defaultSource: string
) =>
  pipe(
    urls,
    RA.chunksOf(5),
    RA.map(str.joinParagraphs),
    RA.map(generateNewUrls(channel, defaultSource)),
    RTE.sequenceSeqArray,
    RTE.map(RA.flatten),
    RTE.map(
      RA.map((url) =>
        pipe(
          utils.taskify(() => fetch(url).then((resp) => resp.buffer())),
          TE.map((buf) => {
            const id = pipe(url, str.before('.jpg'), str.afterLast('/'));
            return [id, buf] as const;
          }),
          TE.mapError(Err.forDev)
        )
      )
    ),
    RTE.flatMapTaskEither(TE.sequenceSeqArray)
  );

const fetchMultipleFromSource = (ids: ReadonlyArray<number>, source: string) =>
  pipe(
    ids,
    RA.map((id) =>
      pipe(
        utils.taskify(() =>
          fetch(source.replace('%id%', id.toString())).then((resp) =>
            resp.buffer()
          )
        ),
        TE.map((buf) => [id.toString(), buf] as const)
      )
    ),
    TE.sequenceSeqArray,
    TE.mapError(Err.forDev),
    RTE.fromTaskEither
  );

export const getMultipleRaws = (ids: ReadonlyArray<number>) => (ctx: Ctx) => {
  const source = ctx.picsSource;
  const channel = ctx.picsChannel;
  if (O.isNone(source) || O.isNone(channel)) return TE.left(Err.ignore());
  return pipe(
    [...new Set(ids)],
    RA.map((id) => (O.isSome(Babel.getCard(id)(ctx)) ? id : 0)),
    RA.map((id) =>
      pipe(
        getExisting(id)(ctx),
        E.fromOption(() => id)
      )
    ),
    RA.separate,
    ({ left, right }) =>
      RTE.sequenceSeqArray([
        fetchMultipleFromSource(left, source.value),
        fetchReuploadedPics(right, channel.value.toString(), source.value),
      ])(ctx),
    TE.map(RA.flatten),
    TE.map(RR.fromEntries)
  );
};
