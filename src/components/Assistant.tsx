import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import { colors, fonts, radius } from '../theme';
import { navigationRef } from '../navigation/navigationRef';
import { useAssistantStore } from '../store/assistantStore';
import { useAuthStore } from '../store/authStore';
import { firstNameOfFullName } from '../lib/assistantBrain';
import { texts } from '../lib/assistantText';
import { AssistantPanel } from './AssistantPanel';

const AVATAR = require('../../assets/assistante-avatar.jpg');
const TEASER_DELAY_MS = 5000;
// Le client connecté est salué par son prénom 10 secondes après sa connexion (et non 5).
const MEMBER_TEASER_DELAY_MS = 10000;
const TEASER_DURATION_MS = 10000;
const TEASER_SEEN_KEY = 'albasse_assistant_teaser_seen';
const MEMBER_TEASER_SEEN_KEY = 'albasse_assistant_teaser_member_seen';
const SIZE = 62;
const PRODUCT_BAR_LIFT = 62;
// Le bouton est au milieu de l'ecran, un peu plus haut qu'avant, pour qu'on le voie tout de suite.
const FAB_BOTTOM = 136;
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
function FabButton({ bottom, label, onPress }: { bottom: number; label: string; onPress: () => void }) {
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
    <Pressable style={[styles.fabSlot, { bottom }]} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} testID="assistant-fab">
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

  const showTeaser = teaserVisible && !open && !teaserDismissed;
  // Sur la fiche produit, la barre « Commander / Ajouter au panier » est haute : le bouton passe au-dessus.
  const lift = routeName === 'Product' ? PRODUCT_BAR_LIFT : 0;
  const fabBottom = FAB_BOTTOM + lift;

  return (
    <>
      {open ? <AssistantPanel /> : null}
      {!open ? (
        <>
          {showTeaser ? (
            // la bulle est au-dessus du bouton, au milieu de l'ecran (le reste de la ligne laisse passer les touchers)
            <View style={[styles.teaserRow, { bottom: fabBottom + SIZE + TEASER_GAP }]} pointerEvents="box-none">
              <Pressable ref={teaserRef} style={styles.teaser} onPress={openChat} accessibilityRole="button" accessibilityLabel={t.openLabel}>
                <Text style={[styles.teaserText, rtl && styles.teaserTextRtl]}>{memberName ? t.teaserMember(memberName) : t.teaser(name)}</Text>
                <Pressable onPress={dismissTeaser} hitSlop={10} style={styles.teaserClose} accessibilityRole="button" accessibilityLabel={t.ui.closeTeaser}>
                  <Text style={styles.teaserCloseText}>✕</Text>
                </Pressable>
              </Pressable>
            </View>
          ) : null}
          <FabButton bottom={fabBottom} label={t.fabLabel} onPress={openChat} />
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  // la zone qui recoit le toucher : fixe, au milieu de l'ecran
  fabSlot: {
    position: 'absolute',
    left: '50%',
    marginLeft: -SIZE / 2,
    width: SIZE,
    height: SIZE,
    zIndex: 900,
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
