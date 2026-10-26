import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { CITY_CLOCK_SECONDS, CLOCK_CITIES, chadTime, clockSentence } from '../lib/cityClock';

const CHAD_YELLOW = '#FECB00';

// Heure locale au Tchad, affichée dans le bandeau d'accueil : une ville après l'autre, 10 secondes chacune (N'Djamena d'abord).
// L'heure vient de lib/cityClock (UTC+1, jamais l'heure du téléphone du client).
export function CityClock() {
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // l'heure se relit chaque seconde (les minutes changent à l'heure juste)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const swap = useRef(new Animated.Value(1)).current; // 0 → 1 : la ville et l'heure apparaissent
  const progress = useRef(new Animated.Value(0)).current; // 0 → 1 en 10 secondes : la barre qui se remplit
  const colon = useRef(new Animated.Value(0)).current;

  // à chaque nouvelle ville : apparition douce, barre de 10 secondes, puis la ville suivante
  useEffect(() => {
    swap.setValue(0);
    progress.setValue(0);
    Animated.timing(swap, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    Animated.timing(progress, { toValue: 1, duration: CITY_CLOCK_SECONDS * 1000, easing: Easing.linear, useNativeDriver: false }).start();
    const id = setTimeout(() => {
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

  const time = chadTime(now);
  const [hh, mm] = time.split(':');
  const appear = {
    opacity: swap.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1] }),
    transform: [{ translateY: swap.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  };
  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const colonOpacity = colon.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] });

  return (
    <View style={styles.outer} testID="city-clock">
      <View style={styles.card} accessible accessibilityRole="timer" accessibilityLabel={`Heure locale : ${clockSentence(index, now)}`}>
        <View style={styles.labelRow}>
          <Text style={styles.labelIcon}>🕒</Text>
          <Text style={styles.label}>HEURE LOCALE</Text>
        </View>

        <Animated.View style={[styles.timeRow, appear]}>
          <Text style={styles.digits} testID="city-clock-time">
            {hh}
          </Text>
          <Animated.Text style={[styles.digits, styles.colon, { opacity: colonOpacity }]}>:</Animated.Text>
          <Text style={styles.digits}>{mm}</Text>
          <Text style={styles.hour}> H</Text>
        </Animated.View>

        <Animated.View style={[styles.cityRow, appear]}>
          <Text style={styles.at}>à</Text>
          <Text style={styles.pin}>📍</Text>
          <Text style={styles.city} testID="city-clock-city" numberOfLines={1}>
            {CLOCK_CITIES[index]}
          </Text>
        </Animated.View>

        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: barWidth }]} />
        </View>

        <View style={styles.dots}>
          {CLOCK_CITIES.map((c, i) => (
            <View key={c} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { alignSelf: 'stretch', alignItems: 'center', paddingHorizontal: spacing.md, marginTop: spacing.md },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: radius.lg,
    backgroundColor: colors.panel,
    paddingTop: spacing.sm + 4,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    shadowColor: colors.gold,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  labelIcon: { fontSize: 14 },
  label: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.goldLight, letterSpacing: 3 },
  timeRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginTop: 4 },
  digits: { fontFamily: fonts.displayBold, fontSize: 52, lineHeight: 60, color: colors.cream, fontVariant: ['tabular-nums'] },
  colon: { color: CHAD_YELLOW, marginHorizontal: 2 },
  hour: { fontFamily: fonts.displayBold, fontSize: 26, color: CHAD_YELLOW },
  cityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, maxWidth: '100%' },
  at: { fontFamily: fonts.displayItalic, fontSize: 18, color: colors.creamMuted },
  pin: { fontSize: 18 },
  city: { fontFamily: fonts.displayBold, fontSize: 26, color: colors.goldLight, flexShrink: 1 },
  track: {
    alignSelf: 'stretch',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(244, 239, 228, 0.15)',
    overflow: 'hidden',
    marginTop: spacing.sm + 4,
  },
  fill: { height: 4, borderRadius: 2, backgroundColor: CHAD_YELLOW },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(244, 239, 228, 0.25)' },
  dotActive: { width: 18, backgroundColor: CHAD_YELLOW },
});
