// Livraison programmée (src/lib/scheduledDelivery.ts) : jours et créneaux proposés, contrôle du rendez-vous, textes. Tout se calcule à l'heure de
// N'Djamena (UTC+1) quel que soit le fuseau du téléphone : à lancer sous plusieurs fuseaux, le résultat doit être le même.
// Lancer : TZ=America/Los_Angeles node --import ./tests/zara/register.mjs tests/email/scheduled-delivery.test.ts
import { allSlots, dayFromText, dayKeyOf, dayOptions, flagDeadlineIso, formatSlot, ndjamenaParts, slotInstant, slotProblem, slotToIso, slotsOfDay, timeFromText, timeLabel, waitsForAppointment } from '../../src/lib/scheduledDelivery.ts';

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

// dimanche 25 octobre 2026, 10h00 à N'Djamena (09:00 UTC)
const NOW = Date.UTC(2026, 9, 25, 9, 0, 0);

// --- l'heure de N'Djamena ---
check('09:00 UTC = 10h00 à N’Djamena, un dimanche', JSON.stringify(ndjamenaParts(NOW)) === JSON.stringify({ year: 2026, month: 10, day: 25, hour: 10, minute: 0, weekday: 0 }), ndjamenaParts(NOW));
check('23:30 UTC = 00h30 le lendemain à N’Djamena', dayKeyOf(Date.UTC(2026, 9, 25, 23, 30)) === '2026-10-26');
check('22:59 UTC = encore le même jour', dayKeyOf(Date.UTC(2026, 9, 25, 22, 59)) === '2026-10-25');
check('passage d’année : 31/12 23:30 UTC = 1er janvier', dayKeyOf(Date.UTC(2026, 11, 31, 23, 30)) === '2027-01-01');

// --- jour + heure -> instant ---
check('26/10 à 14h30 = 13:30 UTC', slotInstant('2026-10-26', '14:30') === Date.UTC(2026, 9, 26, 13, 30));
check('00h30 = 23:30 UTC la veille', slotInstant('2026-10-26', '00:30') === Date.UTC(2026, 9, 25, 23, 30));
check('jour qui n’existe pas : refusé', slotInstant('2026-02-31', '10:00') === null);
check('heure mal écrite : refusée', slotInstant('2026-10-26', '25:00') === null && slotInstant('2026-10-26', '8:30') === null && slotInstant('2026-10-26', '10h00') === null);
check('jour mal écrit : refusé', slotInstant('26/10/2026', '10:00') === null && slotInstant('', '10:00') === null);
check('instant -> texte ISO en UTC', slotToIso('2026-10-26', '14:30') === '2026-10-26T13:30:00.000Z');
check('mauvais jour -> pas de texte ISO', slotToIso('2026-13-01', '14:30') === null);

// --- les créneaux d'une journée ---
const slots = allSlots();
check('15 créneaux : de 08:30 à 15:30', slots.length === 15 && slots[0] === '08:30' && slots[14] === '15:30', slots);
check('un créneau toutes les 30 minutes', slots.every((t, i) => i === 0 || Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) - (Number(slots[i - 1].slice(0, 2)) * 60 + Number(slots[i - 1].slice(3))) === 30));
check('étiquettes : 8h30, 14h00', timeLabel('08:30') === '8h30' && timeLabel('14:00') === '14h00');

const today = slotsOfDay('2026-10-25', NOW); // il est 10h00 : 2 h plus tard = 12h00
check('aujourd’hui à 10h : 11h30 trop proche', today.find((s) => s.time === '11:30')?.available === false);
check('aujourd’hui à 10h : 12h00 (exactement 2 h) possible', today.find((s) => s.time === '12:00')?.available === true);
check('aujourd’hui à 10h : 08h30 déjà passé', today.find((s) => s.time === '08:30')?.available === false);
check('demain : tous les créneaux possibles', slotsOfDay('2026-10-26', NOW).every((s) => s.available));

// --- les jours proposés ---
const days = dayOptions(NOW);
check('8 jours proposés : aujourd’hui + 7', days.length === 8 && days[0].key === '2026-10-25' && days[7].key === '2026-11-01', days.map((d) => d.key));
check('étiquettes : Aujourd’hui, Demain, puis jour + date', days[0].label === "Aujourd'hui" && days[1].label === 'Demain' && days[2].label === 'mar. 27/10' && days[6].label === 'sam. 31/10', days.map((d) => d.label));

const late = Date.UTC(2026, 9, 25, 13, 30); // 14h30 à N'Djamena : plus aucun créneau possible aujourd'hui
const lateDays = dayOptions(late);
check('14h30 : plus de rendez-vous aujourd’hui, on commence demain', lateDays[0].key === '2026-10-26' && lateDays[0].label === 'Demain', lateDays.map((d) => d.key));
check('14h30 : toujours 7 jours proposés', lateDays.length === 7, lateDays.length);

