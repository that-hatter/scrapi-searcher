import { O, pipe, RNEA, RTE } from '@that-hatter/scrapi-factory/fp';
import { Ctx } from '../../../Ctx';
import { Babel, Card } from '../../../ygo';
import { PATHS } from '../../constants';
import { Command, FS, Github, Op, str } from '../../modules';

const cdbName = (c: Babel.Card) =>
  pipe(
    c.cdbPath,
    FS.filenameFromPath,
    O.getOrElse(() => '')
  );

const cdbUrl = (c: Babel.Card) => (ctx: Ctx) =>
  pipe(
    c.cdbPath.substring(PATHS.DATA.length),
    FS.splitFilepath,
    RNEA.fromReadonlyArray,
    O.map(RNEA.unprepend),
    O.map(([head, tail]) => {
      const source = pipe(head, str.split('_'), ([owner, repo, branch]) => ({
        owner,
        repo: repo ?? '',
        branch: branch ?? 'master',
      }));
      const relativePath = tail.join('/');

      if (O.isNone(ctx.sources.cdbs)) {
        return Github.blobURL(source, relativePath);
      }

      return Github.blobURL(
        ctx.sources.cdbs.value,
        Github.blobURL(ctx.sources.base) === Github.blobURL(source)
          ? relativePath.replace('expansions/', '')
          : relativePath
      );
    })
  );

export const cdb: Command.Command = {
  name: 'cdb',
  description: "Get a link to a card's database file.",
  syntax: 'cdb <query>',
  aliases: ['db', 'dbfind'],
  execute: (parameters, message) => (ctx) =>
    pipe(
      Card.bestMatch(parameters.join(' ')),
      RTE.map((c) => {
        const content = str.bold(c.name) + '\nFound in ';
        const name = str.inlineCode(cdbName(c));
        const url = cdbUrl(c)(ctx);
        if (O.isNone(url)) return content + name;
        return content + str.link(name, url.value);
      }),
      RTE.flatMap(Op.sendReply(message))
    )(ctx),
};
