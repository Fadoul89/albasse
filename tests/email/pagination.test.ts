// Pages numérotées (Admin › Clients : 1 2 3 4). Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/pagination.test.ts
import { clampPage, pageCount, pageItems, pageRange, pageSlice } from '../../src/lib/pagination.ts';

let ok = 0;
const check = (label: string, cond: unknown, detail?: unknown) => {
  if (cond) {
    ok++;
    console.log('OK   ', label);
  } else {
    console.log('ECHEC', label, detail === undefined ? '' : JSON.stringify(detail));
    process.exitCode = 1;
  }
};

// le cas du patron : 75 clients, 20 par page = 4 pages
check('75 clients, 20 par page : 4 pages', pageCount(75, 20) === 4);
check('exactement 80 clients : 4 pages (pas de 5e page vide)', pageCount(80, 20) === 4);
check('81 clients : 5 pages', pageCount(81, 20) === 5);
check('liste vide : toujours 1 page (pas « page 0 »)', pageCount(0, 20) === 1);
check('une taille de page absurde (0, négative, texte) ne casse rien', pageCount(10, 0) === 10 && pageCount(10, -5) === 10 && pageCount(10, NaN) === 10);
check('un total absurde (négatif, NaN) = 1 page', pageCount(-3, 20) === 1 && pageCount(NaN, 20) === 1);

check('page demandée trop grande -> la dernière', clampPage(99, 75, 20) === 4);
check('page 0, négative ou illisible -> la première', clampPage(0, 75, 20) === 1 && clampPage(-2, 75, 20) === 1 && clampPage(NaN, 75, 20) === 1);
check('page décimale arrondie vers le bas', clampPage(2.9, 75, 20) === 2);

const list = Array.from({ length: 75 }, (_, i) => i + 1);
const p1 = pageSlice(list, 1, 20);
const p4 = pageSlice(list, 4, 20);
check('page 1 : les clients 1 à 20', p1.length === 20 && p1[0] === 1 && p1[19] === 20);
check('page 2 : les clients 21 à 40', pageSlice(list, 2, 20)[0] === 21 && pageSlice(list, 2, 20)[19] === 40);
check('page 4 : les 15 derniers (61 à 75)', p4.length === 15 && p4[0] === 61 && p4[14] === 75);
check('les 4 pages mises bout à bout = toute la liste, sans doublon ni oubli', [1, 2, 3, 4].flatMap((p) => pageSlice(list, p, 20)).join() === list.join());
check('page trop grande : la dernière page (jamais une page vide)', pageSlice(list, 99, 20).join() === p4.join());
check('liste vide : page vide', pageSlice([], 1, 20).length === 0);
const before = JSON.stringify(list);
pageSlice(list, 3, 20);
check('la liste reçue n\'est pas modifiée', JSON.stringify(list) === before);

check('« 1 – 20 sur 75 »', JSON.stringify(pageRange(1, 75, 20)) === JSON.stringify({ from: 1, to: 20, total: 75 }));
check('« 61 – 75 sur 75 » à la dernière page', JSON.stringify(pageRange(4, 75, 20)) === JSON.stringify({ from: 61, to: 75, total: 75 }));
check('liste vide : aucun intervalle', pageRange(1, 0, 20) === null);
check('un seul client : « 1 – 1 sur 1 »', JSON.stringify(pageRange(1, 1, 20)) === JSON.stringify({ from: 1, to: 1, total: 1 }));

// les boutons
const items = (c: number, n: number, max?: number) => pageItems(c, n, max).map((x) => (x === 'gap-left' || x === 'gap-right' ? '…' : String(x))).join(' ');
check('4 pages : « 1 2 3 4 » (comme le patron le demande)', items(1, 4) === '1 2 3 4' && items(3, 4) === '1 2 3 4');
check('1 seule page : « 1 »', items(1, 1) === '1');
check('7 pages : tous les numéros', items(4, 7) === '1 2 3 4 5 6 7');
check('12 pages, page 1 : « 1 2 3 4 5 … 12 »', items(1, 12) === '1 2 3 4 5 … 12');
check('12 pages, page 4 : « 1 2 3 4 5 … 12 » (la page 4 reste visible)', items(4, 12) === '1 2 3 4 5 … 12');
check('12 pages, page 6 : « 1 … 5 6 7 … 12 »', items(6, 12) === '1 … 5 6 7 … 12');
check('12 pages, page 9 : « 1 … 8 9 10 11 12 »', items(9, 12) === '1 … 8 9 10 11 12');
check('12 pages, dernière page : « 1 … 8 9 10 11 12 »', items(12, 12) === '1 … 8 9 10 11 12');
check('jamais plus de 7 boutons, la page courante est toujours dans la liste, la première et la dernière aussi', Array.from({ length: 40 }, (_, k) => k + 1).every((n) => Array.from({ length: n }, (_, k) => k + 1).every((c) => { const it = pageItems(c, n); return it.length <= 7 && it.includes(c) && it.includes(1) && it.includes(n); })));
check('les numéros sont toujours dans l\'ordre croissant, sans doublon', Array.from({ length: 30 }, (_, k) => k + 1).every((n) => Array.from({ length: n }, (_, k) => k + 1).every((c) => { const nums = pageItems(c, n).filter((x): x is number => typeof x === 'number'); return nums.every((v, i) => i === 0 || v > nums[i - 1]); })));
check('un « … » ne cache jamais une seule page (sinon on montrerait cette page)', Array.from({ length: 40 }, (_, k) => k + 1).every((n) => Array.from({ length: n }, (_, k) => k + 1).every((c) => { const it = pageItems(c, n); return it.every((x, i) => { if (typeof x === 'number') return true; const a = it[i - 1] as number; const b = it[i + 1] as number; return b - a > 2; }); })));
check('entrées absurdes (page 0, NaN, trop grande) : pas d\'erreur', pageItems(0, 12).includes(1) && pageItems(NaN, 12).includes(1) && pageItems(99, 12).includes(12) && pageItems(1, 0).join() === '1');

console.log(`\n${ok} contrôles réussis`);
