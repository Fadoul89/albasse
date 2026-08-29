import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';
import { trackTikTokEvent } from './tiktokPixel';

const HEARTBEAT_SECONDS = 20;
const VISITOR_ID_KEY = 'albasse_visitor_id';
const REFERRAL_CODE_KEY = 'albasse_referral_code';
const REFERRAL_CODE_DAYS = 30;

export const TRAFFIC_SOURCES = [
  'TikTok',
  'Facebook',
  'Instagram',
  'Google',
  'WhatsApp',
  'Accès direct',
  'Publicité / campagne',
  'Autre',
] as const;

export type TrafficSource = (typeof TRAFFIC_SOURCES)[number];

let sessionId: string | null = null;
let elapsedSeconds = 0;
let pageViews = 1;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let currentUserId: string | null = null;
let currentReferrerSource: TrafficSource | null = null;
let currentVisitorId: string | null = null;
let initPromise: Promise<void> | null = null;

// Renvoie l'id de session, en la creant si besoin (independant du minutage
// de l'effet App.tsx) : evite qu'une commande passee tres vite se retrouve
// sans session_id, et donc sans attribution affilie/source.
export async function getCurrentSessionId(userId: string | null = null): Promise<string | null> {
  if (!sessionId) await initAnalyticsSession(userId);
  return sessionId;
}

export function getCurrentReferrerSource(): string | null {
  return currentReferrerSource;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function getOrCreateVisitorId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;
    const created = generateUUID();
    await AsyncStorage.setItem(VISITOR_ID_KEY, created);
    return created;
  } catch {
    return generateUUID();
  }
}

// Capture le code de parrainage (?ref=CODE) present dans l'URL et le memorise
// 30 jours (meme au-dela de la session en cours), pour attribuer une vente
// meme si le client revient plus tard sans le lien.
async function getOrCaptureReferralCode(): Promise<string | null> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;

  try {
    const params = new URLSearchParams(window.location.search);
    const refFromUrl = params.get('ref');
    if (refFromUrl) {
      const expiresAt = Date.now() + REFERRAL_CODE_DAYS * 24 * 60 * 60 * 1000;
      await AsyncStorage.setItem(REFERRAL_CODE_KEY, JSON.stringify({ code: refFromUrl, expiresAt }));
      return refFromUrl;
    }

    const stored = await AsyncStorage.getItem(REFERRAL_CODE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { code: string; expiresAt: number };
    if (Date.now() > parsed.expiresAt) {
      await AsyncStorage.removeItem(REFERRAL_CODE_KEY);
      return null;
    }
    return parsed.code;
  } catch {
    return null;
  }
}

function matchPlatform(text: string): TrafficSource | null {
  if (/tiktok|musically|ugc\.trill/i.test(text)) return 'TikTok';
  if (/facebook|fb\.com|instagram\.com\/.*fbclid/i.test(text)) return 'Facebook';
  if (/instagram/i.test(text)) return 'Instagram';
  if (/google/i.test(text)) return 'Google';
  if (/whatsapp|wa\.me/i.test(text)) return 'WhatsApp';
  return null;
}

interface DetectedAttribution {
  source: TrafficSource;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}

function detectAttribution(): DetectedAttribution {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return { source: 'Autre', utmSource: null, utmMedium: null, utmCampaign: null };
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get('utm_source');
    const utmMedium = params.get('utm_medium');
    const utmCampaign = params.get('utm_campaign');

    // Trafic explicitement identifie comme publicite/campagne payante
    if (utmMedium && /paid|cpc|ads?|sponsor/i.test(utmMedium)) {
      return { source: 'Publicité / campagne', utmSource, utmMedium, utmCampaign };
    }

    if (utmSource) {
      const platform = matchPlatform(utmSource);
      return { source: platform ?? 'Autre', utmSource, utmMedium, utmCampaign };
    }

    const ref = document.referrer;
    if (!ref) return { source: 'Accès direct', utmSource: null, utmMedium: null, utmCampaign: null };

    const platform = matchPlatform(ref);
    if (platform) return { source: platform, utmSource: null, utmMedium: null, utmCampaign: null };

    return { source: 'Autre', utmSource: null, utmMedium: null, utmCampaign: null };
  } catch {
    return { source: 'Accès direct', utmSource: null, utmMedium: null, utmCampaign: null };
  }
}

export function initAnalyticsSession(userId: string | null): Promise<void> {
  if (!isSupabaseConfigured || sessionId) return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = (async () => {
    currentUserId = userId;
    currentVisitorId = await getOrCreateVisitorId();

    const attribution = detectAttribution();
    currentReferrerSource = attribution.source;
    const referralCode = await getOrCaptureReferralCode();

    const { data, error } = await supabase
      .from('visitor_sessions')
      .insert({
        user_id: userId,
        visitor_id: currentVisitorId,
        referrer_source: attribution.source,
        utm_medium: attribution.utmMedium,
        utm_campaign: attribution.utmCampaign,
        referral_code: referralCode,
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error('Erreur creation session visiteur:', error);
      return;
    }
    sessionId = data.id;
    elapsedSeconds = 0;
    pageViews = 1;

    heartbeatTimer = setInterval(async () => {
      if (!sessionId) return;
      elapsedSeconds += HEARTBEAT_SECONDS;
      await supabase
        .from('visitor_sessions')
        .update({ duration_seconds: elapsedSeconds, last_seen_at: new Date().toISOString() })
        .eq('id', sessionId);
    }, HEARTBEAT_SECONDS * 1000);
  })();

  return initPromise;
}

export async function attachUserToSession(userId: string) {
  currentUserId = userId;
  if (!isSupabaseConfigured || !sessionId) return;
  await supabase.from('visitor_sessions').update({ user_id: userId }).eq('id', sessionId);
}

export async function trackPageView() {
  if (!isSupabaseConfigured || !sessionId) return;
  pageViews += 1;
  await supabase.from('visitor_sessions').update({ page_views: pageViews }).eq('id', sessionId);
}

export async function trackProductView(productId: string) {
  trackTikTokEvent('ViewContent', { content_id: productId, content_type: 'product' });
  if (!isSupabaseConfigured) return;
  await supabase.from('product_views').insert({
    session_id: sessionId,
    user_id: currentUserId,
    product_id: productId,
  });
}

export async function trackAddToCart(productId: string) {
  trackTikTokEvent('AddToCart', { content_id: productId, content_type: 'product' });
  if (!isSupabaseConfigured) return;
  await supabase.from('cart_events').insert({
    session_id: sessionId,
    user_id: currentUserId,
    product_id: productId,
  });
}

export function stopAnalyticsSession() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}
