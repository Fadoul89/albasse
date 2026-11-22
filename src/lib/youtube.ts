// La chaîne YouTube de la boutique (demande du patron, 22 novembre 2026) : liens et lecteur intégré.
// Lien donné par le patron : youtube.com/@albasseshopping (la partie « ?si=… » est un traceur de partage YouTube : retirée).
// Fonctions pures (tests/shop/youtube.test.ts).

export const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/@albasseshopping';
// ouvre la chaîne avec la fenêtre « S'abonner » de YouTube
export const YOUTUBE_SUBSCRIBE_URL = `${YOUTUBE_CHANNEL_URL}?sub_confirmation=1`;
// identifiant de la chaîne (page YouTube de la chaîne, « externalId »)
export const YOUTUBE_CHANNEL_ID = 'UCFSsx6lIT9sQa87xg-628Bw';

// la liste « toutes les vidéos envoyées » d'une chaîne : UC… → UU… ; la plus récente d'abord
export function uploadsPlaylistId(channelId: string): string | null {
  return /^UC[A-Za-z0-9_-]{22}$/.test(channelId) ? `UU${channelId.slice(2)}` : null;
}

// la liste jouée dans « Albasse TV » : aujourd'hui toujours la dernière vidéo de la chaîne.
// Pour jouer une liste choisie (ex. « Boutique »), remplacer par son identifiant (PL…), lu dans le lien de la liste (…?list=PL…).
export const ALBASSE_TV_PLAYLIST = uploadsPlaylistId(YOUTUBE_CHANNEL_ID) as string;

// l'identifiant d'une liste dans un lien YouTube (…?list=…), pour le jour où le patron envoie sa liste
export function playlistIdFromUrl(url: string): string | null {
  const m = /[?&]list=([A-Za-z0-9_-]{10,64})/.exec(url);
  return m ? m[1] : null;
}

// le lecteur : démarre seul SANS le son (seule lecture automatique permise par les navigateurs), sur place dans la page
// (playsinline), recommence à la fin ; youtube-nocookie : YouTube ne pose ses témoins qu'au moment où le visiteur touche la vidéo
// enablejsapi + origin : le site peut mettre la vidéo en pause quand l'espace sort de l'écran (youtubeCommand ci-dessous)
export const YOUTUBE_EMBED_ORIGIN = 'https://www.youtube-nocookie.com';
export function albasseTvEmbedUrl(playlistId: string = ALBASSE_TV_PLAYLIST, siteOrigin?: string): string {
  const params = new URLSearchParams({ list: playlistId, autoplay: '1', mute: '1', playsinline: '1', loop: '1', rel: '0', modestbranding: '1', enablejsapi: '1' });
  if (siteOrigin && /^https?:\/\/[^/]+$/.test(siteOrigin)) params.set('origin', siteOrigin);
  return `${YOUTUBE_EMBED_ORIGIN}/embed/videoseries?${params.toString()}`;
}

// l'ordre envoyé au lecteur YouTube (postMessage) : lecture ou pause
export const youtubeCommand = (func: 'playVideo' | 'pauseVideo'): string => JSON.stringify({ event: 'command', func, args: [] });

// combien de temps l'espace doit rester à l'écran avant de charger le lecteur : au chargement de l'accueil, avant l'arrivée
// des articles, l'espace passe un instant en haut de la page ; on ne charge pas la vidéo pour ce passage éclair
export const ALBASSE_TV_DWELL_MS = 1500;
