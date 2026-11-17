// Publicité animée Stickman – Albasse Shopping. Tout est une fonction du temps : window.seek(ms) place chaque image (rendu par render.js).
// Les 3 personnages sont dessinés en vectoriel (SVG) par makeStickman() : mêmes traits, mêmes couleurs dans toutes les scènes.
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const W = 1080, H = 1920;
  const el = (tag, attrs = {}, parent = null) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  const easeOut = (k) => 1 - Math.pow(1 - k, 3);
  const easeOutBack = (k) => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);
  const easeIn = (k) => k * k;
  const fr = (n) => n.toLocaleString('fr-FR') + ' FCFA';

  // ------------------------------------------------------------------ les personnages
  const INK = '#111';
  const LOOK = {
    client: { shirt: '#d8262b', sleeve: 'short', shoe: '#d8262b', pants: '#17181c', hand: '#fff', hair: true },
    ami: { shirt: '#1f5fd6', sleeve: 'long', shoe: '#1f5fd6', pants: '#17181c', hand: '#fff', hair: true, collar: true },
    livreur: { shirt: '#22b24c', sleeve: 'long', shoe: '#151515', pants: '#111', hand: '#1a1a1a', hair: false, helmet: true, bag: true, stripes: true },
  };
  // les poses (angles en degrés ; bras droit = côté droit de l'écran ; u = épaule / hanche, l = coude / genou)
  const BASE = { legL: { u: 4, l: 0 }, legR: { u: -4, l: 0 }, armL: { u: 8, l: 0 }, armR: { u: -8, l: 0 }, tilt: 0, brow: 0, eye: 1, mouth: 'smile' };
  const POSE = {
    stand: {},
    think: { armR: { u: 40, l: 154 }, armL: { u: 32, l: -81 }, tilt: -5, brow: 0.25, mouth: 'flat' },      // main droite au menton, main gauche sur la hanche
    explain: { armR: { u: -35, l: -120 }, armL: { u: 35, l: 120 }, tilt: 2, brow: 0.3, mouth: 'flat' },   // les deux mains ouvertes
    listen: { armL: { u: 32, l: -81 }, armR: { u: -8, l: 0 }, tilt: 7, brow: 0.6 },                        // écoute, main sur la hanche
    surprise: { armR: { u: -40, l: -150 }, armL: { u: 40, l: 150 }, tilt: 5, brow: 1, mouth: 'o', eye: 1.25 }, // mains levées près de la tête
    present: { armL: { u: 95, l: 40 }, armR: { u: -35, l: 129 }, tilt: 3, brow: 0.5 },                     // bras gauche ouvert (paume), téléphone à droite
    phone: { armR: { u: -35, l: 129 }, armL: { u: 8, l: 0 }, tilt: 6, brow: 0.2 },                         // regarde le téléphone (main devant la poitrine)
    point: { armR: { u: -35, l: 129 }, armL: { u: 30, l: -137 }, tilt: 2, brow: 0.45 },                     // montre l'écran de la main gauche
    happy: { armR: { u: -150, l: -10 }, armL: { u: 150, l: 10 }, tilt: -4, brow: 1, mouth: 'laugh', eye: 1.1 },
    box: { armR: { u: -70, l: 108 }, armL: { u: 70, l: -108 }, brow: 0.3 },                               // tient le colis à deux mains
    wave: { armR: { u: -150, l: -10 }, armL: { u: 8, l: 0 }, brow: 0.6 },
    waveBox: { armR: { u: -150, l: -10 }, armL: { u: 70, l: -108 }, brow: 0.6 },
    laugh: { tilt: -8, brow: 0.8, mouth: 'laugh', eye: 0 },
  };
  const resolve = (name) => {
    const p = POSE[name] || {};
    return {
      legL: { ...BASE.legL, ...(p.legL || {}) }, legR: { ...BASE.legR, ...(p.legR || {}) },
      armL: { ...BASE.armL, ...(p.armL || {}) }, armR: { ...BASE.armR, ...(p.armR || {}) },
      tilt: p.tilt ?? BASE.tilt, brow: p.brow ?? BASE.brow, eye: p.eye ?? BASE.eye, mouth: p.mouth ?? BASE.mouth,
    };
  };
  const blend = (a, b, k) => ({
    legL: { u: lerp(a.legL.u, b.legL.u, k), l: lerp(a.legL.l, b.legL.l, k) }, legR: { u: lerp(a.legR.u, b.legR.u, k), l: lerp(a.legR.l, b.legR.l, k) },
    armL: { u: lerp(a.armL.u, b.armL.u, k), l: lerp(a.armL.l, b.armL.l, k) }, armR: { u: lerp(a.armR.u, b.armR.u, k), l: lerp(a.armR.l, b.armR.l, k) },
    tilt: lerp(a.tilt, b.tilt, k), brow: lerp(a.brow, b.brow, k), eye: lerp(a.eye, b.eye, k), mouth: k < 0.5 ? a.mouth : b.mouth,
  });
  // une suite de poses dans le temps : [{t, pose, dur}] ; la pose se fond depuis la précédente en « dur » secondes
  const poseAt = (track, t) => {
    let i = track.length - 1;
    while (i > 0 && track[i].t > t) i--;
    const cur = resolve(track[i].pose);
    if (i === 0 || t >= track[i].t + (track[i].dur || 0.35)) return cur;
    const prev = resolve(track[i - 1].pose);
    return blend(prev, cur, easeInOut(seg(t, track[i].t, track[i].t + (track[i].dur || 0.35))));
  };

  function makeStickman(kind) {
    const L = LOOK[kind];
    const root = el('g', { class: `stick ${kind}` });
    const body = el('g', {}, root);
    const sw = 6.5;
    const limb = (parent, w, len, fill, rx) => el('rect', { x: -w / 2, y: -6, width: w, height: len + 6, rx: rx ?? w / 2, fill, stroke: INK, 'stroke-width': sw }, parent);

    // le sac du livreur (derrière)
    if (L.bag) {
      const bag = el('g', { transform: 'translate(62,-430)' }, body);
      el('rect', { x: 0, y: 0, width: 150, height: 160, rx: 22, fill: '#22b24c', stroke: INK, 'stroke-width': sw }, bag);
      el('rect', { x: 0, y: 52, width: 150, height: 22, fill: '#fff', stroke: INK, 'stroke-width': 4 }, bag);
      el('rect', { x: 16, y: 102, width: 118, height: 38, rx: 8, fill: '#189a3e', stroke: INK, 'stroke-width': 4 }, bag);
      el('path', { d: 'M -40 10 L 0 22 M -40 90 L 0 96', stroke: INK, 'stroke-width': 9, fill: 'none', 'stroke-linecap': 'round' }, bag);
    }
    // les jambes
    const legs = {};
    for (const side of ['L', 'R']) {
      const sx = side === 'L' ? -26 : 26;
      const hip = el('g', {}, body);
      const thigh = el('g', {}, hip);
      limb(thigh, 50, 124, L.pants, 18);
      if (L.helmet) el('rect', { x: -22, y: 56, width: 44, height: 40, rx: 8, fill: '#2a2a2a', stroke: INK, 'stroke-width': 4 }, thigh); // poche cargo
      const knee = el('g', { transform: 'translate(0,124)' }, thigh);
      limb(knee, 44, 118, L.pants, 16);
      const foot = el('g', { transform: 'translate(0,118)' }, knee);
      if (L.helmet) {
        el('path', { d: 'M -24 -6 h 48 v 22 l 14 10 q 6 14 -10 14 h -58 q -14 0 -12 -14 z', fill: L.shoe, stroke: INK, 'stroke-width': sw }, foot);
        el('path', { d: 'M -32 32 h 72', stroke: '#777', 'stroke-width': 4 }, foot);
      } else {
        el('path', { d: 'M -24 -6 h 48 v 18 l 16 12 q 6 14 -10 14 h -58 q -14 0 -12 -14 z', fill: L.shoe, stroke: INK, 'stroke-width': sw }, foot);
        el('path', { d: 'M -34 28 h 76', stroke: '#fff', 'stroke-width': 9 }, foot);
        el('path', { d: 'M -14 4 h 30 M -14 12 h 30', stroke: '#fff', 'stroke-width': 4 }, foot);
      }
      legs[side] = { hip, knee, sx };
    }
    // le tronc
    const torso = el('g', {}, body);
    el('rect', { x: -64, y: -420, width: 128, height: 178, rx: 28, fill: L.shirt, stroke: INK, 'stroke-width': sw }, torso);
    if (L.stripes) {
      el('rect', { x: -64, y: -376, width: 128, height: 16, fill: '#fff' }, torso);
      el('rect', { x: -64, y: -300, width: 128, height: 16, fill: '#fff' }, torso);
      el('path', { d: 'M 0 -420 v 178', stroke: '#13843a', 'stroke-width': 5 }, torso);
      el('rect', { x: -64, y: -420, width: 128, height: 178, rx: 28, fill: 'none', stroke: INK, 'stroke-width': sw }, torso);
    }
    if (L.collar) {
      el('path', { d: 'M -22 -420 L 0 -392 L 22 -420 L 22 -404 L 0 -378 L -22 -404 Z', fill: '#fff', stroke: INK, 'stroke-width': 4 }, torso);
      el('path', { d: 'M 0 -378 v 130', stroke: '#1649a8', 'stroke-width': 4 }, torso);
      for (const y of [-350, -318, -286, -254]) el('circle', { cx: 0, cy: y, r: 5, fill: '#fff', stroke: INK, 'stroke-width': 2.5 }, torso);
    }
    if (kind === 'client') el('path', { d: 'M -24 -420 q 24 22 48 0', fill: 'none', stroke: INK, 'stroke-width': 5 }, torso);
    // les bras
    const arms = {};
    for (const side of ['L', 'R']) {
      const sx = side === 'L' ? -58 : 58;
      const sh = el('g', {}, body);
      const upper = el('g', {}, sh);
      limb(upper, 32, 108, L.sleeve === 'long' ? L.shirt : '#fff');
      if (L.sleeve === 'short') el('rect', { x: -22, y: -8, width: 44, height: 54, rx: 14, fill: L.shirt, stroke: INK, 'stroke-width': sw }, upper);
      if (L.stripes) el('rect', { x: -16, y: 54, width: 32, height: 12, fill: '#fff' }, upper);
      const elbow = el('g', { transform: 'translate(0,108)' }, upper);
      limb(elbow, 28, 96, L.sleeve === 'long' ? L.shirt : '#fff');
      const hand = el('g', { transform: 'translate(0,104)' }, elbow);
      el('circle', { cx: 0, cy: 0, r: 25, fill: L.hand, stroke: L.hand === '#fff' ? INK : '#555', 'stroke-width': sw }, hand);
      if (side === 'R' && kind !== 'livreur') {
        // la montre au poignet droit
        el('rect', { x: -18, y: -34, width: 36, height: 14, rx: 4, fill: '#2b2f3a', stroke: INK, 'stroke-width': 3 }, hand);
        el('circle', { cx: 0, cy: -27, r: 9, fill: '#e8edf5', stroke: INK, 'stroke-width': 3 }, hand);
      }
      arms[side] = { sh, elbow, hand, sx };
    }
    // le téléphone dans la main droite de l'ami
    let phone = null;
    if (kind === 'ami') {
      phone = el('g', {}, arms.R.hand);
      el('rect', { x: -32, y: -64, width: 64, height: 118, rx: 12, fill: '#1b1f2e', stroke: INK, 'stroke-width': 5 }, phone);
      el('rect', { x: -25, y: -54, width: 50, height: 98, rx: 7, fill: '#0b2a72' }, phone);
      el('rect', { x: -19, y: -40, width: 38, height: 9, rx: 4, fill: '#f1c96b' }, phone);
      el('rect', { x: -19, y: -24, width: 38, height: 6, rx: 3, fill: '#fff', opacity: 0.8 }, phone);
      el('rect', { x: -19, y: -12, width: 17, height: 17, rx: 3, fill: '#4ade80' }, phone);
      el('rect', { x: 2, y: -12, width: 17, height: 17, rx: 3, fill: '#fff', opacity: 0.85 }, phone);
      el('rect', { x: -19, y: 10, width: 17, height: 17, rx: 3, fill: '#fff', opacity: 0.85 }, phone);
      el('rect', { x: 2, y: 10, width: 17, height: 17, rx: 3, fill: '#f1c96b' }, phone);
    }
    // le cou et la tête
    el('rect', { x: -14, y: -446, width: 28, height: 34, fill: '#fff', stroke: INK, 'stroke-width': sw }, body);
    const head = el('g', {}, body);
    el('circle', { cx: 0, cy: -524, r: 86, fill: '#fff', stroke: INK, 'stroke-width': 7 }, head);
    if (L.hair) el('path', { d: 'M -24 -606 l -10 -24 M 0 -610 l 0 -28 M 24 -606 l 10 -24', stroke: INK, 'stroke-width': 6, 'stroke-linecap': 'round', fill: 'none' }, head);
    const brows = el('g', {}, head);
    el('path', { d: 'M -46 -574 q 16 -12 32 -2', stroke: INK, 'stroke-width': 7, 'stroke-linecap': 'round', fill: 'none' }, brows);
    el('path', { d: 'M 46 -574 q -16 -12 -32 -2', stroke: INK, 'stroke-width': 7, 'stroke-linecap': 'round', fill: 'none' }, brows);
    const eyes = el('g', {}, head);
    const eyeOpen = el('g', {}, eyes);
    for (const x of [-30, 30]) {
      el('ellipse', { cx: x, cy: -538, rx: 11, ry: 15, fill: INK }, eyeOpen);
      el('circle', { cx: x + 4, cy: -543, r: 3.5, fill: '#fff' }, eyeOpen);
    }
    const eyeHappy = el('path', { d: 'M -42 -534 q 12 -18 24 0 M 18 -534 q 12 -18 24 0', stroke: INK, 'stroke-width': 7, 'stroke-linecap': 'round', fill: 'none', display: 'none' }, eyes);
    const mouthG = el('g', { transform: 'translate(0,-488)' }, head);
    const mouthFill = el('path', { d: '', fill: '#c0242b', stroke: INK, 'stroke-width': 5, 'stroke-linejoin': 'round' }, mouthG);
    const teeth = el('rect', { x: -20, y: 2, width: 40, height: 9, rx: 3, fill: '#fff', display: 'none' }, mouthG);
    const mouthLine = el('path', { d: 'M -26 0 q 26 26 52 0', fill: 'none', stroke: INK, 'stroke-width': 6, 'stroke-linecap': 'round' }, mouthG);
    // le casque du livreur
    if (L.helmet) {
      const hel = el('g', {}, head);
      el('path', { d: 'M -100 -524 a 100 100 0 0 1 200 0 l 0 22 q 0 14 -14 14 l -40 0 q -10 0 -12 -10 l -8 -26 l -52 0 l -8 26 q -2 10 -12 10 l -40 0 q -14 0 -14 -14 z', fill: '#22b24c', stroke: INK, 'stroke-width': 7, 'stroke-linejoin': 'round' }, hel);
      el('path', { d: 'M -76 -560 a 86 86 0 0 1 152 0', fill: 'none', stroke: '#9ff0b8', 'stroke-width': 10, 'stroke-linecap': 'round' }, hel);
      el('path', { d: 'M -74 -540 q 74 -40 148 0 l -8 -30 q -66 -36 -132 0 z', fill: '#bfe9ff', opacity: 0.75, stroke: INK, 'stroke-width': 4 }, hel);
      el('circle', { cx: 96, cy: -520, r: 16, fill: '#189a3e', stroke: INK, 'stroke-width': 5 }, hel);
    }
    // le colis Albasse Shopping, tenu devant
    let box = null;
    if (kind === 'livreur') {
      box = el('g', { transform: 'translate(0,-300)' }, body);
      el('rect', { x: -92, y: -58, width: 184, height: 118, rx: 8, fill: '#d6a46b', stroke: INK, 'stroke-width': sw }, box);
      el('rect', { x: -92, y: -58, width: 184, height: 26, rx: 6, fill: '#c4925a', stroke: INK, 'stroke-width': 4 }, box);
      el('rect', { x: -14, y: -58, width: 28, height: 118, fill: '#e9d9b6', opacity: 0.9 }, box);
      const defs = el('defs', {}, box);
      el('circle', { cx: -46, cy: 14, r: 27 }, el('clipPath', { id: 'logo-clip' }, defs));
      el('circle', { cx: -46, cy: 14, r: 30, fill: '#fff', stroke: INK, 'stroke-width': 3 }, box);
      el('image', { href: 'assets/logo-256.png', x: -73, y: -13, width: 54, height: 54, 'clip-path': 'url(#logo-clip)' }, box);
      const tx = el('text', { x: -8, y: 8, 'font-family': 'Inter', 'font-weight': '800', 'font-size': 11, fill: '#0b2a72' }, box);
      tx.textContent = 'ALBASSE';
      const tx2 = el('text', { x: -8, y: 22, 'font-family': 'Inter', 'font-weight': '800', 'font-size': 11, fill: '#0b2a72' }, box);
      tx2.textContent = 'SHOPPING';
      el('path', { d: 'M -8 34 h 60 M -8 44 h 42', stroke: '#8c6436', 'stroke-width': 4, 'stroke-linecap': 'round' }, box);
    }

    const mouthPath = (style, open) => {
      if (style === 'o') return { fill: 'M -13 -16 a 13 16 0 1 0 26 0 a 13 16 0 1 0 -26 0', line: null, teeth: false };
      if (style === 'smile' && open < 0.08) return { fill: null, line: 'M -26 0 q 26 26 52 0', teeth: false };
      if (style === 'flat' && open < 0.08) return { fill: null, line: 'M -16 2 q 16 -8 32 0', teeth: false };
      const o = style === 'laugh' ? Math.max(0.75, open) : open;
      const w = 24 + 16 * o, h = 8 + 44 * o;
      return { fill: `M ${-w} 0 Q 0 ${-h * 0.25} ${w} 0 Q 0 ${h * 1.15} ${-w} 0 Z`, line: null, teeth: o > 0.28 };
    };

    return {
      g: root,
      set(p) {
        root.setAttribute('transform', `translate(${p.x},${p.y}) scale(${p.s * (p.flip ? -1 : 1)},${p.s})`);
        body.setAttribute('transform', `translate(0,${p.bob || 0})`);
        for (const side of ['L', 'R']) {
          const lg = p[`leg${side}`], ar = p[`arm${side}`];
          legs[side].hip.setAttribute('transform', `translate(${legs[side].sx},-250) rotate(${lg.u})`);
          legs[side].knee.setAttribute('transform', `translate(0,124) rotate(${lg.l})`);
          arms[side].sh.setAttribute('transform', `translate(${arms[side].sx},-412) rotate(${ar.u})`);
          arms[side].elbow.setAttribute('transform', `translate(0,108) rotate(${ar.l})`);
        }
        head.setAttribute('transform', `rotate(${p.tilt} 0 -446) translate(0,${p.headDy || 0})`);
        brows.setAttribute('transform', `translate(0,${-14 * p.brow})`);
        const happyEyes = p.eye <= 0.05;
        eyeHappy.setAttribute('display', happyEyes ? '' : 'none');
        eyeOpen.setAttribute('display', happyEyes ? 'none' : '');
        const blink = p.blink ? 0.08 : 1;
        eyeOpen.setAttribute('transform', `translate(0,-538) scale(${Math.max(p.eye, 0.5)},${Math.max(p.eye, 0.5) * blink}) translate(0,538)`);
        const m = mouthPath(p.mouth, p.open || 0);
        mouthFill.setAttribute('d', m.fill || '');
        mouthFill.setAttribute('display', m.fill ? '' : 'none');
        mouthLine.setAttribute('d', m.line || '');
        mouthLine.setAttribute('display', m.line ? '' : 'none');
        teeth.setAttribute('display', m.teeth ? '' : 'none');
        if (box) box.setAttribute('display', p.box === false ? 'none' : '');
        if (phone) {
          phone.setAttribute('display', p.phone === false ? 'none' : '');
          phone.setAttribute('transform', `rotate(${-(p.armR.u + p.armR.l) - 12}) translate(-4,-26)`);
        }
      },
    };
  }

  // ------------------------------------------------------------------ la rue de N'Djamena
  function makeStreet(parent) {
    const g = el('g', { id: 'street' }, parent);
    const defs = el('defs', {}, g);
    const sky = el('linearGradient', { id: 'sky', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': '#ff9f5a' }, sky);
    el('stop', { offset: 0.55, 'stop-color': '#ffd79a' }, sky);
    el('stop', { offset: 1, 'stop-color': '#fff1d6' }, sky);
    el('rect', { x: 0, y: 0, width: W, height: 1500, fill: 'url(#sky)' }, g);
    el('circle', { cx: 180, cy: 260, r: 120, fill: '#fff3b0', opacity: 0.95 }, g);
    el('circle', { cx: 180, cy: 260, r: 170, fill: '#fff3b0', opacity: 0.35 }, g);
    // loin : silhouettes (mosquée, château d'eau, immeubles)
    const far = el('g', {}, g);
    const farShapes = (x0) => {
      const f = el('g', { transform: `translate(${x0},0)` }, far);
      const c = '#e3b48f';
      el('rect', { x: 0, y: 1120, width: 220, height: 380, fill: c }, f);
      el('rect', { x: 260, y: 1060, width: 160, height: 440, fill: c }, f);
      el('rect', { x: 470, y: 1000, width: 60, height: 500, fill: c }, f); // minaret
      el('circle', { cx: 500, cy: 990, r: 36, fill: c }, f);
      el('path', { d: 'M 560 1500 v -330 q 90 -110 180 0 v 330 z', fill: c }, f); // dôme
      el('rect', { x: 800, y: 1090, width: 140, height: 410, fill: c }, f);
      el('rect', { x: 1000, y: 1010, width: 110, height: 120, rx: 20, fill: c }, f); // château d'eau
      el('rect', { x: 1040, y: 1120, width: 30, height: 380, fill: c }, f);
      el('rect', { x: 1200, y: 1140, width: 300, height: 360, fill: c }, f);
      for (let i = 0; i < 18; i++) el('rect', { x: 20 + (i % 6) * 34 + (i > 11 ? 1200 : i > 5 ? 260 : 0), y: 1160 + Math.floor(i / 6) * 60, width: 16, height: 26, fill: '#f6d9bd' }, f);
    };
    farShapes(0); farShapes(1600);
    // près : les boutiques
    const near = el('g', {}, g);
    const shop = (x, w, color, label, awning) => {
      const s = el('g', { transform: `translate(${x},0)` }, near);
      el('rect', { x: 0, y: 1130, width: w, height: 380, fill: color, stroke: INK, 'stroke-width': 5 }, s);
      el('rect', { x: 0, y: 1130, width: w, height: 70, fill: '#fff', stroke: INK, 'stroke-width': 5 }, s);
      const t = el('text', { x: w / 2, y: 1180, 'text-anchor': 'middle', 'font-family': 'Inter Display, Inter', 'font-weight': '800', 'font-size': 38, fill: '#1b2b5a', 'letter-spacing': 2 }, s);
      t.textContent = label;
      // l'auvent rayé
      const aw = el('g', { transform: 'translate(0,1200)' }, s);
      for (let i = 0; i < Math.floor(w / 40); i++) el('path', { d: `M ${i * 40} 0 h 40 l -8 60 h -24 z`, fill: i % 2 ? '#fff' : awning, stroke: INK, 'stroke-width': 3 }, aw);
      el('rect', { x: w / 2 - 70, y: 1300, width: 140, height: 210, rx: 8, fill: '#3a2a1f', stroke: INK, 'stroke-width': 5 }, s); // porte
      el('rect', { x: 30, y: 1290, width: w / 2 - 120, height: 120, fill: '#bfe9ff', stroke: INK, 'stroke-width': 5 }, s); // vitrine
      el('rect', { x: w / 2 + 90, y: 1290, width: w / 2 - 120, height: 120, fill: '#bfe9ff', stroke: INK, 'stroke-width': 5 }, s);
    };
    const palm = (x) => {
      const p = el('g', { transform: `translate(${x},0)` }, near);
      el('path', { d: 'M -12 1510 q 10 -260 24 -400 l 20 0 q -14 140 -4 400 z', fill: '#8b5a2b', stroke: INK, 'stroke-width': 5 }, p);
      for (const a of [-70, -35, 0, 35, 70]) el('path', { d: 'M 20 1110 q 60 -40 150 0 q -70 -70 -150 0', fill: '#2e9e4f', stroke: INK, 'stroke-width': 4, transform: `rotate(${a} 20 1110)` }, p);
    };
    const row = (x0) => {
      shop(x0 + 0, 420, '#f5c15c', 'BOUTIQUE', '#e8735f');
      palm(x0 + 470);
      shop(x0 + 560, 460, '#6fb3d9', 'CHAUSSURES', '#1f5fd6');
      shop(x0 + 1080, 380, '#e8735f', 'PARFUMERIE', '#f5c15c');
      palm(x0 + 1520);
      shop(x0 + 1600, 440, '#8fcf9a', 'MARCHÉ', '#22b24c');
      shop(x0 + 2100, 400, '#f5c15c', 'BOUTIQUE', '#6fb3d9');
    };
    row(0); row(2560);
    // le sol : trottoir et route
    el('rect', { x: 0, y: 1500, width: W, height: 420, fill: '#d9a66e' }, g);
    el('rect', { x: 0, y: 1540, width: W, height: 380, fill: '#8a7f78' }, g);
    const dashes = el('g', {}, g);
    for (let i = 0; i < 14; i++) el('rect', { x: i * 160, y: 1720, width: 90, height: 12, rx: 6, fill: '#f4e6c8' }, dashes);
    // le taxi jaune
    const taxi = el('g', {}, g);
    el('rect', { x: -170, y: -140, width: 340, height: 90, rx: 24, fill: '#f6c614', stroke: INK, 'stroke-width': 6 }, taxi);
    el('path', { d: 'M -120 -140 l 30 -70 h 170 l 40 70 z', fill: '#f6c614', stroke: INK, 'stroke-width': 6 }, taxi);
    el('path', { d: 'M -100 -140 l 22 -52 h 60 v 52 z M 0 -192 h 70 l 30 52 h -100 z', fill: '#bfe9ff', stroke: INK, 'stroke-width': 4 }, taxi);
    el('rect', { x: -30, y: -214, width: 60, height: 24, rx: 6, fill: '#fff', stroke: INK, 'stroke-width': 4 }, taxi);
    const tt = el('text', { x: 0, y: -196, 'text-anchor': 'middle', 'font-family': 'Inter', 'font-weight': '800', 'font-size': 16, fill: INK }, taxi);
    tt.textContent = 'TAXI';
    for (const x of [-100, 100]) {
      el('circle', { cx: x, cy: -46, r: 34, fill: '#222', stroke: INK, 'stroke-width': 5 }, taxi);
      el('circle', { cx: x, cy: -46, r: 14, fill: '#ccc' }, taxi);
    }
    const dim = el('rect', { x: 0, y: 0, width: W, height: H, fill: '#050c23', opacity: 0 }, g);
    return {
      g, dim,
      set(offset, taxiX, dimA) {
        far.setAttribute('transform', `translate(${-((offset * 0.25) % 1600)},0)`);
        near.setAttribute('transform', `translate(${-((offset * 0.8) % 2560)},0)`);
        dashes.setAttribute('transform', `translate(${-(offset % 160)},0)`);
        taxi.setAttribute('transform', `translate(${taxiX},1700)`);
        taxi.setAttribute('display', taxiX < -400 || taxiX > W + 400 ? 'none' : '');
        dim.setAttribute('opacity', dimA);
      },
    };
  }

  // ------------------------------------------------------------------ l'écran du téléphone
  const QUERIES = ['Chaussures', 'Parfum', 'Chemise', 'Montre'];
  const QKEYS = ['chaussures', 'parfum', 'chemise', 'montre'];
  function phoneUI(products) {
    const q = document.getElementById('q'), caret = document.getElementById('caret'), ph = document.getElementById('ph'), grid = document.getElementById('grid');
    const pages = { home: document.getElementById('pg-home'), product: document.getElementById('pg-product'), form: document.getElementById('pg-form'), confirm: document.getElementById('pg-confirm') };
    const cursor = document.getElementById('cursor');
    const cards = [];
    for (let i = 0; i < 4; i++) {
      const c = document.createElement('div');
      c.className = 'card';
      c.innerHTML = '<div class="img"></div><div class="nm"></div><div class="pr"></div>';
      grid.appendChild(c);
      cards.push(c);
    }
    const chosen = products.chaussures[1] || products.chaussures[0];
    document.getElementById('pp-img').style.backgroundImage = `url(${chosen.image})`;
    document.getElementById('pp-nm').textContent = chosen.name;
    document.getElementById('pp-pr').textContent = fr(chosen.price);
    const show = (name) => { for (const [k, v] of Object.entries(pages)) v.style.display = k === name ? (k === 'confirm' ? 'flex' : 'block') : 'none'; };
    const typeInto = (id, text, k) => { document.getElementById(id).textContent = text.slice(0, Math.round(text.length * clamp(k, 0, 1))); };
    return {
      // la recherche : mot tapé (k lettres), résultats (progression 0..1 de l'apparition)
      search(word, typed, results, key) {
        show('home');
        cursor.style.display = 'none';
        const n = Math.min(word.length, typed);
        q.textContent = word.slice(0, n);
        ph.style.display = n > 0 ? 'none' : '';
        caret.style.display = '';
        caret.style.opacity = typed === Infinity ? 0 : 1;
        const list = key ? products[key] : [];
        cards.forEach((c, i) => {
          const p = list[i];
          if (!p || results <= 0) { c.style.display = 'none'; return; }
          c.style.display = '';
          const k = easeOutBack(clamp((results - i * 0.12) / 0.5, 0, 1));
          c.style.transform = `scale(${0.5 + 0.5 * k})`;
          c.style.opacity = clamp(k * 1.4, 0, 1);
          c.querySelector('.img').style.backgroundImage = `url(${p.image})`;
          c.querySelector('.nm').textContent = p.name;
          c.querySelector('.pr').textContent = fr(p.price);
        });
      },
      // le parcours de commande : étape et progression
      order(step, k) {
        caret.style.display = 'none';
        if (step === 'tap') {
          this.search('Chaussures', Infinity, 1, 'chaussures');
          caret.style.display = 'none';
          cursor.style.display = 'block';
          cursor.style.left = '640px'; cursor.style.top = '560px';
          cursor.style.transform = `scale(${1 - 0.3 * Math.sin(Math.PI * clamp(k, 0, 1))})`;
          cards[1].style.transform = `scale(${1 - 0.08 * Math.sin(Math.PI * clamp(k, 0, 1))})`;
        } else if (step === 'product') {
          show('product');
          cursor.style.display = 'block';
          cursor.style.left = '430px'; cursor.style.top = '1125px';
          cursor.style.opacity = k > 0.55 ? 1 : 0;
          const r = document.getElementById('rip1');
          const rk = clamp((k - 0.7) / 0.3, 0, 1);
          r.style.transform = `scale(${rk * 18})`; r.style.opacity = 1 - rk;
        } else if (step === 'form') {
          show('form');
          cursor.style.display = 'none';
          typeInto('f-nom', 'Votre nom', k * 4);
          typeInto('f-tel', 'Votre numéro', k * 4 - 1);
          typeInto('f-ville', "N'Djamena", k * 4 - 2);
          const r = document.getElementById('rip2');
          const rk = clamp((k - 0.85) / 0.15, 0, 1);
          r.style.transform = `scale(${rk * 18})`; r.style.opacity = 1 - rk;
        } else if (step === 'confirm') {
          show('confirm');
          cursor.style.display = 'none';
          const ck = easeOutBack(clamp(k / 0.35, 0, 1));
          document.getElementById('check').style.transform = `scale(${ck})`;
        }
      },
    };
  }

  // ------------------------------------------------------------------ montage
  let TL, PROD, street, chars, ui, confetti = [];
  const stage = document.getElementById('stage');
  const phoneEl = document.getElementById('phone'), banner = document.getElementById('banner'), wipe = document.getElementById('wipe');
  const sub = document.getElementById('sub'), subWho = document.getElementById('sub-who'), subTxt = document.getElementById('sub-txt');
  const WHO = { client: 'Client', ami: 'Ami', livreur: 'Livreur', voixoff: 'Voix off', tous: 'Tous' };
  const line = (id) => TL.lines.find((l) => l.id === id);
  const scene = (n) => TL.scenes[n - 1];

  // la bouche : ouverture 0..1 depuis l'enveloppe de la vraie voix (ou, sans voix, un rythme de parole simulé)
  function mouthOpen(l, t) {
    if (t < l.start || t > l.end) return 0;
    if (l.env) {
      const i = Math.floor((t - l.start) * 30);
      return clamp((l.env[i] ?? 0) * 1.25, 0, 1);
    }
    const idx = Math.floor((t - l.start) * 14.5);
    const ch = (l.text || 'hahaha hahaha')[idx] || ' ';
    if (ch === ' ' || ',.!?'.includes(ch)) return 0.08;
    return 0.35 + 0.45 * Math.abs(Math.sin((t - l.start) * 2 * Math.PI * 4.5));
  }
  const speaking = (who, t) => TL.lines.find((l) => (l.speaker === who || l.speaker === 'tous') && t >= l.start - 0.05 && t <= l.end + 0.05);
  const blinkAt = (i, t) => ((t * 1000 + i * 1370) % (3100 + i * 600)) < 110;

  // les sous-titres : une réplique longue est coupée en morceaux lisibles
  function chunks(text) {
    const safe = text.replace(/\.com/g, '\u2024com'); // « .com » n'est pas une fin de phrase
    const parts = (safe.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [safe]).map((s) => s.trim().replace(/\u2024/g, '.')).filter(Boolean);
    // une phrase trop longue est coupée au meilleur endroit (« et », virgule, « que », « dans »…), près du milieu
    const MAX = 64;
    const split = (p) => {
      if (p.length <= MAX) return [p];
      let best = -1, bestScore = -1;
      for (const sep of [', ', ' et ', ' que ', ' dans ', ' où ', ' pour ', ' sur ', ' ']) {
        let i = p.indexOf(sep, 20);
        while (i > 0 && i < p.length - 20) {
          const score = (sep === ' ' ? 0 : 60) - Math.abs(i - p.length / 2);
          if (score > bestScore) { bestScore = score; best = i + (sep === ', ' ? 1 : 0); }
          i = p.indexOf(sep, i + 1);
        }
      }
      if (best < 0) return [p];
      return [...split(p.slice(0, best).trim()), ...split(p.slice(best).trim())];
    };
    const out = [];
    let cur = '';
    for (const p of parts.flatMap(split)) {
      if ((cur + ' ' + p).trim().length > MAX && cur) { out.push(cur.trim()); cur = p; } else cur = (cur + ' ' + p).trim();
    }
    if (cur) out.push(cur);
    return out;
  }
  function subtitles(t, sc) {
    const l = TL.lines.find((l) => !l.laugh && t >= l.start - 0.05 && t <= l.end + 0.3);
    if (!l) { sub.style.display = 'none'; return; }
    const cs = chunks(l.text);
    const total = cs.reduce((a, c) => a + c.length, 0);
    let acc = 0, shown = cs[cs.length - 1];
    const k = clamp((t - l.start) / l.dur, 0, 0.999);
    for (const c of cs) { acc += c.length; if (k < acc / total) { shown = c; break; } }
    sub.style.display = 'block';
    sub.style.top = (sc === 6 ? 1235 : sc === 4 ? 1290 : sc === 3 ? 1640 : 1520) + 'px';
    subWho.textContent = WHO[l.speaker];
    subTxt.innerHTML = shown.replace(/Albasse ?Shopping(\.com)?/gi, (m) => `<b>${m}</b>`);
  }

  function seek(ms) {
    const t = ms / 1000;
    const s1 = scene(1), s2 = scene(2), s3 = scene(3), s4 = scene(4), s5 = scene(5), s6 = scene(6);
    const sc = t < s2.start ? 1 : t < s3.start ? 2 : t < s4.start ? 3 : t < s5.start ? 4 : t < s6.start ? 5 : 6;
    const C = TL.cues;
    const l1 = line('l1'), l2 = line('l2'), l3 = line('l3'), l4 = line('l4'), l5 = line('l5'), l6 = line('l6'), l7 = line('l7'), l8 = line('l8'), l9 = line('l9'), rire = line('rire'), vo = line('vo');

    // ----- la rue : visible scènes 1, 2, 5 (et le début de la 3)
    const streetOn = sc <= 2 || sc === 5 || (sc === 3 && t < s3.start + 0.7);
    street.g.setAttribute('display', streetOn ? '' : 'none');
    const walkEnd = l1.start - 0.35;
    const walked = clamp(t, 0, walkEnd) * 240;
    const taxiX = 1400 - seg(t, 0.2, 3.4) * 2100;
    const dimA = sc === 3 ? 0.75 * easeOut(seg(t, s3.start, s3.start + 0.5)) : 0;
    street.set(walked, sc === 1 ? taxiX : -9999, dimA);
    document.getElementById('root').style.background = sc === 4 ? '#071c52' : '#0b2a72';

    // ----- les personnages
    const CL = chars.client, AM = chars.ami, LV = chars.livreur;
    const walking = sc === 1 && t < walkEnd ? 1 - seg(t, walkEnd - 0.4, walkEnd) : 0;
    const ph = t * 2 * Math.PI * 1.9;
    const walkPose = (p, wk, phase) => {
      p.legR.u += 28 * Math.sin(phase) * wk; p.legL.u += -28 * Math.sin(phase) * wk;
      p.legR.l += 14 * Math.max(0, Math.sin(phase + 0.9)) * wk; p.legL.l -= 14 * Math.max(0, -Math.sin(phase + 0.9)) * wk;
      p.armR.u += 16 * Math.sin(phase) * wk; p.armL.u += 16 * Math.sin(phase) * wk;
      p.bob = -7 * Math.abs(Math.sin(phase)) * wk;
      return p;
    };
    const talk = (p, who, t) => {
      const l = speaking(who, t);
      if (l) { p.open = mouthOpen(l, t); if (p.mouth === 'smile' || p.mouth === 'flat' || p.mouth === 'o') p.mouth = l.laugh ? 'laugh' : 'talk'; }
      return p;
    };
    const idle = (p, i, t) => { p.tilt += 1.5 * Math.sin(t * 1.3 + i); p.blink = blinkAt(i, t); return p; };

    // pistes de poses (en secondes absolues)
    const clientTrack = [
      { t: 0, pose: 'stand' }, { t: walkEnd - 0.1, pose: 'think', dur: 0.5 }, { t: l1.start + l1.dur * 0.45, pose: 'explain', dur: 0.5 },
      { t: l2.start, pose: 'listen', dur: 0.5 }, { t: l3.start - 0.15, pose: 'surprise', dur: 0.35 }, { t: l3.end + 0.1, pose: 'listen', dur: 0.5 },
      { t: s4.start, pose: 'surprise', dur: 0.4 }, { t: l6.start + l6.dur * 0.5, pose: 'explain', dur: 0.4 }, { t: l7.start, pose: 'listen', dur: 0.5 },
      { t: s5.start, pose: 'listen' }, { t: C.bell, pose: 'surprise', dur: 0.35 }, { t: l9.start - 0.1, pose: 'happy', dur: 0.45 }, { t: rire.start, pose: 'laugh', dur: 0.3 },
      { t: s6.start, pose: 'wave' },
    ];
    const amiTrack = [
      { t: 0, pose: 'stand' }, { t: walkEnd - 0.1, pose: 'phone', dur: 0.5 }, { t: l1.start + l1.dur * 0.6, pose: 'listen', dur: 0.5 },
      { t: l2.start - 0.1, pose: 'present', dur: 0.4 }, { t: l3.start, pose: 'phone', dur: 0.4 }, { t: l4.start - 0.1, pose: 'point', dur: 0.4 },
      { t: s4.start, pose: 'point', dur: 0.4 }, { t: l7.start, pose: 'present', dur: 0.4 }, { t: l7.start + l7.dur * 0.5, pose: 'point', dur: 0.4 },
      { t: s5.start, pose: 'phone' }, { t: C.bell, pose: 'present', dur: 0.4 }, { t: rire.start, pose: 'laugh', dur: 0.3 },
      { t: s6.start, pose: 'phone' },
    ];
    const lvTrack = [{ t: 0, pose: 'box' }, { t: rire.start, pose: 'laugh', dur: 0.3 }, { t: s6.start, pose: 'waveBox' }];

    const laughBounce = (t) => (t >= rire.start && t <= rire.end + 0.2 ? -14 * Math.abs(Math.sin((t - rire.start) * 2 * Math.PI * 3.2)) : 0);
    const put = (ch, track, who, i, x, y, s, extra = {}, tweak = null) => {
      let p = { ...poseAt(track, t), x, y, s, flip: false, ...extra };
      p = { ...p, legL: { ...p.legL }, legR: { ...p.legR }, armL: { ...p.armL }, armR: { ...p.armR } };
      if (tweak) tweak(p);
      p.bob = (p.bob || 0) + laughBounce(t);
      talk(p, who, t); idle(p, i, t);
      if (p.mouth === 'laugh' && !speaking(who, t)) p.open = 0.5 + 0.3 * Math.abs(Math.sin(t * 20));
      ch.set(p);
      ch.g.setAttribute('display', p.hidden ? 'none' : '');
      return p;
    };
    const hideAll = () => { for (const c of Object.values(chars)) c.g.setAttribute('display', 'none'); };

    if (sc <= 2 || (sc === 3 && t < s3.start + 0.6)) {
      const fadeK = sc === 3 ? 1 - seg(t, s3.start, s3.start + 0.5) : 1;
      stage.style.opacity = 1;
      const pc = put(CL, clientTrack, 'client', 0, 330, 1500, 1);
      walkPose(pc, walking, ph); CL.set(pc);
      const pa = put(AM, amiTrack, 'ami', 1, 760, 1500, 1);
      walkPose(pa, walking, ph + Math.PI * 0.9); AM.set(pa);
      LV.g.setAttribute('display', 'none');
      CL.g.setAttribute('opacity', fadeK); AM.g.setAttribute('opacity', fadeK);
    } else if (sc === 3) {
      hideAll();
    } else if (sc === 4) {
      const rise = easeOutBack(seg(t, s4.start, s4.start + 0.6));
      CL.g.setAttribute('opacity', 1); AM.g.setAttribute('opacity', 1);
      put(CL, clientTrack, 'client', 0, 250, 1965 + (1 - rise) * 500, 0.78);
      put(AM, amiTrack, 'ami', 1, 830, 1965 + (1 - rise) * 500, 0.78);
      LV.g.setAttribute('display', 'none');
    } else if (sc === 5) {
      CL.g.setAttribute('opacity', 1); AM.g.setAttribute('opacity', 1); LV.g.setAttribute('opacity', 1);
      put(CL, clientTrack, 'client', 0, 230, 1500, 0.92);
      put(AM, amiTrack, 'ami', 1, 545, 1500, 0.92);
      const k = easeOut(seg(t, C.courier_in[0], C.courier_in[1]));
      const lp = put(LV, lvTrack, 'livreur', 2, 1300 - 440 * k, 1500, 0.92);
      const wk = k < 1 ? 1 : 0;
      walkPose(lp, wk, (t - C.courier_in[0]) * 2 * Math.PI * 2.2);
      LV.set(lp);
    } else {
      const rise = easeOutBack(seg(t, s6.start, s6.start + 0.7));
      const y = 1895 + (1 - rise) * 600;
      for (const c of Object.values(chars)) c.g.setAttribute('opacity', 1);
      const wave = (p, ph) => { p.armR = { u: -150 + 16 * Math.sin(t * 9 + ph), l: -10 - 16 * Math.sin(t * 9 + ph) }; return p; };
      put(CL, clientTrack, 'client', 0, 260, y, 0.64, {}, (p) => wave(p, 0));
      put(AM, amiTrack, 'ami', 1, 540, y, 0.64);
      put(LV, lvTrack, 'livreur', 2, 820, y, 0.64, {}, (p) => wave(p, 1.2));
    }

    // ----- le téléphone
    if (sc === 3 || sc === 4) {
      phoneEl.style.display = 'block';
      let sx = 1, px = 100, py = 140;
      if (sc === 3) {
        const k = easeInOut(seg(t, s3.start, s3.start + 0.65));
        sx = lerp(0.1, 1, k); px = lerp(736, 100, k); py = lerp(1088, 140, k);
        phoneEl.style.zIndex = 5;
      } else {
        const k = easeInOut(seg(t, s4.start, s4.start + 0.5));
        sx = lerp(1, 0.74, k); px = lerp(100, 215, k); py = lerp(140, 50, k);
        phoneEl.style.zIndex = 0;
      }
      phoneEl.style.transform = `translate(${px}px,${py}px) scale(${sx})`;
      if (t < C.tap_product) {
        let i = 3;
        while (i > 0 && C.type[i] > t) i--;
        if (t < C.type[0]) ui.search('', 0, 0, null);
        else {
          const t0 = C.type[i];
          const typed = Math.floor((t - t0) / 0.085);
          const res = t >= C.results[i] ? (t - C.results[i]) / 0.9 : 0;
          ui.search(QUERIES[i], typed, res, QKEYS[i]);
        }
      } else if (t < C.tap_product + 0.3) ui.order('tap', (t - C.tap_product) / 0.3);
      else if (t < C.tap_order + 0.35) ui.order('product', seg(t, C.tap_product + 0.3, C.tap_order + 0.35));
      else if (t < C.confirm) ui.order('form', seg(t, C.tap_order + 0.35, C.confirm));
      else ui.order('confirm', t - C.confirm);
    } else phoneEl.style.display = 'none';

    // ----- la bannière du final et les confettis
    banner.style.display = sc === 6 ? 'block' : 'none';
    for (const [i, c] of confetti.entries()) {
      if (sc !== 6) { c.setAttribute('display', 'none'); continue; }
      const age = (t - s6.start + i * 0.37) % 6;
      const x = ((i * 193) % W) + 40 * Math.sin(age * 2 + i);
      const y = -40 + age * (260 + (i % 5) * 50);
      c.setAttribute('display', y > H + 40 ? 'none' : '');
      c.setAttribute('transform', `translate(${x},${y}) rotate(${age * 240 + i * 40})`);
    }

    // ----- les volets dorés entre les scènes (4 → 5, 5 → 6)
    let wx = W;
    for (const ts of [s5.start, s6.start]) {
      const k = seg(t, ts - 0.3, ts + 0.3);
      if (k > 0 && k < 1) wx = lerp(W, -W, easeInOut(k));
    }
    wipe.style.left = wx + 'px';

    subtitles(t, sc);
  }

  // ------------------------------------------------------------------ chargement
  window.ready = (async () => {
    TL = window.TIMELINE; PROD = window.PRODUCTS; // timeline.js et assets/products.js (la page est ouverte en file://)
    window.TL = TL;
    street = makeStreet(stage);
    const layer = el('g', { id: 'chars' }, stage);
    chars = { client: makeStickman('client'), ami: makeStickman('ami'), livreur: makeStickman('livreur') };
    for (const c of Object.values(chars)) layer.appendChild(c.g);
    const cf = el('g', { id: 'confetti' }, stage);
    const colors = ['#f1c96b', '#fff', '#4ade80', '#ff6b8a', '#6fb3d9'];
    for (let i = 0; i < 34; i++) confetti.push(el('rect', { x: -9, y: -14, width: 18, height: 28, rx: 4, fill: colors[i % colors.length], display: 'none' }, cf));
    ui = phoneUI(PROD);
    // les images des articles doivent être chargées avant le rendu
    await Promise.all(Object.values(PROD).flat().map((p) => new Promise((res) => { const im = new Image(); im.onload = im.onerror = res; im.src = p.image; })));
    seek(0);
    return true;
  })();
  window.seek = seek;

  // les trois personnages côte à côte sur fond blanc (image de contrôle du design)
  window.lineup = () => {
    street.g.setAttribute('display', 'none');
    phoneEl.style.display = 'none'; banner.style.display = 'none'; sub.style.display = 'none'; wipe.style.left = W + 'px';
    document.getElementById('root').style.background = '#fff';
    const base = (pose, x) => ({ ...resolve(pose), x, y: 1300, s: 1.05, flip: false, open: 0 });
    chars.client.set(base('think', 200)); chars.ami.set({ ...base('present', 540), mouth: 'talk', open: 0.6 }); chars.livreur.set({ ...base('box', 880), mouth: 'talk', open: 0.5 });
    for (const c of Object.values(chars)) { c.g.setAttribute('display', ''); c.g.setAttribute('opacity', 1); }
  };
})();
