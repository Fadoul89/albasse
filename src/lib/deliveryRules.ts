// Regle de paiement : a la livraison seulement pour les clients de N'Djamena.
const compact = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

export function isHomeCity(name: string | null | undefined): boolean {
  const c = compact(name ?? '');
  return c === 'ndjamena' || c === 'djamena' || c === 'ndjam';
}

export const cashOnDeliveryAllowed = isHomeCity;
