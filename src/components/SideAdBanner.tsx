import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, Linking, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import { colors, radius } from '../theme';
import type { AdItem } from '../types';

const ROTATE_MS = 4500;
const TRANSITION_MS = 700;
const SIDE_VISIBLE_COUNT = 3;
const NEON_PURPLE = '#C400FF';

export function SideAdBanner({ items, variant = 'side' }: { items: AdItem[]; variant?: 'side' | 'mobile' }) {
  const visibleCount = variant === 'side' ? Math.min(SIDE_VISIBLE_COUNT, items.length) : 1;
  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (items.length <= visibleCount) return;
    const id = setInterval(() => {
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: TRANSITION_MS / 2, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(slide, { toValue: -16, duration: TRANSITION_MS / 2, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start(() => {
        setIndex((i) => (i + 1) % items.length);
        slide.setValue(16);
        Animated.parallel([
          Animated.timing(fade, { toValue: 1, duration: TRANSITION_MS / 2, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(slide, { toValue: 0, duration: TRANSITION_MS / 2, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]).start();
      });
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [items.length, visibleCount, fade, slide]);

  if (items.length === 0) return null;

  if (variant === 'mobile') {
    const current = items[index % items.length];
    return (
      <AdSlot item={current} style={styles.wrapMobile} fade={fade} slide={slide} />
    );
  }

  const slots = Array.from({ length: visibleCount }, (_, i) => items[(index + i) % items.length]);

  return (
    <View style={styles.sideColumn}>
      {slots.map((item, i) => (
        <AdSlot key={`${item.image_url}-${i}`} item={item} style={styles.wrap} fade={fade} slide={slide} />
      ))}
    </View>
  );
}

function AdSlot({
  item,
  style,
  fade,
  slide,
}: {
  item: AdItem;
  style: object;
  fade: Animated.Value;
  slide: Animated.Value;
}) {
  const image = (
    <Animated.View style={{ flex: 1, opacity: fade, transform: [{ translateY: slide }] }}>
      <Image source={{ uri: item.image_url }} style={styles.image} contentFit="contain" />
    </Animated.View>
  );

  if (!item.link) {
    return <View style={style}>{image}</View>;
  }

  return (
    <Pressable style={style} onPress={() => Linking.openURL(item.link!)}>
      {image}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sideColumn: {
    width: 160,
    alignSelf: 'flex-start',
    gap: 12,
    marginVertical: 12,
  },
  wrap: {
    width: 160,
    height: 150,
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
  wrapMobile: {
    width: '100%',
    height: 120,
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
  image: { width: '100%', height: '100%' },
});
