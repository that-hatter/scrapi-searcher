import { identity, pipe, R, RTE } from '@that-hatter/scrapi-factory/fp';
import { Babel, BitNames, Card, KonamiIds } from '../../../ygo';
import { URLS } from '../../constants';
import { Command, Err, Op, str } from '../../modules';

const msgContent = (c: Babel.Card) =>
  pipe(
    BitNames.scopes(c.ot),
    R.bindTo('scopes'),
    RTE.fromReader,
    RTE.bind('konamiId', ({ scopes }) =>
      pipe(
        KonamiIds.getOrFetchMissing(scopes, c.id, c.name),
        RTE.mapError(Err.forDev),
        RTE.flatMapOption(identity, () =>
          Err.forUser('There are no rulings for ' + str.bold(c.name))
        )
      )
    ),
    RTE.map(({ scopes, konamiId }) => {
      const rush = scopes.includes('Rush');
      const db = rush ? URLS.KONAMI_DB_RUSH : URLS.KONAMI_DB_MASTER;
      const konami =
        `🇯🇵 Konami DB: ` +
        `<${db}/faq_search.action?ope=2&request_locale=ja&cid=${konamiId}>`;
      if (rush) return str.joinParagraphs([str.bold(c.name), konami]);

      const ygoResources =
        `🇬🇧 YGOResources: ` + `<${URLS.YGORESOURCES_DB}card#${konamiId}>`;
      return str.joinParagraphs([str.bold(c.name), konami, ygoResources]);
    })
  );

export const rulings: Command.Command = {
  name: 'rulings',
  description: "Get links to a card's ruling page(s).",
  syntax: 'rulings <query>',
  aliases: ['ruling'],
  execute: (parameters, message) =>
    pipe(
      Card.bestMatch(parameters.join(' ')),
      RTE.flatMap(msgContent),
      RTE.flatMap(Op.sendReply(message))
    ),
};
