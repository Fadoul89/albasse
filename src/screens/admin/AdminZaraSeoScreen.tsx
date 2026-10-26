// Admin › « Zara SEO » : Zara prépare les descriptions des articles pour Google (voir components/ZaraSeoPanel).
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ZaraSeoPanel } from '../../components/ZaraSeoPanel';

export function AdminZaraSeoScreen() {
  const profile = useAuthStore((s) => s.profile);

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Zara SEO (Google)" showBack />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
        <ZaraSeoPanel />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
});
