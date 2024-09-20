import * as sf from '@that-hatter/scrapi-factory';
import { pipe, RA } from '@that-hatter/scrapi-factory/fp';
import { Command, Op, str } from '../../modules';

const format = (
  name: string,
  items: ReadonlyArray<Exclude<sf.Topic, sf.Tag>>
) =>
  pipe(
    items,
    RA.filter(({ tags }) => tags.includes('under-construction')),
    (ct) =>
      `\`${ct.length}\` out of \`${items.length}\` ${name} ` +
      `(${
        Math.floor(((items.length - ct.length) / items.length) * 10000) / 100
      }% done!)`
  );

const footer =
  str.link(
    'View list',
    'https://projectignis.github.io/scrapi-book/api/tags/under-construction.html'
  ) +
  ' | ' +
  str.link(
    'Contribute',
    'https://github.com/ProjectIgnis/scrapiyard/blob/master/v1-nification.md'
  );

export const progress: Command.Command = {
  name: 'progress',
  description: 'View the current progress of API documentation.',
  syntax: 'progress',
  aliases: [],
  execute: (_, message) => (ctx) =>
    pipe(
      ['functions', 'constants', 'namespaces', 'enums', 'types'] as const,
      RA.map((name) => format(name, ctx.yard.api[name].array)),
      str.joinParagraphs,
      str.prepend(str.bold('Documentation entries under construction') + '\n'),
      str.append('\n' + str.subtext(footer)),
      Op.sendReply(message)
    )(ctx),
};
