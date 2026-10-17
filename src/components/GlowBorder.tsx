import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

// Ligne lumineuse fine qui fait le tour de l'ecran (web seulement), d'UNE SEULE couleur a la fois.
// Une etoile court le long du bord (sens des aiguilles d'une montre, depart en haut a gauche) et laisse
// une queue de lumiere derriere elle. La couleur change a CHAQUE COIN (4 fois par tour).
// L'etoile s'arrete apres 8 tours a chaque visite : elle s'efface en douceur et la ligne reste fixe.
// Seul le temps ou la page est visible compte. Tout le mouvement est fait par le navigateur
// (transform) : peu de batterie, et plus aucune animation une fois l'etoile partie. Rien ne bloque
// les touchers. Pour les personnes qui ont demande moins d'animations : ligne turquoise, sans etoile.
const COLORS: Array<[number, number, number]> = [
  [45, 226, 200], // turquoise
  [90, 169, 255], // bleu ciel
  [167, 139, 250], // violet
  [255, 90, 138], // rose
  [255, 82, 82], // rouge
  [255, 210, 74], // or
  [74, 222, 128], // vert
];
const LAPS_MAX = 8; // tours de l'etoile a chaque visite
const SPEED_PX_PER_S = 520;
const MIN_LAP_MS = 3500;
const MAX_LAP_MS = 9000;
const STAR_SIZE = 20;
const INSET = 9; // distance entre le bord interieur de la ligne et le centre de l'etoile
const TRAIL_DOTS = 28;
const TRAIL_STEP_MS = 10;
const FADE_MS = 350;
const GONE_FADE_MS = 600; // l'etoile s'efface en douceur apres le dernier tour
// Une fois les 8 tours faits, on s'en souvient pour la visite (onglet) : un rechargement ne la relance pas.
const DONE_KEY = 'albasse_star_done';

const CSS = `
.albasse-glow{position:fixed;top:env(safe-area-inset-top,0px);right:env(safe-area-inset-right,0px);bottom:env(safe-area-inset-bottom,0px);left:env(safe-area-inset-left,0px);
  box-sizing:border-box;pointer-events:none;z-index:2147483646;--glow-rgb:${COLORS[0].join(',')};
  border:2px solid rgb(var(--glow-rgb));
  box-shadow:inset 0 0 3px 0 rgba(var(--glow-rgb),.95),inset 0 0 9px 1px rgba(var(--glow-rgb),.5);
  transition:border-color ${FADE_MS}ms ease,box-shadow ${FADE_MS}ms ease}
.albasse-glow [data-dot]{position:absolute;left:0;top:0;display:block;will-change:transform}
.albasse-glow .albasse-trail{border-radius:50%;background:radial-gradient(circle,rgba(var(--glow-rgb),1) 0%,rgba(var(--glow-rgb),.7) 55%,rgba(var(--glow-rgb),0) 80%)}
.albasse-glow .albasse-star{width:${STAR_SIZE}px;height:${STAR_SIZE}px;margin:-${STAR_SIZE / 2}px 0 0 -${STAR_SIZE / 2}px}
.albasse-glow .albasse-star svg{display:block;fill:#fff;
  filter:drop-shadow(0 0 2px rgba(255,255,255,.95)) drop-shadow(0 0 5px rgb(var(--glow-rgb))) drop-shadow(0 0 11px rgba(var(--glow-rgb),.85));
  transition:filter ${FADE_MS}ms ease}
@media (prefers-reduced-motion:reduce){.albasse-glow [data-dot]{display:none}}
`;

const STAR_POINTS = '12,1.8 14.9,8.6 22.2,9.2 16.6,14 18.4,21.2 12,17.3 5.6,21.2 7.4,14 1.8,9.2 9.1,8.6';

// Queue : des points lumineux de plus en plus petits et pales, qui suivent le meme chemin que l'etoile
// avec un peu de retard. Le premier point est le plus proche de l'etoile.
const TRAIL = Array.from({ length: TRAIL_DOTS }, (_, i) => {
  const t = i / (TRAIL_DOTS - 1);
  const size = Math.round((9 - 7.5 * t) * 10) / 10;
  return { size, opacity: Math.round(0.85 * (1 - t) ** 1.4 * 100) / 100 };
});

