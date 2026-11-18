// Photo → article : la photo choisie par le client est réduite sur le téléphone (JPEG) avant l'envoi à Zara IA.
// null : la photo ne s'ouvre pas (format inconnu...) ou reste trop lourde.
import * as ImageManipulator from 'expo-image-manipulator';
import { fitSide, PHOTO_MAX_BASE64, PHOTO_SIDE, THUMB_SIDE } from './zaraPhotoCore';

export interface PreparedPhoto {
  data: string; // pour Zara IA : base64 JPEG, 1024 px au plus
  thumb: string; // pour la bulle du chat : petite image (data:image/jpeg;base64,...)
  ratio: number; // largeur / hauteur
}

async function jpeg(uri: string, resize: { width: number } | { height: number } | null, compress: number) {
  const context = ImageManipulator.ImageManipulator.manipulate(uri);
  if (resize) context.resize(resize);
  const image = await context.renderAsync();
  return image.saveAsync({ base64: true, compress, format: ImageManipulator.SaveFormat.JPEG });
}

export async function preparePhoto(uri: string): Promise<PreparedPhoto | null> {
  try {
    const original = await ImageManipulator.ImageManipulator.manipulate(uri).renderAsync();
    const { width, height } = original;
    const big = await jpeg(uri, fitSide(width, height, PHOTO_SIDE), 0.72);
    const small = await jpeg(uri, fitSide(width, height, THUMB_SIDE), 0.6);
    if (!big.base64 || !small.base64 || big.base64.length > PHOTO_MAX_BASE64) return null;
    const ratio = big.width > 0 && big.height > 0 ? big.width / big.height : 1;
    return { data: big.base64, thumb: `data:image/jpeg;base64,${small.base64}`, ratio };
  } catch {
    return null;
  }
}
