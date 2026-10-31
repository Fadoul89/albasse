// L'affiche du rapport de Zara (image 1080 px de large) : un arbre d'éléments pour « satori », sans réseau ni base, donc testable.
// Les données viennent de la fonction SQL zara_weekly_report_data (rien n'est inventé : pas de visite = « Aucune visite »).

export interface ReportData {
  d0: string; // 2026-10-19
  d1: string; // 2026-10-25
  products: { name: string; views: number; image: string | null }[];
  searches: { q: string; n: number }[];
  days: { day: string; names: string[] }[];
}

export interface PosterAssets {
  avatar: string | null; // photo de Zara (data:image/jpeg;base64,…)
  images: (string | null)[]; // photos des articles (même ordre que data.products), data URI ou null
}

export const POSTER_WIDTH = 1080;

// Les 3 couleurs du patron (comme les e-mails) : violet aubergine (fond et cartes), doré (accents, rangs, nombres), argenté (textes).
// Contrastes sur le violet #4B0082 : argenté 6,9 pour 1, doré 5,9 pour 1 (lisibles). Le violet sert aussi de texte sur les pastilles dorées.
const VIOLET = '#4B0082';
const VIOLET_DEEP = '#2E0052'; // bas du dégradé
const VIOLET_TOP = '#5E1A9B'; // haut du dégradé
const PANEL = '#390066'; // cartes : un violet plus sombre que le fond
const PANEL_ALT = '#5A2A8F'; // carré gris-violet quand l'article n'a pas de photo
const GOLD = '#D4AF37';
const GOLD_LIGHT = '#E6C766'; // doré éclairci pour les titres sur violet
const SILVER = '#C0C0C0';
const SILVER_LIGHT = '#EDEDF2'; // argenté éclairci pour les textes importants
const SILVER_MUTED = 'rgba(192, 192, 192, 0.82)';
const GOLD_LINE = 'rgba(212, 175, 55, 0.55)';

