import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, Linking, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import { colors, radius } from '../theme';
import type { AdItem } from '../types';

const ROTATE_MS = 4500;
const TRANSITION_MS = 700;

export function SideAdBanner({ items, variant = 'side' }: { items: AdItem[]; variant?: 'side' | 'mobile' }) {
  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (items.length <= 1) return;
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
  }, [items.length, fade, slide]);

  if (items.length === 0) return null;
  const current = items[index % items.length];
  const wrapStyle = variant === 'mobile' ? styles.wrapMobile : styles.wrap;

  const image = (
    <Animated.View style={{ flex: 1, opacity: fade, transform: [{ translateY: slide }] }}>
      <Image source={{ uri: current.image_url }} style={styles.image} contentFit="contain" />
    </Animated.View>
  );

  if (!current.link) {
    return <View style={wrapStyle}>{image}</View>;
  }

  return (
    <Pressable style={wrapStyle} onPress={() => Linking.openURL(current.link!)}>
      {image}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 160,
    height: 220,
    alignSelf: 'flex-start',
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginVertical: 12,
  },
  wrapMobile: {
    width: '100%',
    height: 180,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
});
