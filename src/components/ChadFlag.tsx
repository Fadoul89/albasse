import React from 'react';
import { View, StyleSheet } from 'react-native';

const CHAD_BLUE = '#0033A0';
const CHAD_YELLOW = '#FECB00';
const CHAD_RED = '#D21034';

interface Props {
  width?: number;
  height?: number;
}

export function ChadFlag({ width = 32, height = 22 }: Props) {
  return (
    <View style={[styles.wrap, { width, height }]}>
      <View style={[styles.stripe, { backgroundColor: CHAD_BLUE }]} />
      <View style={[styles.stripe, { backgroundColor: CHAD_YELLOW }]} />
      <View style={[styles.stripe, { backgroundColor: CHAD_RED }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  stripe: { flex: 1, height: '100%' },
});
