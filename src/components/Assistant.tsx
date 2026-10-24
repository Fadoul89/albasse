import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Animated, Easing, PanResponder, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { colors, fonts, radius } from '../theme';
import { navigationRef } from '../navigation/navigationRef';
import { useAssistantStore } from '../store/assistantStore';
import { useAuthStore } from '../store/authStore';
import { firstNameOfFullName } from '../lib/assistantBrain';
import { texts } from '../lib/assistantText';
import { pushReminderNow } from '../lib/pushReminder';
import { AssistantPanel } from './AssistantPanel';
import { TAB_BAR_HEIGHT } from '../navigation/tabLayout';

const AVATAR = require('../../assets/assistante-avatar.jpg');
const TEASER_DELAY_MS = 5000;
// Le client connecté est salué par son prénom 10 secondes après sa connexion (et non 5).
const MEMBER_TEASER_DELAY_MS = 10000;
const TEASER_DURATION_MS = 10000;
const TEASER_SEEN_KEY = 'albasse_assistant_teaser_seen';
const MEMBER_TEASER_SEEN_KEY = 'albasse_assistant_teaser_member_seen';
const SIZE = 62;
const PRODUCT_BAR_LIFT = 62;
// Sur les pages avec la barre du bas (Accueil, Recherche, Commandes, Compte), le bouton est au milieu de la barre, dans l'espace ouvert
// entre « Recherche » et « Commandes », sur la meme ligne que les onglets (il ne depasse pas de la barre). Sur les autres pages, il reste dans le coin en bas a droite.
const TAB_ROUTES = new Set(['Home', 'Search', 'Orders', 'Account']);
const NAV_SLOT_BOTTOM = 8; // 62 px de haut : de 8 a 70 px du bas, dans la barre de 78 px
const CORNER_EDGE = 14;
const TEASER_GAP = 12;
const GOLD_RGB = '212,175,55';
// Vibration : un petit tremblement (environ 0,7 s) toutes les 4,2 s ; lumiere : deux halos dores qui s'etendent et s'effacent, l'un apres l'autre.
const SHAKE_CYCLE_MS = 4200;
const SHAKE_STEPS: Array<[number, number, number]> = [
  // [moment du cycle (0 a 1), rotation en degres, echelle]
  [0, 0, 1],
  [0.02, -14, 1.1],
  [0.04, 14, 1.1],
  [0.06, -12, 1.1],
  [0.08, 12, 1.1],
  [0.1, -8, 1.06],
  [0.12, 8, 1.06],
  [0.14, -4, 1.03],
  [0.16, 0, 1],
  [1, 0, 1],
];
const RING_MS = 2400;
// Le visiteur peut deplacer le bouton (appuyer et glisser) ; il reste dans l'ecran, au-dessus de la barre du bas, et retient sa place.
const FAB_EDGE = 8; // marge a gauche et a droite
const FAB_MIN_BOTTOM = 82; // sur les pages sans barre du bas : le bouton ne descend pas plus bas
const SNAP_HOME_MARGIN = 12; // lache dans la barre du bas (ou juste au-dessus) : le bouton revient dans l'espace du milieu
const FAB_TOP_MARGIN = 56; // marge en haut
const DRAG_THRESHOLD = 8; // en dessous, c'est un simple toucher (ouvre Zara)
const POST_DRAG_MS = 350; // juste apres un glissement, le « clic » du navigateur est ignore
const FAB_POS_KEY = 'albasse_zara_fab_pos';

// Place choisie par le visiteur : dx = decalage par rapport au milieu de l'ecran (a droite +, a gauche -), b = distance du bas, en pixels.
// Pas de place choisie (null) : le bouton est a sa place d'origine.
interface FabSpot {
  dx: number;
  b: number;
}
let memorySpot: FabSpot | null = null; // application : garde la place pendant la visite
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function loadFabSpot(): FabSpot | null {
  if (Platform.OS !== 'web') return memorySpot;
  try {
    const v = JSON.parse(window.localStorage.getItem(FAB_POS_KEY) ?? 'null');
    if (v && Number.isFinite(v.dx) && Number.isFinite(v.b)) return { dx: Math.round(v.dx), b: Math.round(v.b) };
  } catch {
    // pas de memoire possible : le bouton reprend sa place d'origine
  }
  return null;
}

