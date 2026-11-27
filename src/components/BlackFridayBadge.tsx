import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { fonts, radius } from '../theme';
import { blackFridayBadgeActive } from '../lib/blackFridayBadge';

// Petite pastille « Black Friday 🇹🇩 » (lib/blackFridayBadge.ts pour la période) : accueil et cartes articles en vraie promotion.
export function BlackFridayBadge({ compact = false, style }: { compact?: boolean; style?: StyleProp<ViewStyle> }) {
  if (!blackFridayBadgeActive()) return null;
  return (
    <View style={[styles.badge, compact && styles.compact, style]} testID="black-friday-badge">
      <Text style={[styles.text, compact && styles.compactText]} numberOfLines={1}>
        Black Friday 🇹🇩
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#111111',
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'center',
  },
  text: { color: '#ffffff', fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.3 },
  compact: { paddingHorizontal: 6, paddingVertical: 3 },
  compactText: { fontSize: 9 },
});
