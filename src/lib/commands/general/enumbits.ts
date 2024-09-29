import type * as sf from '@that-hatter/scrapi-factory';
import { O, pipe, RA, RNEA, RTE, TE } from '@that-hatter/scrapi-factory/fp';
import { Ctx } from '../../../Ctx';
import { Topic } from '../../../yard/shared';
import { LIMITS } from '../../constants';
import { Command, Err, Nav, SearchCommand, str } from '../../modules';
import { utils } from '../../utils';

const getEnumsWithName = (nameQuery: string) => (ctx: Ctx) =>
  pipe(
    ctx.yard.api.enums.array,
    RA.filter(
      (en) =>
        en.bitmaskInt &&
        en.name !== 'Archetype' &&
        en.name.toLowerCase().includes(nameQuery)
    ),
    RNEA.fromReadonlyArray,
    TE.fromOption(() => SearchCommand.noMatches(nameQuery))
  );

const itemEmbedFn =
  (value: bigint): Nav.Nav<sf.Enum>['itemEmbed'] =>
  (en) =>
  (ctx) => {
    const bits = value
      .toString(2)
      .split('')
      .filter((d) => d === '0' || d === '1')
      .map((b, i, arr) => '0b' + b + '0'.repeat(arr.length - i - 1))
      .map(utils.safeBigInt)
      .filter((b) => b > 0n);

    const decStr = pipe(
      bits,
      RA.reduce(0, (b, c) => Math.max(b, c.toString().length)),
      str.leftPaddedCode
    );

    const hexStr = pipe(
      bits,
      RA.reduce(2, (b, c) => Math.max(b, 2 + c.toString(16).length)),
      str.leftPaddedCode
    );

    const enumMembers = pipe(
      ctx.yard.api.constants.array,
      RA.filter((c) => c.enum === en.name)
    );

    const constants = pipe(
      bits,
      RA.map((b) =>
        pipe(
          enumMembers,
          RA.findFirst((ct) => utils.safeBigInt(ct.value) === b)
        )
      )
    );

    const constantNameStr = pipe(
      constants,
      RA.reduce(0, (b, c) =>
        Math.max(b, O.isSome(c) ? c.value.name.length : 0)
      ),
      str.rightPaddedCode
    );

    const bitStr = (idx: number, b: bigint) =>
      str.joinWords([
        hexStr('0x' + b.toString(16)),
        decStr(b.toString()),
        pipe(
          constants[idx],
          O.fromNullable,
          O.flatten,
          O.map((c) => str.link(constantNameStr(c.name), Topic.url(c))),
          O.getOrElse(() => constantNameStr('???'))
        ),
      ]);

    const title =
      'Component ' +
      str.bold(en.name) +
      ' constants for ' +
      str.inlineCode('0x' + value.toString(16));

    return pipe(
      bits,
      RA.mapWithIndex(bitStr),
      str.joinParagraphs,
      (desc) => ({
        title,
        description:
          desc.length > LIMITS.EMBED_DESCRIPTION
            ? '[Too long to display here]'
            : desc,
        footer: { text: 'Full DEC: ' + value },
      }),
      TE.right
    );
  };

export const enumbits: Command.Command = {
  name: 'enumbits',
  description:
    'Show which constants in a bit enum (except Archetype) make up an integer value.',
  syntax: 'enumbits <value> <enum-name?>',
  aliases: ['ebits'],
  execute: (parameters, message) => {
    if (!RA.isNonEmpty(parameters))
      return RTE.left(
        Err.forUser('You must specify a positive integer value.')
      );

    const [val_, name_] = RNEA.unprepend(parameters);
    const value = utils.safeBigInt(val_);
    if (value <= 0n)
      return RTE.left(
        Err.forUser('You must specify a positive integer value.')
      );

    const nameQuery = name_.join(' ');
    return pipe(
      getEnumsWithName(name_.join(' ')),
      RTE.map(
        (items): Nav.Nav<sf.Enum> => ({
          title: 'Bit enums matching ' + nameQuery,
          items,
          selectHint: 'Select bit enum to display',
          messageId: message.id,
          channelId: message.channelId,
          itemId: ({ name }) => name,

          itemListDescription: Topic.defaultListDescription,
          itemMenuDescription: Topic.defaultMenuDescription,
          itemEmbed: itemEmbedFn(value),
        })
      ),
      RTE.flatMap(Nav.sendInitialPage(message))
    );
  },
};
