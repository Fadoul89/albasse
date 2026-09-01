import { Platform } from 'react-native';
import { supabase } from './supabase';

const LAST_PLAYED_KEY = 'albasse_voiceover_last_played';
const DAY_MS = 24 * 60 * 60 * 1000;

let initialized = false;

// Joue le message vocal de la boutique (parametres > voix off) une fois
// toutes les 24h par visiteur. La plupart des navigateurs bloquent le son
// automatique sans interaction : on attend donc le premier clic/toucher de
// la page, ce qui reste "automatique" du point de vue du client.
export function initVoiceoverAutoplay() {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined' || initialized) return;
  initialized = true;

  const lastPlayed = Number(window.localStorage.getItem(LAST_PLAYED_KEY) ?? 0);
  if (Date.now() - lastPlayed < DAY_MS) return;

  const playOnFirstInteraction = async () => {
    document.removeEventListener('click', playOnFirstInteraction);
    document.removeEventListener('touchstart', playOnFirstInteraction);

    const { data } = await supabase.from('store_settings').select('voiceover_url').eq('id', 1).single();
    const url = (data as { voiceover_url: string | null } | null)?.voiceover_url;
    if (!url) return;

    try {
      const audio = new Audio(url);
      await audio.play();
      window.localStorage.setItem(LAST_PLAYED_KEY, String(Date.now()));
    } catch {
      // lecture bloquee par le navigateur, on reessaiera a la prochaine visite
    }
  };

  document.addEventListener('click', playOnFirstInteraction);
  document.addEventListener('touchstart', playOnFirstInteraction);
}
