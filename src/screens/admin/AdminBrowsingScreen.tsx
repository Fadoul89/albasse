import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { fetchBrowsingOverview, type BrowsingOverviewResult } from '../../lib/assistantData';
import { PERIOD_LABELS, PERIOD_ORDER, type StatsPeriod } from '../../lib/assistantStats';
import { INTEREST_LABELS } from '../../lib/browsingInsights';
import {
  CART_LABELS,
  INTEREST_FILTERS,
  ORDER_STATUS_LABELS,
  SUGGESTION_LABELS,
  filterRows,
  formatAgo,
  formatSeconds,
  type BrowsingOverview,
  type InterestFilter,
  type OverviewRow,
} from '../../lib/browsingOverview';

const FILTER_LABELS: Record<InterestFilter, string> = { all: 'Tous', eleve: 'Élevé', moyen: 'Moyen', leger: 'Léger' };
const LEVEL_COLOR = { eleve: '#E8B04B', moyen: '#9FB8E8', leger: '#8A93A6' } as const;

export function AdminBrowsingScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [period, setPeriod] = useState<StatsPeriod>('30d');
  const [filter, setFilter] = useState<InterestFilter>('all');
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<BrowsingOverviewResult | null>(null);
  const latest = useRef(0);

  const load = useCallback(async (p: StatsPeriod) => {
    const mine = ++latest.current;
    setLoading(true);
    const next = await fetchBrowsingOverview(p);
    if (mine !== latest.current) return; // une demande plus récente est partie entre-temps
    setResult(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (profile?.is_admin) void load(period);
  }, [period, profile?.is_admin, load]);

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen} testID="browsing-board">
      <ScreenHeader title="Suivi de navigation" showBack />
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(period)} tintColor={colors.gold} />}
      >
        <Text style={styles.note}>
          🔎 Les articles que les visiteurs regardent sur le site, pour que Zara les conseille mieux. Les visiteurs sont anonymes (V-xxxxxx) ; un
          client connecté apparaît seulement par un code (C-xxxxxxxx), jamais avec son nom ni son téléphone. Le suivi se fait tout seul, sans rien
          demander au visiteur ; rien n'est noté si son navigateur demande de ne pas être suivi.
        </Text>

        <View style={styles.periodRow}>
          {PERIOD_ORDER.map((p) => (
            <Pressable key={p} style={[styles.chip, period === p && styles.chipActive]} onPress={() => setPeriod(p)} testID={`browsing-period-${p}`}>
              <Text style={[styles.chipText, period === p && styles.chipTextActive]}>{PERIOD_LABELS[p]}</Text>
            </Pressable>
          ))}
        </View>

        {loading && !result ? <Text style={styles.loading}>Chargement…</Text> : null}
        {result && !result.ok ? <Problem reason={result.reason} message={result.message} onRetry={() => load(period)} /> : null}
        {result && result.ok ? <Board overview={result.overview} filter={filter} setFilter={setFilter} dimmed={loading} /> : null}
      </ScrollView>
    </View>
  );
}

