// Partenaires locaux (Admin › Mes partenaires) : vérification de ce que le patron écrit, ligne montrée sous un article, WhatsApp du partenaire. Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/partners.test.ts
import {
  PARTNER_NAME_MAX,
  PARTNER_NOTE_MAX,
  articlesCountLabel,
  checkLinkNote,
  checkPartnerInput,
  isMissingPartnersTable,
  partnerByProduct,
  partnerCallLink,
  partnerLine,
  partnerPhoneLabel,
  partnerWhatsappLink,
  type Partner,
  type ProductPartnerLink,
} from '../../src/lib/partners.ts';

let ok = 0;
const check = (label: string, cond: unknown, detail?: unknown) => {
  if (cond) ok++;
  else {
    console.log('ECHEC', label, detail === undefined ? '' : JSON.stringify(detail));
    process.exitCode = 1;
  }
};

// ---- ce que le patron écrit
{
  const r = checkPartnerInput({ name: '  Mahamat   Ali ', phone: ' 66 12 34 56 ', note: ' Marché de Dembé ' });
  check('partenaire complet : espaces en trop retirés, numéro et petit mot gardés', r.ok && r.value.name === 'Mahamat Ali' && r.value.phone === '66 12 34 56' && r.value.note === 'Marché de Dembé', r);
}
{
  const r = checkPartnerInput({ name: 'Boutique Amina' });
  check('seul le nom est obligatoire : téléphone et petit mot vides = absents (null)', r.ok && r.value.phone === null && r.value.note === null, r);
}
check('nom vide ou seulement des espaces : refusé', !checkPartnerInput({ name: '' }).ok && !checkPartnerInput({ name: '   ' }).ok);
check('nom trop long : refusé avec un message', (() => { const r = checkPartnerInput({ name: 'x'.repeat(PARTNER_NAME_MAX + 1) }); return !r.ok && /80/.test(r.message); })());
check('nom de 80 caractères : accepté', checkPartnerInput({ name: 'x'.repeat(PARTNER_NAME_MAX) }).ok);
check('téléphone écrit mais pas un numéro : refusé', (() => { const r = checkPartnerInput({ name: 'A', phone: 'abc' }); return !r.ok && /valide/.test(r.message); })());
check('téléphone trop court : refusé', !checkPartnerInput({ name: 'A', phone: '12' }).ok);
check('téléphones acceptés : « +235 66 12 34 56 », « 0023566123456 », « 66-12-34-56 »', ['+235 66 12 34 56', '0023566123456', '66-12-34-56'].every((p) => checkPartnerInput({ name: 'A', phone: p }).ok));
check('petit mot trop long : refusé', !checkPartnerInput({ name: 'A', note: 'x'.repeat(PARTNER_NOTE_MAX + 1) }).ok && checkPartnerInput({ name: 'A', note: 'x'.repeat(PARTNER_NOTE_MAX) }).ok);
check('texte piégé dans le nom : gardé tel quel comme texte (la base ne l\'exécute pas)', (() => { const r = checkPartnerInput({ name: "'; drop table partners; --" }); return r.ok && r.value.name === "'; drop table partners; --"; })());

{
  const a = checkLinkNote('  Prix chez lui : 8 000  ');
  check('petit message d\'un article : espaces retirés', a.ok && a.value === 'Prix chez lui : 8 000', a);
  check('petit message vide = aucun message (null)', (() => { const r = checkLinkNote('   '); return r.ok && r.value === null; })());
  check('petit message trop long : refusé', !checkLinkNote('x'.repeat(PARTNER_NOTE_MAX + 1)).ok);
}

