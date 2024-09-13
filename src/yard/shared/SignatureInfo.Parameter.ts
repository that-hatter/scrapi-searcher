import type * as sf from '@that-hatter/scrapi-factory';
import { O, RA, flow, pipe } from '@that-hatter/scrapi-factory/fp';
import { DescInfo } from '.';
import { str } from '../../lib/modules';
import * as Comp from './Component';

// string used in the signature line for one parameter
const partialSignature = (param: sf.Parameter) =>
  pipe(param.type, Comp.fullType, str.append(' ' + str.inlineCode(param.name)));

const partialSignatureWithDefault = (param: sf.Parameter) => {
  const sig = partialSignature(param);
  return pipe(
    param.defaultValue,
    O.map((def) => sig + ' = ' + str.inlineCode(def.toString())),
    O.getOrElse(() => sig)
  );
};

const partialSignaturesWithCommas = flow(
  RA.map(partialSignatureWithDefault),
  str.intercalate(', ')
);

export const combinedPartialSignatures = flow(
  RA.partition((pm: sf.Parameter) => pm.required),
  ({ right: req, left: opt }) => [req, opt],
  RA.map(partialSignaturesWithCommas),
  ([req, opt]): string => {
    if (!opt || opt.length === 0) return req ?? '';
    if (!req || req.length === 0) return str.bracketed(opt);
    return req + ', ' + str.bracketed(opt);
  }
);

const preDescription = (param: sf.Parameter): O.Option<string> =>
  pipe(
    param.defaultValue,
    O.map((def) => 'Defaults to ' + str.inlineCode(def.toString()) + '.'),
    O.map((pre) => {
      if (param.required) return pre;
      return (pre.length > 0 ? 'Optional. ' : 'Optional.') + pre;
    }),
    O.map(str.italic)
  );

const section = (param: sf.Parameter) => {
  const desc = str.joinWords([
    preDescription(param),
    DescInfo.nonPlaceholder(str.fromAST(param.description)),
  ]);
  return partialSignature(param) + (desc.length > 0 ? ' - ' + desc : '');
};

export const embedField = Comp.embedField('Parameters', section);

export const headArgsString = flow(
  RA.map(({ name }: sf.Parameter) => name),
  str.intercalate(','),
  str.parenthesized
);
