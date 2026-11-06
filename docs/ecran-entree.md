# Écran d'entrée : « Voici ce qui vous attend » et inscription en 2 étapes

Demande du patron (6 novembre 2026), après avoir vu que **les visiteurs arrivent mais ne créent pas de compte** : *« Oui »* à l'idée « l'écran d'entrée qui donne envie ».

## Le constat (chiffres réels du 6 novembre à 8 h 15, heure de N'Djamena)
- 62 visiteurs différents, 91 visites, **0 compte créé**. Un seul visiteur « vrai » : le compte administrateur du patron.
- Les 61 autres : 0 seconde, 1 page, pas connectés. 49 venaient de Facebook.
- Avant, l'écran d'entrée montrait **6 champs obligatoires** (nom, Homme/Femme, naissance, situation, téléphone, mot de passe) et 3 facultatifs, le bouton « Créer mon compte » **en bas** (il fallait défiler) et **aucun article**.
- Du 24 au 28 octobre : 6 à 8 comptes par jour pour 500 à 1 300 visiteurs. Du 1er au 6 novembre : 0 à 2 par jour (le trafic a aussi beaucoup baissé après le 1er novembre).

Je ne promets aucun chiffre : après la mise en ligne, on compare **« comptes créés pour 100 visiteurs »** avant et après (requête plus bas).

## Ce que voit le visiteur maintenant
1. **« Voici ce qui vous attend »** : 4 vrais articles de la boutique (photo, nom, prix en FCFA), de catégories différentes si possible, les plus aimés d'abord. Seulement des articles en vente (actif, en stock, avec photo et prix). **Jamais un article « Vitalité & Énergie »** (ni ses sous-catégories) : ils sont réservés aux annonces des clients mariés de 32 ans et plus (`lib/adSensitive`). Si la boutique ne répond pas, la bande n'apparaît pas.
2. **2 avantages, tous vrais** : 💵 paiement à la livraison à N'Djamena · 🎁 Invite 5 amis, gagne un parfum. Aucun pourcentage, aucune urgence inventée. (La pastille « 🎡 Roue de la chance » a été retirée le 6 novembre : la roue est cachée, docs/roue-cachee.md.)
3. **Étape 1 sur 2** : nom et prénom, téléphone, mot de passe, case des conditions (les 6 conditions s'ouvrent avec « Lire les conditions d'inscription »). **Le bouton « Créer mon compte » se voit sans défiler** sur un téléphone de 800 px de haut.
4. **Étape 2 sur 2**, juste après la création du compte : les 3 questions **toujours obligatoires** (Homme/Femme, date de naissance, célibataire/marié), puis les informations facultatives (e-mail, WhatsApp, profession, ville, pays, adresse) et la case des notifications (cochée d'office, comme avant), puis « Terminer ».

## Ce qui ne change pas
- **Le compte reste obligatoire** (interrupteur Admin › Clients).
- La page « Inscription » complète (`/inscription`, ouverte depuis Zara ou un lien) garde le formulaire en **une seule étape** avec tous les champs.
- Les anciens clients ne sont jamais bloqués : l'étape 2 ne s'affiche qu'à celui qui vient de créer son compte avec le formulaire court.
- Le parrainage (« Invité(e) par Amina », `invite_claim`) se fait à l'étape 1, comme avant.
- La page d'installation de l'application (une seule fois, téléphone sans le raccourci) s'ouvre **après l'étape 2**.
- **Aucun script SQL** : les colonnes existent déjà ; rien n'est ajouté dans la base.

## Détails qui comptent
- **Les notifications** ne sont pas activées à l'étape 1 : leur case (cochée d'office, avec le même texte qu'avant) est à l'étape 2. Le patron et le client gardent donc le même consentement qu'avant.
- **Fermer le site entre les deux étapes** : le compte existe déjà ; un petit repère est gardé sur le téléphone (3 jours au plus) et **les 3 questions reviennent** à la prochaine ouverture, tant qu'elles ne sont pas répondues. Après 3 jours le repère disparaît : un ancien compte n'est jamais bloqué par un vieux reste.
- **Pendant l'étape 2** : ni Zara ni fenêtre de promotion / roue / installation par-dessus les questions (comme derrière le mur).
- **Une colonne absente de la base** (script SQL de genre ou de naissance pas lancé) : la question correspondante n'est pas posée et rien n'est écrit. Si rien ne manque, l'étape 2 ne s'affiche pas.
- **Erreur réseau à l'étape 2** : rien n'est perdu, un message dit de réessayer ; l'étape reste là.
- Le compte créé à l'étape 1 est compté dans les statistiques (« comptes créés ») comme avant ; seuls les clients qui répondent à l'étape 2 ont Homme/Femme, naissance et situation dans Admin › Clients (les autres : « Non précisé »).

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
- Règles pures (articles montrés, avantages, contrôle de l'étape 1, qui doit répondre à l'étape 2, expiration) : `src/lib/entryScreen.ts` (test : `node --import ./tests/zara/register.mjs tests/email/entry-screen.test.ts`).
- Bande d'articles et avantages : `src/components/EntryPreview.tsx` ; écran d'entrée : `src/components/AccountWall.tsx`.
- Étape 1 : `src/components/RegisterForm.tsx` (propriété `short`) ; étape 2 : `src/components/SignupStepTwo.tsx` ; repère sur le téléphone : `src/store/signupStepStore.ts` ; affichage : `src/navigation/RootNavigator.tsx` (`showStepTwo`).
- Test dans le navigateur : parties `2` (compte obligatoire, étape 1, étape 2, reprise après fermeture) et `#` (parrainage) de `tests/zara/zara-ui.test.js`.

## Honnêteté
- Les articles et les prix montrés sont ceux de la boutique, au moment où la page s'ouvre.
- Les avantages sont ceux que le site offre vraiment (paiement à la livraison seulement à N'Djamena).
- Rien ne dit « offre limitée », « derniers articles » ou un pourcentage.
