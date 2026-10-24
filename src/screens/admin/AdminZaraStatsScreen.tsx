import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { fetchAssistantStats, fetchBrowsingOverview, type AssistantStatsResult } from '../../lib/assistantData';
import { formatSeconds } from '../../lib/browsingOverview';
import { supabase } from '../../lib/supabase';
import { DEVICES, DEVICE_LABELS, PERIOD_LABELS, PERIOD_ORDER, type Device, type StatsPeriod, type ZaraStats } from '../../lib/assistantStats';

const formatXAF = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const formatPct = (n: number | null) => (n === null ? '—' : `${String(n).replace('.', ',')} %`);

export function AdminZaraStatsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [period, setPeriod] = useState<StatsPeriod>('30d');
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<AssistantStatsResult | null>(null);
  const latest = useRef(0);

  const load = useCallback(async (p: StatsPeriod) => {
    const mine = ++latest.current;
    setLoading(true);
    const next = await fetchAssistantStats(p);
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
    <View style={styles.screen} testID="zara-stats">
      <ScreenHeader title="Statistiques de Zara" showBack />
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(period)} tintColor={colors.gold} />}
      >
        <Text style={styles.note}>
          💬 Ce que Zara apporte à la boutique : ses ventes, les comptes et les installations qui viennent d'elle, et sur quel téléphone. Seul
          le type d'appareil est noté (iPhone, Android...), aucune donnée personnelle.
        </Text>

        <View style={styles.periodRow}>
          {PERIOD_ORDER.map((p) => (
            <Pressable key={p} style={[styles.periodChip, period === p && styles.periodChipActive]} onPress={() => setPeriod(p)} testID={`zara-period-${p}`}>
              <Text style={[styles.periodChipText, period === p && styles.periodChipTextActive]}>{PERIOD_LABELS[p]}</Text>
            </Pressable>
          ))}
        </View>

        {loading && !result ? <Text style={styles.loading}>Chargement…</Text> : null}

        {result && !result.ok ? <Problem reason={result.reason} message={result.message} onRetry={() => load(period)} /> : null}

        {result && result.ok ? <Stats stats={result.stats} dimmed={loading} /> : null}

        <TopProducts period={period} />
      </ScrollView>
    </View>
  );
}

