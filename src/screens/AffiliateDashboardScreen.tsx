import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { useMyAffiliate } from '../hooks/useMyAffiliate';
import { useAffiliateSettings } from '../hooks/useAffiliateSettings';
import { useToastStore } from '../store/toastStore';
import { ScreenHeader } from '../components/ScreenHeader';
import { GoldButton } from '../components/GoldButton';
import { colors, fonts, radius, spacing } from '../theme';

const SITE_URL = 'https://www.albasseshopping.com';
const formatXAF = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  validated: 'Validée',
  cancelled: 'Annulée',
};

export function AffiliateDashboardScreen() {
  const profile = useAuthStore((s) => s.profile);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { stats, isLoading } = useMyAffiliate();
  const { settings } = useAffiliateSettings();
  const showToast = useToastStore((s) => s.show);

  if (!profile?.is_affiliate) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Espace affilié" showBack />
        <Text style={styles.denied}>Vous n'êtes pas encore inscrit au programme d'affiliation.</Text>
      </View>
    );
  }

  const link = `${SITE_URL}/?ref=${profile.referral_code}`;

  const copyLink = async () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(link);
      showToast('Lien copié dans le presse-papiers.', { title: 'Prêt à partager 🔗', type: 'success' });
    }
  };

  if (profile.affiliate_status !== 'approved') {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Espace affilié" showBack />
        <Text style={styles.denied}>
          {profile.affiliate_status === 'blocked'
            ? 'Votre compte affilié est bloqué.'
            : 'Votre candidature est en attente d\'approbation.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Espace affilié" showBack />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
        <View style={styles.linkCard}>
          <Text style={styles.linkLabel}>🔗 Votre lien unique</Text>
          <Pressable style={styles.linkRow} onPress={copyLink}>
            <Text style={styles.linkValue} numberOfLines={1}>
              {link}
            </Text>
            <Text style={styles.linkCopyIcon}>📋</Text>
          </Pressable>
          <Pressable style={styles.copyBtn} onPress={copyLink}>
            <Text style={styles.copyBtnText}>Copier le lien</Text>
          </Pressable>
          <Text style={styles.linkHint}>
            Astuce : ajoutez "?ref={profile.referral_code}" à la fin de n'importe quel lien produit du site
            pour partager un article précis.
          </Text>
        </View>

        <View style={styles.rateCard}>
          <Text style={styles.rateLabel}>📊 Taux de commission actuel</Text>
          <Text style={styles.rateValue}>{settings.default_commission_rate}%</Text>
          <Text style={styles.rateHint}>
            Ce pourcentage s'applique par défaut sur vos ventes. Il peut être plus élevé sur certains produits
            ou catégories (visible sur la fiche produit).
          </Text>
        </View>

        <GoldButton
          label="🔗 Mes produits — générer mes liens"
          variant="outline"
          onPress={() => navigation.navigate('AffiliateProducts')}
          style={{ marginBottom: spacing.lg }}
        />

        <View style={styles.statsGrid}>
          <Stat icon="👀" label="Visiteurs envoyés" value={String(stats.visitorsSent)} />
          <Stat icon="🛍️" label="Ventes" value={String(stats.ordersCount)} />
          <Stat icon="💰" label="Chiffre d'affaires généré" value={formatXAF(stats.revenue)} />
          <Stat icon="⏳" label="Commission en attente" value={formatXAF(stats.pendingCommission)} />
          <Stat icon="✅" label="Commission validée" value={formatXAF(stats.validatedCommission)} highlight />
          <Stat icon="💳" label="Déjà payé" value={formatXAF(stats.paidCommission)} />
        </View>

        <Text style={styles.sectionTitle}>Historique des commissions</Text>
        {isLoading ? (
          <Text style={styles.emptyText}>Chargement…</Text>
        ) : stats.commissions.length === 0 ? (
          <Text style={styles.emptyText}>Aucune vente pour le moment. Partagez votre lien pour commencer !</Text>
        ) : (
          stats.commissions.map((c) => (
            <View key={c.id} style={styles.commissionRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.commissionOrder}>Commande #{c.order_id.slice(0, 8)}</Text>
                <Text style={styles.commissionDate}>
                  {new Date(c.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.commissionAmount}>{formatXAF(c.amount)}</Text>
                <Text style={styles.commissionStatus}>{c.paid ? 'Payée' : STATUS_LABELS[c.status]}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ icon, label, value, highlight }: { icon: string; label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, highlight && { color: colors.goldLight }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
  linkCard: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  linkLabel: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 13, marginBottom: 6 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.panelAlt,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 8,
  },
  linkValue: { flex: 1, color: colors.cream, fontFamily: fonts.body, fontSize: 12 },
  linkCopyIcon: { fontSize: 16 },
  copyBtn: { backgroundColor: colors.gold, borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center' },
  copyBtnText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 13 },
  linkHint: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 10.5, marginTop: 10, lineHeight: 15 },
  rateCard: {
    backgroundColor: colors.panelAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  rateLabel: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  rateValue: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 28, marginTop: 4 },
  rateHint: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 10.5, textAlign: 'center', marginTop: 6, lineHeight: 15 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
  stat: {
    width: '31%',
    alignItems: 'center',
    backgroundColor: colors.panelAlt,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  statIcon: { fontSize: 16, marginBottom: 4 },
  statValue: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 13, textAlign: 'center' },
  statLabel: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 9, textAlign: 'center', marginTop: 3, paddingHorizontal: 4 },
  sectionTitle: { color: colors.cream, fontFamily: fonts.display, fontSize: 16, marginBottom: spacing.sm },
  emptyText: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', marginTop: 20 },
  commissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  commissionOrder: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  commissionDate: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  commissionAmount: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 14 },
  commissionStatus: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 10, marginTop: 2 },
});