function starAlreadyDone() {
  try {
    return window.sessionStorage.getItem(DONE_KEY) === '1';
  } catch {
    return false;
  }
}

export function GlowBorder() {
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = frame.current;
    if (!el || typeof el.animate !== 'function') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    // rang 0 = etoile, puis les points de la queue du plus proche au plus loin
    const dots = Array.from(el.querySelectorAll<HTMLElement>('[data-step]')).sort(
      (a, b) => Number(a.dataset.step) - Number(b.dataset.step)
    );
    const hideDots = () => dots.forEach((d) => (d.style.display = 'none'));
    if (starAlreadyDone()) {
      hideDots();
      return;
    }

    const spinner = el.querySelector<SVGElement>('.albasse-star svg');
    let animations: Animation[] = [];
    let lapMs = 0;
    let corners: number[] = []; // moments (en ms depuis le debut du tour) ou l'etoile est dans un coin
    let epoch = performance.now(); // instant ou l'etoile etait en haut a gauche, au debut du tour numero lapBase
    let lapBase = 0; // tours entiers deja faits quand epoch a ete fixe
    let hiddenAt: number | null = document.hidden ? performance.now() : null; // page cachee depuis...
    let colorIndex = 0;
    let builtSize = '';
    let finished = false;
    let lastEventAt = -Infinity; // dernier coin pour lequel la couleur a change (en ms depuis epoch)
    let timer: ReturnType<typeof setTimeout> | undefined;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;

    // Fin des 8 tours : l'etoile et sa queue s'effacent, puis tout s'arrete. La ligne garde sa couleur.
    const finish = () => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      if (resizeTimer) clearTimeout(resizeTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
      try {
        window.sessionStorage.setItem(DONE_KEY, '1');
      } catch {
        // ignore : la page rechargee relancera simplement l'etoile
      }
      dots.forEach((d) => {
        d.style.transition = `opacity ${GONE_FADE_MS}ms ease`;
        d.style.opacity = '0';
      });
      setTimeout(() => {
        animations.forEach((a) => a.cancel());
        animations = [];
        hideDots();
      }, GONE_FADE_MS + 100);
    };

    // Prochain coin ou la couleur change, ou la fin des 8 tours. Tout est calcule avec l'horloge de la
    // page (pas avec la position affichee, qui retarde d'une image).
    const schedule = () => {
      if (timer) clearTimeout(timer);
      if (finished || hiddenAt !== null || lapMs === 0) return;
      const elapsed = performance.now() - epoch;
      const endIn = (LAPS_MAX - lapBase) * lapMs; // moment de la fin, en ms depuis epoch
      const lap = Math.floor(elapsed / lapMs);
      let next = Infinity;
      for (const k of [lap, lap + 1, lap + 2]) {
        for (const c of corners) {
          const t = k * lapMs + c;
          if (t > elapsed + 15 && t < next) next = t;
        }
      }
      if (!Number.isFinite(next) || next >= endIn - 30) {
        timer = setTimeout(finish, Math.max(0, endIn - elapsed));
        return;
      }
      timer = setTimeout(() => {
        // Si le navigateur a endormi la page, le minuteur arrive tres en retard : on ne change pas
        // la couleur quand l'etoile n'est plus dans le coin. Jamais deux changements pour le meme coin.
        if (performance.now() - epoch - next < 200 && Math.abs(next - lastEventAt) > 50) {
          lastEventAt = next;
          colorIndex = (colorIndex + 1) % COLORS.length;
          el.style.setProperty('--glow-rgb', COLORS[colorIndex].join(','));
        }
        schedule();
      }, next - elapsed);
    };

    // (Re)construit le chemin : un rectangle un peu a l'interieur de la ligne, parcouru dans le sens
    // des aiguilles d'une montre depuis le coin en haut a gauche. Garde la position de l'etoile et le
    // nombre de tours deja faits. Pas de reconstruction pendant que la page est cachee.
    const build = () => {
      if (finished || hiddenAt !== null) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w < 40 || h < 40 || builtSize === w + 'x' + h) return;
      builtSize = w + 'x' + h;
      let fraction = 0;
      if (lapMs > 0) {
        const laps = lapBase + (performance.now() - epoch) / lapMs; // tours faits depuis le debut
        lapBase = Math.floor(laps);
        fraction = laps - lapBase;
      }
      if (lapBase >= LAPS_MAX) {
        finish();
        return;
      }
      animations.forEach((a) => a.cancel());
      const x0 = INSET;
      const y0 = INSET;
      const x1 = Math.max(x0 + 1, w - INSET);
      const y1 = Math.max(y0 + 1, h - INSET);
      const top = x1 - x0;
      const side = y1 - y0;
      const perimeter = 2 * (top + side);
      lapMs = Math.min(MAX_LAP_MS, Math.max(MIN_LAP_MS, (perimeter / SPEED_PX_PER_S) * 1000));
      const at = (x: number, y: number, offset: number) => ({ transform: `translate(${x}px, ${y}px)`, offset });
      const keyframes = [
        at(x0, y0, 0),
        at(x1, y0, top / perimeter),
        at(x1, y1, (top + side) / perimeter),
        at(x0, y1, (2 * top + side) / perimeter),
        at(x0, y0, 1),
      ];
      corners = [0, (top / perimeter) * lapMs, ((top + side) / perimeter) * lapMs, ((2 * top + side) / perimeter) * lapMs];
      epoch = performance.now() - fraction * lapMs;
      lastEventAt = -Infinity;
      animations = dots.map((dot) =>
        dot.animate(keyframes, {
          duration: lapMs,
          iterations: Infinity,
          easing: 'linear',
          delay: Number(dot.dataset.step) * TRAIL_STEP_MS,
          fill: 'backwards',
        })
      );
      if (spinner) {
        // deux tours sur elle-meme par tour d'ecran
        animations.push(
          spinner.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
            duration: lapMs / 2,
            iterations: Infinity,
            easing: 'linear',
          })
        );
      }
      animations.forEach((a) => {
        a.startTime = epoch;
      });
      schedule();
    };

    // Page cachee (autre onglet, ecran eteint) : l'etoile se met en pause et ne compte plus ses tours.
    function onVisibility() {
      if (finished) return;
      if (document.hidden) {
        if (hiddenAt === null) {
          hiddenAt = performance.now();
          animations.forEach((a) => a.pause());
          if (timer) clearTimeout(timer);
        }
        return;
      }
      if (hiddenAt === null) return;
      if (animations.length === 0) {
        // la page s'est ouverte cachee : l'etoile demarre quand on la voit
        hiddenAt = null;
        epoch = performance.now();
        build();
        return;
      }
      epoch += performance.now() - hiddenAt;
      hiddenAt = null;
      animations.forEach((a) => a.play());
      build(); // la taille a pu changer pendant ce temps : on reverifie
      schedule();
    }

    build();
    document.addEventListener('visibilitychange', onVisibility);
    // La barre d'adresse qui se cache ou l'ecran qui tourne change la taille : on reprend le chemin.
    const observer =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(build, 120);
          })
        : null;
    observer?.observe(el);

    return () => {
      finished = true;
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
      if (timer) clearTimeout(timer);
      if (resizeTimer) clearTimeout(resizeTimer);
      animations.forEach((a) => a.cancel());
    };
  }, []);

  if (Platform.OS !== 'web') return null;
  return React.createElement(
    React.Fragment,
    null,
    React.createElement('style', null, CSS),
    React.createElement(
      'div',
      { ref: frame, className: 'albasse-glow', 'aria-hidden': 'true' },
      ...TRAIL.map((dot, i) =>
        React.createElement('div', {
          key: i,
          'data-dot': 'trail',
          'data-step': String(i + 1),
          className: 'albasse-trail',
          style: { width: dot.size, height: dot.size, marginLeft: -dot.size / 2, marginTop: -dot.size / 2, opacity: dot.opacity },
        })
      ).reverse(),
      React.createElement(
        'div',
        { key: 'star', 'data-dot': 'star', 'data-step': '0', className: 'albasse-star' },
        React.createElement(
          'svg',
          { viewBox: '0 0 24 24', width: STAR_SIZE, height: STAR_SIZE },
          React.createElement('polygon', { points: STAR_POINTS })
        )
      )
    )
  );
}
