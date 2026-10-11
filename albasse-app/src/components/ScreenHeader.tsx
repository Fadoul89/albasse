import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, fonts } from '../theme';

interface Props {
  title: string;
  showBack?: boolean;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, showBack, right }: Props) {
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <View style={styles.header}>
      <View style={[styles.side, styles.sideStart]}>
        {showBack && (
          <>
            <Pressable onPress={handleBack} hitSlop={12}>
              <Text style={styles.back}>←</Text>
            </Pressable>
            <Pressable onPress={() => router.replace('/')} hitSlop={12}>
              <Text style={styles.home}>🏠</Text>
            </Pressable>
          </>
        )}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  side: { width: 76 },
  sideStart: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  back: { color: colors.gold, fontSize: 28 },
  home: { fontSize: 26 },
  title: { flex: 1, color: colors.cream, fontFamily: fonts.display, fontSize: 18, textAlign: 'center' },
});
