// Les mots qui vendent de Zara : chaque mot n'est dit que s'il est vrai. Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/zara-words.test.ts
import {
  GIFT_ADMIN_BADGE, GIFT_CLIENT_LINE, GIFT_INVOICE, MIN_BOUGHT_CUSTOMERS, alsoLine, confirmBecauseLine, finishLabel, giftOfferLine, giftPlacedLine, giftRecapLine,
  hasChatGift, nextRealDeadline, parseAffinity, pickAlsoBought, protectionLine, receivedLine, riskFreeLine, urgencyLine, validityLine,
} from '../../src/lib/assistantWords.ts';

let ok = 0;
const check = (label: string, cond: unknown, detail?: unknown) => {
  if (cond) {
    ok++;
    console.log('OK   ', label);
  } else {
    console.log('ECHEC', label, detail === undefined ? '' : JSON.stringify(detail));
    process.exitCode = 1;
  }
};

// --- GRATUIT / EXCLUSIF : le cadeau surprise du chat
check('une commande du chat (appareil noté) a le cadeau surprise', hasChatGift({ assistant_device: 'Android' }) && hasChatGift({ assistant_device: 'iPhone' }));
check('une commande du site (aucun appareil noté) n\'a PAS le cadeau : « uniquement sur le chatbot »', !hasChatGift({ assistant_device: null }) && !hasChatGift({}) && !hasChatGift({ assistant_device: '  ' }) && !hasChatGift(null) && !hasChatGift(undefined));
for (const lang of ['fr', 'ar'] as const) {
  check(`[${lang}] l'annonce dit : cadeau surprise, dans le colis, écrit sur la facture, réservé au chat`, lang === 'fr' ? /Cadeau surprise offert/.test(giftOfferLine(lang)) && /dans son colis/.test(giftOfferLine(lang)) && /écrit sur votre facture/.test(giftOfferLine(lang)) && /réservée au chat/.test(giftOfferLine(lang)) : /هدية مفاجأة/.test(giftOfferLine(lang)) && /الطرد/.test(giftOfferLine(lang)) && /فاتورتك/.test(giftOfferLine(lang)) && /المحادثة فقط/.test(giftOfferLine(lang)));
  check(`[${lang}] récapitulatif et confirmation parlent du cadeau`, /🎁/.test(giftRecapLine(lang)) && /🎁/.test(giftPlacedLine(lang)));
}
check('facture : « Cadeau surprise (Zara) » — « Offert » (sans émoji : le PDF n\'en dessine pas)', GIFT_INVOICE.label === 'Cadeau surprise (Zara)' && GIFT_INVOICE.value === 'Offert' && !/[^\x00-ɏ’ ]/.test(GIFT_INVOICE.label + GIFT_INVOICE.value));
check('admin : « à mettre dans le colis » ; client : « offert dans votre colis »', /à mettre dans le colis/.test(GIFT_ADMIN_BADGE) && /offert dans votre colis/.test(GIFT_CLIENT_LINE));

// --- FINALISEZ VOTRE COMMANDE, IMMÉDIAT, PARCE QUE
check('le bouton : « Finalisez votre commande »', finishLabel('fr') === 'Finalisez votre commande');
check('« Finalisez votre commande maintenant : … tout de suite … » (immédiat + la raison)', /Finalisez votre commande maintenant/.test(confirmBecauseLine('fr')) && /tout de suite/.test(confirmBecauseLine('fr')) && /cadeau surprise/.test(confirmBecauseLine('fr')));
check('immédiat : seulement un fait (l\'équipe reçoit la commande)', /vient de recevoir votre commande/.test(receivedLine('fr')));

// --- SANS RISQUE : seulement les vraies assurances
check('N\'Djamena : « vous payez seulement quand vous recevez » (vrai : paiement à la livraison)', /à N’Djamena, vous payez seulement quand vous recevez/.test(riskFreeLine('fr', true)));
check('autres villes : PAS « payez à la réception » (faux là-bas), mais le retour sous 72 h d\'un article incorrect ou défectueux', !/payez seulement quand vous recevez/.test(riskFreeLine('fr', false)) && /72 heures/.test(riskFreeLine('fr', false)) && /frais de retour sont à notre charge/.test(riskFreeLine('fr', false)));
check('arabe : mêmes deux assurances', /إنجامينا/.test(riskFreeLine('ar', true)) && /72/.test(riskFreeLine('ar', false)));

