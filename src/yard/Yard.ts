import * as sf from '@that-hatter/scrapi-factory';
import { pipe, TE } from '@that-hatter/scrapi-factory/fp';
import { CtxWithoutResources } from '../Ctx';
import { Github } from '../lib/modules';
import { utils } from '../lib/utils';

export const load = ({ sources }: CtxWithoutResources) =>
  pipe(
    Github.localPath(sources.yard, 'api'),
    // TODO: allow specifying the core and extension repos (needs scrapi-factory update)
    (directory) => ({ ...sf.DEFAULT_OPTIONS, directory }),
    sf.loadYard,
    TE.mapError(utils.stringify)
  );
