import { O, pipe, R, RTE, TE } from '@that-hatter/scrapi-factory/fp';
import { Ctx } from '../../../Ctx';
import { Babel, BitNames, Card, KonamiIds } from '../../../ygo';
import { URLS } from '../../constants';
import { Command, Err, Op, str } from '../../modules';

const msgContent = (c: Babel.Card) => (ctx: Ctx) => {
  const scopes = BitNames.scopes(c.ot)(ctx);
  const kid = KonamiIds.getKonamiId(scopes, c.id)(ctx);
  if (O.isNone(kid))
    return TE.left(
      Err.forUser("Couldn't resolve rulings for " + str.bold(c.name))
    );

  const ygoResources = pipe(
    kid,
    O.filter((_: number) => !scopes.includes('Rush')),
    O.map(
      (kid) => '🇬🇧 YGOResources: <' + URLS.YGORESOURCES_DB + 'card#' + kid + '>'
    )
  );

  const officialDb =
    '🇯🇵 Konami DB: <' +
    (scopes.includes('Rush') ? URLS.KONAMI_DB_RUSH : URLS.KONAMI_DB_MASTER) +
    '/faq_search.action?ope=2&request_locale=ja&cid=' +
    kid.value +
    '>';

  return TE.right(
    str.joinParagraphs([str.bold(c.name), ygoResources, officialDb])
  );
};

export const rulings: Command.Command = {
  name: 'rulings',
  description: "Get links to a card's ruling page(s).",
  syntax: 'rulings <query>',
  aliases: ['ruling'],
  execute: (parameters, message) =>
    pipe(
      Card.bestMatch(parameters.join(' ')),
      R.map(TE.fromOption(Err.ignore)),
      RTE.flatMap(msgContent),
      RTE.flatMap(Op.sendReply(message))
    ),
};
