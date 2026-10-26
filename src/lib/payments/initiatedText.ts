// Phrase affichée sur la page de confirmation quand le paiement est lancé : « Paiement Airtel Money initié. … ».
// Le libellé du paiement à la livraison commence déjà par « Paiement » : on ne le répète pas (« Paiement à la livraison initié. … »).
export function paymentInitiatedText(methodLabel: string, message: string): string {
  const lead = /^paiement\b/i.test(methodLabel.trim()) ? methodLabel.trim() : `Paiement ${methodLabel}`;
  return `${lead} initié. ${message}`;
}
