// Le sondage du site (docs/sondage-client.md) : quelles questions restent, quand la carte est montrée, et les réponses vérifiées avant d'être envoyées. Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/client-survey.test.ts
import {
  ASK_GAP_MS,
  ASK_MAX,
  NEVER_ASKED,
  NO_LOCAL,
  NOTIFICATIONS_ON,
  SURVEY_ORDER,
  checkSurveyBirth,
  checkSurveyWhatsapp,
  notificationsQuestionDue,
  parseAskState,
  parseSurveyLocal,
  surveyAskDue,
  surveyPending,
  surveyProgress,
  whatsappQuestionDue,
  type SurveyProfile,
} from '../../src/lib/clientSurvey.ts';

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

const DAY = 86_400_000;
const T = Date.parse('2026-11-07T10:00:00Z');

// un compte tout neuf, créé avec le formulaire court : seuls le nom, le téléphone et le mot de passe sont connus (les colonnes existent, vides)
const fresh: SurveyProfile = {
  is_admin: false,
  gender: null,
  birth_date: null,
  marital_status: null,
  phone: '66 12 34 56',
  whatsapp_number: '66 12 34 56', // l'inscription copie le téléphone dans le WhatsApp
  notify_new_products: false,
  notify_promotions: false,
  notify_flash_sale: false,
};

// ---- les questions, dans l'ordre
check('l\'ordre : sexe, naissance, situation, WhatsApp, notifications', SURVEY_ORDER.join() === 'gender,birth,marital,whatsapp,notifications');
check('compte neuf : les 5 questions, dans l\'ordre', surveyPending(fresh).join() === 'gender,birth,marital,whatsapp,notifications', surveyPending(fresh));
check('sexe déjà répondu : il n\'est plus demandé', surveyPending({ ...fresh, gender: 'femme' }).join() === 'birth,marital,whatsapp,notifications');
check('naissance et situation déjà répondues : elles ne sont plus demandées', surveyPending({ ...fresh, gender: 'homme', birth_date: '1998-03-25', marital_status: 'marie' }).join() === 'whatsapp,notifications');
check('tout répondu : plus rien à demander', surveyPending({ ...fresh, gender: 'homme', birth_date: '1998-03-25', marital_status: 'celibataire', whatsapp_number: '99 22 10 17', notify_promotions: true, notify_new_products: true, notify_flash_sale: true }).length === 0);
check('valeur inconnue (« autre », date impossible) : redemandée', surveyPending({ ...fresh, gender: 'autre', birth_date: '1998-02-31', marital_status: 'veuf' }).slice(0, 3).join() === 'gender,birth,marital');

// ---- colonnes absentes de la base (scripts SQL pas lancés) : on ne demande pas ce qui ne peut pas être gardé
check('colonnes sexe / naissance / situation absentes : ces trois questions ne sont pas posées', surveyPending({ is_admin: false, phone: '66 12 34 56', whatsapp_number: null, notify_new_products: false, notify_promotions: false, notify_flash_sale: false }).join() === 'whatsapp,notifications');
check('seul le sexe est absent de la base : naissance et situation sont quand même demandées', surveyPending({ ...fresh, gender: undefined, ...{} } as SurveyProfile).includes('birth') === true);
{
  const noGender = { ...fresh } as Record<string, unknown>;
  delete noGender.gender;
  check('clé « gender » absente du profil : pas de question sexe', !surveyPending(noGender as SurveyProfile).includes('gender') && surveyPending(noGender as SurveyProfile).includes('birth'));
}

// ---- l'équipe et les visiteurs
check('équipe (administrateur) : jamais interrogée', surveyPending({ ...fresh, is_admin: true }).length === 0);
check('pas de profil (visiteur sans compte) : rien', surveyPending(null).length === 0 && surveyPending(undefined).length === 0);

// ---- WhatsApp
check('WhatsApp = téléphone (copié à l\'inscription) : on demande si c\'est bien le même', whatsappQuestionDue({ phone: '66 12 34 56', whatsapp_number: '66 12 34 56' }));
check('WhatsApp vide : on demande', whatsappQuestionDue({ phone: '66 12 34 56', whatsapp_number: null }));
check('même numéro écrit autrement (+235, espaces) : toujours « le même »', whatsappQuestionDue({ phone: '66 12 34 56', whatsapp_number: '+235 66123456' }));
check('un autre numéro déjà donné : plus de question', !whatsappQuestionDue({ phone: '66 12 34 56', whatsapp_number: '99 22 10 17' }));
check('compte sans téléphone : la question n\'a pas de sens, elle n\'est pas posée', !whatsappQuestionDue({ phone: null, whatsapp_number: null }) && !whatsappQuestionDue({ phone: '', whatsapp_number: '' }));
check('« c\'est le même » gardé sur le téléphone : plus de question WhatsApp', !surveyPending(fresh, { whatsappDone: true, notificationsDone: false }).includes('whatsapp'));

// ---- accord pour les nouveautés et offres
check('les trois réglages sont « non » : on demande', notificationsQuestionDue({ notify_new_products: false, notify_promotions: false, notify_flash_sale: false }));
check('un seul réglage « oui » : jamais redemandé', !notificationsQuestionDue({ notify_new_products: true, notify_promotions: false, notify_flash_sale: false }) && !notificationsQuestionDue({ notify_new_products: false, notify_promotions: false, notify_flash_sale: true }));
check('réglages absents du profil (pas lus) : pas de question (jamais « non » par défaut)', !notificationsQuestionDue({}) && !notificationsQuestionDue({ notify_new_products: null, notify_promotions: null, notify_flash_sale: null }));
check('« non merci » gardé sur le téléphone : plus de question', !surveyPending(fresh, { whatsappDone: false, notificationsDone: true }).includes('notifications'));
check('« oui » : exactement les trois réglages de Mon compte', JSON.stringify(NOTIFICATIONS_ON) === '{"notify_new_products":true,"notify_promotions":true,"notify_flash_sale":true}');