function Problem({ reason, message, onRetry }: { reason: 'not_installed' | 'forbidden' | 'error'; message: string; onRetry: () => void }) {
  if (reason === 'not_installed') {
    return (
      <View style={styles.problem} testID="zara-stats-not-installed">
        <Text style={styles.problemTitle}>Les statistiques de Zara ne sont pas encore activées</Text>
        <Text style={styles.problemText}>
          La boutique marche normalement, mais la base n'a pas encore les compteurs de Zara. Pour les activer :{'\n'}
          1. Ouvrez Supabase, puis « SQL Editor » et « New query ».{'\n'}
          2. Collez le contenu du fichier add-assistant-stats.sql, puis appuyez sur « Run ».{'\n'}
          3. Revenez ici et tirez la page vers le bas pour l'actualiser.{'\n'}
          Les chiffres comptent à partir de ce moment-là.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.problem} testID="zara-stats-error">
      <Text style={styles.problemTitle}>{reason === 'forbidden' ? 'Accès refusé' : 'Impossible de lire les statistiques'}</Text>
      <Text style={styles.problemText}>{reason === 'forbidden' ? 'Seul un administrateur peut voir cette page.' : message}</Text>
      {reason === 'error' ? (
        <Pressable onPress={onRetry} style={styles.retry} testID="zara-stats-retry">
          <Text style={styles.retryText}>Réessayer</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type TopLine = { id: string; name: string; value: string; sub: string };

// Les produits qui retiennent le plus les visiteurs (temps passé sur la fiche, pendant la période) et les plus aimés (cœurs, depuis le début).
function TopProducts({ period }: { period: StatsPeriod }) {
  const [watched, setWatched] = useState<TopLine[] | null>(null);
  const [liked, setLiked] = useState<TopLine[] | null>(null);
  const [likedError, setLikedError] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchBrowsingOverview(period).then((res) => {
      if (!alive) return;
      if (!res.ok) return setWatched([]);
      const byProduct = new Map<string, { name: string; seconds: number; views: number }>();
      for (const r of res.overview.rows) {
        const cur = byProduct.get(r.productId) ?? { name: r.productName, seconds: 0, views: 0 };
        cur.seconds += r.activeSeconds;
        cur.views += r.views;
        byProduct.set(r.productId, cur);
      }
      const top = [...byProduct.entries()]
        .sort((a, b) => b[1].seconds - a[1].seconds)
        .slice(0, 3)
        .map(([id, v]) => ({ id, name: v.name, value: formatSeconds(v.seconds), sub: `${v.views} vue(s) sur la période` }));
      setWatched(top);
    });
    return () => {
      alive = false;
    };
  }, [period]);

  useEffect(() => {
    let alive = true;
    Promise.resolve(supabase.from('products').select('id,name,likes_count').order('likes_count', { ascending: false }).limit(3)).then(({ data, error }) => {
      if (!alive) return;
      if (error || !data) return setLikedError(true);
      setLiked(
        (data as { id: string; name: string; likes_count: number | null }[])
          .filter((p) => (p.likes_count ?? 0) > 0)
          .map((p) => ({ id: p.id, name: p.name, value: `❤️ ${p.likes_count ?? 0}`, sub: 'cœurs depuis le début' }))
      );
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <View testID="zara-stats-top-products">
      <Text style={styles.sectionTitle}>👀 Ce que les visiteurs regardent le plus longtemps</Text>
      <TopTable lines={watched} empty="Aucune visite de fiche sur cette période" />

      <Text style={styles.sectionTitle}>❤️ Les produits les plus aimés</Text>
      <TopTable
        lines={liked}
        empty={likedError ? "Compteur de « j'aime » pas encore activé (lancez add-product-likes.sql)" : 'Aucun cœur pour le moment'}
      />
    </View>
  );
}

function TopTable({ lines, empty }: { lines: TopLine[] | null; empty: string }) {
  if (lines === null) return <Text style={styles.loading}>Chargement…</Text>;
  if (lines.length === 0) return <Text style={styles.note}>{empty}</Text>;
  return (
    <View style={styles.table}>
      {lines.map((l, i) => (
        <View key={l.id} style={styles.topRow}>
          <Text style={styles.topRank}>{i + 1}</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.topName} numberOfLines={1}>
              {l.name}
            </Text>
            <Text style={styles.topSub}>{l.sub}</Text>
          </View>
          <Text style={styles.topValue}>{l.value}</Text>
        </View>
      ))}
    </View>
  );
}

function Stats({ stats, dimmed }: { stats: ZaraStats; dimmed: boolean }) {
  const { sales, accounts, installs, conversations, shop } = stats;
  const shownDevices = DEVICES.filter(
    (d) => d !== 'Autre' || conversations.byDevice.Autre + sales.byDevice.Autre.count + accounts.byDevice.Autre + installs.byDevice.Autre > 0
  );
  return (
    <View style={{ opacity: dimmed ? 0.5 : 1 }}>
      <View style={styles.bigGrid}>
        <BigStat
          id="sales"
          icon="🛒"
          title="Ventes réalisées par Zara"
          value={String(sales.count)}
          lines={[
            formatXAF(sales.amount),
            `dont livrées : ${sales.delivered.count} (${formatXAF(sales.delivered.amount)})`,
            `${formatPct(stats.shares.orders)} des commandes de la boutique (${shop.orders})`,
            ...(sales.cancelled > 0 ? [`${sales.cancelled} annulée(s), non comptée(s)`] : []),
          ]}
        />
        <BigStat
          id="accounts"
          icon="👤"
          title="Comptes créés grâce à Zara"
          value={String(accounts.count)}
          lines={[`${formatPct(stats.shares.accounts)} des nouveaux comptes (${shop.accounts})`]}
        />
        <BigStat
          id="installs"
          icon="📲"
          title="Installations grâce à Zara"
          value={String(installs.count)}
          lines={[`${formatPct(stats.shares.installs)} des installations (${shop.installs})`, `Aides iPhone envoyées : ${installs.iosGuides}`]}
        />
        <BigStat
          id="chats"
          icon="💬"
          title="Conversations avec Zara"
          value={String(conversations.total)}
          lines={[stats.ordersPer100Chats === null ? 'Aucune conversation sur cette période' : `${String(stats.ordersPer100Chats).replace('.', ',')} vente(s) pour 100 conversations`]}
        />
      </View>

      <Text style={styles.sectionTitle}>📱 Par appareil : Zara reconnaît iPhone et Android</Text>
      <View style={styles.table} testID="zara-stats-devices">
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 1.3, textAlign: 'left' }]}>Appareil</Text>
          <Text style={styles.th}>Conv.</Text>
          <Text style={[styles.th, { flex: 1.5 }]}>Ventes</Text>
          <Text style={styles.th}>Comptes</Text>
          <Text style={styles.th}>Install.</Text>
        </View>
        {shownDevices.map((d) => (
          <DeviceRow key={d} device={d} stats={stats} />
        ))}
      </View>

      <Text style={styles.sectionTitle}>📲 Le parcours d'installation</Text>
      <View style={styles.table} testID="zara-stats-install-funnel">
        <FunnelRow label="Question « Avez-vous déjà installé l'application ? » posée" value={installs.questions} id="questions" />
        <FunnelRow label="Réponse « Oui, déjà installée »" value={installs.alreadyInstalled} id="already" />
        <FunnelRow label="Réponse « Plus tard »" value={installs.later} id="later" />
        <FunnelRow label="Aide iPhone envoyée (photo pas à pas)" value={installs.iosGuides} id="ios" />
        <FunnelRow label="Installées grâce à Zara (confirmées)" value={installs.count} id="done" strong />
      </View>
      <Text style={styles.footnote}>
        Sur iPhone, le site ne peut pas savoir si le client a vraiment installé : on compte les aides envoyées. Sur Android, l'installation est
        confirmée quand le client touche « Installer » chez Zara et accepte.
      </Text>

      <Text style={styles.footnote}>
        Comment on compte : une vente = une commande passée dans le chat de Zara (sans les annulées ni les fausses). Un compte = un client qui a
        touché « Créer mon compte » chez Zara puis s'est inscrit (dans les 3 jours). Les jours commencent à minuit, heure du Tchad. Les
        chiffres commencent le jour où le script de la base a été appliqué.
      </Text>
    </View>
  );
}

function BigStat({ id, icon, title, value, lines }: { id: string; icon: string; title: string; value: string; lines: string[] }) {
  return (
    <View style={styles.bigCard} testID={`zara-stat-${id}`}>
      <Text style={styles.bigTitle}>
        {icon} {title}
      </Text>
      <Text style={styles.bigValue} testID={`zara-stat-${id}-value`}>
        {value}
      </Text>
      {lines.map((line, i) => (
        <Text key={i} style={i === 0 ? styles.bigLine1 : styles.bigLine}>
          {line}
        </Text>
      ))}
    </View>
  );
}

function DeviceRow({ device, stats }: { device: Device; stats: ZaraStats }) {
  const sale = stats.sales.byDevice[device];
  return (
    <View style={styles.tr} testID={`zara-device-${device}`}>
      <Text style={[styles.td, { flex: 1.3, textAlign: 'left', fontFamily: fonts.bodySemiBold }]}>{DEVICE_LABELS[device]}</Text>
      <Text style={styles.td}>{stats.conversations.byDevice[device]}</Text>
      <View style={{ flex: 1.5, alignItems: 'center' }}>
        <Text style={styles.td}>{sale.count}</Text>
        {sale.count > 0 ? <Text style={styles.tdSmall}>{Math.round(sale.amount).toLocaleString('fr-FR')}</Text> : null}
      </View>
      <Text style={styles.td}>{stats.accounts.byDevice[device]}</Text>
      <Text style={styles.td}>{stats.installs.byDevice[device]}</Text>
    </View>
  );
}

function FunnelRow({ label, value, id, strong }: { label: string; value: number; id: string; strong?: boolean }) {
  return (
    <View style={styles.tr} testID={`zara-funnel-${id}`}>
      <Text style={[styles.td, { flex: 1, textAlign: 'left' }, strong && { color: colors.goldLight, fontFamily: fonts.bodyBold }]}>{label}</Text>
      <Text style={[styles.tdValue, strong && { color: colors.goldLight }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  loading: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  note: {
    color: colors.creamMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md },
  periodChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  periodChipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  periodChipText: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  periodChipTextActive: { color: colors.background, fontFamily: fonts.bodyBold },
  problem: { backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.gold, padding: spacing.md, gap: 8 },
  problemTitle: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 15 },
  problemText: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 20 },
  retry: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.gold },
  retryText: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  bigGrid: { gap: spacing.sm, marginBottom: spacing.lg },
  bigCard: { backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  bigTitle: { color: colors.creamMuted, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  bigValue: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 34, marginVertical: 2 },
  bigLine1: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  bigLine: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  sectionTitle: { color: colors.cream, fontFamily: fonts.display, fontSize: 16, marginBottom: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  topRank: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 14, width: 18, textAlign: 'center' },
  topName: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  topSub: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  topValue: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 13 },
  table: { backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, marginBottom: spacing.lg },
  tableHeader: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  th: { flex: 1, color: colors.creamFaint, fontFamily: fonts.bodySemiBold, fontSize: 10, textTransform: 'uppercase', textAlign: 'center' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  td: { flex: 1, color: colors.cream, fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },
  tdSmall: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 10, marginTop: 1 },
  tdValue: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 15, minWidth: 40, textAlign: 'right' },
  footnote: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, marginBottom: spacing.md },
});
