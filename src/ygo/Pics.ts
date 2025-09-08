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
import * as buffer from 'node:buffer';
import { Babel, Card } from '.';
import { Ctx, CtxWithoutResources } from '../Ctx';
import { URLS } from '../lib/constants';
import {
  dd,
  Decoder,
  Err,
  Fetch,
  Github,
  Op,
  Resource,
  str,
} from '../lib/modules';
import { utils } from '../lib/utils';

const RESOURCE_PATH = 'data/pics.json';

export type Pics = RR.ReadonlyRecord<string, string>;

const decoder = Decoder.record(Decoder.string);

const update = ({ sources }: CtxWithoutResources) =>
  pipe(
    sources.misc,
    O.map(({ repo }) =>
      pipe(
        Github.rawURL(repo, RESOURCE_PATH),
        Fetch.json,
        TE.flatMapEither(Decoder.decode(decoder))
      )
    ),
    O.getOrElse(() => TE.right(<Pics>{}))
  );

export const resource: Resource.Resource<'pics'> = {
  key: 'pics',
  description: 'Reuploaded card pic urls saved in pics.json.',
  update,
  init: update,
  commitFilter: (ctx) => (src, files) =>
    O.isSome(ctx.sources.misc) &&
    src === ctx.sources.misc.value.repo &&
    files.includes('data/pics.json'),
};

export const getExisting = (id: number) => (ctx: Ctx) =>
  pipe(
    ctx.pics[id.toString()],
    O.fromNullable,
    O.filter((pid) => pid !== 'N/A'),
    O.map((pid) => `${URLS.DISCORD_MEDIA}/${pid}/${id}.jpg`)
  );

const fetchFromSourceAndReupload =
  (id: number) =>
  (ctx: Ctx): TE.TaskEither<string, O.Option<string>> =>
    pipe(
      ctx.sources.misc,
      O.flatMap(({ pics }) => pics),
      O.map(({ url, channel }) =>
        pipe(
          url.replace('%id%', id.toString()),
          Fetch.arrayBuffer,
          TE.map(
            (arrayBuf): dd.FileContent => ({
              name: id + '.jpg',
              blob: new buffer.Blob([new Uint8Array(arrayBuf)]),
            })
          ),
          TE.flatMap((file) =>
            pipe(
              Op.sendMessage(channel)({ files: [file] })(ctx),
              TE.mapError(Err.toAlertString)
            )
          ),
          TE.flatMapNullable(
            (msg) => msg.attachments?.at(0)?.url.split('?ex')[0],
            () => 'Failed to upload pic'
          ),
          TE.map(O.some)
        )
      ),
      O.getOrElseW(() => TE.right(O.none))
    );

const updateGithubFile =
  (newRecord: RR.ReadonlyRecord<string, string>, message: string) =>
  (ctx: Ctx) =>
    pipe(
      ctx.sources.misc,
      O.map(({ repo }) =>
        Github.updateFile(
          repo,
          RESOURCE_PATH,
          utils.stringify(newRecord),
          message
        )(ctx)
      ),
      O.getOrElseW(() => Op.noop)
    );

export const addToFile = (url: string) => (ctx: Ctx) => {
  const [_, __, ___, ____, ch, att, _id] = url.split('/');
  if (!ch || !att || !_id) return TE.left('Invalid pic url: ' + url);
  const id = _id.substring(0, _id.length - 4);
  return pipe(
    ctx.pics,
    RR.upsertAt(id, ch + '/' + att),
    TE.right,
    TE.tap((content) => updateGithubFile(content, 'add pic for ' + id)(ctx))
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
          url,
          Fetch.buffer,
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
        source.replace('%id%', id.toString()),
        Fetch.buffer,
        TE.map((buf) => [id.toString(), buf] as const)
      )
    ),
    TE.sequenceSeqArray,
    TE.mapError(Err.forDev),
    RTE.fromTaskEither
  );

export const getMultipleRaws = (ids: ReadonlyArray<number>) => (ctx: Ctx) =>
  pipe(
    ctx.sources.misc,
    O.flatMap(({ pics }) => pics),
    O.map(({ url, channel }) =>
      pipe(
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
            fetchMultipleFromSource(left, url),
            fetchReuploadedPics(right, channel.toString(), url),
          ])(ctx),
        TE.map(RA.flatten),
        TE.map(RR.fromEntries)
      )
    ),
    O.getOrElse(() => TE.left(Err.ignore()))
  );

export const remove = (ids: ReadonlyArray<number>) => (ctx: Ctx) =>
  pipe(
    ctx.pics,
    RR.filterWithIndex((key) => !ids.includes(+key)),
    TE.right,
    TE.tap((pics) => updateGithubFile(pics, 'remove card pic(s)')(ctx)),
    TE.map((pics) => Resource.asUpdate({ pics }))
  );