// ---- ce que le téléphone a gardé
check('réponses gardées relues', JSON.stringify(parseSurveyLocal('{"whatsappDone":true,"notificationsDone":true}')) === '{"whatsappDone":true,"notificationsDone":true}');
check('rien de gardé ou texte illisible : rien de répondu', JSON.stringify(parseSurveyLocal(null)) === JSON.stringify(NO_LOCAL) && JSON.stringify(parseSurveyLocal('pas du json')) === JSON.stringify(NO_LOCAL) && JSON.stringify(parseSurveyLocal('{"whatsappDone":"oui"}')) === JSON.stringify(NO_LOCAL));

// ---- « Question 2 sur 4 »
check('1re question sur 4', JSON.stringify(surveyProgress(4, 4)) === '{"index":1,"total":4}');
check('2e question sur 4 (3 restantes)', JSON.stringify(surveyProgress(4, 3)) === '{"index":2,"total":4}');
check('dernière question', JSON.stringify(surveyProgress(4, 1)) === '{"index":4,"total":4}');
check('jamais d\'indice absurde (0 restante, plus que le total)', surveyProgress(3, 0).index >= 1 && surveyProgress(2, 5).total === 5 && surveyProgress(0, 0).total === 1);

// ---- quand la carte est montrée
check('compte neuf, jamais demandé : la carte est montrée tout de suite', surveyAskDue(fresh, NO_LOCAL, NEVER_ASKED, T));
check('rien à demander : jamais montrée', !surveyAskDue({ ...fresh, gender: 'homme', birth_date: '1998-03-25', marital_status: 'marie', whatsapp_number: '99 22 10 17', notify_promotions: true }, NO_LOCAL, NEVER_ASKED, T));
check('équipe : jamais montrée', !surveyAskDue({ ...fresh, is_admin: true }, NO_LOCAL, NEVER_ASKED, T));
check('pas de profil : jamais montrée', !surveyAskDue(null, NO_LOCAL, NEVER_ASKED, T));
check('« Plus tard » il y a 1 jour : pas encore', !surveyAskDue(fresh, NO_LOCAL, { count: 1, last: T - DAY }, T));
check('« Plus tard » il y a 2 j 23 h : pas encore', !surveyAskDue(fresh, NO_LOCAL, { count: 1, last: T - 3 * DAY + 3_600_000 }, T));
check('3 jours après : la carte revient', surveyAskDue(fresh, NO_LOCAL, { count: 1, last: T - ASK_GAP_MS }, T));
check('la 3e fois est la dernière : après 3 demandes, le sondage ne demande plus', ASK_MAX === 3 && !surveyAskDue(fresh, NO_LOCAL, { count: 3, last: T - 30 * DAY }, T) && surveyAskDue(fresh, NO_LOCAL, { count: 2, last: T - 4 * DAY }, T));
check('date dans le futur (horloge changée) : on attend', !surveyAskDue(fresh, NO_LOCAL, { count: 1, last: T + DAY }, T));

check('état gardé relu', JSON.stringify(parseAskState('{"count":2,"last":1700000000000}')) === '{"count":2,"last":1700000000000}');
check('rien de gardé : jamais demandé', parseAskState(null).count === 0 && parseAskState(undefined).count === 0 && parseAskState('').count === 0);
check('texte illisible ou faux : jamais demandé', parseAskState('pas du json').count === 0 && parseAskState('{"count":"x"}').count === 0 && parseAskState('{"count":-1,"last":5}').count === 0 && parseAskState('[]').count === 0);

// ---- les réponses écrites
{
  const r = checkSurveyBirth('25/03/1998', T);
  check('date juste : « 25/03/1998 » devient « 1998-03-25 »', r.ok && r.value === '1998-03-25', r);
}
check('date vide : refusée avec un message', (() => { const r = checkSurveyBirth('', T); return !r.ok && /manquante/.test(r.title); })());
check('date qui n\'existe pas (31/02/1998) : refusée', (() => { const r = checkSurveyBirth('31/02/1998', T); return !r.ok && /invalide/.test(r.title); })());
check('date dans le futur : refusée', (() => { const r = checkSurveyBirth('01/01/2030', T); return !r.ok && /futur/.test(r.message); })());
check('âge absurde (année 1800) : « à vérifier »', (() => { const r = checkSurveyBirth('01/01/1850', T); return !r.ok && /vérifier/.test(r.title); })());
{
  const r = checkSurveyWhatsapp('  99   22 10 17 ');
  check('numéro WhatsApp valide : espaces nettoyés', r.ok && r.value === '99 22 10 17', r);
}
check('numéro WhatsApp avec +235 : accepté', checkSurveyWhatsapp('+235 99 22 10 17').ok === true);
check('numéro WhatsApp trop court ou avec des lettres : refusé avec le même message qu\'avant', (() => { const a = checkSurveyWhatsapp('12'); const b = checkSurveyWhatsapp('abc'); const c = checkSurveyWhatsapp(''); return !a.ok && !b.ok && !c.ok && a.message === 'Merci de saisir un numéro WhatsApp valide (8 à 15 chiffres).'; })());

console.log(`\n${ok} controles OK`);
if (process.exitCode) console.log('DES ECHECS ci-dessus');
else console.log('TOUT EST BON');
