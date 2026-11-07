# Écran d'entrée : « Voici ce qui vous attend » et inscription courte

Demande du patron (6 novembre 2026), après avoir vu que **les visiteurs arrivent mais ne créent pas de compte** : *« Oui »* à l'idée « l'écran d'entrée qui donne envie ».

## Le constat (chiffres réels du 6 novembre à 8 h 15, heure de N'Djamena)
- 62 visiteurs différents, 91 visites, **0 compte créé**. Un seul visiteur « vrai » : le compte administrateur du patron.
- Les 61 autres : 0 seconde, 1 page, pas connectés. 49 venaient de Facebook.
- Avant, l'écran d'entrée montrait **6 champs obligatoires** (nom, Homme/Femme, naissance, situation, téléphone, mot de passe) et 3 facultatifs, le bouton « Créer mon compte » **en bas** (il fallait défiler) et **aucun article**.
- Du 24 au 28 octobre : 6 à 8 comptes par jour pour 500 à 1 300 visiteurs. Du 1er au 6 novembre : 0 à 2 par jour (le trafic a aussi beaucoup baissé après le 1er novembre).

Je ne promets aucun chiffre : après la mise en ligne, on compare **« comptes créés pour 100 visiteurs »** avant et après (requête plus bas).

## Ce que voit le visiteur maintenant
1. **« Voici ce qui vous attend »** : 4 vrais articles de la boutique (photo, nom, prix en FCFA), **qui changent tout seuls** (demandes du patron, 6 novembre : « montre les articles moins chers », puis « les articles changent automatiquement, avec les autres de 20 000 à 40 000 FCFA »).
   - **Deux fourchettes de prix** (bornes comprises) : **10 000 à 15 000 FCFA** et **20 000 à 40 000 FCFA**. Rien entre 15 001 et 19 999 FCFA, rien au-dessus de 40 000, jamais un article hors de ces deux fourchettes, même pour compléter. Pour les changer : `ENTRY_PRICE_BANDS` dans `src/lib/entryScreen.ts`.
   - **Chaque jeu de 4 articles** : 2 articles de 10 000 à 15 000 + 2 de 20 000 à 40 000 (les plus aimés de chaque fourchette, une catégorie chacun si possible) ; si une fourchette n'a pas assez d'articles, l'autre complète. **4 articles différents à 4 prix différents** (jamais deux fois le même prix ni le même nom, tant qu'il y a assez de choix), **rangés du moins cher au plus cher**.
   - **Le changement automatique** : jusqu'à **4 jeux** (16 articles), un **nouveau jeu toutes les 5 secondes** (`ENTRY_ROTATE_MS`, `ENTRY_SET_COUNT`), avec un petit fondu et **4 petits points** sous la bande (le point doré = le jeu montré). Un article n'est que dans un seul jeu. Les photos des jeux suivants sont chargées d'avance. Il n'y a jamais un jeu à moitié vide qui remplace un jeu complet : avec moins de 8 articles possibles, la bande reste sur le 1er jeu. Sur un téléphone réglé sur « moins d'animations », la bande ne bouge pas (1er jeu seulement).
   - Seulement des articles en vente (actif, en stock, avec photo et prix). **Jamais un article « Vitalité & Énergie »** (ni ses sous-catégories) : ils sont réservés aux annonces des clients mariés de 32 ans et plus (`lib/adSensitive`). Si la boutique ne répond pas, ou s'il n'y a aucun article dans les deux fourchettes, la bande n'apparaît pas.
2. **2 avantages, tous vrais** : 💵 paiement à la livraison à N'Djamena · 🎁 Invite 5 amis, gagne un parfum. Aucun pourcentage, aucune urgence inventée. (La pastille « 🎡 Roue de la chance » a été retirée le 6 novembre : la roue est cachée, docs/roue-cachee.md.)
3. **« Créer mon compte »** : nom et prénom, téléphone, mot de passe (les trois écrits « (obligatoire) » dans leur case), **adresse e-mail (facultatif)**, case des conditions (les 6 conditions s'ouvrent avec « Lire les conditions d'inscription »). **Le bouton « Créer mon compte » se voit sans défiler** sur un téléphone de 800 px de haut. **C'est tout** : le compte est créé avec ces seules informations.
   - *Demande du patron (7 novembre 2026) : « Pour la création de compte, demande seulement l'information sur cette page. Les autres, comme le sexe, la date de naissance et le numéro WhatsApp, demande-les comme un sondage à l'intérieur du site. »* L'ancienne « étape 2 » (3 questions obligatoires juste après la création du compte) est **supprimée**. Ces questions sont posées ensuite, dans une petite carte sur l'accueil : **`docs/sondage-client.md`**.