function saveFabSpot(spot: FabSpot | null) {
  memorySpot = spot;
  if (Platform.OS !== 'web') return;
  try {
    if (spot) window.localStorage.setItem(FAB_POS_KEY, JSON.stringify(spot));
    else window.localStorage.removeItem(FAB_POS_KEY);
  } catch {
    // ignore : le bouton reprendra sa place d'origine a la prochaine visite
  }
}

interface FabBounds {
  minDx: number;
  maxDx: number;
  minBottom: number;
  maxBottom: number;
}

// Nom de l'ecran affiche : le bouton est cache sur les pages d'administration (il couvrait les chiffres).
function useCurrentRouteName() {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    const update = () => setName(navigationRef.isReady() ? (navigationRef.getCurrentRoute()?.name ?? null) : null);
    update();
    const unsubscribe = navigationRef.addListener('state', update);
    const wait = setInterval(() => {
      if (navigationRef.isReady()) {
        update();
        clearInterval(wait);
      }
    }, 150);
    return () => {
      unsubscribe();
      clearInterval(wait);
    };
  }, []);
  return name;
}

function teaserAlreadySeen(key: string) {
  if (Platform.OS !== 'web') return false;
  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

// Le bouton rond de Zara : il vibre de temps en temps et rayonne d'une lumiere doree pour qu'on le remarque.
// Web : animations du navigateur (peu de batterie, rien ne tourne quand l'onglet est cache). Application : Animated.
// Pour les personnes qui ont demande moins d'animations : le bouton reste immobile avec une lueur fixe.
// Le bouton qui recoit le toucher ne bouge jamais (seule sa photo vibre) : on peut toujours le toucher.
function FabButton({
  bottom,
  dx,
  bounds,
  label,
  onPress,
  onMoved,
  onDragging,
}: {
  bottom: number;
  dx: number;
  bounds: FabBounds;
  label: string;
  onPress: () => void;
  onMoved: (dx: number, bottom: number) => void;
  onDragging: (dragging: boolean) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const lastDragAt = useRef(0);
  // le petit trajet fait avant que le geste soit repris ici (le suivi repart de zero a ce moment-la) : on le rajoute pour que le bouton reste sous le doigt
  const headStart = useRef({ x: 0, y: 0 });
  // les dernieres valeurs, lues par le geste (cree une seule fois)
  const live = useRef({ bottom, dx, bounds, onMoved, onDragging });
  live.current = { bottom, dx, bounds, onMoved, onDragging };
  const delta = (g: { dx: number; dy: number }) => {
    const { bottom: b, dx: x, bounds: bd } = live.current;
    return {
      x: clamp(g.dx + headStart.current.x, bd.minDx - x, bd.maxDx - x),
      y: clamp(g.dy + headStart.current.y, b - bd.maxBottom, b - bd.minBottom),
    };
  };
  const responder = useRef(
    PanResponder.create({
      // un simple toucher reste au bouton ; au-dela de quelques pixels de glissement, le geste est repris ici
      onMoveShouldSetPanResponderCapture: (_e, g) => {
        if (Math.hypot(g.dx, g.dy) <= DRAG_THRESHOLD) return false;
        headStart.current = { x: g.dx, y: g.dy };
        return true;
      },
      onPanResponderGrant: () => {
        setDragging(true);
        live.current.onDragging(true);
      },
      onPanResponderMove: (_e, g) => pan.setValue(delta(g)),
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_e, g) => finish(g),
      onPanResponderTerminate: (_e, g) => finish(g),
    })
  ).current;
  function finish(g: { dx: number; dy: number }) {
    const d = delta(g);
    lastDragAt.current = Date.now();
    setDragging(false);
    live.current.onDragging(false);
    live.current.onMoved(live.current.dx + d.x, live.current.bottom - d.y);
  }
  // la nouvelle place est prise en compte : le deplacement temporaire repart a zero (sans saut a l'ecran)
  useLayoutEffect(() => {
    pan.setValue({ x: 0, y: 0 });
  }, [dx, bottom, pan]);
  // juste apres un glissement, le navigateur envoie un « clic » : il ne doit pas ouvrir Zara
  const press = () => {
    if (Date.now() - lastDragAt.current < POST_DRAG_MS) return;
    onPress();
  };

  // Web : le glissement utilise les evenements « pointeur » du navigateur (souris et doigt), plus fiables ici que le systeme de gestes de la page.
  // Le navigateur ne doit pas « emporter » la photo comme une image glissee (il couperait le geste), ni selectionner du texte.
  const dragRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = dragRef.current as unknown as HTMLElement | null;
    if (!el?.addEventListener) return;
    let start: { x: number; y: number; id: number } | null = null;
    let last = { dx: 0, dy: 0 };
    let moving = false;
    // pendant qu'un doigt ou la souris est appuye, on suit toute la page (et non le seul bouton) : un geste rapide quitte le bouton des le premier mouvement
    const onMove = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      last = { dx: e.clientX - start.x, dy: e.clientY - start.y };
      if (!moving) {
        // un simple toucher (moins de quelques pixels) reste un toucher
        if (Math.hypot(last.dx, last.dy) <= DRAG_THRESHOLD) return;
        moving = true;
        headStart.current = { x: 0, y: 0 };
        setDragging(true);
        live.current.onDragging(true);
      }
      pan.setValue(delta(last));
    };
    const onEnd = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      const wasMoving = moving;
      start = null;
      moving = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      if (wasMoving) finish(last);
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
      last = { dx: 0, dy: 0 };
      moving = false;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onEnd);
      window.addEventListener('pointercancel', onEnd);
    };
    // juste apres un glissement, le « clic » du navigateur ne doit pas ouvrir Zara
    const onClick = (e: MouseEvent) => {
      if (Date.now() - lastDragAt.current < POST_DRAG_MS) {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    const noDrag = (e: Event) => e.preventDefault();
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('click', onClick, true);
    el.addEventListener('dragstart', noDrag);
    el.addEventListener('selectstart', noDrag);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      el.removeEventListener('click', onClick, true);
      el.removeEventListener('dragstart', noDrag);
      el.removeEventListener('selectstart', noDrag);
    };
  }, []);

  const shakeRef = useRef<View>(null);
  const ring1Ref = useRef<View>(null);
  const ring2Ref = useRef<View>(null);
  const shake = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS === 'web') {
      const shaker = shakeRef.current as unknown as HTMLElement | null;
      const r1 = ring1Ref.current as unknown as HTMLElement | null;
      const r2 = ring2Ref.current as unknown as HTMLElement | null;
      if (!shaker || typeof shaker.animate !== 'function') return;
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      const animations: Animation[] = [];
      animations.push(
        shaker.animate(
          SHAKE_STEPS.map(([offset, deg, scale]) => ({ offset, transform: `rotate(${deg}deg) scale(${scale})` })),
          { duration: SHAKE_CYCLE_MS, iterations: Infinity }
        )
      );
      // la lueur de la photo respire
      animations.push(
        shaker.animate(
          [
            { boxShadow: `0 0 8px 1px rgba(${GOLD_RGB},.55)` },
            { boxShadow: `0 0 20px 6px rgba(${GOLD_RGB},.95)` },
          ],
          { duration: 1500, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }
        )
      );
      [r1, r2].forEach((ring, i) => {
        if (!ring) return;
        animations.push(
          ring.animate(
            [
              { transform: 'scale(1)', opacity: 0.6 },
              { transform: 'scale(2)', opacity: 0 },
            ],
            { duration: RING_MS, iterations: Infinity, delay: i * (RING_MS / 2), easing: 'ease-out', fill: 'backwards' }
          )
        );
      });
      return () => animations.forEach((a) => a.cancel());
    }
    const loops: Animated.CompositeAnimation[] = [];
    const run = (steps: Animated.CompositeAnimation[]) => {
      const loop = Animated.loop(Animated.sequence(steps));
      loops.push(loop);
      loop.start();
    };
    run([
      ...[1, -1, 1, -1, 0.6, -0.6, 0].map((to) => Animated.timing(shake, { toValue: to, duration: 55, easing: Easing.linear, useNativeDriver: true })),
      Animated.delay(SHAKE_CYCLE_MS - 7 * 55),
    ]);
    [ring1, ring2].forEach((ring, i) =>
      run([
        Animated.delay(i * (RING_MS / 2)),
        Animated.timing(ring, { toValue: 1, duration: RING_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(ring, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(RING_MS / 2 - i * (RING_MS / 2)),
      ])
    );
    return () => loops.forEach((l) => l.stop());
  }, [shake, ring1, ring2]);

  const nativeShake = {
    transform: [
      { rotate: shake.interpolate({ inputRange: [-1, 1], outputRange: ['-14deg', '14deg'] }) },
      { scale: shake.interpolate({ inputRange: [-1, 0, 1], outputRange: [1.1, 1, 1.1] }) },
    ],
  };
  const nativeRing = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }) }],
  });
  const web = Platform.OS === 'web';

  return (
    <Animated.View
      ref={dragRef}
      {...(web ? {} : responder.panHandlers)}
      style={[
        styles.fabDrag,
        { bottom, marginLeft: -SIZE / 2 + dx, transform: [...pan.getTranslateTransform(), { scale: dragging ? 1.12 : 1 }] },
        web && ({ touchAction: 'none', userSelect: 'none', cursor: dragging ? 'grabbing' : 'grab' } as object),
      ]}
    >
      <Pressable style={styles.fabSlot} onPress={press} accessibilityRole="button" accessibilityLabel={label} testID="assistant-fab">
        {web ? (
          <>
            <View ref={ring1Ref} pointerEvents="none" style={[styles.ring, styles.ringHidden]} />
            <View ref={ring2Ref} pointerEvents="none" style={[styles.ring, styles.ringHidden]} />
            <View ref={shakeRef} style={styles.fab}>
              <Image source={AVATAR} style={styles.avatar} contentFit="cover" />
              <View style={styles.dot} />
            </View>
          </>
        ) : (
          <>
            <Animated.View pointerEvents="none" style={[styles.ring, nativeRing(ring1)]} />
            <Animated.View pointerEvents="none" style={[styles.ring, nativeRing(ring2)]} />
            <Animated.View style={[styles.fab, nativeShake]}>
              <Image source={AVATAR} style={styles.avatar} contentFit="cover" />
              <View style={styles.dot} />
            </Animated.View>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

// Bouton rond avec le visage de Zara Kings (remplace l'ancien bouton WhatsApp), une bulle de
// bienvenue une seule fois par visite, et la fenetre de chat.
export function Assistant() {
  const open = useAssistantStore((s) => s.open);
  const openChat = useAssistantStore((s) => s.openChat);
  const teaserDismissed = useAssistantStore((s) => s.teaserDismissed);
  const dismissTeaser = useAssistantStore((s) => s.dismissTeaser);
  const savedName = useAssistantStore((s) => s.name);
  const lang = useAssistantStore((s) => s.lang);
  // Client connecté : reconnu à son prénom, il est reçu avec honneur dès la bulle de bienvenue.
  const memberName = useAuthStore((s) => (s.isAuthenticated ? firstNameOfFullName(s.profile?.full_name) : null));
  const name = memberName ?? savedName;
  const routeName = useCurrentRouteName();
  const [teaserVisible, setTeaserVisible] = useState(false);
  // installé sans notifications : la bulle rappelle de les activer (toucher la bulle ouvre Zara, qui propose le bouton)
  const [pushDue] = useState(() => pushReminderNow() === 'ask');
  // téléphone sans l'application (et pas « Plus tard ») : la bulle invite à l'installer
  const [installDue] = useState(() => !pushDue && useAssistantStore.getState().installInviteDue());
  const openFor = useAssistantStore((s) => s.openFor);
  const { width: winW, height: winH } = useWindowDimensions();
  const [spot, setSpot] = useState<FabSpot | null>(loadFabSpot);
  const [dragging, setDragging] = useState(false);
  const t = texts(lang);
  const rtl = lang === 'ar';
  const teaserRef = useRef<View>(null);

  // Le traducteur automatique de Google ne doit pas traduire la bulle : elle suit déjà la langue de Zara.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = teaserRef.current as unknown as HTMLElement | null;
    if (!el?.setAttribute) return;
    el.setAttribute('translate', 'no');
    el.classList.add('notranslate');
  });

  // Un client qui se connecte pendant la visite a droit à sa propre salutation (par son prénom), même si la bulle des visiteurs est déjà passée.
  const isMember = !!memberName;
  useEffect(() => {
    const seenKey = isMember ? MEMBER_TEASER_SEEN_KEY : TEASER_SEEN_KEY;
    if (open || teaserDismissed || teaserAlreadySeen(seenKey)) return;
    const delay = isMember ? MEMBER_TEASER_DELAY_MS : TEASER_DELAY_MS;
    const show = setTimeout(() => {
      setTeaserVisible(true);
      if (Platform.OS === 'web') {
        try {
          window.sessionStorage.setItem(seenKey, '1');
        } catch {
          // ignore : la bulle pourra revenir a la prochaine visite
        }
      }
    }, delay);
    const hide = setTimeout(() => setTeaserVisible(false), delay + TEASER_DURATION_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [open, teaserDismissed, isMember]);

  if (routeName?.startsWith('Admin')) return null;

  const showTeaser = teaserVisible && !open && !teaserDismissed && !dragging;
  // Sur la fiche produit, la barre « Commander » est haute : le bouton passe au-dessus.
  const lift = routeName === 'Product' ? PRODUCT_BAR_LIFT : 0;
  // Place du bouton : sa place d'origine (dans l'espace du milieu de la barre du bas, ou dans le coin sans barre), ou celle choisie par le visiteur,
  // toujours dans l'ecran. Sur les pages avec la barre, il ne reste pas pose sur les onglets : lache dessus, il revient dans l'espace du milieu.
  const hasTabBar = routeName == null || TAB_ROUTES.has(routeName);
  const maxDx = Math.max(0, winW / 2 - SIZE / 2 - FAB_EDGE);
  const minBottom = hasTabBar ? NAV_SLOT_BOTTOM : FAB_MIN_BOTTOM + lift;
  const minFree = hasTabBar ? TAB_BAR_HEIGHT + SNAP_HOME_MARGIN : FAB_MIN_BOTTOM + lift;
  const maxBottom = Math.max(minFree, winH - SIZE - FAB_TOP_MARGIN);
  const home = hasTabBar
    ? { dx: 0, bottom: NAV_SLOT_BOTTOM }
    : { dx: Math.max(0, winW / 2 - SIZE / 2 - CORNER_EDGE), bottom: FAB_MIN_BOTTOM + lift };
  const fabDx = spot ? clamp(spot.dx, -maxDx, maxDx) : home.dx;
  const fabBottom = spot ? clamp(spot.b, minFree, maxBottom) : home.bottom;
  const moved = (nextDx: number, nextBottom: number) => {
    // lache dans la barre du bas : retour a la place d'origine
    const next = hasTabBar && nextBottom < TAB_BAR_HEIGHT + SNAP_HOME_MARGIN ? null : { dx: Math.round(nextDx), b: Math.round(nextBottom) };
    setSpot(next);
    saveFabSpot(next);
  };
  // La bulle suit le bouton : au-dessus (ou en dessous s'il est tout en haut), sans sortir de l'ecran.
  const bubbleMaxW = Math.min(250, winW - 2 * FAB_EDGE);
  const bubbleShift = clamp(fabDx, -Math.max(0, winW / 2 - bubbleMaxW / 2 - FAB_EDGE), Math.max(0, winW / 2 - bubbleMaxW / 2 - FAB_EDGE));
  const fabTop = winH - fabBottom - SIZE;
  const bubbleBelow = fabTop < 150;

  return (
    <>
      {open ? <AssistantPanel /> : null}
      {!open ? (
        <>
          {showTeaser ? (
            // la bulle est au-dessus du bouton, au milieu de l'ecran (le reste de la ligne laisse passer les touchers)
            <View
              style={[styles.teaserRow, bubbleBelow ? { top: fabTop + SIZE + TEASER_GAP } : { bottom: fabBottom + SIZE + TEASER_GAP }, { transform: [{ translateX: bubbleShift }] }]}
              pointerEvents="box-none"
            >
              <Pressable
                ref={teaserRef}
                style={styles.teaser}
                onPress={pushDue ? () => openFor('push') : installDue ? () => openFor('install') : openChat}
                accessibilityRole="button"
                accessibilityLabel={t.openLabel}
                testID="assistant-teaser"
              >
                <Text style={[styles.teaserText, rtl && styles.teaserTextRtl]}>
                  {pushDue ? t.teaserPush(name) : installDue ? t.teaserInstall(name) : memberName ? t.teaserMember(memberName) : t.teaser(name)}
                </Text>
                <Pressable onPress={dismissTeaser} hitSlop={10} style={styles.teaserClose} accessibilityRole="button" accessibilityLabel={t.ui.closeTeaser}>
                  <Text style={styles.teaserCloseText}>✕</Text>
                </Pressable>
              </Pressable>
            </View>
          ) : null}
          <FabButton
            bottom={fabBottom}
            dx={fabDx}
            bounds={{ minDx: -maxDx, maxDx, minBottom, maxBottom: Math.max(minBottom, maxBottom) }}
            label={t.fabLabel}
            onPress={openChat}
            onMoved={moved}
            onDragging={setDragging}
          />
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  // l'enveloppe qu'on deplace en glissant : au milieu de l'ecran au depart
  fabDrag: {
    position: 'absolute',
    left: '50%',
    width: SIZE,
    height: SIZE,
    zIndex: 900,
  },
  // la zone qui recoit le toucher : elle ne bouge pas dans son enveloppe
  fabSlot: {
    width: SIZE,
    height: SIZE,
  },
  // la photo ronde (c'est elle qui vibre et qui brille)
  fab: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2.5,
    borderColor: colors.gold,
    backgroundColor: colors.panel,
    padding: 1.5,
    shadowColor: colors.gold,
    shadowOpacity: 0.75,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  // les halos dores qui s'etendent autour du bouton
  ring: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: `rgba(${GOLD_RGB},0.55)`,
  },
  ringHidden: { opacity: 0 },
  avatar: { width: '100%', height: '100%', borderRadius: SIZE / 2 },
  dot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#3ddc84',
    borderWidth: 2.5,
    borderColor: colors.background,
  },
  teaserRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 900,
  },
  teaser: {
    maxWidth: 250,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  teaserText: { flex: 1, color: '#1b1405', fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 18 },
  teaserTextRtl: { writingDirection: 'rtl', textAlign: 'right' },
  teaserClose: { paddingHorizontal: 4, paddingVertical: 1 },
  teaserCloseText: { color: 'rgba(27,20,5,0.55)', fontSize: 12 },
});