// Les polices de l'affiche n'ont ni emoji ni arabe : on garde seulement les lettres latines, les chiffres et la ponctuation
export function cleanText(text: string): string {
  const kept = text.replace(/[^\p{Script=Latin}\p{N}\p{P}\p{Zs}+&@#°%$€£=<>~^|\\/]/gu, '').replace(/\s+/g, ' ').trim();
  return kept || '';
}

const WEEKDAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

// « 2026-10-19 » → « 19/10 »
export function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}` : iso;
}

// « 2026-10-19 » → « Lun 19/10 »
export function dayLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const wd = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)).getUTCDay();
  return `${WEEKDAYS[wd]} ${m[3]}/${m[2]}`;
}

export function frNumber(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

type Style = Record<string, string | number>;
interface El {
  type: string;
  props: { style?: Style; children?: unknown; src?: string; width?: number; height?: number };
}
const el = (type: string, style: Style, children?: unknown, extra: Record<string, unknown> = {}): El => ({ type, props: { style, children, ...extra } as El['props'] });
const box = (style: Style, children?: unknown) => el('div', { display: 'flex', ...style }, children);
const txt = (style: Style, children: string) => el('div', { display: 'flex', ...style }, children);

const RANK_COLORS = [GOLD, SILVER, '#B07A3E']; // or, argent, bronze

function sectionTitle(label: string): El {
  return box({ alignItems: 'center', marginTop: 46, marginBottom: 20 }, [
    txt({ fontFamily: 'Manrope', fontWeight: 700, fontSize: 30, letterSpacing: 5, color: GOLD_LIGHT }, label),
    box({ flex: 1, height: 3, marginLeft: 24, backgroundColor: GOLD_LINE }),
  ]);
}

function productRow(p: ReportData['products'][number], i: number, image: string | null): El {
  const name = cleanText(p.name) || 'Article';
  return box({ alignItems: 'center', backgroundColor: PANEL, borderRadius: 28, border: `2px solid ${GOLD_LINE}`, padding: 20, marginBottom: 20 }, [
    box({ width: 86, height: 86, borderRadius: 43, backgroundColor: RANK_COLORS[i] ?? GOLD, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }, [
      txt({ fontFamily: 'Fraunces', fontWeight: 700, fontSize: 56, color: VIOLET }, String(i + 1)),
    ]),
    image
      ? el('img', { width: 170, height: 170, borderRadius: 20, objectFit: 'cover', marginLeft: 22, flexShrink: 0 }, undefined, { src: image, width: 170, height: 170 })
      : box({ width: 170, height: 170, borderRadius: 20, marginLeft: 22, backgroundColor: PANEL_ALT, flexShrink: 0 }),
    box({ flexDirection: 'column', marginLeft: 26, flex: 1, minWidth: 0 }, [
      txt({ fontFamily: 'Manrope', fontWeight: 700, fontSize: 38, lineHeight: 1.18, color: SILVER_LIGHT, lineClamp: 2 }, name),
      box({ alignItems: 'baseline', marginTop: 12 }, [
        txt({ fontFamily: 'Fraunces', fontWeight: 700, fontSize: 64, color: GOLD_LIGHT }, frNumber(p.views)),
        txt({ fontFamily: 'Manrope', fontWeight: 700, fontSize: 30, color: SILVER_MUTED, marginLeft: 12 }, p.views > 1 ? 'vues' : 'vue'),
      ]),
    ]),
  ]);
}

function searchChips(searches: ReportData['searches']): El {
  if (searches.length === 0) return txt({ fontFamily: 'Manrope', fontWeight: 600, fontSize: 32, color: SILVER_MUTED }, 'Aucune recherche');
  return box(
    { flexWrap: 'wrap' },
    searches.map((s) =>
      box({ alignItems: 'center', backgroundColor: PANEL, border: `2px solid ${GOLD_LINE}`, borderRadius: 999, paddingTop: 12, paddingBottom: 12, paddingLeft: 26, paddingRight: 14, marginRight: 14, marginBottom: 14 }, [
        txt({ fontFamily: 'Manrope', fontWeight: 700, fontSize: 34, color: SILVER_LIGHT }, `« ${cleanText(s.q) || '…'} »`),
        box({ minWidth: 52, height: 52, borderRadius: 26, marginLeft: 16, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', paddingLeft: 10, paddingRight: 10 }, [
          txt({ fontFamily: 'Manrope', fontWeight: 700, fontSize: 30, color: VIOLET }, String(s.n)),
        ]),
      ])
    )
  );
}

function dayRow(d: ReportData['days'][number]): El {
  const names = d.names.map((n) => cleanText(n)).filter(Boolean);
  return box({ alignItems: 'center', backgroundColor: PANEL, border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: 24, padding: 14, marginBottom: 12 }, [
    box({ width: 214, height: 66, borderRadius: 33, backgroundColor: 'rgba(212, 175, 55, 0.2)', border: `2px solid ${GOLD_LINE}`, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }, [
      txt({ fontFamily: 'Manrope', fontWeight: 700, fontSize: 32, color: GOLD_LIGHT }, dayLabel(d.day)),
    ]),
    box({ flexDirection: 'column', marginLeft: 24, flex: 1, minWidth: 0 },
      names.length > 0
        ? names.map((n, i) =>
            txt({ fontFamily: 'Manrope', fontWeight: i === 0 ? 700 : 600, fontSize: i === 0 ? 29 : 25, lineHeight: 1.25, color: i === 0 ? SILVER_LIGHT : SILVER_MUTED, lineClamp: 1 }, `${i + 1}. ${n}`)
          )
        : [txt({ fontFamily: 'Manrope', fontWeight: 600, fontSize: 28, color: SILVER_MUTED }, 'Aucune visite')]),
  ]);
}

function header(data: ReportData, avatar: string | null, big: boolean): El {
  const size = big ? 190 : 120;
  return box({ alignItems: 'center' }, [
    avatar
      ? el('img', { width: size, height: size, borderRadius: size / 2, border: `6px solid ${GOLD}`, objectFit: 'cover', flexShrink: 0 }, undefined, { src: avatar, width: size, height: size })
      : box({ width: size, height: size, borderRadius: size / 2, backgroundColor: GOLD, flexShrink: 0 }),
    box({ flexDirection: 'column', marginLeft: big ? 36 : 28, flex: 1, minWidth: 0 }, [
      txt({ fontFamily: 'Manrope', fontWeight: 700, fontSize: big ? 28 : 24, letterSpacing: 8, color: GOLD_LIGHT }, 'ALBASSE SHOPPING'),
      txt({ fontFamily: 'Fraunces', fontWeight: 700, fontSize: big ? 84 : 64, lineHeight: 1.05, color: SILVER_LIGHT, marginTop: big ? 8 : 4 }, 'Rapport de Zara'),
      box({ marginTop: big ? 14 : 10 }, [
        box({ backgroundColor: GOLD, border: `2px solid ${GOLD}`, borderRadius: 999, paddingTop: 10, paddingBottom: 10, paddingLeft: 26, paddingRight: 26 }, [
          txt({ fontFamily: 'Manrope', fontWeight: 700, fontSize: big ? 34 : 30, color: VIOLET }, `Semaine du ${shortDate(data.d0)} au ${shortDate(data.d1)}`),
        ]),
      ]),
    ]),
  ]);
}

const pageBox = (height: number, children: unknown[]): El =>
  box({ width: POSTER_WIDTH, height, flexDirection: 'column', backgroundImage: `linear-gradient(180deg, ${VIOLET_TOP} 0%, ${VIOLET} 38%, ${VIOLET_DEEP} 100%)`, padding: 56, fontFamily: 'Manrope' }, children);

const footerLine = (label: string): El =>
  box({ justifyContent: 'center', marginTop: 24 }, [txt({ fontFamily: 'Manrope', fontWeight: 600, fontSize: 25, color: SILVER_MUTED, textAlign: 'center' }, label)]);

export interface PosterPage {
  tree: El;
  width: number;
  height: number;
}

// Telegram réduit les photos à 1280 px au plus : deux pages de 1080 x ~1400 restent nettes sur un téléphone (une seule page de 2400 px serait floue)
export function posterPages(data: ReportData, assets: PosterAssets): PosterPage[] {
  const products = data.products.slice(0, 3);
  const searches = data.searches.slice(0, 5);
  const days = data.days.slice(0, 7);
  const two = days.length > 0;

  const chipRows = Math.max(1, Math.ceil(searches.length / 3));
  const h1 = 112 + 190 + 102 + Math.max(1, products.length) * 230 + 102 + chipRows * 92 + 100;
  const page1 = pageBox(h1, [
    header(data, assets.avatar, true),
    sectionTitle('ARTICLES LES PLUS REGARDÉS'),
    ...(products.length > 0
      ? products.map((p, i) => productRow(p, i, assets.images[i] ?? null))
      : [txt({ fontFamily: 'Manrope', fontWeight: 600, fontSize: 32, color: SILVER_MUTED, marginBottom: 20 }, 'Aucune visite')]),
    sectionTitle('MOTS LES PLUS CHERCHÉS'),
    searchChips(searches),
    box({ flex: 1 }),
    footerLine(two ? 'Suite : le top 3 de chaque jour  ›  (2/2)' : 'Rapport automatique de Zara chaque lundi  ·  albasseshopping.com'),
  ]);
  const pages: PosterPage[] = [{ tree: page1, width: POSTER_WIDTH, height: h1 }];

  if (two) {
    const h2 = 112 + 140 + 102 + days.length * 137 + 105;
    pages.push({
      width: POSTER_WIDTH,
      height: h2,
      tree: pageBox(h2, [
        header(data, assets.avatar, false),
        sectionTitle('TOP 3 PAR JOUR'),
        ...days.map(dayRow),
        box({ flex: 1 }),
        footerLine('Rapport automatique de Zara chaque lundi  ·  albasseshopping.com'),
      ]),
    });
  }
  return pages;
}
