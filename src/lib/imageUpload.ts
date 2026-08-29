import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './supabase';

const MAX_DIMENSION = 1200;
const COMPRESS_QUALITY = 0.7;
const ONE_YEAR_SECONDS = '31536000';

async function resizeForUpload(uri: string): Promise<string> {
  try {
    const context = ImageManipulator.ImageManipulator.manipulate(uri);
    context.resize({ width: MAX_DIMENSION });
    const image = await context.renderAsync();
    const result = await image.saveAsync({
      compress: COMPRESS_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return result.uri;
  } catch {
    // Si le redimensionnement echoue (format non supporte, etc.), on envoie l'original.
    return uri;
  }
}

export async function uploadProductImage(uri: string): Promise<{ url: string | null; error: string | null }> {
  try {
    const resizedUri = await resizeForUpload(uri);
    const response = await fetch(resizedUri);
    const blob = await response.blob();
    const ext = blob.type.split('/')[1] ?? 'jpg';
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(path, blob, { contentType: blob.type || 'image/jpeg', cacheControl: ONE_YEAR_SECONDS });

    if (uploadError) return { url: null, error: uploadError.message };

    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : 'Échec du téléversement.' };
  }
}

export async function uploadAvatar(
  uri: string,
  userId: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    const resizedUri = await resizeForUpload(uri);
    const response = await fetch(resizedUri);
    const blob = await response.blob();
    const ext = blob.type.split('/')[1] ?? 'jpg';
    // Range dans un dossier nomme d'apres l'utilisateur : les policies de
    // stockage n'autorisent l'ecriture que dans son propre dossier.
    const path = `${userId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, blob, { contentType: blob.type || 'image/jpeg', cacheControl: ONE_YEAR_SECONDS });

    if (uploadError) return { url: null, error: uploadError.message };

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : 'Échec du téléversement.' };
  }
}
