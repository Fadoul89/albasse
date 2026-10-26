import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, type LayoutChangeEvent } from 'react-native';
import { colors, fonts, radius } from '../theme';
import { CITY_CLOCK_SECONDS, CLOCK_CITIES, chadTime, clockSentence } from '../lib/cityClock';

const CHAD_YELLOW = '#FECB00';
const SLIDE = 36; // de combien les noms glissent (en px) quand la ville change
const MAX_LETTERS = Math.max(...CLOCK_CITIES.map((c) => c.length));

// Heure locale au Tchad, sous le cadre « SERVICE QUALITÉ GARANTIE » et exactement de sa largeur (`width`, mesurée sur le cadre) :
// 🕒 06:15 H | 📍 N'DJAMENA. Toutes les 10 secondes, le nom de la ville glisse tout seul vers la suivante (N'Djamena d'abord).
// Même écriture que le cadre (Manrope gras, majuscules). L'heure vient de lib/cityClock (UTC+1, jamais l'heure du téléphone du client).
export function CityClock({ width }: { width?: number }) {
  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [slotWidth, setSlotWidth] = useState(0);

  // l'heure se relit chaque seconde (les minutes changent à l'heure juste)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const swap = useRef(new Animated.Value(1)).current; // 0 → 1 : l'ancien nom sort à gauche, le nouveau arrive de la droite
  const progress = useRef(new Animated.Value(0)).current; // 0 → 1 en 10 secondes : la barre qui se remplit
  const colon = useRef(new Animated.Value(0)).current;
  const first = useRef(true);

  // à chaque nouvelle ville : le nom glisse, la barre de 10 secondes repart, puis la ville suivante
  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: CITY_CLOCK_SECONDS * 1000, easing: Easing.linear, useNativeDriver: false }).start();
    if (first.current) first.current = false;
    else {
      swap.setValue(0);
      Animated.timing(swap, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(({ finished }) => {
        if (finished) setPrev(null);
      });
    }
    const id = setTimeout(() => {
      setPrev(index);
      setIndex((i) => (i + 1) % CLOCK_CITIES.length);
      setNow(Date.now());
    }, CITY_CLOCK_SECONDS * 1000);
    return () => clearTimeout(id);
  }, [index]);

  // les deux points de l'heure clignotent
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(colon, { toValue: 1, duration: 500, useNativeDriver: false }),
        Animated.timing(colon, { toValue: 0, duration: 500, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const [hh, mm] = chadTime(now).split(':');
  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const colonOpacity = colon.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] });

  // taille des lettres : le plus long nom (9 lettres) doit tenir dans la place à droite de l'heure
  const citySize = slotWidth > 0 ? Math.max(11, Math.min(16, Math.floor(slotWidth / (MAX_LETTERS * 0.78)))) : 15;
  const cityStyle = [styles.city, { fontSize: citySize }];
  const slideIn = { opacity: swap, transform: [{ translateX: swap.interpolate({ inputRange: [0, 1], outputRange: [SLIDE, 0] }) }] };
  const slideOut = { opacity: swap.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ translateX: swap.interpolate({ inputRange: [0, 1], outputRange: [0, -SLIDE] }) }] };
  const pillWidth = width && width > 0 ? width : 255;
  const showIcon = pillWidth >= 230;

  return (
    <View style={styles.outer} testID="city-clock">
      <View style={[styles.pill, { width: pillWidth }]} accessible accessibilityRole="timer" accessibilityLabel={`Heure locale : ${clockSentence(index, now)}`}>
        {showIcon && <Text style={styles.icon}>🕒</Text>}
        <View style={styles.timeRow}>
          <Text style={styles.digits} testID="city-clock-time">
            {hh}
          </Text>
          <Animated.Text style={[styles.digits, styles.colon, { opacity: colonOpacity }]}>:</Animated.Text>
          <Text style={styles.digits}>{mm}</Text>
          <Text style={styles.hour}> H</Text>
        </View>
        <View style={styles.sep} />
        <Text style={styles.pin}>📍</Text>
        <View style={styles.slot} testID="city-clock-slot" onLayout={(e: LayoutChangeEvent) => setSlotWidth(e.nativeEvent.layout.width)}>
          {prev !== null && (
            <Animated.Text style={[cityStyle, styles.layer, slideOut]} numberOfLines={1}>
              {CLOCK_CITIES[prev]}
            </Animated.Text>
          )}
          <Animated.Text style={[cityStyle, prev !== null ? styles.layer : null, prev !== null ? slideIn : null]} numberOfLines={1} testID="city-clock-city">
            {CLOCK_CITIES[index]}
          </Animated.Text>
        </View>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: barWidth }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { alignSelf: 'stretch', alignItems: 'center', marginTop: 8 },
  pill: {
    height: 38,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    overflow: 'hidden',
  },
  icon: { fontSize: 13 },
  timeRow: { flexDirection: 'row', alignItems: 'baseline', flexShrink: 0 },
  digits: { fontFamily: fonts.bodyBold, fontSize: 18, lineHeight: 22, letterSpacing: 0.5, color: colors.cream, fontVariant: ['tabular-nums'] },
  colon: { color: CHAD_YELLOW, marginHorizontal: 1 },
  hour: { fontFamily: fonts.bodyBold, fontSize: 12, color: CHAD_YELLOW },
  sep: { width: 1, height: 18, backgroundColor: 'rgba(199, 154, 62, 0.6)' },
  pin: { fontSize: 12 },
  // le nom de la ville : une place à droite de l'heure, découpée pour que les noms glissent sans déborder
  slot: { flex: 1, minWidth: 0, height: 22, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  layer: { position: 'absolute' },
  city: {
    fontFamily: fonts.bodyBold,
    color: CHAD_YELLOW,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
    textShadowColor: CHAD_YELLOW,
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 0 },
  },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, backgroundColor: 'rgba(244, 239, 228, 0.15)' },
  fill: { height: 2, backgroundColor: CHAD_YELLOW },
});
