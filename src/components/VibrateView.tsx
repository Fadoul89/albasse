// Mouvement « vibreur » d'un bouton (demande du patron, 15 novembre 2026) : le bouton tremble environ une demi-seconde, se repose, puis recommence.
// Seulement un déplacement visuel (rien ne vibre dans le téléphone). Aucune place prise dans la page : l'animation ne change pas la mise en page.
// Pas de mouvement pour les clients qui ont demandé « moins d'animations » (réglage du téléphone / du navigateur).
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, View, type StyleProp, type ViewStyle } from 'react-native';

export const VIBRATE_CYCLE_MS = 3000; // une secousse toutes les 3 secondes
export const VIBRATE_SHAKE_MS = 600; // la secousse dure 0,6 seconde
// déplacements (pixels) de la secousse, du début à la fin
export const VIBRATE_STEPS: readonly number[] = [0, -3, 3, -3, 3, -2.5, 2.5, -1.5, 1.5, 0];

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delayMs?: number; // décalage du départ (pour que deux boutons ne tremblent pas exactement ensemble)
  testID?: string;
}

export function VibrateView({ children, style, delayMs = 0, testID }: Props) {
  const ref = useRef<View>(null);
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS === 'web') {
      const el = ref.current as unknown as HTMLElement | null;
      if (!el || typeof el.animate !== 'function') return undefined;
      if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
      const shakeShare = VIBRATE_SHAKE_MS / VIBRATE_CYCLE_MS;
      const frames: Keyframe[] = VIBRATE_STEPS.map((px, i) => ({
        offset: (shakeShare * i) / (VIBRATE_STEPS.length - 1),
        transform: `translateX(${px}px) rotate(${px / 3}deg)`,
      }));
      frames.push({ offset: 1, transform: 'translateX(0px) rotate(0deg)' });
      const anim = el.animate(frames, { duration: VIBRATE_CYCLE_MS, iterations: Infinity, delay: delayMs });
      return () => anim.cancel();
    }
    const step = VIBRATE_SHAKE_MS / (VIBRATE_STEPS.length - 1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delayMs),
        ...VIBRATE_STEPS.slice(1).map((to) => Animated.timing(x, { toValue: to, duration: step, easing: Easing.linear, useNativeDriver: true })),
        Animated.delay(VIBRATE_CYCLE_MS - VIBRATE_SHAKE_MS),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [x, delayMs]);

  if (Platform.OS === 'web') {
    return (
      <View ref={ref} style={style} testID={testID}>
        {children}
      </View>
    );
  }
  return (
    <Animated.View style={[style, { transform: [{ translateX: x }] }]} testID={testID}>
      {children}
    </Animated.View>
  );
}
