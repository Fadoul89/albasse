import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, Linking, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import { colors, radius } from '../theme';
import type { AdItem } from '../types';

const ROTATE_MS = 4500;
const TRANSITION_MS = 700;
const NEON_PURPLE = '#C400FF';

export function SideAdBanner({ items, variant = 'side' }: { items: AdItem[]; variant?: 'side' | 'mobile' }) {
  const perFrame = variant === 'side' ? 2 : 1;
  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (items.length <= perFrame) return;
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
  }, [items.length, perFrame, fade, slide]);

  if (items.length === 0) return null;

  if (variant === 'mobile') {
    const current = items[index % items.length];
    const image = (
      <Animated.View style={{ flex: 1, opacity: fade, transform: [{ translateY: slide }] }}>
        <Image source={{ uri: current.image_url }} style={styles.image} contentFit="contain" />
      </Animated.View>
    );
    if (!current.link) {
      return <View style={styles.wrapMobile}>{image}</View>;
    }
    return (
      <Pressable style={styles.wrapMobile} onPress={() => Linking.openURL(current.link!)}>
        {image}
      </Pressable>
    );
  }

  const first = items[index % items.length];
  const second = items.length > 1 ? items[(index + 1) % items.length] : null;

  const renderHalf = (item: AdItem, style: object) => {
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
  };

  return (
    <View style={styles.wrap}>
      {renderHalf(first, styles.half)}
      {second && <View style={styles.divider} />}
      {second && renderHalf(second, styles.half)}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 160,
    height: 150,
    alignSelf: 'flex-start',
    marginVertical: 12,
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
  half: { flex: 1 },
  divider: { width: 2, backgroundColor: NEON_PURPLE },
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
