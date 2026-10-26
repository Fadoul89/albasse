# Saison fraîche : blousons et manteaux (jusqu'au 31 décembre 2026)

Pendant la période, la boutique met en avant les **vrais** blousons et manteaux en vente. Rien n'est inventé : ni remise, ni urgence, ni date limite d'offre (la période est celle de la mise en avant, pas celle des prix).

## Ce qui change pour le client

- **Accueil du site** : une bande « 🧥 SAISON FRAÎCHE — Blousons et manteaux » avec les articles (la plus grande remise réelle d'abord), sous la vente flash et au-dessus de « Voyage — Billet d'avion ».
- **Zara, à l'ouverture** : une ligne « La saison fraîche arrive : nos blousons et manteaux sont là ! » (une seule fois, et seulement si Zara ne parle pas déjà d'un moment fort comme le Black Friday).
- **Zara, menu** : un bouton « 🧥 Blousons & manteaux » (« 🧥 جاكيتات ومعاطف » en arabe).
- **Zara, quand le client écrit** « manteau », « blouson », « veste », « doudoune », « il fait froid », « harmattan »… : elle montre les vrais modèles avec le bouton « Commander ». Avec un budget écrit (« manteau 30000 »), la recherche normale s'en charge.
- Les chiffres dits par Zara (nombre de modèles, « à partir de … FCFA », « jusqu'à -29 % sur l'ancien prix ») sont calculés sur les articles montrés. Un pourcentage n'est annoncé que s'il vient d'un vrai « ancien prix » barré d'au moins 5 %.

## Ce qui est montré

Les articles **actifs, en stock, avec photo**, dont le nom contient blouson, manteau, veste, doudoune, parka, perfecto, coupe-vent, pardessus ou trench (ou l'équivalent arabe). Les **porte-manteaux** (meubles) et les cintres sont écartés.

## Fin de la période

Le 1ᵉʳ janvier 2027 à 00h00 (heure de N'Djamena), tout disparaît tout seul : la bande, la ligne d'ouverture et le bouton. Pour changer les dates : `src/lib/coldSeason.ts` (`COLD_SEASON_START`, `COLD_SEASON_END`).

## Tests

- `node --import ./tests/zara/register.mjs tests/email/cold-season.test.ts` (26 contrôles : période, noms, porte-manteaux, ordre, chiffres).
- Navigateur : `PARTS=X node tests/zara/zara-ui.test.js dist 4333` (partie X8 : accueil, Zara en français et en arabe, budget, porte-manteau, après le 31 décembre, 31 décembre à 23h59).
