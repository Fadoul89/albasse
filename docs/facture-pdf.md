# Facture PDF (Telegram du patron + téléchargement du client)

## Ce que ça fait
1. **À chaque nouvelle commande**, la base appelle la fonction serveur `order-invoice`. Elle dessine la facture en **PDF** et l'envoie en **document** sur le Telegram des administrateurs (en plus de l'alerte texte « 🛒 Nouvelle commande », qui ne change pas).
2. **Le client** a un bouton **« 📄 Télécharger ma facture »** :
   - sur la page de confirmation après la commande,
   - dans le chat de Zara juste après « votre commande a bien été enregistrée » (en français et en arabe),
   - sur la page « Facture » (en plus de « Imprimer »).
3. Si le PDF ne peut pas être téléchargé (application sans navigateur, réseau coupé, fonction pas encore en ligne), **la facture s'ouvre à l'écran** (page « Facture » qui existait déjà) : jamais d'impasse.

La facture PDF a **les mêmes chiffres** que la page « Facture » : numéro `FA-2026-000012`, lignes, remise fidélité, emballage cadeau, livraison (« Gratuite » ou « À définir » quand il n'y a pas de frais), total, paiement, statut, mention légale. Un test compare les deux calculs.

## Qui peut télécharger quoi
- Le **client** : seulement **ses** commandes (le compte qui a passé la commande).
- L'**administrateur** : toutes les commandes.
- Sans compte : refusé. Une commande qui n'est pas la sienne répond « introuvable » (on ne dit pas qu'elle existe).
- L'envoi sur Telegram n'est possible que **depuis la base** (secret partagé gardé dans le coffre-fort Supabase, le même que pour les e-mails et le rapport de Zara). Le code du bot Telegram est relu dans le coffre-fort : rien n'est écrit en clair dans le code.

## Fichiers
- `supabase/functions/order-invoice/` : `index.ts` (service), `invoice.ts` (calculs et dessin, testable), le logo est le même fichier que sur le site (`public/icon-192.png`), lu une fois sur albasseshopping.com ; s'il est introuvable, la facture est dessinée sans logo.
- `add-order-invoice-telegram.sql` : déclencheur après chaque commande (sans danger à relancer ; **une commande n'échoue jamais** à cause de la facture).
- `src/lib/invoiceDownload.ts` et `src/components/InvoiceDownloadButton.tsx` : le bouton du site.
- `tests/email/invoice-pdf.test.ts` (chiffres, texte, dessin), parties O et C de `tests/zara/zara-ui.test.js` (boutons).

## Mise en route (dans cet ordre, après accord)
1. Déployer la fonction `order-invoice` (sans vérification de jeton : elle vérifie elle-même le secret ou la connexion).
2. Lancer `add-order-invoice-telegram.sql` dans Supabase › SQL Editor.
3. Publier le site (boutons).

Pour arrêter l'envoi sur Telegram : `drop trigger if exists on_order_created_invoice_telegram on public.orders;` (le téléchargement par le client continue).

## Limites connues
- Les polices standard d'un PDF ne connaissent que l'alphabet latin : un **nom en arabe** ou un emoji n'est pas écrit sur le PDF (le nom devient « Client »). La page « Facture » à l'écran, elle, l'affiche en entier. Le message Telegram qui accompagne le PDF garde le nom tel quel.
- Plus de ~7 articles : le total passe sur une 2ᵉ page (rare : une commande = un article).
- Sur iPhone installé comme application, le PDF peut s'ouvrir dans la visionneuse du téléphone (bouton « Partager » pour l'enregistrer).

## Couleurs et modèle
Modèle « sobre » (choisi par le patron, avec ses couleurs) : fond blanc, un filet en haut de chaque page (début marron, puis lavande), titres et nom de la boutique en **marron** `#6B4F3B`, en-tête du tableau marron souligné, lignes en **argenté** `#C0C0C0`, « TOTAL À PAYER » en marron entre deux filets en **violet lavande** `#D8B4FE`, pied de page avec un filet lavande. La lavande est claire : elle ne sert **jamais** de texte sur fond blanc, seulement de filet. Le rouge de « COMMANDE ANNULÉE » reste rouge : c'est un statut. Les couleurs sont au début de `buildInvoicePdf` dans `supabase/functions/order-invoice/invoice.ts` (`BROWN`, `LAVENDER`, `LINE`). La facture à l'écran (`src/`) n'est pas changée.
