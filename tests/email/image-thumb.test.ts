// Photos réduites (src/lib/imageThumb.ts) : éteint = adresses inchangées ; allumé = version réduite des seules photos publiques de la base.
import { thumbUrl, THUMBS_ENABLED } from '../../src/lib/imageThumb.ts';
import { readFileSync } from 'node:fs';

let ok = 0;
let ko = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) ok++;
  else {
    ko++;
    console.log('ÉCHEC :', name, detail === undefined ? '' : JSON.stringify(detail));
  }
}

const base = 'https://xtitsmmccpkelxfjyqyh.supabase.co/storage/v1/object/public/product-images/1786163207002-4ybcklij4pl.jpeg';

check('par défaut : éteint (rien ne change tant que le patron n\'a pas dit oui)', THUMBS_ENABLED === false);
check('éteint : l\'adresse reste EXACTEMENT la même', thumbUrl(base, 480, false) === base && thumbUrl(base, 480) === base);
check('allumé : version réduite (render/image, largeur, qualité)', thumbUrl(base, 480, true) === 'https://xtitsmmccpkelxfjyqyh.supabase.co/storage/v1/render/image/public/product-images/1786163207002-4ybcklij4pl.jpeg?width=480&quality=70', thumbUrl(base, 480, true));
check('allumé : qualité réglable', /quality=80$/.test(thumbUrl(base, 300, true, 80)));
check('allumé : largeur bornée (16 à 2000)', /width=16&/.test(thumbUrl(base, 1, true)) && /width=2000&/.test(thumbUrl(base, 99999, true)));
check('allumé : vide, null, undefined -> inchangés', thumbUrl('', 480, true) === '' && thumbUrl(null, 480, true) === null && thumbUrl(undefined, 480, true) === undefined);
check('allumé : photo d\'un autre site -> inchangée', thumbUrl('https://exemple.com/photo.jpg', 480, true) === 'https://exemple.com/photo.jpg');
check('allumé : photo locale (logo, avatar) -> inchangée', thumbUrl('/assets/assets/logo.2942.jpg', 480, true) === '/assets/assets/logo.2942.jpg');
check('allumé : déjà réduite ou déjà paramétrée -> pas réduite deux fois', thumbUrl(thumbUrl(base, 480, true) as string, 480, true) === thumbUrl(base, 480, true) && thumbUrl(base + '?v=2', 480, true) === base + '?v=2');
check('allumé : photo non publique (autre chemin) -> inchangée', thumbUrl('https://xtitsmmccpkelxfjyqyh.supabase.co/storage/v1/object/sign/x/y.jpg', 480, true) === 'https://xtitsmmccpkelxfjyqyh.supabase.co/storage/v1/object/sign/x/y.jpg');

// l'interrupteur n'est PAS allumé dans netlify.toml sans décision du patron
const toml = readFileSync(new URL('../../netlify.toml', import.meta.url), 'utf8');
check('netlify.toml : EXPO_PUBLIC_IMAGE_THUMBS pas allumé (il faut l\'accord du patron)', !/^\s*EXPO_PUBLIC_IMAGE_THUMBS\s*=\s*"on"/m.test(toml));

console.log(`${ok} contrôles réussis, ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
