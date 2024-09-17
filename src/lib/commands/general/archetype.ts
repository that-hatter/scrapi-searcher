import {
  identity,
  O,
  pipe,
  R,
  RA,
  RNEA,
  RTE,
  TE,
} from '@that-hatter/scrapi-factory/fp';
import { Topic } from '../../../yard/shared';
import { Systrings } from '../../../ygo';
import {
  Command,
  Ctx,
  dd,
  Err,
  Nav,
  Op,
  SearchCommand,
  str,
} from '../../modules';
import { utils } from '../../utils';

const getConstant = (val: bigint) => (ctx: Ctx.Ctx) =>
  pipe(
    ctx.yard.api.constants.array,
    RA.findFirst((ct) => ct.enum === 'Archetype' && ct.value === val)
  );

const singleArchEmbed = (s: Systrings.Systring) =>
  pipe(
    s.value,
    utils.safeBigInt,
    getConstant,
    RTE.fromReader,
    RTE.map(
      O.map(
        (c) =>
          str.bold('Constant:') + ' ' + Topic.linkify(str.inlineCode(c.name))(c)
      )
    ),
    RTE.map((constant) => ({
      title: 'archetype string',
      url: Systrings.url(s),
      description: str.joinParagraphs([
        s.name,
        str.bold('DEC:') + ' ' + str.inlineCode(s.value.toString()),
        str.bold('HEX:') + ' ' + str.inlineCode('0x' + s.value.toString(16)),
        constant,
      ]),
    }))
  );

const hexBreakDownEmbed =
  (val: bigint): Op.Op<dd.Embed> =>
  (ctx: Ctx.Ctx) => {
    if (val < 0n) return TE.left(Err.forUser('Value must not be negative.'));
    if (val >> 64n > 0n)
      return TE.left(Err.forUser('Value must not exceed 64 bits.'));

    if (val < 0x10000n) {
      const ss = ctx.systrings.find(
        (s) => s.kind === 'setname' && s.value === Number(val)
      );
      if (ss) return singleArchEmbed(ss)(ctx);
    }

    const comps = pipe(
      [
        (val >> 48n) & 0xffffn,
        (val >> 32n) & 0xffffn,
        (val >> 16n) & 0xffffn,
        val & 0xffffn,
      ],
      RA.filter((c) => c > 0n)
    );

    const decStr = pipe(
      comps,
      RA.reduce(0, (b, c) => Math.max(b, c.toString().length)),
      str.leftPaddedCode
    );

    const hexStr = pipe(
      comps,
      RA.reduce(2, (b, c) => Math.max(b, 2 + c.toString(16).length)),
      str.leftPaddedCode
    );

    const constants = pipe(
      comps,
      RA.map((c) => getConstant(c)(ctx))
    );

    const constantNameStr = pipe(
      constants,
      RA.reduce(0, (b, c) =>
        Math.max(b, O.isSome(c) ? c.value.name.length : 0)
      ),
      str.rightPaddedCode
    );

    const compStr = (idx: number, c: bigint) =>
      str.joinWords([
        hexStr('0x' + c.toString(16)),
        decStr(c.toString()),
        pipe(
          constants[idx],
          O.fromNullable,
          O.flatten,
          O.map((c) => str.link(constantNameStr(c.name), Topic.url(c))),
          O.getOrElse(() => constantNameStr('???'))
        ),
        pipe(
          ctx.systrings,
          RA.findFirst((s) => s.kind === 'setname' && s.value === Number(c)),
          O.map((s) => str.link(s.name, Systrings.url(s)))
        ),
      ]);

    const title =
      'Component archetypes for ' + str.inlineCode('0x' + val.toString(16));
    return pipe(
      comps,
      RA.mapWithIndex(compStr),
      str.joinParagraphs,
      (description) => ({
        title,
        description,
        footer: { text: 'Full DEC: ' + val },
      }),
      TE.right
    );
  };

export const archetype: Command.Command = {
  name: 'archetype',
  description:
    'Show which archetypes make up an integer value, ' +
    'or search archetype strings (setnames) by name. ' +
    'Name matches are case-insensitive and can be partial.',
  syntax: 'archetype <query>',
  aliases: ['arch', 'set'],
  execute: (parameters, message) => {
    const query = parameters.join(' ');
    const asBigInt = utils.safeBigInt(query);
    if (asBigInt > 0n)
      return pipe(
        hexBreakDownEmbed(asBigInt),
        RTE.map((embed) => ({ embeds: [embed] })),
        RTE.flatMap(Op.sendReply(message))
      );

    return pipe(
      Systrings.findMatches('setname')(query),
      R.map(RNEA.fromReadonlyArray),
      RTE.fromReader,
      RTE.flatMapOption(identity, () => SearchCommand.noMatches(query)),
      RTE.map(
        (items): Nav.Nav<Systrings.Systring> => ({
          title: SearchCommand.title(items.length, 'setname', query),
          items,
          selectHint: 'Select setname string to display',
          messageId: message.id,
          channelId: message.channelId,
          bulletList: true,
          itemName: (ct) => ct.name,
          itemListDescription: Systrings.itemListDescription,
          itemEmbed: singleArchEmbed,
        })
      ),
      RTE.flatMap(Nav.sendInitialPage(message))
    );
  },
};