const night = Date.UTC(2026, 9, 25, 23, 30); // 00h30 le 26 à N'Djamena : « aujourd'hui » est déjà le 26
const nightDays = dayOptions(night);
check('00h30 : « Aujourd’hui » est le jour de N’Djamena (26), pas celui du téléphone', nightDays[0].key === '2026-10-26' && nightDays[0].label === "Aujourd'hui", nightDays.map((d) => d.key));
check('00h30 : le jour même propose des créneaux (08h30 est à plus de 2 h)', slotsOfDay('2026-10-26', night).some((s) => s.available));

// --- le contrôle du rendez-vous ---
check('rendez-vous demain 14h30 : bon', slotProblem('2026-10-26', '14:30', NOW) === null);
check('exactement 2 h : bon', slotProblem('2026-10-25', '12:00', NOW) === null);
check('1 h 30 : trop tôt', /au moins 2 h/.test(slotProblem('2026-10-25', '11:30', NOW) ?? ''));
check('dans le passé : refusé', slotProblem('2026-10-24', '10:00', NOW) !== null);
check('16h00 : hors des horaires', /8h30 à 15h30/.test(slotProblem('2026-10-26', '16:00', NOW) ?? ''));
check('08h00 : hors des horaires', /8h30 à 15h30/.test(slotProblem('2026-10-26', '08:00', NOW) ?? ''));
check('14h20 : pas un créneau de 30 minutes', slotProblem('2026-10-26', '14:20', NOW) !== null);
check('dans 7 jours : bon', slotProblem('2026-11-01', '15:30', NOW) === null);
check('dans 10 jours : trop loin', /7 prochains jours/.test(slotProblem('2026-11-04', '10:00', NOW) ?? ''));
check('rien choisi : message pour choisir', /Choisissez le jour/.test(slotProblem(null, null, NOW) ?? '') && /Choisissez le jour/.test(slotProblem('2026-10-26', null, NOW) ?? '') && /Choisissez le jour/.test(slotProblem(null, '10:00', NOW) ?? ''));
check('jour inventé : refusé', slotProblem('2026-02-31', '10:00', NOW) !== null);

// --- le texte affiché ---
check('même jour : « aujourd’hui à 14h30 »', formatSlot('2026-10-25T13:30:00.000Z', NOW) === "aujourd'hui à 14h30");
check('lendemain : « demain à 9h00 »', formatSlot('2026-10-26T08:00:00.000Z', NOW) === 'demain à 9h00', formatSlot('2026-10-26T08:00:00.000Z', NOW));
check('plus tard : « samedi 31/10 à 14h30 »', formatSlot('2026-10-31T13:30:00.000Z', NOW) === 'samedi 31/10 à 14h30');
check('heure en UTC mais jour de N’Djamena : 23:30 UTC = 00h30 le lendemain', formatSlot('2026-10-25T23:30:00.000Z', NOW) === 'demain à 0h30', formatSlot('2026-10-25T23:30:00.000Z', NOW));
check('texte illisible ou vide : rien', formatSlot('pas une date', NOW) === '' && formatSlot(null, NOW) === '' && formatSlot(undefined, NOW) === '');
check('aller-retour : ce qu’on enregistre se relit pareil', formatSlot(slotToIso('2026-10-31', '10:30'), NOW) === 'samedi 31/10 à 10h30');

// --- en arabe (chat de Zara) ---
const daysAr = dayOptions(NOW, 'ar');
check('arabe : « اليوم », « غداً », puis jour + date', daysAr[0].label === 'اليوم' && daysAr[1].label === 'غداً' && daysAr[2].label === 'الثلاثاء 27/10' && daysAr.length === 8, daysAr.map((d) => d.label));
check('arabe : les mêmes jours que le français (mêmes clés)', JSON.stringify(daysAr.map((d) => d.key)) === JSON.stringify(days.map((d) => d.key)));
check('arabe : heures « 14:30 » et « 8:30 »', timeLabel('14:30', 'ar') === '14:30' && timeLabel('08:30', 'ar') === '8:30');
check('arabe : « اليوم الساعة 14:30 »', formatSlot('2026-10-25T13:30:00.000Z', NOW, 'ar') === 'اليوم الساعة 14:30', formatSlot('2026-10-25T13:30:00.000Z', NOW, 'ar'));
check('arabe : « غداً الساعة 9:00 »', formatSlot('2026-10-26T08:00:00.000Z', NOW, 'ar') === 'غداً الساعة 9:00', formatSlot('2026-10-26T08:00:00.000Z', NOW, 'ar'));
check('arabe : « السبت 31/10 الساعة 14:30 »', formatSlot('2026-10-31T13:30:00.000Z', NOW, 'ar') === 'السبت 31/10 الساعة 14:30', formatSlot('2026-10-31T13:30:00.000Z', NOW, 'ar'));
check('arabe : texte illisible : rien', formatSlot('x', NOW, 'ar') === '');

