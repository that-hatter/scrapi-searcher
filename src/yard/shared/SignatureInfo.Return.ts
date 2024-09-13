import type * as sf from '@that-hatter/scrapi-factory';
import { O, pipe, RA } from '@that-hatter/scrapi-factory/fp';
import { DescInfo } from '.';
import { str } from '../../lib/modules';
import * as Comp from './Component';

// string used in the signature line for one return,
// also used as the heading for each return section
const partialSignature = (ret: sf.Return) =>
  Comp.fullType(ret.type) +
  (O.isSome(ret.name) ? str.inlineCode(ret.name.value) : '');

export const combinedPartialSignatures = (rets: ReadonlyArray<sf.Return>) =>
  rets.length > 0
    ? pipe(rets, RA.map(partialSignature), str.intercalate(', '))
    : 'nil';

const section = (ret: sf.Return) => {
  const desc = DescInfo.nonPlaceholder(str.fromAST(ret.description));
  return partialSignature(ret) + (O.isSome(desc) ? ' - ' + desc.value : '');
};

export const embedField = Comp.embedField('Returns', section);
