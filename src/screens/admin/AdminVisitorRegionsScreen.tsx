// Admin › Visiteurs par région (option GPS, docs/option-gps-visiteurs.md) : où se trouvent réellement les
// visiteurs, d'après la position GPS détectée dès leur arrivée sur le site (et non la ville déclarée à la main).
import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { useVisitorRegions } from '../../hooks/useVisitorRegions';
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';

export function AdminVisitorRegionsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const { state, total, regions, cities, refresh } = useVisitorRegions();

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
      <ScreenHeader title="Visiteurs par région" showBack />
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={state === 'loading'} onRefresh={refresh} tintColor={colors.gold} />}
      >
        <Text style={styles.privacyNote}>
          📍 Position GPS réelle, demandée une seule fois par appareil, dès l'arrivée sur le site. Regroupe
          visiteurs anonymes et clients connectés ; « Inconnu » quand l'adresse n'a pas pu être retrouvée.
        </Text>

        {state === 'missing' ? (
          <Text style={styles.empty} testID="visitor-regions-unavailable">
            Lancez d'abord le script add-visitor-gps.sql.
          </Text>
        ) : state === 'error' ? (
          <Text style={styles.empty}>Impossible de charger les régions pour le moment. Réessayez dans un instant.</Text>
        ) : state === 'loading' ? (
          <Text style={styles.empty}>Chargement…</Text>
        ) : total === 0 ? (
          <Text style={styles.empty} testID="visitor-regions-empty">
            Aucun visiteur n'a encore partagé sa position.
          </Text>
        ) : (
          <>
            <Text style={styles.totals} testID="visitor-regions-total">
              {total} visiteur{total > 1 ? 's' : ''} avec une position connue.
            </Text>

            <Section title="🗺️ Par région">
              {regions.map((r, i) => (
                <Row key={`${r.region}-${r.country}-${i}`} testID={`visitor-region-${i}`} label={`${r.region} (${r.country})`} value={r.visitors} total={total} />
              ))}
            </Section>

            <Section title="🏙️ Principales villes">
              {cities.map((c, i) => (
                <Row key={`${c.city}-${c.region}-${i}`} testID={`visitor-city-${i}`} label={`${c.city} — ${c.region}`} value={c.visitors} total={total} />
              ))}
            </Section>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Row({ label, value, total, testID }: { label: string; value: number; total: number; testID?: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <View style={styles.row} testID={testID}>
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.rowValue}>
        {value} · {pct}%
      </Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  empty: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  privacyNote: {
    color: colors.creamMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  totals: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12, marginBottom: spacing.md },
  section: { marginBottom: spacing.lg },
  sectionTitle: { color: colors.cream, fontFamily: fonts.display, fontSize: 16, marginBottom: spacing.sm },
  sectionBody: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    marginBottom: 6,
  },
  rowLabel: { flex: 1, color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13, marginRight: spacing.sm },
  rowValue: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 13 },
});
