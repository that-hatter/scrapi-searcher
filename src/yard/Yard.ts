import * as sf from '@that-hatter/scrapi-factory';
import { pipe, TE } from '@that-hatter/scrapi-factory/fp';
import * as path from 'node:path';
import { PATHS } from '../lib/constants';
import type { Data } from '../lib/modules';
import { Github } from '../lib/modules';
import { utils } from '../lib/utils';

const YARD_OPTIONS: sf.YardOptions = {
  ...sf.DEFAULT_OPTIONS,
  directory: path.join(PATHS.DATA, 'scrapiyard', 'api'),
};

const update: TE.TaskEither<string, sf.Yard> = pipe(
  Github.pullOrClone(
    'scrapiyard',
    'https://github.com/ProjectIgnis/scrapiyard'
  ),
  TE.flatMap(() => sf.loadYard(YARD_OPTIONS)),
  TE.mapError(utils.stringify)
);

export const data: Data.Data<'yard'> = {
  key: 'yard',
  description: 'API documentation from scrapiyard.',
  update,
  init: pipe(
    sf.loadYard(YARD_OPTIONS),
    TE.orElse(() => update)
  ),
  commitFilter: (repo, files) => {
    if (repo === 'scrapiyard')
      return files.some((f) => f.startsWith('api/') && f.endsWith('.yml'));
    if (repo === 'CardScripts')
      return files.some((f) => f.endsWith('.lua') && !f.includes('/'));
    return (
      repo === 'ygopro-core' &&
      files.some((f) => f.startsWith('lib') && f.endsWith('.cpp'))
    );
  },
};
