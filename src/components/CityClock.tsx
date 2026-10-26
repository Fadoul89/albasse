import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts } from '../theme';
import { CITY_CLOCK_SECONDS, CLOCK_CITIES, chadTime, clockSentence } from '../lib/cityClock';

const CHAD_YELLOW = '#FECB00';

// la plus longue ville : les cases ont la même taille pour toutes (les noms courts laissent juste de la place)
const MAX_LETTERS = Math.max(...CLOCK_CITIES.map((c) => c.length));
const TILE_GAP = 2;
const PIN_SPACE = 16;

// Heure locale au Tchad, en bandeau fin sous le cadre « SERVICE QUALITÉ GARANTIE » : 🕒 06:15 H | 📍 [N][ ' ][D]… (une ville toutes les 10 secondes,
// N'Djamena d'abord). Le nom de la ville est écrit dans des cases foncées de tableau d'affichage. L'heure vient de lib/cityClock
// (UTC+1, jamais l'heure du téléphone du client).
export function CityClock() {
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [cityWidth, setCityWidth] = useState(0);
  const { width: screenWidth } = useWindowDimensions();
  const showIcon = screenWidth >= 340; // sur un très petit téléphone, la place va aux cases de la ville

  // l'heure se relit chaque seconde (les minutes changent à l'heure juste)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const swap = useRef(new Animated.Value(1)).current; // 0 → 1 : les cases de la ville tombent l'une après l'autre
  const progress = useRef(new Animated.Value(0)).current; // 0 → 1 en 10 secondes : la barre qui se remplit
  const colon = useRef(new Animated.Value(0)).current;

  // à chaque nouvelle ville : cases qui apparaissent, barre de 10 secondes, puis la ville suivante
  useEffect(() => {
    swap.setValue(0);
    progress.setValue(0);
    Animated.timing(swap, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
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

  const [hh, mm] = chadTime(now).split(':');
  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const colonOpacity = colon.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] });

  // taille des cases : tout le nom (9 lettres au plus) doit tenir à droite de l'heure, même sur un petit téléphone
  const room = cityWidth - PIN_SPACE - TILE_GAP * (MAX_LETTERS - 1);
  const tileW = cityWidth > 0 ? Math.max(9, Math.min(17, Math.floor(room / MAX_LETTERS))) : 15;
  const tileH = Math.round(tileW * 1.5);
  const letterSize = Math.round(tileW * 0.95);
  const letters = Array.from(CLOCK_CITIES[index]);

  return (
    <View style={styles.outer} testID="city-clock">
      <View style={styles.pill} accessible accessibilityRole="timer" accessibilityLabel={`Heure locale : ${clockSentence(index, now)}`}>
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
        <View style={styles.cityBox} onLayout={(e: LayoutChangeEvent) => setCityWidth(e.nativeEvent.layout.width)}>
          <Text style={styles.pin}>📍</Text>
          <View style={styles.tiles} testID="city-clock-city">
            {letters.map((ch, i) => {
              const start = Math.min(0.5, i * 0.07);
              const range = [start, Math.min(1, start + 0.45)];
              const appear = {
                opacity: swap.interpolate({ inputRange: range, outputRange: [0, 1], extrapolate: 'clamp' }),
                transform: [{ translateY: swap.interpolate({ inputRange: range, outputRange: [-10, 0], extrapolate: 'clamp' }) }],
              };
              const narrow = ch === "'" || ch === '’';
              return (
                <Animated.View key={`${index}-${i}`} style={[styles.tile, { width: narrow ? Math.round(tileW * 0.55) : tileW, height: tileH }, appear]}>
                  <LinearGradient colors={['#1a2c63', '#1a2c63', '#0c1b4a', '#0c1b4a']} locations={[0, 0.5, 0.5, 1]} style={StyleSheet.absoluteFill} />
                  <View style={styles.tileLine} />
                  <Text style={[styles.letter, { fontSize: letterSize, lineHeight: tileH }]}>{ch}</Text>
                </Animated.View>
              );
            })}
          </View>
        </View>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: barWidth }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { alignSelf: 'stretch', alignItems: 'center', paddingHorizontal: 16, marginTop: 10 },
  pill: {
    width: '100%',
    maxWidth: 360,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: 18,
    backgroundColor: colors.panel,
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  icon: { fontSize: 13 },
  timeRow: { flexDirection: 'row', alignItems: 'baseline', flexShrink: 0 },
  digits: { fontFamily: fonts.displayBold, fontSize: 20, lineHeight: 24, color: colors.cream, fontVariant: ['tabular-nums'] },
  colon: { color: CHAD_YELLOW, marginHorizontal: 1 },
  hour: { fontFamily: fonts.displayBold, fontSize: 12, color: CHAD_YELLOW },
  sep: { width: 1, height: 16, backgroundColor: 'rgba(199, 154, 62, 0.6)' },
  cityBox: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  pin: { fontSize: 12 },
  tiles: { flexDirection: 'row', alignItems: 'center', gap: TILE_GAP },
  tile: {
    borderRadius: 3,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  tileLine: { position: 'absolute', left: 0, right: 0, top: '50%', height: 1, backgroundColor: '#02091f' },
  letter: { fontFamily: fonts.displayBold, color: colors.goldLight, textAlign: 'center' },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, backgroundColor: 'rgba(244, 239, 228, 0.15)' },
  fill: { height: 2, backgroundColor: CHAD_YELLOW },
});
