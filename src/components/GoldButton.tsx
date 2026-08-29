import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, radius } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'gold' | 'outline' | 'red';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function GoldButton({ label, onPress, variant = 'gold', disabled, loading, style }: Props) {
  if (variant === 'gold') {
    return (
      <Pressable onPress={onPress} disabled={disabled || loading} style={[styles.wrapper, style]}>
        <LinearGradient
          colors={disabled ? ['#5a5138', '#6b6247'] : [colors.gold, colors.goldLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        >
          {loading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.goldText}>{label}</Text>
          )}
        </LinearGradient>
      </Pressable>
    );
  }

  if (variant === 'red') {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        style={[styles.wrapper, styles.redButton, disabled && { opacity: 0.5 }, style]}
      >
        {loading ? <ActivityIndicator color={colors.cream} /> : <Text style={styles.redText}>{label}</Text>}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.wrapper, styles.outlineButton, disabled && { opacity: 0.5 }, style]}
    >
      {loading ? <ActivityIndicator color={colors.gold} /> : <Text style={styles.outlineText}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.background,
    letterSpacing: 0.5,
  },
  redButton: {
    backgroundColor: colors.red,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.cream,
    letterSpacing: 0.5,
  },
  outlineButton: {
    borderWidth: 1.5,
    borderColor: colors.gold,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.gold,
    letterSpacing: 0.5,
  },
});
