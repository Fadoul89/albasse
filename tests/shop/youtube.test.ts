// La chaîne YouTube (src/lib/youtube.ts) : liens et lecteur « Albasse TV ». Fonctions pures, aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/shop/youtube.test.ts
import { YOUTUBE_CHANNEL_URL, YOUTUBE_SUBSCRIBE_URL, YOUTUBE_CHANNEL_ID, ALBASSE_TV_PLAYLIST, ALBASSE_TV_DWELL_MS, uploadsPlaylistId, playlistIdFromUrl, albasseTvEmbedUrl, youtubeCommand } from '../../src/lib/youtube.ts';

let ok = 0;
const check = (label: string, cond: unknown, detail?: unknown) => {
  if (cond) { ok++; console.log('OK   ', label); } else { console.log('ECHEC', label, detail === undefined ? '' : JSON.stringify(detail)); process.exitCode = 1; }
};

check('lien de la chaîne : youtube.com/@albasseshopping, sans le traceur « ?si= »', YOUTUBE_CHANNEL_URL === 'https://www.youtube.com/@albasseshopping' && !YOUTUBE_CHANNEL_URL.includes('si='));
check('« S\'abonner » ouvre la fenêtre d\'abonnement de YouTube', YOUTUBE_SUBSCRIBE_URL === 'https://www.youtube.com/@albasseshopping?sub_confirmation=1');
check('liste des envois : UC… → UU… (la plus récente d\'abord)', uploadsPlaylistId(YOUTUBE_CHANNEL_ID) === 'UUFSsx6lIT9sQa87xg-628Bw' && ALBASSE_TV_PLAYLIST === 'UUFSsx6lIT9sQa87xg-628Bw');
check('identifiant de chaîne faux : rien', uploadsPlaylistId('albasse') === null && uploadsPlaylistId('UC123') === null && uploadsPlaylistId('') === null);
const u = new URL(albasseTvEmbedUrl());
check('lecteur : youtube-nocookie, la liste des envois', u.origin === 'https://www.youtube-nocookie.com' && u.pathname === '/embed/videoseries' && u.searchParams.get('list') === 'UUFSsx6lIT9sQa87xg-628Bw');
check('lecteur : démarre seul, SANS le son, sur place (téléphone), recommence à la fin', ['autoplay', 'mute', 'playsinline', 'loop'].every((k) => u.searchParams.get(k) === '1'), u.search);
check('lecteur : pas de vidéos d\'autres chaînes à la fin', u.searchParams.get('rel') === '0');
check('une liste choisie (PL…) peut remplacer la dernière vidéo', new URL(albasseTvEmbedUrl('PLabcdefghij123')).searchParams.get('list') === 'PLabcdefghij123');
check('identifiant d\'une liste dans un lien YouTube', playlistIdFromUrl('https://youtube.com/playlist?list=PLx1y2z3a4b5c6d7&si=abc') === 'PLx1y2z3a4b5c6d7' && playlistIdFromUrl('https://www.youtube.com/watch?v=abc&list=PLqwertyuiop12') === 'PLqwertyuiop12');
check('lien sans liste : rien', playlistIdFromUrl('https://youtube.com/@albasseshopping?si=kYzLOZy2LxbEN6HJ') === null);

check('le site peut mettre la vidéo en pause (enablejsapi), et se présente au lecteur (origin)', u.searchParams.get('enablejsapi') === '1' && new URL(albasseTvEmbedUrl(undefined, 'https://www.albasseshopping.com')).searchParams.get('origin') === 'https://www.albasseshopping.com');
check('origine bizarre : ignorée', !new URL(albasseTvEmbedUrl(undefined, 'javascript:alert(1)')).searchParams.has('origin') && !new URL(albasseTvEmbedUrl(undefined, 'https://a.com/x')).searchParams.has('origin'));
check('ordres au lecteur : lecture / pause (format de YouTube)', youtubeCommand('pauseVideo') === '{"event":"command","func":"pauseVideo","args":[]}' && JSON.parse(youtubeCommand('playVideo')).func === 'playVideo');
check('le lecteur attend 1,5 s d\'affichage avant de se charger', ALBASSE_TV_DWELL_MS === 1500);

console.log(process.exitCode ? '\nIL Y A DES ECHECS' : `\nTOUS LES CONTROLES REUSSIS (${ok})`);
