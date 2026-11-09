// Offre « élèves et étudiants » (demande du patron, 9 novembre 2026) : l'article URBANSOLE à 12 500 FCFA, RÉSERVÉ aux élèves et étudiants,
// avec le code EE26 appliqué AUTOMATIQUEMENT. Qui est élève ou étudiant ? Seulement d'après le métier que le client a lui-même écrit dans son compte
// (lib/adAudiences, professionAudience) : rien n'est deviné. Les autres clients paient le prix normal.
// Des fonctions pures, sans réseau : testées dans tests/email/student-offer.test.ts. Voir docs/offre-eleves-etudiants.md.
//
// Règles de vérité :
//  - le prix normal est toujours le VRAI prix de l'article dans la base (aujourd'hui 15 000 FCFA) : « au lieu de … » n'est jamais inventé ;
//  - l'offre ne s'applique que si elle fait vraiment économiser (si le prix de l'article tombe à 12 500 ou moins, il n'y a plus d'offre : jamais une hausse) ;
//  - un client qui n'est pas élève/étudiant (ou n'a pas rempli son métier) ne voit pas l'offre et ne l'obtient pas ;
//  - le code est un nom d'offre : il s'applique tout seul, le client n'a rien à taper.
import { professionAudience } from './adAudiences';
import { normalize } from './assistantBrain';

export const STUDENT_OFFER = { code: 'EE26', slug: 'urbansole', price: 12500 } as const;

export type OfferCustomer = { profession?: string | null } | null | undefined;
export type StudentLevel = 'eleve' | 'etudiant';

export function studentLevel(customer: OfferCustomer): StudentLevel | null {
  const a = professionAudience(customer?.profession);
  return a === 'eleve' || a === 'etudiant' ? a : null;
}
export const isStudentCustomer = (customer: OfferCustomer): boolean => studentLevel(customer) !== null;

export interface StudentDeal {
  code: string;
  price: number; // le prix élève / étudiant
  listPrice: number; // le vrai prix normal de l'article
  saving: number; // ce que le client économise (par article)
  pct: number; // la vraie remise en %, arrondie
}

// Le prix normal doit être > au prix de l'offre. `price` peut arriver en texte (colonne numeric de la base).
export function dealFromPrice(listPrice: unknown): StudentDeal | null {
  const list = Number(listPrice);
  if (!Number.isFinite(list) || list <= STUDENT_OFFER.price) return null;
  const saving = list - STUDENT_OFFER.price;
  return { code: STUDENT_OFFER.code, price: STUDENT_OFFER.price, listPrice: list, saving, pct: Math.round((saving / list) * 100) };
}

// L'offre de CET article pour CE client, ou null (autre article, client pas élève/étudiant, ou aucune économie).
export function studentDeal(product: { slug?: string | null; price?: unknown } | null | undefined, customer: OfferCustomer): StudentDeal | null {
  if (!product || product.slug !== STUDENT_OFFER.slug) return null;
  if (!isStudentCustomer(customer)) return null;
  return dealFromPrice(product.price);
}

// Ce qui est noté sur l'article de la commande (la commande garde le prix payé, le prix normal et le code : l'équipe voit l'offre)
export interface StudentOfferMark {
  code: string;
  list_price: number;
}

// L'article avec le prix de l'offre quand le client y a droit (sinon l'article tel quel). Appliquer deux fois ne change rien.
export function withStudentPrice<T extends { slug?: string | null; price: number; student_offer?: StudentOfferMark }>(product: T, customer: OfferCustomer): T {
  const deal = studentDeal(product, customer);
  if (!deal) return product;
  return { ...product, price: deal.price, student_offer: { code: deal.code, list_price: deal.listPrice } };
}

// Un article de la commande qui porte l'offre alors que le client n'y a plus droit (autre compte sur le même téléphone, métier changé) : le prix normal revient.
export function withoutStudentPrice<T extends { price: number; student_offer?: StudentOfferMark }>(product: T): T {
  if (!product.student_offer) return product;
  const { student_offer, ...rest } = product;
  return { ...(rest as unknown as T), price: student_offer.list_price };
}

// Remet l'article de la commande dans le bon état pour CE client : le prix de l'offre s'il y a droit, le prix normal sinon.
export function settleStudentPrice<T extends { slug?: string | null; price: number; student_offer?: StudentOfferMark }>(product: T, customer: OfferCustomer): T {
  const base = product.student_offer ? withoutStudentPrice(product) : product;
  return withStudentPrice(base, customer);
}

