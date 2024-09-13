import type * as sf from '@that-hatter/scrapi-factory';
import { flow, O, pipe, RA, RNEA } from '@that-hatter/scrapi-factory/fp';
import { DescInfo } from '.';
import { dd, Menu, str } from '../../lib/modules';
import * as Parameter from './SignatureInfo.Parameter';
import * as Return from './SignatureInfo.Return';

export const combinedComps = (sig: sf.Variant<sf.SignatureInfo>) =>
  '(' +
  Parameter.combinedPartialSignatures(sig.parameters) +
  ') → ' +
  Return.combinedPartialSignatures(sig.returns);

export const synopsis = <T extends sf.SignatureInfo>(
  doc: sf.Variant<T> & sf.DescInfo,
  name: string
) => str.blockquote(name + combinedComps(doc));

export const menuRow = (
  curr: number,
  doc: sf.Function | sf.FunctionType
): O.Option<dd.ActionRow> =>
  pipe(
    doc.overloads,
    RNEA.fromReadonlyArray,
    O.map(
      flow(
        RA.prependW(doc),
        RA.mapWithIndex(
          (i, v): dd.SelectOption => ({
            label: i > 0 ? 'Overload ' + i : 'Main signature',
            value: i.toString(),
            description: DescInfo.summaryOrDesc(v),
            default: curr === i,
          })
        ),
        (options) => ({
          placeholder: 'Select Signature',
          customId: 'signature',
          options,
        }),
        Menu.row
      )
    )
  );
