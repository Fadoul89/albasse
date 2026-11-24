// Option GPS : règles pures (aucun réseau, aucun navigateur ici — testable directement).
// La partie qui parle au navigateur et à la base est dans visitorLocationTracker.ts.
// Docs : docs/option-gps-visiteurs.md

import { type KeyValueStore } from './assistantAttribution';
import { isTrackingAllowed, privacySignals, type PrivacySignals } from './trackingConsent';

const ASKED_KEY = 'albasse_gps_asked_v1';

export function hasAlreadyAsked(store: KeyValueStore | null): boolean {
  try {
    return store?.getItem(ASKED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markAsked(store: KeyValueStore | null): void {
  try {
    store?.setItem(ASKED_KEY, '1');
  } catch {
    // stockage plein ou bloqué : on redemandera à la prochaine visite, sans gravité
  }
}

// Faut-il demander la position maintenant ? Jamais deux fois sur le même appareil, jamais si le visiteur
// (ou son navigateur) a refusé le suivi (même choix que src/lib/trackingConsent.ts). Sans refus, la demande
// part pour tout le monde, dès l'arrivée sur le site, comme demandé.
export function shouldRequestLocation(store: KeyValueStore | null, signals: PrivacySignals = privacySignals()): boolean {
  if (hasAlreadyAsked(store)) return false;
  return isTrackingAllowed(store, signals);
}

export interface ParsedAddress {
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
}

// Lit la réponse de OpenStreetMap Nominatim (reverse geocoding, format=jsonv2&addressdetails=1).
export function parseNominatimAddress(json: unknown): ParsedAddress {
  if (!json || typeof json !== 'object') return { address: null, city: null, region: null, country: null };
  const root = json as { display_name?: unknown; address?: unknown };
  const addr = (root.address && typeof root.address === 'object' ? root.address : {}) as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return {
    address: str(root.display_name),
    city: str(addr.city) ?? str(addr.town) ?? str(addr.village) ?? str(addr.municipality) ?? null,
    region: str(addr.state) ?? str(addr.region) ?? str(addr.county) ?? null,
    country: str(addr.country),
  };
}
