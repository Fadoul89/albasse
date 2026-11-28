// L'avatar de Zara, sur Cloudinary (affiché en petit partout : bulle de chat, bannière, carte publicitaire — jamais plus de
// 62 px sur l'écran). Téléversé une fois ; voir scripts/migrate-images-to-cloudinary.mjs pour le réimporter si besoin.
import { cloudinaryUrl } from './cloudinaryUrl';

const ORIGINAL_URL = 'https://res.cloudinary.com/c3sblcwg/image/upload/v1795757163/zara-avatar.jpg';

export const ZARA_AVATAR_URL = cloudinaryUrl(ORIGINAL_URL, 120);
