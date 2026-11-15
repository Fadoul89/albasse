// Page de commande › « 💳 Informations de paiement » (en bas de la page) : une carte Moov Money et une carte Airtel Money,
// avec le numéro et « Copier le numéro ». Les numéros viennent d'Admin › Moyens de paiement ; sans réglage, on garde ceux de la boutique (shopRules.PAYMENT).
// Aucun nom de titulaire inventé : on ne l'affiche que si un nom est enregistré.
import { PAYMENT } from '../constants/shopRules';

export type PaymentCardKey = 'moov' | 'airtel';

export interface PaymentCard {
  key: PaymentCardKey;
  name: string;
  number: string; // comme affiché : « 99 22 10 17 »
  copyValue: string; // les chiffres seuls : « 99221017 » (pratique à coller dans le téléphone)
  url: string | null;
}

export interface PaymentCardSettings {
  airtel_number?: string | null;
  moov_number?: string | null;
  airtel_payment_url?: string | null;
  moov_payment_url?: string | null;
}

const clean = (v: string | null | undefined): string => (v ?? '').trim();

/** Chiffres seuls d'un numéro (« 99 22 10 17 » → « 99221017 »). */
export function digitsOnly(number: string): string {
  return number.replace(/\D/g, '');
}

/** Les cartes à montrer, Moov puis Airtel. Un numéro vide dans l'administration revient au numéro de la boutique. */
export function paymentCards(settings: PaymentCardSettings | null | undefined): PaymentCard[] {
  const moov = clean(settings?.moov_number) || PAYMENT.moov;
  const airtel = clean(settings?.airtel_number) || PAYMENT.airtel;
  return [
    { key: 'moov', name: 'Moov Money', number: moov, copyValue: digitsOnly(moov), url: clean(settings?.moov_payment_url) || null },
    { key: 'airtel', name: 'Airtel Money', number: airtel, copyValue: digitsOnly(airtel), url: clean(settings?.airtel_payment_url) || null },
  ];
}

export const PAYMENT_CARDS_TEXT = {
  title: '💳 Informations de paiement',
  intro: "Hors N'Djamena, le paiement se fait à l'avance : envoyez le montant de votre commande à l'un de ces numéros, puis confirmez votre commande. À N'Djamena, vous payez à la livraison.",
  numberLabel: 'Numéro pour payer',
  copy: 'Copier le numéro',
  copied: (number: string) => `${number} est copié.`,
  copyFailed: (number: string) => `Numéro à utiliser : ${number}`,
  link: 'Payer en ligne',
};
