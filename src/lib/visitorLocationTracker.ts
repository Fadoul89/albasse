// Option GPS : demande la position du visiteur (une seule fois par appareil, à tous, dès l'arrivée sur le
// site), la convertit en adresse lisible (OpenStreetMap Nominatim, gratuit) et la garde en base pour
// l'administrateur. Règles de décision pures : src/lib/visitorLocation.ts. Docs : docs/option-gps-visiteurs.md
//
// Seulement sur le site (web) ; ailleurs, ce module ne fait rien. Si la base n'a pas encore le script
// add-visitor-gps.sql, l'enregistrement échoue en silence : aucune redemande, aucun blocage de la navigation.

import { Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from './supabase';
import { deviceStore } from './assistantAttribution';
import { getVisitorId } from './browsingTracker';
import { shouldRequestLocation, markAsked, parseNominatimAddress, type ParsedAddress } from './visitorLocation';

const isWeb = () => Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined';

interface Coords {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

async function reverseGeocode(coords: Coords): Promise<ParsedAddress> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=14&lat=${coords.latitude}&lon=${coords.longitude}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return { address: null, city: null, region: null, country: null };
    return parseNominatimAddress(await res.json());
  } catch {
    return { address: null, city: null, region: null, country: null };
  }
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

async function saveLocation(coords: Coords): Promise<void> {
  if (!isSupabaseConfigured) return;
  const [parsed, userId] = await Promise.all([reverseGeocode(coords), currentUserId()]);
  try {
    await supabase.from('visitor_locations').insert({
      visitor_id: getVisitorId(),
      user_id: userId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy_meters: coords.accuracy,
      address: parsed.address,
      city: parsed.city,
      region: parsed.region,
      country: parsed.country,
    });
  } catch {
    // script pas encore lancé, ou réseau coupé : on abandonne cette visite, sans redemander (déjà marqué)
  }
}

let installed = false;

// Démarrage (une seule fois, sur le site) : à appeler au même endroit que initBrowsingTracker().
export function initVisitorLocation(): void {
  if (!isWeb() || installed) return;
  installed = true;
  const store = deviceStore();
  if (!shouldRequestLocation(store)) return;
  if (typeof navigator === 'undefined' || !navigator.geolocation) return;
  markAsked(store); // marqué avant la réponse : une actualisation pendant la demande ne redemande pas
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      void saveLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null });
    },
    () => {
      // refusée, indisponible, ou délai dépassé : rien à faire, déjà marqué comme demandée
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
  );
}
