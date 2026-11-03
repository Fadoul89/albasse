// Admin (page Promotions intelligentes) : l'annonce que Zara montre EN CE MOMENT à chaque public (femmes, hommes, élèves, étudiants, administrateurs),
// le nombre de clients de chaque public (d'après leur compte), et le prochain changement. Zara change les annonces 4 fois par jour, jour et nuit.
// Lecture seule : rien n'est écrit. (lib/adTargeting, lib/adAudiences, docs/zara-annonce-ciblee.md)
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import type { Category, Product } from '../types';
import { useStoreSettings } from '../hooks/useStoreSettings';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { fetchAllPages } from '../lib/visitStats';
import { AUDIENCES, AUDIENCE_LABEL, audiencesOf, type Audience } from '../lib/adAudiences';
import { AD_ROTATE_HOURS, adHeadline, adWhy, nextAdChange, previewAudiences } from '../lib/adTargeting';
import { isTestEmail } from '../lib/testAccounts';
import { colors, fonts, radius, spacing } from '../theme';

const formatXAF = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const hour = (at: number) => new Date(at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Ndjamena' }).replace(':', ' h ');

export function ZaraAdsAudiences({ products, categories }: { products: Product[]; categories: Category[] }) {
  const { settings } = useStoreSettings();
  const enabled = settings.zara_ads_enabled === true;
  const [now, setNow] = useState(() => Date.now());
  const [counts, setCounts] = useState<Record<Audience, number> | null>(null);

  // Zara travaille 24 h sur 24 : l'écran se remet à jour tout seul chaque minute (et change d'annonces au changement de tranche)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let alive = true;
    fetchAllPages<{ email: string | null; gender?: string | null; profession: string | null }>((from, to) =>
      supabase.from('profiles').select('email,gender,profession').eq('is_admin', false).order('id').range(from, to)
    )
      .then((rows) => {
        if (!alive) return;
        const c = { femme: 0, homme: 0, eleve: 0, etudiant: 0, admin: 0 } as Record<Audience, number>;
        for (const r of rows) {
          if (isTestEmail(r.email)) continue;
          for (const a of audiencesOf(r)) c[a] += 1;
        }
        setCounts(c);
      })
      .catch(() => alive && setCounts(null));
    return () => {
      alive = false;
    };
  }, []);

  const preview = useMemo(
    () => previewAudiences({ products, categories, now }),
    // l'annonce ne change que d'une tranche de 6 h à l'autre (ou quand le catalogue change)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, categories, Math.floor(now / 60_000 / 30)]
  );

  return (
    <View style={styles.card} testID="zara-audiences">
      <Text style={styles.title}>📣 Annonces de Zara · 24 h sur 24</Text>
      <Text style={styles.status} testID="zara-audiences-status">
        {enabled ? '🟢 Allumé : les clients voient ces annonces dans l’accueil' : '⚪ Éteint : rien n’est affiché aux clients (c’est seulement un aperçu)'}
      </Text>
      <Text style={styles.help} testID="zara-audiences-next">
        {`Zara change les annonces toutes les ${AD_ROTATE_HOURS} heures, jour et nuit (00 h, 06 h, 12 h, 18 h). Prochain changement : ${hour(nextAdChange(now))}.`}
      </Text>

      {AUDIENCES.map((a) => {
        const ad = preview[a];
        const label = AUDIENCE_LABEL[a];
        return (
          <View key={a} style={styles.row} testID={`zara-audience-${a}`}>
            <View style={styles.rowHead}>
              <Text style={styles.audience}>{`${label.icon} ${label.fr}`}</Text>
              <Text style={styles.count} testID={`zara-audience-${a}-count`}>
                {counts ? `${counts[a]} client${counts[a] > 1 ? 's' : ''}` : '…'}
              </Text>
            </View>
            {ad ? (
              <View style={styles.adBox}>
                {!!ad.product.images?.[0] && <Image source={{ uri: ad.product.images[0] }} style={styles.thumb} contentFit="cover" />}
                <View style={styles.adText}>
                  <Text style={styles.adName} numberOfLines={2} testID={`zara-audience-${a}-name`}>
                    {ad.product.name.trim()}
                  </Text>
                  <Text style={styles.adPrice}>{formatXAF(ad.product.price)}</Text>
                  <Text style={styles.adHeadline} testID={`zara-audience-${a}-headline`}>
                    {adHeadline(ad.reason)}
                  </Text>
                  <Text style={styles.adWhy}>{adWhy(ad.reason).replace('Pourquoi cette annonce ? ', '')}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.none} testID={`zara-audience-${a}-none`}>
                Aucune annonce vraie pour ce public pour le moment : Zara n’invente rien.
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md, gap: 8 },
  title: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.cream },
  status: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.goldLight },
  help: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.creamMuted },
  row: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: 6 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  audience: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.cream },
  count: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.goldLight },
  adBox: { flexDirection: 'row', gap: 10, backgroundColor: colors.panelAlt, borderRadius: radius.md, padding: 8 },
  thumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.cream },
  adText: { flex: 1, minWidth: 0, gap: 1 },
  adName: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.cream },
  adPrice: { fontFamily: fonts.displayBold, fontSize: 14, color: colors.goldLight },
  adHeadline: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.cream, marginTop: 2 },
  adWhy: { fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: colors.creamFaint },
  none: { fontFamily: fonts.body, fontSize: 12, color: colors.creamFaint },
});