## Ce qui ne change pas
- **Le compte reste obligatoire** (interrupteur Admin › Clients).
- La page « Inscription » (`/inscription`, ouverte depuis Zara ou un lien) montre **le même formulaire court** : les deux endroits où l'on crée un compte demandent exactement les mêmes informations.
- Le parrainage (« Invité(e) par Amina », `invite_claim`) se fait à la création du compte, comme avant.
- La page d'installation de l'application (une seule fois, téléphone sans le raccourci) s'ouvre **tout de suite après la création du compte**.
- **Aucun script SQL** : les colonnes existent déjà ; rien n'est ajouté dans la base.

## Détails qui comptent
- **Les notifications** ne sont pas activées à la création du compte : les conditions disent « J'accepte de recevoir les notifications commerciales uniquement si je donne mon accord ». L'accord est demandé dans le sondage (« Voulez-vous recevoir les nouveautés et les offres ? » : Oui, avec plaisir / Non merci). Tant que le client n'a pas répondu « Oui », Zara Marketing ne lui écrit pas.
- **Plus d'écran qui couvre la page** après la création du compte : le client arrive directement sur la page demandée, avec Zara et les fenêtres habituelles.
- **Le compte créé est compté** dans les statistiques (« comptes créés ») comme avant ; seuls les clients qui répondent au sondage ont Homme/Femme, naissance, situation dans Admin › Clients (les autres : « Non précisé »).

## Mesurer (à lancer dans Supabase › SQL Editor, lecture seule)
```sql
-- comptes créés pour 100 visiteurs, jour par jour (heure de N'Djamena)
with jours as (select generate_series(date_trunc('day', now() at time zone 'Africa/Ndjamena') - interval '13 days', date_trunc('day', now() at time zone 'Africa/Ndjamena'), interval '1 day') as jour)
select to_char(j.jour,'DD/MM') as jour,
  (select count(distinct coalesce(visitor_id, id::text)) from public.visitor_sessions s where (s.started_at at time zone 'Africa/Ndjamena') >= j.jour and (s.started_at at time zone 'Africa/Ndjamena') < j.jour + interval '1 day') as visiteurs,
  (select count(*) from public.profiles p where (p.created_at at time zone 'Africa/Ndjamena') >= j.jour and (p.created_at at time zone 'Africa/Ndjamena') < j.jour + interval '1 day') as comptes
from jours j order by j.jour;
```
Attention : les chiffres de quelques dizaines de visiteurs par jour bougent beaucoup d'un jour à l'autre ; comparer plusieurs jours.

## Où est le code
- Règles pures (articles montrés, avantages, contrôle du formulaire court) : `src/lib/entryScreen.ts` (test : `node --import ./tests/zara/register.mjs tests/email/entry-screen.test.ts`).
- Bande d'articles et avantages : `src/components/EntryPreview.tsx` ; écran d'entrée : `src/components/AccountWall.tsx`.
- Formulaire court (écran d'entrée et page `/inscription`) : `src/components/RegisterForm.tsx`. Les questions suivantes : `src/components/SurveyCard.tsx` et `src/lib/clientSurvey.ts` (`docs/sondage-client.md`).
- Test dans le navigateur : parties `2` (compte obligatoire, inscription courte), `#` (parrainage) et `%` (sondage) de `tests/zara/zara-ui.test.js`.

## Honnêteté
- Les articles et les prix montrés sont ceux de la boutique, au moment où la page s'ouvre (la bande change entre des articles déjà chargés ; elle ne les relit pas toutes les 5 secondes).
- Les avantages sont ceux que le site offre vraiment (paiement à la livraison seulement à N'Djamena).
- Rien ne dit « offre limitée », « derniers articles » ou un pourcentage.