function Problem({ reason, message, onRetry }: { reason: 'not_installed' | 'forbidden' | 'error'; message: string; onRetry: () => void }) {
  if (reason === 'not_installed') {
    return (
      <View style={styles.problem} testID="browsing-not-installed">
        <Text style={styles.problemTitle}>Le suivi de navigation n'est pas encore activé</Text>
        <Text style={styles.problemText}>
          La boutique marche normalement, et Zara utilise déjà ce que le téléphone du client a retenu. Mais la base n'a pas encore le tableau de suivi.
          Pour l'activer :{'\n'}
          1. Ouvrez Supabase, puis « SQL Editor » et « New query ».{'\n'}
          2. Collez le contenu du fichier add-browsing-intelligence.sql, puis appuyez sur « Run ».{'\n'}
          3. Revenez ici et tirez la page vers le bas pour l'actualiser.{'\n'}
          Les chiffres comptent à partir de ce moment-là.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.problem} testID="browsing-error">
      <Text style={styles.problemTitle}>{reason === 'forbidden' ? 'Accès refusé' : 'Impossible de lire le suivi'}</Text>
      <Text style={styles.problemText}>{reason === 'forbidden' ? 'Seul un administrateur peut voir cette page.' : message}</Text>
      {reason === 'error' ? (
        <Pressable onPress={onRetry} style={styles.retry} testID="browsing-retry">
          <Text style={styles.retryText}>Réessayer</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Board({ overview, filter, setFilter, dimmed }: { overview: BrowsingOverview; filter: InterestFilter; setFilter: (f: InterestFilter) => void; dimmed: boolean }) {
  const rows = filterRows(overview.rows, filter);
  const { levels, totals } = overview;
  return (
    <View style={{ opacity: dimmed ? 0.5 : 1 }}>
      <View style={styles.levelGrid} testID="browsing-levels">
        <Level id="visitors" title="Visiteurs" value={totals.visitors} />
        <Level id="eleve" title="Intérêt élevé" value={levels.eleve} color={LEVEL_COLOR.eleve} />
        <Level id="moyen" title="Intérêt moyen" value={levels.moyen} color={LEVEL_COLOR.moyen} />
        <Level id="leger" title="Intérêt léger" value={levels.leger} color={LEVEL_COLOR.leger} />
      </View>
      <Text style={styles.footnote}>Chaque chiffre « intérêt » compte un article regardé par un visiteur (pas une personne).</Text>

      {overview.topProducts.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>🏆 Articles les plus regardés</Text>
          <View style={styles.box} testID="browsing-top-products">
            {overview.topProducts.map((p, i) => (
              <View key={p.productId || i} style={styles.topRow} testID={`browsing-top-product-${i}`}>
                <Text style={styles.topRank}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.topName} numberOfLines={2}>
                    {p.name}
                  </Text>
                  <Text style={styles.topMeta}>
                    {p.category ? `${p.category} · ` : ''}
                    {p.visitors} visiteur(s) · {formatSeconds(p.activeSeconds)} au total{p.highInterest > 0 ? ` · ${p.highInterest} intérêt élevé` : ''}
                  </Text>
                </View>
                <Text style={styles.topValue}>{p.views}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {overview.topCategories.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>🏷️ Catégories qui intéressent</Text>
          <View style={styles.box} testID="browsing-top-categories">
            {overview.topCategories.slice(0, 6).map((c, i) => (
              <View key={c.category + i} style={styles.topRow}>
                <Text style={styles.topName}>{c.category}</Text>
                <Text style={styles.topMeta}>{c.visitors} visiteur(s)</Text>
                <Text style={styles.topValue}>{c.views}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {overview.topSearches.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>🔍 Recherches les plus fréquentes</Text>
          <View style={styles.box} testID="browsing-top-searches">
            {overview.topSearches.slice(0, 8).map((s, i) => (
              <View key={s.query + i} style={styles.topRow}>
                <Text style={styles.topName}>« {s.query} »</Text>
                <Text style={styles.topValue}>{s.count}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <Text style={styles.sectionTitle}>👀 Détail : qui regarde quoi</Text>
      <View style={styles.periodRow}>
        {INTEREST_FILTERS.map((f) => (
          <Pressable key={f} style={[styles.chip, filter === f && styles.chipActive]} onPress={() => setFilter(f)} testID={`browsing-filter-${f}`}>
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>{FILTER_LABELS[f]}</Text>
          </Pressable>
        ))}
      </View>

      {overview.rows.length === 0 ? (
        <Text style={styles.empty} testID="browsing-empty">
          Aucun article regardé sur cette période. Le suivi compte à partir du moment où le script de la base a été appliqué.
        </Text>
      ) : rows.length === 0 ? (
        <Text style={styles.empty} testID="browsing-filter-empty">
          Aucune ligne avec ce niveau d'intérêt.
        </Text>
      ) : (
        rows.map((r, i) => <RowCard key={`${r.visitorRef}-${r.productId}-${i}`} row={r} index={i} />)
      )}
      {overview.rows.length >= 300 ? <Text style={styles.footnote}>Les 300 lignes les plus récentes sont affichées.</Text> : null}

      <Text style={styles.footnote}>
        Comment lire : le temps est le temps ACTIF (écran allumé, onglet ouvert, le client touche l'écran) ; un client qui laisse la page ouverte ne
        compte pas. L'intérêt est une estimation faite avec plusieurs signes (retours sur l'article, tailles ou couleurs essayées, panier, photos
        regardées) : le temps passé seul ne suffit jamais, et ce n'est jamais une certitude d'achat. Les données sont effacées après 90 jours.
      </Text>
    </View>
  );
}

function Level({ id, title, value, color }: { id: string; title: string; value: number; color?: string }) {
  return (
    <View style={styles.levelCard} testID={`browsing-level-${id}`}>
      <Text style={[styles.levelValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.levelTitle}>{title}</Text>
    </View>
  );
}

function RowCard({ row, index }: { row: OverviewRow; index: number }) {
  return (
    <View style={styles.rowCard} testID={`browsing-row-${index}`}>
      <View style={styles.rowTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowName} numberOfLines={2}>
            {row.productName}
          </Text>
          <Text style={styles.rowMeta}>
            {row.categoryName ? `${row.categoryName} · ` : ''}
            {row.accountRef ? `Compte ${row.accountRef}` : `Visiteur ${row.visitorRef}`}
          </Text>
        </View>
        <View style={[styles.badge, { borderColor: LEVEL_COLOR[row.interest] }]}>
          <Text style={[styles.badgeText, { color: LEVEL_COLOR[row.interest] }]}>{INTEREST_LABELS[row.interest]}</Text>
        </View>
      </View>
      <View style={styles.facts}>
        <Fact label="Vues" value={String(row.views)} />
        <Fact label="Visites" value={String(row.sessions)} />
        <Fact label="Session" value={row.sessionId ? row.sessionId.slice(0, 8) : 'sans compte'} />
        <Fact label="Temps actif" value={formatSeconds(row.activeSeconds)} />
        <Fact label="Dernière visite" value={`${formatSeconds(row.lastDurationSeconds)} · ${formatAgo(row.lastViewedAt)}`} />
        <Fact label="Clics (photos, tailles, couleurs)" value={String(row.variantClicks)} />
        <Fact label="Panier" value={CART_LABELS[row.cartStatus]} />
        <Fact label="Commande" value={row.orderStatus ? ORDER_STATUS_LABELS[row.orderStatus] ?? row.orderStatus : '—'} />
        <Fact label="Dernière suggestion de Zara" value={row.lastSuggestionKind ? `${SUGGESTION_LABELS[row.lastSuggestionKind]} · ${formatAgo(row.lastSuggestionAt)}` : '—'} />
      </View>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  loading: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  empty: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', marginVertical: spacing.lg, lineHeight: 19 },
  note: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, backgroundColor: colors.panel, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md },
  periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  chipTextActive: { color: colors.background, fontFamily: fonts.bodyBold },
  problem: { backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.gold, padding: spacing.md, gap: 8 },
  problemTitle: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 15 },
  problemText: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 20 },
  retry: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.gold },
  retryText: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  levelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xs },
  levelCard: { flexGrow: 1, flexBasis: '45%', backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  levelValue: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 30 },
  levelTitle: { color: colors.creamMuted, fontFamily: fonts.bodySemiBold, fontSize: 12 },
  sectionTitle: { color: colors.cream, fontFamily: fonts.display, fontSize: 16, marginTop: spacing.md, marginBottom: spacing.sm },
  box: { backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, marginBottom: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  topRank: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 14, width: 18 },
  topName: { flex: 1, color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  topMeta: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 1 },
  topValue: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 15, minWidth: 30, textAlign: 'right' },
  rowCard: { backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm, gap: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rowName: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 14 },
  rowMeta: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  badge: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fact: { flexGrow: 1, flexBasis: '45%', minWidth: 120 },
  factLabel: { color: colors.creamFaint, fontFamily: fonts.bodySemiBold, fontSize: 10, textTransform: 'uppercase' },
  factValue: { color: colors.cream, fontFamily: fonts.body, fontSize: 13, marginTop: 1 },
  footnote: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, marginVertical: spacing.md },
});
