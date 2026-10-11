import { supabase, isSupabaseConfigured } from './supabase';

export function trackAppDownloadClick(source: 'banner' | 'popup') {
  if (!isSupabaseConfigured) return;
  supabase.from('app_download_clicks').insert({ source }).then(({ error }) => {
    if (error) console.error('Erreur suivi clic telechargement:', error.message);
  });
}
