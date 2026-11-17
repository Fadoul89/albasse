import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, Linking, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import { colors, radius } from '../theme';
import type { AdItem } from '../types';

const ROTATE_MS = 4500;
const TRANSITION_MS = 700;
const NEON_PURPLE = '#C400FF';
const VISIBLE_COUNT = 3;

// Les images changent par « page » : les 3 images de la bande sont remplacées toutes ensemble par les 3 suivantes.
// La page se calcule sur l'horloge (même ROTATE_MS pour toutes les bandes) : les deux bandes de l'accueil
// changent donc au même moment, et les 6 images sont remplacées par 6 autres d'un coup.
export function pageAt(now: number, pageCount: number) {
  return pageCount > 0 ? Math.floor(now / ROTATE_MS) % pageCount : 0;
}

// height : la hauteur de la bande (plus haute sur téléphone, où chaque bande prend toute la largeur)
export function SideAdBanner({ items, height = 120 }: { items: AdItem[]; height?: number }) {
  const visibleCount = Math.min(VISIBLE_COUNT, items.length);
  const pageCount = visibleCount > 0 ? Math.ceil(items.length / visibleCount) : 0;
  const [page, setPage] = useState(() => pageAt(Date.now(), pageCount));
  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (items.length === 0) return;
    Image.prefetch(items.map((item) => item.image_url)).catch(() => {});
  }, [items]);

  useEffect(() => {
    setPage(pageAt(Date.now(), pageCount));
    if (pageCount <= 1) return;
    let timer: ReturnType<typeof setTimeout>;
    // délai jusqu'au prochain tic ; un minuteur parti un peu en avance ne déclenche pas deux changements de suite
    const waitForTick = () => {
      const wait = ROTATE_MS - (Date.now() % ROTATE_MS);
      return wait < 200 ? wait + ROTATE_MS : wait;
    };
    const schedule = () => {
      // attendre le prochain « tic » de l'horloge commune
      timer = setTimeout(() => {
        const next = pageAt(Date.now() + TRANSITION_MS, pageCount);
        Animated.parallel([
          Animated.timing(fade, { toValue: 0, duration: TRANSITION_MS / 2, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.timing(slide, { toValue: -16, duration: TRANSITION_MS / 2, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]).start(() => {
          setPage(next);
          slide.setValue(16);
          Animated.parallel([
            Animated.timing(fade, { toValue: 1, duration: TRANSITION_MS / 2, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(slide, { toValue: 0, duration: TRANSITION_MS / 2, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          ]).start();
        });
        schedule();
      }, waitForTick());
    };
    schedule();
    return () => clearTimeout(timer);
  }, [pageCount, fade, slide]);

  if (items.length === 0) return null;

  const start = (page % Math.max(pageCount, 1)) * visibleCount;
  const slots = Array.from({ length: visibleCount }, (_, i) => items[(start + i) % items.length]);

  const renderSlot = (item: AdItem) => {
    const image = (
      <Animated.View style={{ flex: 1, opacity: fade, transform: [{ translateY: slide }] }}>
        <Image accessibilityLabel="Publicité Albasse Shopping" source={{ uri: item.image_url }} style={styles.image} contentFit="cover" />
      </Animated.View>
    );
    return item.link ? (
      <Pressable style={styles.slot} onPress={() => Linking.openURL(item.link!)}>
        {image}
      </Pressable>
    ) : (
      <View style={styles.slot}>{image}</View>
    );
  };

  return (
    <View style={[styles.wrap, { height }]}>
      {slots.map((item, i) => (
        <React.Fragment key={`slot-${i}`}>
          {i > 0 && <View style={styles.divider} />}
          {renderSlot(item)}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: NEON_PURPLE,
    shadowColor: NEON_PURPLE,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  slot: { flex: 1 },
  divider: { width: 2, backgroundColor: NEON_PURPLE },
  image: { width: '100%', height: '100%' },
});
