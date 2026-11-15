import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';
import type { AdCategory, AdProduct } from '../lib/adTargeting';
import { LEVEL_BADGE, studyClient, type StudyCustomer, type StudyInterestRow, type StudyLine } from '../lib/clientStudy';
import { colors, fonts, radius, spacing } from '../theme';

// « Zara a étudié ce client » (demande du patron, 10 novembre 2026) : sur la page de chaque client de l'admin, ce que Zara a COMPRIS (public, articles préférés,
// regardés sans plus, commandés) et ce qu'elle LUI PROPOSE (la même affiche que sur son accueil). D'après ce que le site a VRAIMENT enregistré : rien n'est deviné.
// (lib/clientStudy, docs/zara-etude-client.md). Lecture seule, réservée à l'administrateur (la base ne laisse lire le suivi qu'à lui).
interface Loaded {
  interest: StudyInterestRow[];
  likedIds: string[];
  products: AdProduct[];
  categories: AdCategory[];
  names: Record<string, string>;
}

const DATE_MS = (v: unknown) => {
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : 0;
};
const LEVELS = ['eleve', 'moyen', 'leger'] as const;

export function ZaraStudyCard({ userId, customer, orderedProductIds }: { userId: string; customer: StudyCustomer; orderedProductIds: string[] }) {
  const [data, setData] = useState<Loaded | null | undefined>(undefined); // undefined : lecture en cours ; null : lecture impossible

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [interestRes, favRes, prodRes, catRes] = await Promise.all([
          supabase.from('visitor_product_interest').select('product_id,interest,views,cart_status,last_viewed_at').eq('user_id', userId).limit(500),
          supabase.from('favorites').select('product_id').eq('user_id', userId).limit(500),
          supabase.from('products').select('*').eq('is_active', true).limit(2000),
          supabase.from('categories').select('id,slug,name,parent_id'),
        ]);
        if (!alive) return;
        // la lecture du suivi est réservée aux administrateurs : une erreur ici = pas d'étude (jamais une fausse étude « rien d'enregistré »)
        if (interestRes.error || favRes.error || prodRes.error) {
          setData(null);
          return;
        }
        const interest: StudyInterestRow[] = ((interestRes.data ?? []) as Record<string, unknown>[])
          .filter((r) => typeof r.product_id === 'string')
          .map((r) => ({
            productId: r.product_id as string,
            level: (LEVELS as readonly string[]).includes(r.interest as string) ? (r.interest as StudyInterestRow['level']) : 'leger',
            views: Math.max(0, Number(r.views) || 0),
            lastViewedAt: DATE_MS(r.last_viewed_at),
            cartStatus: typeof r.cart_status === 'string' ? r.cart_status : 'none',
          }));
        const likedIds = ((favRes.data ?? []) as { product_id: string }[]).map((r) => r.product_id).filter((id) => typeof id === 'string');
        const products = ((prodRes.data ?? []) as Record<string, unknown>[]).map((p) => ({ ...p, price: Number(p.price), stock: p.stock == null ? null : Number(p.stock) })) as unknown as AdProduct[];
        const categories = (catRes.data ?? []) as AdCategory[];
        // les noms des articles qui ne sont plus en vente (retirés, désactivés) : pour les écrire quand même
        const known = new Set(products.map((p) => p.id));
        const missing = [...new Set([...interest.map((r) => r.productId), ...likedIds, ...orderedProductIds])].filter((id) => !known.has(id));
        const names: Record<string, string> = {};
        if (missing.length > 0) {
          const { data: rows } = await supabase.from('products').select('id,name').in('id', missing.slice(0, 200));
          for (const r of (rows ?? []) as { id: string; name: string }[]) names[r.id] = r.name;
        }
        if (alive) setData({ interest, likedIds, products, categories, names });
      } catch {
        if (alive) setData(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, orderedProductIds.join(',')]);

  const study = useMemo(
    () => (data ? studyClient({ customer, interest: data.interest, likedIds: data.likedIds, orderedProductIds, products: data.products, categories: data.categories, names: data.names }) : null),
    [data, customer.gender, customer.profession, customer.region, customer.birth_date, customer.marital_status, orderedProductIds.join(',')]
  );

  return (
    <View style={styles.section} testID="zara-study">
      <Text style={styles.sectionTitle}>🧠 Zara a étudié ce client</Text>
      <View style={styles.body}>
        {data === undefined ? (
          <Text style={styles.muted} testID="zara-study-loading">Zara étudie ce client…</Text>
        ) : !study ? (
          <Text style={styles.muted} testID="zara-study-error">Étude impossible pour le moment (lecture refusée ou réseau). Réessayez plus tard.</Text>
        ) : (
          <>
            <View style={styles.highlight}>
              <Text style={styles.badge} testID="zara-study-level">{LEVEL_BADGE[study.level]}</Text>
              <Text style={styles.summary} testID="zara-study-summary">{study.summary}</Text>
            </View>

            <Text style={styles.sub}>Son public (d'après ce qu'il a écrit dans son compte)</Text>
            <Text style={styles.value} testID="zara-study-audience">{study.audienceLabels.length > 0 ? study.audienceLabels.join(' · ') : 'Aucun public reconnu'}</Text>

            <Text style={styles.sub}>💙 Ses articles préférés (Intérêt élevé)</Text>
            {study.loved.length === 0 ? <Text style={styles.muted} testID="zara-study-loved-none">Aucun article d'intérêt élevé.</Text> : study.loved.map((l, i) => <Line key={l.id} line={l} testID={`zara-study-loved-${i + 1}`} />)}

            {study.weak.length > 0 ? (
              <>
                <Text style={styles.sub}>👀 Regardés sans plus (pas assez pour l'affiche)</Text>
                {study.weak.slice(0, 6).map((l, i) => <Line key={l.id} line={l} testID={`zara-study-weak-${i + 1}`} />)}
              </>
            ) : null}

            {study.ordered.length > 0 ? (
              <>
                <Text style={styles.sub}>📦 Déjà commandés (jamais reproposés)</Text>
                {study.ordered.slice(0, 6).map((l, i) => <Line key={l.id} line={l} testID={`zara-study-ordered-${i + 1}`} />)}
              </>
            ) : null}

            <Text style={styles.sub}>📣 Ce que Zara lui propose</Text>
            {study.ad ? (
              <View style={styles.adBox} testID="zara-study-ad">
                <Text style={styles.adHeadline} testID="zara-study-ad-headline">{study.adHeadline}</Text>
                {study.adNames.map((n, i) => (
                  <Text key={`${n}-${i}`} style={styles.adName} testID={`zara-study-ad-name-${i + 1}`}>{`${i === 0 ? '▶' : '•'} ${n}`}</Text>
                ))}
                <Text style={styles.adWhy} testID="zara-study-ad-why">{study.adWhy}</Text>
              </View>
            ) : (
              <Text style={styles.muted} testID="zara-study-ad-none">Rien pour le moment : Zara n'invente jamais une annonce.</Text>
            )}

            {study.notes.length > 0 ? (
              <View style={styles.notes} testID="zara-study-notes">
                {study.notes.map((n) => (
                  <Text key={n} style={styles.note}>{`ⓘ ${n}`}</Text>
                ))}
              </View>
            ) : null}
            <Text style={styles.foot}>D'après ce que le site a enregistré pour ce client (regards, favoris, commandes, compte). Sur son téléphone, l'affiche peut changer : ses regards y sont aussi gardés.</Text>
          </>
        )}
      </View>
    </View>
  );
}

function Line({ line, testID }: { line: StudyLine; testID: string }) {
  return (
    <View style={styles.line} testID={testID}>
      <Text style={[styles.lineName, !line.available && styles.lineOff]} numberOfLines={2}>{line.name}</Text>
      <Text style={styles.lineWhy}>{line.why}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.lg },
  sectionTitle: { color: colors.cream, fontFamily: fonts.display, fontSize: 16, marginBottom: spacing.sm },
  body: { backgroundColor: colors.panel, borderRadius: radius.md, padding: spacing.sm },
  highlight: { backgroundColor: colors.panelAlt, borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.sm },
  badge: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 15 },
  summary: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 18, marginTop: 4 },
  sub: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 12.5, marginTop: spacing.sm, marginBottom: 4 },
  value: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 12.5 },
  muted: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  line: { paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: colors.border },
  lineName: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 12.5 },
  lineOff: { color: colors.creamFaint, textDecorationLine: 'line-through' },
  lineWhy: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 11.5, marginTop: 1 },
  adBox: { borderWidth: 1, borderColor: colors.gold, borderRadius: radius.sm, padding: spacing.sm, gap: 3 },
  adHeadline: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 13 },
  adName: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 12.5 },
  adWhy: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  notes: { marginTop: spacing.sm, gap: 3 },
  note: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16 },
  foot: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, lineHeight: 15, marginTop: spacing.sm },
});
