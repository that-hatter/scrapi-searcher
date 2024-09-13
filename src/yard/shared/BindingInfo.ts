import type * as sf from '@that-hatter/scrapi-factory';
import { O, pipe } from '@that-hatter/scrapi-factory/fp';
import { str } from '../../lib/modules';

export const isDeprecated = ({ status }: sf.BindingInfo): boolean =>
  status.index === 'deprecated';

export const isDeleted = ({ status }: sf.BindingInfo): boolean =>
  status.index === 'deleted';

export const isUnstable = ({ status }: sf.BindingInfo): boolean =>
  status.index !== 'stable';

export const strikeBasedOnStatus =
  (doc: sf.BindingInfo) =>
  (content: string): string =>
    isDeprecated(doc) || isDeleted(doc) ? str.strikethrough(content) : content;

const statusMessages: Readonly<Record<string, string>> = {
  unstable:
    ' It may be modified or deleted without notice.' +
    ' Unstable versions will not be documented when modified or deleted.',
  deleted:
    ' It is no longer available, and attempting to use it will result in errors.',
  deprecated: '',
};

export const statusHatnote = (
  doc: sf.Topic & sf.BindingInfo
): O.Option<string> =>
  pipe(
    doc.status.message,
    O.filter(() => doc.status.index !== 'stable'),
    O.map(
      (msg) =>
        `This ${doc.doctype} is ${doc.status.index}. ` +
        str.fromAST(msg) +
        (statusMessages[doc.status.index] ?? '')
    ),
    O.map((msg) =>
      str.admonition(
        msg,
        doc.status.index === 'deleted' ? 'danger' : 'warning',
        doc.status.index.toUpperCase()
      )
    )
  );

export const sourceLink = (doc: sf.BindingInfo) =>
  pipe(
    doc.source,
    O.map((src) => str.link('Source Code', src))
  );
