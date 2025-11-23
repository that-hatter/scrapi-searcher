import { O, pipe, RA, RNEA, RR, RTE, TE } from '@that-hatter/scrapi-factory/fp';
import { sequenceS } from 'fp-ts/lib/Apply';
import * as buffer from 'node:buffer';
import { Babel, Card } from '.';
import { Ctx, CtxWithoutResources } from '../Ctx';
import { URLS } from '../lib/constants';
import {
  dd,
  Decoder,
  Err,
  Fetch,
  FS,
  Github,
  Op,
  Resource,
  str,
} from '../lib/modules';
import { utils } from '../lib/utils';

const RESOURCE_PATH = 'data/pics.json';

export type Pics = {
  readonly local: RR.ReadonlyRecord<string, string>;
  readonly reuploaded: RR.ReadonlyRecord<string, string>;
};

const jsonDecoder = Decoder.record(Decoder.string);

const loadLocalPathsFromDir = (src: Github.Source) =>
  pipe(
    Github.localPath(src, 'pics'),
    FS.getMatchingFilepaths((f) => f.endsWith('.png') || f.endsWith('.jpg')),
    TE.orElse(() => TE.right(<ReadonlyArray<string>>[])),
    TE.map(
      RA.filterMap((filepath) =>
        pipe(
          filepath,
          FS.filenameFromPath,
          O.map(FS.removeExt),
          O.map((id) => [id, filepath] as const)
        )
      )
    ),
    TE.map(RR.fromEntries)
  );

const loadAllLocalPaths = (
  ctx: CtxWithoutResources
): TE.TaskEither<string, RR.ReadonlyRecord<string, string>> =>
  pipe(
    [ctx.sources.base, ...ctx.sources.expansions],
    RA.map(loadLocalPathsFromDir),
    TE.sequenceArray,
    TE.map(utils.mergeRecords)
  );

const loadReuploadsJson = (
  ctx: CtxWithoutResources
): TE.TaskEither<string, RR.ReadonlyRecord<string, string>> =>
  pipe(
    ctx.sources.misc,
    O.map((src) =>
      pipe(
        Github.localPath(src, RESOURCE_PATH),
        FS.readJsonFile,
        TE.flatMapEither(Decoder.decode(jsonDecoder))
      )
    ),
    O.getOrElse(() => TE.right({}))
  );

export const load = sequenceS(RTE.ApplySeq)({
  local: loadAllLocalPaths,
  reuploaded: loadReuploadsJson,
});

export const getReuploadUrl = (id: number) => (ctx: Ctx) =>
  pipe(
    ctx.pics.reuploaded[id.toString()],
    O.fromNullable,
    O.filter((pid) => pid !== 'N/A'),
    O.map((pid) => `${URLS.DISCORD_MEDIA}/${pid}/${id}.jpg`)
  );

const fetchFromSource =
  (id: string) =>
  (ctx: Ctx): TE.TaskEither<string, O.Option<dd.FileContent>> => {
    if (O.isNone(ctx.sources.picsUrl)) return TE.right(O.none);
    const url = ctx.sources.picsUrl.value;
    return pipe(
      url.replace('%id%', id.toString()),
      Fetch.arrayBuffer,
      TE.map((arrayBuf) =>
        O.some({
          name: id + '.' + pipe(url, str.split('.'), RNEA.last),
          blob: new buffer.Blob([new Uint8Array(arrayBuf)]),
        })
      )
    );
  };

const readFromLocal =
  (id: string) =>
  (ctx: Ctx): TE.TaskEither<string, O.Option<dd.FileContent>> => {
    const path = ctx.pics.local[id];
    if (!path) return TE.right(O.none);
    return pipe(
      path,
      FS.readFile,
      TE.map((buf) =>
        O.some({
          name: pipe(
            path,
            FS.filenameFromPath,
            O.getOrElse(() => id)
          ),
          blob: new buffer.Blob([new Uint8Array(buf)]),
        })
      )
    );
  };

const fetchThenReupload =
  (id: string) =>
  (ctx: Ctx): TE.TaskEither<string, O.Option<string>> =>
    pipe(
      fetchFromSource(id)(ctx),
      TE.orElse(() => readFromLocal(id)(ctx)),
      TE.flatMap((file) => {
        if (O.isNone(file)) return TE.right(O.none);
        return pipe(
          Op.sendMessage('')({ files: [file.value] })(ctx),
          TE.mapError(Err.toAlertString),
          TE.flatMapNullable(
            (msg) => msg.attachments?.at(0)?.url.split('?ex')[0],
            () => 'Failed to upload pic'
          ),
          TE.map(O.some)
        );
      })
    );

const updateGithubFile =
  (newRecord: RR.ReadonlyRecord<string, string>, message: string) =>
  (ctx: Ctx) =>
    pipe(
      ctx.sources.misc,
      O.map((repo) =>
        Github.updateFile(
          repo,
          RESOURCE_PATH,
          utils.stringify(newRecord),
          message
        )(ctx)
      ),
      O.getOrElseW(() => Op.noop)
    );

export const addToReuploadsJson = (url: string) => (ctx: Ctx) => {
  const [_, __, ___, ____, ch, att, _id] = url.split('/');
  if (!ch || !att || !_id) return TE.left('Invalid pic url: ' + url);
  const id = _id.substring(0, _id.length - 4);
  return pipe(
    ctx.pics.reuploaded,
    RR.upsertAt(id, ch + '/' + att),
    TE.right,
    TE.tap((content) => updateGithubFile(content, 'add pic for ' + id)(ctx))
  );
};

export const getReuploadUrlOrFillIn = (c: Babel.Card) => (ctx: Ctx) => {
  const id = c.id.toString();
  const reup = ctx.pics.reuploaded[id];
  if (reup) {
    return pipe(
      reup,
      O.fromPredicate((pid) => pid !== 'N/A'),
      O.map((pid) => `${URLS.DISCORD_MEDIA}/${pid}/${id}.jpg`),
      TE.right
    );
  }
  return Card.isNonCard(c) ? TE.right(O.none) : fetchThenReupload(id)(ctx);
};

export const getMultipleRaws = (ids: ReadonlyArray<number>) => (ctx: Ctx) =>
  pipe(
    [...new Set(ids)],
    RA.map(String),
    RA.map((id) =>
      pipe(
        fetchFromSource(id)(ctx),
        TE.orElse(() => readFromLocal(id)(ctx)),
        TE.flatMap((f) => {
          if (O.isNone(f)) return TE.right(O.none);
          return pipe(
            utils.taskify(() => f.value.blob.arrayBuffer()),
            TE.map((arrayBuf) =>
              O.some([id, buffer.Buffer.from(arrayBuf)] as const)
            )
          );
        })
      )
    ),
    TE.sequenceSeqArray,
    TE.map(RA.compact),
    TE.map(RR.fromEntries)
  );

export const remove = (ids: ReadonlyArray<number>) => (ctx: Ctx) =>
  pipe(
    ctx.pics.reuploaded,
    RR.filterWithIndex((key) => !ids.includes(+key)),
    TE.right,
    TE.tap((reuploaded) =>
      updateGithubFile(reuploaded, 'remove card pic(s)')(ctx)
    ),
    TE.map((reuploaded) =>
      Resource.asUpdate({ pics: { reuploaded, local: ctx.pics.local } })
    )
  );

export const current = (ctx: Ctx) => TE.right(ctx.pics);
