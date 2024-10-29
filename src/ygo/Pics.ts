import { O, pipe, RR, TE } from '@that-hatter/scrapi-factory/fp';
import fetch from 'node-fetch';
import * as buffer from 'node:buffer';
import { Babel, Card } from '.';
import { Ctx } from '../Ctx';
import { URLS } from '../lib/constants';
import type { Data, dd } from '../lib/modules';
import { Decoder, Err, Github, Op } from '../lib/modules';
import { utils } from '../lib/utils';

const OWNER = 'that-hatter';
const REPO = 'scrapi-searcher';
const PATH = 'data/pics.json';
const BRANCH = 'master';
const URL = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${PATH}`;

export type Pics = RR.ReadonlyRecord<string, string>;

const decoder = Decoder.record(Decoder.string);

const update = pipe(
  utils.taskify(() => fetch(URL).then((resp) => resp.json())),
  TE.flatMapEither(Decoder.parse(decoder))
);

export const data: Data.Data<'pics'> = {
  key: 'pics',
  description: 'Card artwork ids.',
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

const fetchAndUpload = (id: string) => (ctx: Ctx) => {
  const source = ctx.picsSource;
  const channel = ctx.picsChannel;
  if (O.isNone(source) || O.isNone(channel)) return TE.right(O.none);
  return pipe(
    utils.taskify(() =>
      fetch(source.value.replace('%id%', id)).then((resp) => resp.arrayBuffer())
    ),
    TE.map(
      (arrayBuf): dd.FileContent => ({
        name: id + '.jpg',
        blob: new buffer.Blob([new Uint8Array(arrayBuf)]),
      })
    ),
    TE.flatMap((file) =>
      pipe(
        Op.sendMessage(channel.value)({ file })(ctx),
        TE.mapError(Err.toAlertString)
      )
    ),
    TE.flatMapNullable(
      (msg) => msg.attachments[0]?.url.split('?ex')[0],
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

  return Card.isNonCard(c) ? TE.right(O.none) : fetchAndUpload(id)(ctx);
};

export const current = (ctx: Ctx) => TE.right(ctx.pics);