// --- le jour écrit par le client ---
const D = (t: string) => dayFromText(t, NOW);
check('« demain » = 26/10 ; « aujourd’hui » (apostrophe courbe ou droite) = 25/10', D('demain') === '2026-10-26' && D('aujourd’hui') === '2026-10-25' && D("Aujourd'hui") === '2026-10-25', [D('demain'), D('aujourd’hui')]);
check('jours de la semaine : jeudi = 29/10, mardi = 27/10, « mar » = mardi, majuscules acceptées', D('jeudi') === '2026-10-29' && D('JEUDI') === '2026-10-29' && D('mardi') === '2026-10-27' && D('mar') === '2026-10-27' && D('je veux jeudi svp') === '2026-10-29');
check('« dimanche » = aujourd’hui (dimanche 25) tant qu’il reste des heures', D('dimanche') === '2026-10-25');
check('une date : 31/10, 1/11, « samedi 31/10 »', D('31/10') === '2026-10-31' && D('1/11') === '2026-11-01' && D('samedi 31/10') === '2026-10-31');
check('un jour qui n’est pas proposé (15/11) ou rien de clair : null', D('15/11') === null && D('n’importe quoi') === null && D('') === null && D('29/02') === null);
check('arabe : غدا / غداً (avec voyelle), اليوم, الخميس, الاثنين, الأربعاء', D('غدا') === '2026-10-26' && D('غداً') === '2026-10-26' && D('اليوم') === '2026-10-25' && D('الخميس') === '2026-10-29' && D('الاثنين') === '2026-10-26' && D('الأربعاء') === '2026-10-28');
check('arabe : date écrite avec des chiffres arabes (٣١/١٠)', D('٣١/١٠') === '2026-10-31');
const nowLate = Date.UTC(2026, 9, 25, 13, 30); // 14h30 : plus de rendez-vous aujourd'hui
check('à 14h30, « aujourd’hui » n’est plus proposé : null ; « dimanche » = le dimanche suivant (1/11)', dayFromText('aujourd’hui', nowLate) === null && dayFromText('dimanche', nowLate) === '2026-11-01', [dayFromText('aujourd’hui', nowLate), dayFromText('dimanche', nowLate)]);

// --- l'heure écrite par le client ---
const T = (t: string) => timeFromText(t);
check('14h30, 14:30, 14h, à 10h, 9h30, 10, midi', T('14h30') === '14:30' && T('14:30') === '14:30' && T('14h') === '14:00' && T('à 10h') === '10:00' && T('9h30') === '09:30' && T('10') === '10:00' && T('midi') === '12:00' && T('Midi') === '12:00');
check('pas un créneau : 14h20, 16h, 8h, 2h, 25h, rien', T('14h20') === null && T('16h') === null && T('8h') === null && T('2h') === null && T('25h') === null && T('bonjour') === null && T('') === null);
check('arabe : ١٤:٣٠, 10 ساعة, الظهر', T('١٤:٣٠') === '14:30' && T('10 ساعة') === '10:00' && T('الظهر') === '12:00');

// --- délai de 48 h avant le signalement « fausse commande » ---
const created = '2026-10-25T09:00:00.000Z';
const plus48 = (iso: string) => new Date(Date.parse(iso) + 48 * 3600_000).toISOString();
check('commande normale : 48 h après la commande', flagDeadlineIso({ created_at: created, payment_method: 'cash_on_delivery' }) === plus48(created));
check('rendez-vous payé à la livraison : 48 h après le RENDEZ-VOUS', flagDeadlineIso({ created_at: created, payment_method: 'cash_on_delivery', delivery_type: 'scheduled', scheduled_for: '2026-10-31T13:30:00.000Z' }) === plus48('2026-10-31T13:30:00.000Z'));
check('rendez-vous payé en Mobile Money : toujours 48 h après la commande', flagDeadlineIso({ created_at: created, payment_method: 'airtel_money', delivery_type: 'scheduled', scheduled_for: '2026-10-31T13:30:00.000Z' }) === plus48(created));
check('rendez-vous sans date lisible : règle normale', flagDeadlineIso({ created_at: created, payment_method: 'cash_on_delivery', delivery_type: 'scheduled', scheduled_for: null }) === plus48(created));
check('livraison normale avec une date : règle normale', flagDeadlineIso({ created_at: created, payment_method: 'cash_on_delivery', delivery_type: 'standard', scheduled_for: '2026-10-31T13:30:00.000Z' }) === plus48(created));
check('waitsForAppointment : seulement programmée + paiement à la livraison', waitsForAppointment({ payment_method: 'cash_on_delivery', delivery_type: 'scheduled', scheduled_for: '2026-10-31T13:30:00.000Z' }) === true && waitsForAppointment({ payment_method: 'moov_money', delivery_type: 'scheduled', scheduled_for: '2026-10-31T13:30:00.000Z' }) === false && waitsForAppointment({ payment_method: 'cash_on_delivery' }) === false);

console.log(process.exitCode ? '\nDES ECHECS' : `\nTOUT EST BON (${ok} contrôles)`);