// Le client écrit le code (« EE26 », « ee 26 », « code EE26 ») : reconnu sans tenir compte des majuscules ni des espaces
export const mentionsOfferCode = (text: string): boolean => normalize(text).replace(/\s+/g, '').includes(STUDENT_OFFER.code.toLowerCase());
// …ou il demande l'offre : « offre étudiant », « réduction pour les élèves », « prix étudiant », « promo élève »
const OFFER_ASK = /(?:offre|reduction|remise|promo|promotion|prix|code|tarif)s?\s+(?:pour\s+)?(?:les\s+|des\s+)?(?:eleves?|etudiants?|etudiantes?)|(?:eleves?|etudiants?)\s+(?:offre|reduction|remise|promo|prix|code)|عرض\s+(?:ال)?(?:طلاب|طالب|تلاميذ|تلميذ)|تخفيض\s+(?:ال)?(?:طلاب|طالب|تلاميذ)/;
export const asksStudentOffer = (text: string): boolean => {
  const n = normalize(text);
  return !!n && n.split(' ').length <= 12 && (mentionsOfferCode(text) || OFFER_ASK.test(n));
};

// --- les textes (français et arabe) ---
export type OfferLang = 'fr' | 'ar';
const fcfa = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;
export const offerTexts = {
  badge: (lang: OfferLang) => (lang === 'ar' ? '🎓 عرض حصري للتلاميذ والطلاب' : '🎓 OFFRE RÉSERVÉE AUX ÉLÈVES ET ÉTUDIANTS'),
  only: (lang: OfferLang) => (lang === 'ar' ? 'هذا العرض للتلاميذ والطلاب فقط' : 'Offre uniquement pour les élèves et étudiants'),
  instead: (d: StudentDeal, lang: OfferLang) => (lang === 'ar' ? `بدل ${fcfa(d.listPrice)}` : `au lieu de ${fcfa(d.listPrice)}`),
  auto: (d: StudentDeal, lang: OfferLang) => (lang === 'ar' ? `الكود ${d.code} يُطبَّق تلقائياً` : `Code ${d.code} appliqué automatiquement`),
  cta: (d: StudentDeal, lang: OfferLang) => (lang === 'ar' ? `اطلب الآن بالكود ${d.code}` : `Commander avec le code ${d.code}`),
  price: (d: StudentDeal) => fcfa(d.price),
  list: (d: StudentDeal) => fcfa(d.listPrice),
  pct: (d: StudentDeal, lang: OfferLang) => (lang === 'ar' ? `-${d.pct}٪` : `-${d.pct} %`),
  // sur la fiche article et à la commande
  line: (d: StudentDeal, lang: OfferLang) =>
    lang === 'ar'
      ? `🎓 عرض التلاميذ والطلاب: ${fcfa(d.price)} بدل ${fcfa(d.listPrice)} (الكود ${d.code} طُبِّق تلقائياً)`
      : `🎓 Offre élèves et étudiants : ${fcfa(d.price)} au lieu de ${fcfa(d.listPrice)} (code ${d.code} appliqué automatiquement)`,
  // Zara : le client écrit le code ou demande l'offre
  zaraYes: (d: StudentDeal, lang: OfferLang) =>
    lang === 'ar'
      ? `🎓 نعم، لديك عرض التلاميذ والطلاب! URBANSOLE بسعر ${fcfa(d.price)} بدل ${fcfa(d.listPrice)}. الكود ${d.code} يُطبَّق تلقائياً عند الطلب، لا تكتب شيئاً.`
      : `🎓 Oui, vous avez l’offre élèves et étudiants ! URBANSOLE à ${fcfa(d.price)} au lieu de ${fcfa(d.listPrice)}. Le code ${d.code} s’applique tout seul à la commande : vous n’avez rien à écrire.`,
  zaraNoMember: (lang: OfferLang) =>
    lang === 'ar'
      ? `🎓 عرض التلاميذ والطلاب (الكود ${STUDENT_OFFER.code}) خاص بالتلاميذ والطلاب فقط. لتستفيد منه، اكتب «تلميذ» أو «طالب» في خانة المهنة في حسابك، ثم ارجع إليّ.`
      : `🎓 L’offre élèves et étudiants (code ${STUDENT_OFFER.code}) est réservée aux élèves et étudiants. Pour en profiter, écrivez « élève » ou « étudiant » dans « Métier », dans votre compte, puis revenez me voir.`,
  zaraNoGuest: (lang: OfferLang) =>
    lang === 'ar'
      ? `🎓 عرض التلاميذ والطلاب (الكود ${STUDENT_OFFER.code}) خاص بالتلاميذ والطلاب فقط. أنشئ حسابك المجاني واكتب «تلميذ» أو «طالب» في خانة المهنة، ثم ارجع إليّ.`
      : `🎓 L’offre élèves et étudiants (code ${STUDENT_OFFER.code}) est réservée aux élèves et étudiants. Créez votre compte gratuit et écrivez « élève » ou « étudiant » dans « Métier », puis revenez me voir.`,
  // l'article n'est plus en vente ou son prix est déjà ≤ au prix de l'offre : Zara ne promet rien
  zaraNone: (lang: OfferLang) => (lang === 'ar' ? 'لا يوجد عرض للتلاميذ والطلاب في الوقت الحالي.' : 'Il n’y a pas d’offre élèves et étudiants en ce moment.'),
  chipAccount: (lang: OfferLang) => (lang === 'ar' ? '👤 حسابي' : '👤 Mon compte'),
};