// --- LA PROTECTION du client, dite avant et après l'achat (demande du patron du 9 novembre 2026)
check('protection (fr) : « jamais à regretter votre achat » + mauvais article ou autre article que celui commandé : on peut annuler', /n’aurez jamais à regretter votre achat/.test(protectionLine('fr')) && /mauvais article/.test(protectionLine('fr')) && /un autre que celui que vous avez commandé/.test(protectionLine('fr')) && /vous pouvez annuler/.test(protectionLine('fr')), protectionLine('fr'));
check('protection (fr) : la vraie règle de retour (72 h, photo ou vidéo, frais à notre charge), jamais une condition cachée', /72 h/.test(protectionLine('fr')) && /photo ou une vidéo/.test(protectionLine('fr')) && /frais de retour sont à notre charge/.test(protectionLine('fr')));
check('protection (ar) : même promesse et mêmes conditions', /لن تندم أبداً/.test(protectionLine('ar')) && /خاطئ/.test(protectionLine('ar')) && /72/.test(protectionLine('ar')) && /الإلغاء/.test(protectionLine('ar')), protectionLine('ar'));

// --- COURTE DURÉE : seulement une vraie échéance
const now = Date.parse('2026-11-02T10:00:00Z');
const h = (n: number) => new Date(now + n * 3_600_000).toISOString();
check('aucune échéance : AUCUN mot d\'urgence', urgencyLine({ now }, 'fr') === null && urgencyLine({ now, flashEndsAt: null, promoEndsAt: null }, 'fr') === null);
check('échéance déjà passée (vente flash finie) : rien', urgencyLine({ now, flashEndsAt: h(-1), promoEndsAt: h(-30) }, 'fr') === null && nextRealDeadline({ now, flashEndsAt: h(-1) }) === null);
check('vente flash qui finit dans 5 h : « Ce prix se termine dans 5 h. »', urgencyLine({ now, flashEndsAt: h(5) }, 'fr') === '⏳ Ce prix se termine dans 5 h.');
check('promotion dans 3 jours : « dans 3 jours »', urgencyLine({ now, promoEndsAt: h(72) }, 'fr') === '⏳ Ce prix se termine dans 3 jours.');
check('deux échéances : la plus proche', urgencyLine({ now, flashEndsAt: h(2), promoEndsAt: h(100) }, 'fr') === '⏳ Ce prix se termine dans 2 h.');
check('dates illisibles : rien (jamais d\'urgence inventée)', urgencyLine({ now, flashEndsAt: 'bientôt', promoEndsAt: '' }, 'fr') === null);
check('arabe : la vraie échéance aussi', /خلال 5 ساعة/.test(urgencyLine({ now, flashEndsAt: h(5) }, 'ar') ?? ''));
check('commande valable 48 heures (la vraie règle de la boutique)', /48 heures/.test(validityLine('fr')));

// --- « X % des clients ont aussi acheté ceci » : le VRAI pourcentage
const A = 'a', B = 'b', C = 'c';
const all = () => true;
check('réponse illisible (script SQL pas lancé) : null, jamais de chiffre', parseAffinity(null) === null && parseAffinity('x') === null && parseAffinity([]) === null);
const aff = (customers: number, boughtWith: [string, number][], viewers = 0, viewedWith: [string, number][] = []) =>
  parseAffinity({ customers, bought_with: boughtWith.map(([product_id, n]) => ({ product_id, n })), viewers, viewed_with: viewedWith.map(([product_id, n]) => ({ product_id, n })) });
