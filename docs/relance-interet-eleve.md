# Relancer les clients « Intérêt élevé »

« Intérêt élevé » = un visiteur a regardé un article **de près** (plusieurs consultations, du temps passé, un geste d'achat…).
Le chiffre du suivi de Zara compte des **paires (visiteur, article)**, pas des personnes : 141 paires = 108 visiteurs, dont 30 seulement ont un compte
(on peut les recontacter) ; les autres sont anonymes.

## Message WhatsApp avec l'article regardé (Admin › Clients)

Pour chaque client qui a regardé de près un article encore en vente, la ligne du client montre « 💙 A regardé de près : <article> · <prix> »,
et le bouton **WhatsApp** ouvre un message déjà écrit (l'administrateur peut le modifier avant d'envoyer ; rien ne part tout seul) :

```
Bonjour Aïcha, ici l'équipe Albasse Shopping 😊

Vous avez regardé « Chaussures homme slip-on sport » sur notre site : 15 000 FCFA. Il est toujours disponible. Il n'en reste que 6.

🚚 Livraison à N'Djamena sans frais, et paiement à la livraison.

Souhaitez-vous le commander ? 👉 https://www.albasseshopping.com/produit/chaussures-homme-slip-on-sport
```

Règles (code : `src/lib/relanceMessage.ts`, données : `src/lib/relanceData.ts`, test : `tests/relance/relance.test.ts`) :

- **Quel article** : parmi les articles « Intérêt élevé » du client (30 derniers jours), celui où il a commencé une commande ou mis au panier ;
  sinon le plus récemment regardé ; sinon celui où il est resté le plus longtemps. Jamais un article qu'il a déjà acheté ou commandé
  (une commande annulée ne compte pas), ni un article en rupture ou retiré de la vente.
- **Le prix** est celui du jour. L'ancien prix (« au lieu de … ») n'apparaît que s'il y a une vraie promotion.
- **« Il n'en reste que N »** seulement si le stock est vraiment bas (10 ou moins). Aucune fausse urgence, aucune remise inventée.
- **La livraison dépend de la ville du client** (sans frais et paiement à la livraison seulement à N'Djamena) :
  N'Djamena (écrit de toutes les façons : « Ndjamena », « N’Djaména »…) → sans frais + paiement à la livraison ;
  autre ville → livraison partout au Tchad, paiement à l'avance (Airtel Money ou Moov Money) ; ville vide → on dit seulement ce qui est vrai pour N'Djamena.
- Aucun article vendable trouvé, ou lecture impossible : le message reste le simple bonjour d'avant.

## Pourquoi la liste complète est lue directement

Le tableau de suivi (`browsing_overview`) ne renvoie que les **300 regards les plus récents** sur près de 3 000 par mois. Le filtre « 💙 Intérêt élevé »
d'Admin › Clients ne reconnaissait donc que **1 compte sur 30**. L'écran lit maintenant les lignes « Intérêt élevé » dans `visitor_product_interest`
(lecture réservée aux administrateurs par la règle de sécurité de la table), plus les commandes de ces clients et les articles : aucun changement de base.

## Ce qui n'est pas fait (volontairement)

- Aucun message n'est envoyé automatiquement : c'est l'administrateur qui touche « WhatsApp » puis « Envoyer ».
- L'écran « Meilleurs clients potentiels » (bouton 💬 sans texte) n'a pas été modifié.
