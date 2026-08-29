import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { useToastStore } from '../store/toastStore';
import { colors, fonts, radius, spacing } from '../theme';

export function Toast() {
  const { visible, title, message, type, hide } = useToastStore();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      const timer = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => hide());
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [visible, message]);

  if (!visible) return null;

  const accent = type === 'error' ? colors.red : type === 'success' ? colors.gold : colors.creamMuted;

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <Animated.View style={[styles.toast, { opacity, borderColor: accent }]}>
        <Pressable onPress={hide} style={styles.content}>
          {title && <Text style={[styles.title, { color: accent }]}>{title}</Text>}
          <Text style={styles.message}>{message}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 90,
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    backgroundColor: colors.panelAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    maxWidth: 420,
    width: '92%',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  content: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  title: { fontFamily: fonts.bodyBold, fontSize: 13, marginBottom: 2 },
  message: { color: colors.cream, fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
});
