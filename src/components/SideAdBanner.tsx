import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, Linking, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import { colors, radius } from '../theme';
import type { AdItem } from '../types';

const ROTATE_MS = 4500;
const TRANSITION_MS = 700;
const NEON_PURPLE = '#C400FF';
const VISIBLE_COUNT = 3;

export function SideAdBanner({ items }: { items: AdItem[] }) {
  const visibleCount = Math.min(VISIBLE_COUNT, items.length);
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

  const slots = Array.from({ length: visibleCount }, (_, i) => items[(index + i) % items.length]);

  const renderSlot = (item: AdItem, key: string) => {
    const image = (
      <Animated.View style={{ flex: 1, opacity: fade, transform: [{ translateY: slide }] }}>
        <Image source={{ uri: item.image_url }} style={styles.image} contentFit="cover" />
      </Animated.View>
    );
    const content = item.link ? (
      <Pressable style={styles.slot} onPress={() => Linking.openURL(item.link!)}>
        {image}
      </Pressable>
    ) : (
      <View style={styles.slot}>{image}</View>
    );
    return <React.Fragment key={key}>{content}</React.Fragment>;
  };

  return (
    <View style={styles.wrap}>
      {slots.map((item, i) => (
        <React.Fragment key={`${item.image_url}-${i}`}>
          {i > 0 && <View style={styles.divider} />}
          {renderSlot(item, `slot-${i}`)}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    height: 120,
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
