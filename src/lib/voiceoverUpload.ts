import { Platform } from 'react-native';
import { supabase } from './supabase';

// Selection de fichier audio + televersement : web uniquement (input HTML
// natif, pas besoin de librairie supplementaire).
export function pickAndUploadVoiceover(): Promise<{ url: string | null; error: string | null }> {
  return new Promise((resolve) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      resolve({ url: null, error: 'Disponible uniquement sur le site web.' });
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve({ url: null, error: null });
        return;
      }
      const ext = file.name.split('.').pop() ?? 'mp3';
      const path = `voiceover-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('voiceover')
        .upload(path, file, { contentType: file.type || 'audio/mpeg', cacheControl: '31536000' });

      if (uploadError) {
        resolve({ url: null, error: uploadError.message });
        return;
      }

      const { data } = supabase.storage.from('voiceover').getPublicUrl(path);
      resolve({ url: data.publicUrl, error: null });
    };
    input.click();
  });
}
