// Téléversement d'une image vers Cloudinary (preset non signé : aucune clé secrète ici, cloud name et preset sont publics
// par conception — voir .env.example). Remplace l'ancien téléversement vers Supabase Storage (lib/imageUpload.ts) : même
// forme de retour ({ url, error }), pour ne rien changer aux écrans qui l'appellent.
import * as ImageManipulator from 'expo-image-manipulator';

const MAX_DIMENSION = 1200;
const COMPRESS_QUALITY = 0.7;

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '';

async function resizeForUpload(uri: string): Promise<string> {
  try {
    const context = ImageManipulator.ImageManipulator.manipulate(uri);
    context.resize({ width: MAX_DIMENSION });
    const image = await context.renderAsync();
    const result = await image.saveAsync({ compress: COMPRESS_QUALITY, format: ImageManipulator.SaveFormat.JPEG });
    return result.uri;
  } catch {
    // Si le redimensionnement échoue (format non supporté, etc.), on envoie l'original.
    return uri;
  }
}

export async function uploadToCloudinary(uri: string): Promise<{ url: string | null; error: string | null }> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    return { url: null, error: 'Cloudinary : EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME / EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET manquantes.' };
  }
  try {
    const resizedUri = await resizeForUpload(uri);
    // même façon de récupérer les octets qu'avant (lib/imageUpload.ts) : marche aussi bien sur le site (URI blob:/data:)
    // que dans l'app (URI file://) — contrairement à la forme { uri, name, type } de FormData, propre à React Native seul.
    const blob = await (await fetch(resizedUri)).blob();
    const form = new FormData();
    form.append('upload_preset', UPLOAD_PRESET);
    form.append('file', blob, `photo.${blob.type.split('/')[1] ?? 'jpg'}`);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) return { url: null, error: data?.error?.message ?? `Échec du téléversement (${res.status}).` };
    return { url: typeof data.secure_url === 'string' ? data.secure_url : null, error: null };
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : 'Échec du téléversement.' };
  }
}
