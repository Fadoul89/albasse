# Rapport de Zara en affiche photo (Telegram)

Chaque lundi à 8 h (heure de N'Djamena), Zara envoie sur le Telegram des administrateurs le rapport de la semaine passée (lundi à dimanche) sous forme de **2 photos** (album) :

1. **Page 1** : les 3 articles les plus regardés (photo, nombre de vues), les mots les plus cherchés.
2. **Page 2** : le top 3 de chaque jour.

Deux pages de 1080 px, parce que Telegram réduit les photos à 1280 px au plus : une seule page très haute serait floue.

## Comment ça marche
- Le planificateur de la base (cron `zara-weekly-report`, lundi 07:00 UTC) appelle `public.zara_send_weekly_report()`.
- Elle appelle la fonction serveur **`zara-report-poster`** (dossier `supabase/functions/zara-report-poster`) avec le secret partagé du coffre-fort (`email_cron_secret`, en-tête `x-cron-secret`) : personne d'autre ne peut la déclencher.
- La fonction lit les chiffres (`zara_weekly_report_data`) et le bot Telegram (`zara_report_credentials`, relu dans le coffre-fort), dessine les images (satori + resvg) et les envoie (`sendMediaGroup`).
- **Repli** : si le dessin échoue, la fonction envoie le texte du rapport, comme avant.
- Rien n'est inventé : pas de visite = « Aucune visite ». Les noms d'articles sont nettoyés (pas d'emoji ni d'arabe dans l'affiche, les polices ne les ont pas).

## Couleurs
Les 3 couleurs du patron, comme les e-mails (voir `docs/couleurs-emails.md`) : **violet aubergine** `#4B0082` (fond et cartes), **doré** `#D4AF37` (rangs, nombres, pastilles, filets), **argenté** `#C0C0C0` (textes). Le doré n'est jamais un texte sur fond clair : il sert de texte seulement sur le violet, ou de fond de pastille avec un texte violet. Tout est dans `supabase/functions/zara-report-poster/poster.ts` (constantes en haut du fichier).

## Installation
`add-zara-weekly-poster.sql` (après avoir déployé la fonction). Pour revenir au texte seul : relancer `add-zara-weekly-report.sql`.

## Essai à la main
Appeler la fonction avec le secret (depuis la base) : `{"action":"weekly","dry":true}` dessine sans envoyer ; sans `dry`, elle envoie.
