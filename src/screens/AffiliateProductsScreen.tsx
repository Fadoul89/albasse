import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useAuthStore } from '../store/authStore';
import { useMyAffiliateProducts } from '../hooks/useMyAffiliateProducts';
import { useCategories } from '../hooks/useCategories';
import { useAffiliateSettings } from '../hooks/useAffiliateSettings';
import { useToastStore } from '../store/toastStore';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, fonts, radius, spacing } from '../theme';

const SITE_URL = 'https://www.albasseshopping.com';
const formatXAF = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

function buildAffiliateLink(pastedUrl: string, code: string): string | null {
  const trimmed = pastedUrl.trim();
  if (!trimmed) return null;

  let path = trimmed;
  // Retire le domaine si l'utilisateur a collé un lien complet
  path = path.replace(/^https?:\/\/[^/]+/i, '');
  if (!path.startsWith('/')) path = `/${path}`;

  const [pathname, existingQuery] = path.split('?');
  const params = new URLSearchParams(existingQuery ?? '');
  params.set('ref', code);

  return `${SITE_URL}${pathname}?${params.toString()}`;
}

export function AffiliateProductsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const { rows, isLoading } = useMyAffiliateProducts();
  const { categories } = useCategories();
  const { settings } = useAffiliateSettings();
  const showToast = useToastStore((s) => s.show);

  const rateFor = (r: (typeof rows)[number]) => {
    if (r.product.affiliate_commission_rate != null) return r.product.affiliate_commission_rate;
    const category = categories.find((c) => c.id === r.product.category_id);
    if (category?.affiliate_commission_rate != null) return category.affiliate_commission_rate;
    return settings.default_commission_rate;
  };
  const [query, setQuery] = useState('');
  const [pastedUrl, setPastedUrl] = useState('');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  if (!profile?.is_affiliate || profile.affiliate_status !== 'approved') {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Mes produits" showBack />
        <Text style={styles.denied}>Réservé aux affiliés approuvés.</Text>
      </View>
    );
  }

  const filtered = rows.filter((r) => r.product.name.toLowerCase().includes(query.trim().toLowerCase()));

  const copyToClipboard = async (link: string) => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(link);
      showToast('Lien copié dans le presse-papiers.', { title: 'Prêt à partager 🔗', type: 'success' });
    }
  };

  const copyLink = (slug: string) => copyToClipboard(`${SITE_URL}/produit/${slug}?ref=${profile.referral_code}`);

  const handleGenerate = () => {
    const link = buildAffiliateLink(pastedUrl, profile.referral_code!);
    if (!link) {
      showToast('Collez un lien du site (ex: albasseshopping.com/produit/...).', { title: 'Lien manquant', type: 'error' });
      return;
    }
    setGeneratedLink(link);
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Mes produits" showBack />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
        <View style={styles.generateCard}>
          <Text style={styles.generateTitle}>🔗 Générer un lien depuis une URL</Text>
          <Text style={styles.generateHint}>
            Collez le lien original de n'importe quel produit (ou page) du site, votre lien affilié sera
            généré automatiquement.
          </Text>
          <TextInput
            value={pastedUrl}
            onChangeText={setPastedUrl}
            placeholder="Collez le lien ici (ex: albasseshopping.com/produit/parfum-x)"
            placeholderTextColor={colors.creamFaint}
            autoCapitalize="none"
            style={styles.search}
          />
          <Pressable style={styles.generateBtn} onPress={handleGenerate}>
            <Text style={styles.generateBtnText}>Générer mon lien</Text>
          </Pressable>
          {generatedLink && (
            <View style={styles.generatedBox}>
              <Text style={styles.generatedText} numberOfLines={2}>
                {generatedLink}
              </Text>
              <Pressable style={styles.linkBtn} onPress={() => copyToClipboard(generatedLink)}>
                <Text style={styles.linkBtnText}>🔗 Copier</Text>
              </Pressable>
            </View>
          )}
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher un produit..."
          placeholderTextColor={colors.creamFaint}
          style={styles.search}
        />
        {isLoading ? (
          <Text style={styles.emptyText}>Chargement…</Text>
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyText}>Aucun produit trouvé.</Text>
        ) : (
          filtered.map((r) => (
            <View key={r.product.id} style={styles.row}>
              {r.product.images[0] ? (
                <Image source={{ uri: r.product.images[0] }} style={styles.thumb} contentFit="cover" />
              ) : (
                <View style={styles.thumbPlaceholder} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {r.product.name}
                </Text>
                <View style={styles.metricsRow}>
                  <Text style={styles.metricText}>👀 {r.clicks}</Text>
                  <Text style={styles.metricText}>🛍️ {r.orders}</Text>
                  <Text style={styles.metricTextHighlight}>💰 {formatXAF(r.commission)}</Text>
                </View>
                <Text style={styles.rateBadge}>📊 Commission estimée : {rateFor(r)}%</Text>
                <Pressable style={styles.linkBtn} onPress={() => copyLink(r.product.slug)}>
                  <Text style={styles.linkBtnText}>🔗 Copier mon lien</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  emptyText: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', marginTop: 20 },
  search: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.cream,
    fontFamily: fonts.body,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  generateCard: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  generateTitle: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 13, marginBottom: 6 },
  generateHint: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, marginBottom: 10 },
  generateBtn: { backgroundColor: colors.gold, borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center' },
  generateBtnText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 13 },
  generatedBox: {
    backgroundColor: colors.panelAlt,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: 10,
    gap: 8,
  },
  generatedText: { color: colors.cream, fontFamily: fonts.body, fontSize: 11 },
  row: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  thumb: { width: 56, height: 66, borderRadius: 8 },
  thumbPlaceholder: { width: 56, height: 66, borderRadius: 8, backgroundColor: colors.panelAlt },
  name: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13, marginBottom: 4 },
  metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  metricText: { color: colors.creamFaint, fontFamily: fonts.bodyMedium, fontSize: 11 },
  metricTextHighlight: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 11 },
  rateBadge: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 10.5, marginBottom: 6 },
  linkBtn: { alignSelf: 'flex-start', backgroundColor: colors.gold, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 6 },
  linkBtnText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 11 },
});