// ---- la ligne sous un article
const P = (id: string, name: string, phone: string | null = null, note: string | null = null): Partner => ({ id, name, phone, note });
const mahamat = P('p1', 'Mahamat Ali', '66 12 34 56');
const sans = P('p2', 'Boutique Amina');
const L = (product_id: string, partner_id: string, note: string | null = null): ProductPartnerLink => ({ product_id, partner_id, note });
{
  const m = partnerByProduct([mahamat, sans], [L('a1', 'p1', 'Prix chez lui : 8 000'), L('a2', 'p2'), L('a3', 'inconnu'), L('a4', 'p1', '   ')]);
  check('article → partenaire + petit message', m.get('a1')?.partner.name === 'Mahamat Ali' && m.get('a1')?.note === 'Prix chez lui : 8 000');
  check('article sans petit message ou avec un message vide : note = null', m.get('a2')?.note === null && m.get('a4')?.note === null);
  check('partenaire supprimé ou inconnu : aucun lien (jamais d\'erreur)', !m.has('a3') && m.size === 3);
  check('article sans partenaire : absent', !m.has('zzz'));
  check('ligne : « 🤝 Partenaire : Mahamat Ali · +235 66 12 34 56 — Prix chez lui : 8 000 »', partnerLine(m.get('a1')!) === '🤝 Partenaire : Mahamat Ali · +235 66 12 34 56 — Prix chez lui : 8 000', partnerLine(m.get('a1')!));
  check('ligne sans téléphone ni message : « 🤝 Partenaire : Boutique Amina »', partnerLine(m.get('a2')!) === '🤝 Partenaire : Boutique Amina', partnerLine(m.get('a2')!));
  check('aucune ligne ne contient « undefined », « null » ou « NaN »', [...m.values()].every((ap) => !/undefined|null|NaN/.test(partnerLine(ap))));
}
check('numéro joli : « 66 12 34 56 » → « +235 66 12 34 56 »', partnerPhoneLabel('66 12 34 56') === '+235 66 12 34 56');
check('numéro absent ou vide : null', partnerPhoneLabel(null) === null && partnerPhoneLabel('  ') === null);
check('texte qui n\'est pas un numéro : montré tel quel (jamais caché)', partnerPhoneLabel('chez lui') === 'chez lui');
check('nombre d\'articles : aucun / 1 / 12', articlesCountLabel(0) === 'aucun article' && articlesCountLabel(1) === '1 article' && articlesCountLabel(12) === '12 articles' && articlesCountLabel(NaN) === 'aucun article');

// ---- WhatsApp et appel
{
  const wa = partnerWhatsappLink(mahamat, { name: 'Montre KEEP MOVING', quantity: 2 });
  const text = decodeURIComponent((wa ?? '').split('text=')[1] ?? '');
  check('WhatsApp du partenaire : bon numéro (235 + 8 chiffres)', !!wa && wa.startsWith('https://wa.me/23566123456?text='), wa);
  check('message : prénom du partenaire, article et quantité', /^Bonjour Mahamat, ici Albasse Shopping\./.test(text) && text.includes('« Montre KEEP MOVING » × 2'), text);
  check('message : jamais d\'informations du client (ni nom, ni numéro, ni ville, ni prix)', !/FCFA|client|livraison/i.test(text) && !/\d{6}/.test(text), text);
  check('quantité absente ou 0 : au moins 1', /× 1/.test(decodeURIComponent((partnerWhatsappLink(mahamat, { name: 'A', quantity: 0 }) ?? '').split('text=')[1] ?? '')));
  check('sans article : simple bonjour', /Bonjour Mahamat, ici Albasse Shopping 😊/.test(decodeURIComponent((partnerWhatsappLink(mahamat) ?? '').split('text=')[1] ?? '')));
}
check('partenaire sans téléphone : ni WhatsApp ni appel', partnerWhatsappLink(sans) === null && partnerCallLink(sans) === null);
check('appel : « tel:+23566123456 »', partnerCallLink(mahamat) === 'tel:+23566123456');
check('numéro illisible : ni WhatsApp ni appel', partnerWhatsappLink({ name: 'A', phone: 'chez lui' }) === null && partnerCallLink({ phone: 'chez lui' }) === null);

// ---- script SQL pas lancé
check('tables absentes (PGRST205 ou 42P01) : reconnu', isMissingPartnersTable({ code: 'PGRST205', message: "Could not find the table 'public.partners' in the schema cache" }) && isMissingPartnersTable({ code: '42P01', message: 'relation "public.product_partners" does not exist' }));
check('autre erreur : pas confondue avec « script pas lancé »', !isMissingPartnersTable({ code: '42501', message: 'permission denied for table partners' }) && !isMissingPartnersTable(null) && !isMissingPartnersTable({ code: 'PGRST205', message: 'Could not find the table public.orders' }));

console.log(`${ok} controles OK`);
if (!process.exitCode) console.log('TOUT EST BON');
