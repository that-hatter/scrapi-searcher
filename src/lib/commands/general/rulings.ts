import { identity, O, pipe, RTE } from '@that-hatter/scrapi-factory/fp';
import { BitNames, Card, KonamiIds } from '../../../ygo';
import { URLS } from '../../constants';
import { Command, Data, Err, Op, str } from '../../modules';

export const rulings: Command.Command = {
  name: 'rulings',
  description: "Get links to a card's ruling page(s).",
  syntax: 'rulings <query>',
  aliases: ['ruling'],
  execute: (parameters, message) =>
    pipe(
      RTE.Do,
      RTE.bind('card', () => Card.bestMatch(parameters.join(' '))),
      RTE.bindW('scopes', ({ card }) =>
        pipe(BitNames.scopes(card.ot), RTE.fromReader)
      ),
      RTE.bindW('types', ({ card }) =>
        pipe(BitNames.types(card.type), RTE.fromReader)
      ),
      RTE.bind('konamiId', ({ card, scopes, types }) =>
        pipe(
          KonamiIds.getOrFetchMissing(card, scopes, types),
          RTE.mapError(Err.forDev),
          RTE.flatMapOption(identity, () =>
            Err.forUser(
              'There are no rulings for ' +
                str.bold(card.name + ' ' + str.inlineCode(card.id.toString())) +
                '.'
            )
          )
        )
      ),
      RTE.let('content', ({ card, scopes, konamiId }) => {
        const rush = scopes.includes('Rush');
        const db = rush ? URLS.KONAMI_DB_RUSH : URLS.KONAMI_DB_MASTER;
        const konami =
          `🇯🇵 Konami DB: ` +
          `<${db}/faq_search.action?ope=2&request_locale=ja&cid=${konamiId}>`;
        if (rush) return str.joinParagraphs([str.bold(card.name), konami]);

        const ygoResources =
          `🇬🇧 YGOResources: ` + `<${URLS.YGORESOURCES_DB}card#${konamiId}>`;
        return str.joinParagraphs([str.bold(card.name), konami, ygoResources]);
      }),
      RTE.bind('reply', ({ content }) => Op.sendReply(message)(content)),
      RTE.bindW('currKid', ({ card }) =>
        pipe(
          KonamiIds.getExisting(card, Card.isRush(card) ? 'rush' : 'master'),
          RTE.fromReader
        )
      ),
      RTE.flatMap(({ card, konamiId, currKid }) => {
        if (O.isSome(currKid)) return Op.noopReader;
        return pipe(
          KonamiIds.addToFile(card, konamiId),
          RTE.map((konamiIds) => Data.asUpdate({ konamiIds })),
          RTE.mapError(Err.forDev)
        );
      })
    ),
};