check('0 commande (la base d\'aujourd\'hui) : AUCUN pourcentage d\'achats', pickAlsoBought(aff(0, []), A, all) === null);
check(`moins de ${MIN_BOUGHT_CUSTOMERS} clients : AUCUN pourcentage (4 clients dont 2 ont acheté B ne prouve rien)`, pickAlsoBought(aff(4, [[B, 2]]), A, all) === null);
const p = pickAlsoBought(aff(10, [[B, 5], [C, 3]]), A, all);
check('10 clients dont 5 ont aussi acheté B : « 50 % » (calculé avec les vrais nombres)', p?.kind === 'bought' && p.pct === 50 && p.productId === B && p.n === 5 && p.total === 10, p);
check('le plus acheté ensemble est choisi (pas le premier)', pickAlsoBought(aff(10, [[C, 3], [B, 6]]), A, all)?.productId === B);
check('un seul client a acheté les deux : rien (au moins 2)', pickAlsoBought(aff(5, [[B, 1]]), A, all) === null);
check('moins de 20 % : rien', pickAlsoBought(aff(20, [[B, 3]]), A, all) === null);
check('l\'article lui-même n\'est jamais proposé', pickAlsoBought(aff(10, [[A, 9], [B, 4]]), A, all)?.productId === B);
check('un article qui n\'est plus en vente est écarté', pickAlsoBought(aff(10, [[B, 6], [C, 4]]), A, (id) => id !== B)?.productId === C);
check('incohérent (plus d\'acheteurs ensemble que de clients) : rien', pickAlsoBought(aff(5, [[B, 9]]), A, all) === null);
check('pourcentage arrondi à l\'entier : 2 sur 7 = 29 %', pickAlsoBought(aff(7, [[B, 2]]), A, all)?.pct === 29);
const v = pickAlsoBought(aff(0, [], 40, [[B, 20]]), A, all);
check('navigation : 40 visiteurs dont 20 ont aussi regardé B : « 50 % » des visiteurs (pas des acheteurs)', v?.kind === 'viewed' && v.pct === 50, v);
check('navigation : moins de 20 visiteurs ou moins de 30 % : rien', pickAlsoBought(aff(0, [], 19, [[B, 19]]), A, all) === null && pickAlsoBought(aff(0, [], 100, [[B, 20]]), A, all) === null);
check('les vrais achats passent avant la navigation', pickAlsoBought(aff(10, [[B, 5]], 100, [[C, 80]]), A, all)?.kind === 'bought');
check('achats insuffisants : la navigation prend le relais', pickAlsoBought(aff(2, [[B, 2]], 100, [[C, 40]]), A, all)?.kind === 'viewed');
check('phrase d\'achat : « 50 % des clients qui ont acheté « A » ont aussi acheté « B » »', alsoLine(p!, 'A', 'B', 'fr') === '👥 50 % des clients qui ont acheté « A » ont aussi acheté « B ».');
check('phrase de navigation : « des visiteurs qui ont REGARDÉ » (jamais « acheté »)', /des visiteurs qui ont regardé « A » ont aussi regardé « B »/.test(alsoLine(v!, 'A', 'B', 'fr')) && !/acheté/.test(alsoLine(v!, 'A', 'B', 'fr')));
check('arabe : les deux phrases', /اشتروا أيضاً/.test(alsoLine(p!, 'A', 'B', 'ar')) && /شاهدوا أيضاً/.test(alsoLine(v!, 'A', 'B', 'ar')));
check('JAMAIS un « 50 % » écrit en dur : tout pourcentage vient du calcul', !/\b50 ?%/.test([giftOfferLine('fr'), giftRecapLine('fr'), giftPlacedLine('fr'), confirmBecauseLine('fr'), riskFreeLine('fr', true), riskFreeLine('fr', false), validityLine('fr'), protectionLine('fr')].join(' ')));

// --- VOUS : Zara parle à la personne
const all2 = [giftOfferLine('fr'), giftRecapLine('fr'), giftPlacedLine('fr'), confirmBecauseLine('fr'), receivedLine('fr'), riskFreeLine('fr', true), riskFreeLine('fr', false), validityLine('fr'), protectionLine('fr')].join(' ');
check('« vous » partout, jamais « tu » ni « ton » dans les textes à un client', !/\b(tu|ton|ta|tes|toi|te)\b/i.test(all2.replace(/N’Djamena/g, '')), all2.match(/\b(tu|ton|ta|tes|toi|te)\b/gi));
check('aucune promesse de santé, d\'effet ou de résultat', !/santé|effet|soigne|guéri|performance|virilité|résultat garanti/i.test(all2));

console.log(`\n${ok} contrôles réussis`);
