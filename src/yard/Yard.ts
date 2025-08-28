import * as sf from '@that-hatter/scrapi-factory';
import { pipe, RTE, TE } from '@that-hatter/scrapi-factory/fp';
import * as path from 'node:path';
import { CtxWithoutResources } from '../Ctx';
import { PATHS } from '../lib/constants';
import type { Resource } from '../lib/modules';
import { Github } from '../lib/modules';
import { utils } from '../lib/utils';

const LOCAL_PATH = path.join(PATHS.DATA, 'scrapiyard', 'api');

const update = pipe(
  RTE.ask<CtxWithoutResources>(),
  RTE.flatMapTaskEither(({ sources }) =>
    pipe(
      Github.pullOrClone('scrapiyard', sources.yard),
      TE.flatMap(() =>
        sf.loadYard({
          core: sources.babel,
          extended: sources.scripts,
          directory: LOCAL_PATH,
        })
      )
    )
  ),
  RTE.mapError(utils.stringify)
);

export const resource: Resource.Resource<'yard'> = {
  key: 'yard',
  description: 'API documentation from scrapiyard.',
  update,
  init: update,
  commitFilter: (ctx) => (src, files) => {
    if (Github.isSource(src, ctx.sources.yard))
      return files.some((f) => f.startsWith('api/') && f.endsWith('.yml'));
    if (Github.isSource(src, ctx.sources.scripts))
      return files.some((f) => f.endsWith('.lua') && !f.includes('/'));
    return (
      Github.isSource(src, ctx.sources.core) &&
      files.some((f) => f.startsWith('lib') && f.endsWith('.cpp'))
    );
  },
};
