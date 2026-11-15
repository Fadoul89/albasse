import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useStoreSettings } from '../hooks/useStoreSettings';
import { colors, fonts, radius, spacing } from '../theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { TERMS_SECTIONS, TERMS_UPDATED } from '../lib/termsText';

export function TermsScreen() {
  const { settings } = useStoreSettings();

  return (
    <View style={styles.screen} testID="terms-screen">
      <ScreenHeader title="Conditions générales" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.shopName}>🏪 {settings.shop_name}</Text>
        <Text style={styles.updated}>Dernière mise à jour : {TERMS_UPDATED}</Text>

        {TERMS_SECTIONS.map((s) => (
          <View key={s.title} style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">{s.title}</Text>
            {s.paragraphs.map((p) => (
              <Text key={p} style={styles.p}>{p}</Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 60 },
  shopName: { color: colors.goldLight, fontFamily: fonts.display, fontSize: 20, textAlign: 'center', marginBottom: 4 },
  updated: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, textAlign: 'center', marginBottom: spacing.lg },
  section: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: 14, marginBottom: 8 },
  p: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginBottom: 6 },
});
