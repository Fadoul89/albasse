import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Animated, RefreshControl, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import {
  PERIODS,
  change,
  compact,
  fcfa,
  litTicks,
  nb,
  orderRateText,
  parseOverview,
  periodTitle,
  shareOf,
  signupRate,
  sourceIcon,
  sourceLabel,
  terminalLine,
  weekBars,
  type Overview,
  type PeriodKey,
} from '../../lib/hackerDashboard';

// Tableau de bord « couleur hacker » (demande du patron, 16 novembre 2026) : fond noir, vert néon, écriture de terminal.
// Tous les chiffres viennent de la base (fonction admin_dashboard_overview, add-admin-dashboard.sql) : rien n'est inventé.
// L'ancien tableau de bord (Admin › Tableau de bord) reste en place : celui-ci s'ouvre depuis son bouton « Tableau de bord hacker ».

const C = {
  bg: '#010401',
  panel: '#03140a',
  border: '#0d3b1c',
  green: '#00ff41',
  green2: '#39ff14',
  deep: '#008f26',
  text: '#c9ffd6',
  muted: '#4fbf6b',
  faint: '#2f8a47',
  track: '#0d3b1c',
  down: '#ff5c7a',
  onGreen: '#001a06',
};
const MONO = Platform.select({ web: '"DejaVu Sans Mono", "Liberation Mono", Menlo, Consolas, "Courier New", monospace', default: 'monospace' });
const glow = { textShadowColor: 'rgba(0,255,65,0.55)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 };

const clockNow = () => {
  try {
    return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Ndjamena' }).format(new Date());
  } catch {
    return '';
  }
};

export function AdminHackerDashboardScreen() {
  const profile = useAuthStore((s) => s.profile);
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [data, setData] = useState<Partial<Record<PeriodKey, Overview>>>({});
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading');
  const [clock, setClock] = useState(clockNow());
  const cursor = useRef(new Animated.Value(1)).current;

  // le curseur du terminal qui clignote, et l'heure de N'Djamena
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(cursor, { toValue: 0, duration: 500, useNativeDriver: Platform.OS !== 'web' }), Animated.timing(cursor, { toValue: 1, duration: 500, useNativeDriver: Platform.OS !== 'web' })]));
    loop.start();
    const t = setInterval(() => setClock(clockNow()), 30000);
    return () => {
      loop.stop();
      clearInterval(t);
    };
  }, [cursor]);

  // la période affichée en ce moment : une réponse arrivée après un changement de période range ses chiffres sans toucher à l'état de l'écran
  const shown = useRef<PeriodKey>(period);
  shown.current = period;
  const load = useCallback(async (k: PeriodKey, force = false) => {
    if (!force && data[k]) {
      setState('ok');
      return;
    }
    setState((s) => (data[k] ? s : 'loading'));
    const { data: raw, error } = await supabase.rpc('admin_dashboard_overview', { p_period: k });
    const parsed = error ? null : parseOverview(raw);
    if (parsed) setData((d) => ({ ...d, [k]: parsed }));
    if (shown.current !== k) return;
    if (error) setState((error as { code?: string }).code === 'PGRST202' ? 'missing' : 'error');
    else setState(parsed ? 'ok' : 'error');
  }, [data]);

  useEffect(() => {
    if (profile?.is_admin) void load(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, profile?.is_admin]);

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <Text style={[styles.mono, styles.denied]}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  const o = data[period];
  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : (navigation as unknown as { navigate: (r: string) => void }).navigate('AdminDashboard'));

  return (
    <View style={styles.screen} testID="hacker-dashboard">
      <ScrollView
        contentContainerStyle={[styles.content, wide && styles.contentWide]}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load(period, true)} tintColor={C.green} />}
      >
        {/* en-tête : retour, logo, heure de N'Djamena */}
        <View style={styles.topBar}>
          <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={10} testID="hacker-back">
            <Text style={[styles.mono, styles.back]}>‹ retour</Text>
          </Pressable>
          <View style={styles.logoRow}>
            <View style={styles.logoSq}>
              <Text style={[styles.mono, styles.logoTxt]}>&gt;_</Text>
            </View>
            <View>
              <Text style={[styles.mono, styles.brand, glow]}>Albasse Shopping</Text>
              <Text style={[styles.mono, styles.brandSub]}>Tableau de bord</Text>
            </View>
          </View>
          <Text style={[styles.mono, styles.clock, glow]} testID="hacker-clock">
            {clock}
          </Text>
        </View>

        {/* la ligne de commande */}
        <View style={styles.terminal}>
          <Text style={[styles.mono, styles.cmd, !wide && styles.cmdSmall, glow]} testID="hacker-command">
            {terminalLine(period)} <Animated.Text style={[styles.cursor, { opacity: cursor }]}>█</Animated.Text>
          </Text>
          <Text style={[styles.mono, styles.cmdSub]}>{`Bonjour Patron. Voici votre boutique ${periodTitle(period)}.`}</Text>
        </View>

        {/* les périodes */}
        <View style={styles.tabs} role="radiogroup" aria-label="Période">
          {PERIODS.map((p) => (
            <Pressable key={p.key} role="radio" aria-checked={p.key === period} onPress={() => setPeriod(p.key)} style={[styles.tab, p.key === period && styles.tabOn]} testID={`hacker-period-${p.key}`}>
              <Text style={[styles.mono, styles.tabTxt, p.key === period && styles.tabTxtOn]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>

        {state === 'loading' && !o ? (
          <Text style={[styles.mono, styles.info]} testID="hacker-loading">
            &gt; chargement des chiffres…
          </Text>
        ) : state === 'missing' ? (
          <Text style={[styles.mono, styles.err]} testID="hacker-missing">
            &gt; ERREUR : la fonction de la base n'est pas encore installée. Lancez add-admin-dashboard.sql dans Supabase.
          </Text>
        ) : state === 'error' && !o ? (
          <View>
            <Text style={[styles.mono, styles.err]} testID="hacker-error">
              &gt; ERREUR : impossible de lire les chiffres pour le moment.
            </Text>
            <Pressable onPress={() => void load(period, true)} style={styles.retry} testID="hacker-retry">
              <Text style={[styles.mono, styles.tabTxtOn]}>Réessayer</Text>
            </Pressable>
          </View>
        ) : o ? (
          <Board o={o} wide={wide} />
        ) : null}
      </ScrollView>
    </View>
  );
}

function Card({ children, style, testID }: { children: React.ReactNode; style?: object; testID?: string }) {
  return (
    <View style={[styles.card, style]} testID={testID}>
      {children}
    </View>
  );
}

function Stat({ title, tag, value, line, trend, testID, wide }: { title: string; tag: string; value: string; line: string | null; trend?: 'up' | 'down' | 'flat'; testID: string; wide: boolean }) {
  return (
    <Card style={wide ? styles.statWide : styles.stat} testID={testID}>
      <View style={styles.statHead}>
        <Text style={[styles.mono, styles.statTitle]}>{title}</Text>
        <Text style={[styles.mono, styles.tag]}>{tag}</Text>
      </View>
      <Text style={[styles.mono, styles.statValue, glow]} testID={`${testID}-value`}>
        {value}
      </Text>
      {line ? (
        <Text style={[styles.mono, styles.statLine, trend === 'up' && styles.up, trend === 'down' && styles.down]} testID={`${testID}-line`}>
          {line}
        </Text>
      ) : null}
    </Card>
  );
}

function Board({ o, wide }: { o: Overview; wide: boolean }) {
  const vis = change(o.visitors, o.visitorsPrev, o.period);
  const cli = change(o.newCustomers, o.newCustomersPrev, o.period);
  const bars = weekBars(o.weeks);
  const maxBar = Math.max(0, ...bars.map((b) => b.visitors));
  // sur téléphone, seuls les plus grands chiffres et la semaine en cours sont écrits au-dessus des barres (sinon ils se chevauchent)
  const shownLabels = new Set(wide ? bars.map((_, i) => i) : [...bars.map((b, i) => [b.visitors, i] as const).sort((a, b) => b[0] - a[0]).slice(0, 3).map(([, i]) => i), bars.length - 1]);
  const rate = signupRate(o.newCustomers, o.visitors);
  const maxSource = Math.max(0, ...o.sources.map((s) => s.visitors));
  const maxTop = Math.max(0, ...o.top.map((t) => t.visitors));
  const TICKS = 36;
  const lit = rate ? litTicks(rate.pct, TICKS) : 0;

  return (
    <View>
      <View style={styles.stats}>
        <Stat wide={wide} testID="hacker-visitors" title="Visiteurs" tag="[◉]" value={nb(o.visitors)} line={vis?.text ?? null} trend={vis?.trend} />
        <Stat wide={wide} testID="hacker-customers" title="Nouveaux clients" tag="[+]" value={nb(o.newCustomers)} line={cli?.text ?? null} trend={cli?.trend} />
        <Stat wide={wide} testID="hacker-orders" title="Commandes" tag="[$]" value={nb(o.orders)} line={`Chiffre livré : ${fcfa(o.revenue)}`} />
        <Stat wide={wide} testID="hacker-products" title="Articles en vente" tag="[#]" value={nb(o.products)} line={`dans ${nb(o.categories)} catégorie${o.categories > 1 ? 's' : ''}`} />
      </View>

      <View style={wide ? styles.rowWide : undefined}>
        <Card style={wide ? { flex: 2 } : undefined} testID="hacker-weeks">
          <View style={styles.cardHead}>
            <Text style={[styles.mono, styles.cardTitle, glow]}>Visiteurs par semaine</Text>
            <Text style={[styles.mono, styles.cardSub]}>12 semaines</Text>
          </View>
          <View style={styles.bars}>
            {bars.map((b, i) => (
              <View key={b.label} style={styles.barCol}>
                {shownLabels.has(i) && b.visitors > 0 ? (
                  <Text style={[styles.mono, styles.barNum, { bottom: (b.height / 100) * BAR_H + 2 }]} testID={`hacker-barnum-${i}`}>
                    {wide ? nb(b.visitors) : compact(b.visitors)}
                  </Text>
                ) : null}
                <View style={[styles.bar, { height: (b.height / 100) * BAR_H }, b.current && styles.barNow, b.visitors === maxBar && maxBar > 0 && !b.current && styles.barTop]} testID={`hacker-bar-${i}`} />
              </View>
            ))}
          </View>
          <View style={styles.barLabels}>
            {bars.map((b) => (
              <Text key={b.label} style={[styles.mono, styles.barLabel, !wide && styles.barLabelSmall]} numberOfLines={1}>
                {b.label}
              </Text>
            ))}
          </View>
          <Text style={[styles.mono, styles.legend]}>Dernière barre (plus claire) : la semaine en cours, pas encore finie.</Text>
        </Card>

        <Card style={wide ? { flex: 1 } : undefined} testID="hacker-gauge">
          <View style={styles.cardHead}>
            <Text style={[styles.mono, styles.cardTitle, glow]}>Visiteurs → comptes créés</Text>
          </View>
          <View style={styles.gauge}>
            {Array.from({ length: TICKS }, (_, i) => {
              const theta = 180 - (i + 0.5) * (180 / TICKS);
              const rad = (theta * Math.PI) / 180;
              return (
                <View
                  key={i}
                  style={[
                    styles.tick,
                    i < lit && styles.tickOn,
                    { left: G_CX + G_R * Math.cos(rad) - 2, top: G_CY - G_R * Math.sin(rad) - 8, transform: [{ rotate: `${90 - theta}deg` }] },
                  ]}
                />
              );
            })}
            <Text style={[styles.mono, styles.gaugePct, glow]} testID="hacker-rate">
              {rate ? rate.text : '—'}
            </Text>
          </View>
          <Text style={[styles.mono, styles.gaugeSub]} testID="hacker-rate-sub">
            {`${nb(o.newCustomers)} nouveaux clients sur ${nb(o.visitors)} visiteurs`}
          </Text>
          <Text style={[styles.mono, styles.gaugeSub]}>{orderRateText(o.orders, o.visitors)}</Text>
        </Card>
      </View>

      <View style={wide ? styles.rowWide : undefined}>
        <Card style={wide ? { flex: 1 } : undefined} testID="hacker-sources">
          <View style={styles.cardHead}>
            <Text style={[styles.mono, styles.cardTitle, glow]}>D'où viennent les visiteurs</Text>
          </View>
          {o.sources.length === 0 ? <Text style={[styles.mono, styles.cardSub]}>&gt; aucune visite sur cette période</Text> : null}
          {o.sources.map((s) => (
            <View key={s.source} style={styles.rankRow}>
              <Text style={[styles.mono, styles.rankName]} numberOfLines={1}>{`${sourceIcon(s.source)} ${sourceLabel(s.source)}`}</Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${shareOf(s.visitors, maxSource)}%` }]} />
              </View>
              <Text style={[styles.mono, styles.rankNum]}>{nb(s.visitors)}</Text>
            </View>
          ))}
        </Card>
        <Card style={wide ? { flex: 1 } : undefined} testID="hacker-top">
          <View style={styles.cardHead}>
            <Text style={[styles.mono, styles.cardTitle, glow]}>Articles les plus regardés</Text>
            <Text style={[styles.mono, styles.cardSub]}>personnes</Text>
          </View>
          {o.top.length === 0 ? <Text style={[styles.mono, styles.cardSub]}>&gt; aucun article regardé sur cette période</Text> : null}
          {o.top.map((t) => (
            <View key={t.productId} style={styles.rankRow}>
              <Text style={[styles.mono, styles.rankName]} numberOfLines={1}>
                {t.name}
              </Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${shareOf(t.visitors, maxTop)}%` }]} />
              </View>
              <Text style={[styles.mono, styles.rankNum]}>{nb(t.visitors)}</Text>
            </View>
          ))}
        </Card>
      </View>
      <Text style={[styles.mono, styles.footer]}>&gt; chiffres réels, comptés dans la base · visites des administrateurs exclues</Text>
    </View>
  );
}

const BAR_H = 140;
const G_W = 220;
const G_CX = G_W / 2;
const G_CY = 112;
const G_R = 92;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: 12, paddingBottom: 60 },
  contentWide: { paddingHorizontal: 24, maxWidth: 1400, width: '100%', alignSelf: 'center' },
  mono: { fontFamily: MONO, color: C.text },
  denied: { color: C.muted, textAlign: 'center', marginTop: 60 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  back: { color: C.green, fontSize: 13 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' },
  logoSq: { width: 34, height: 34, borderRadius: 9, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', shadowColor: C.green, shadowOpacity: 0.6, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  logoTxt: { color: C.onGreen, fontWeight: '900', fontSize: 14 },
  brand: { color: C.text, fontWeight: '700', fontSize: 14 },
  brandSub: { color: C.muted, fontSize: 10.5 },
  clock: { color: C.green, fontSize: 15, fontWeight: '700' },
  terminal: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 12, marginBottom: 10 },
  cmd: { color: C.green, fontSize: 12.5, fontWeight: '700' },
  cmdSmall: { fontSize: 11.2 },
  cursor: { color: C.green, fontFamily: MONO },
  cmdSub: { color: C.muted, fontSize: 11.5, marginTop: 4 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  tab: { borderWidth: 1, borderColor: C.border, backgroundColor: C.panel, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  tabOn: { backgroundColor: C.green, borderColor: C.green },
  tabTxt: { color: C.muted, fontSize: 12 },
  tabTxtOn: { color: C.onGreen, fontWeight: '700', fontSize: 12 },
  info: { color: C.green, fontSize: 13, marginTop: 20 },
  err: { color: C.down, fontSize: 13, marginTop: 20, lineHeight: 19 },
  retry: { alignSelf: 'flex-start', marginTop: 12, backgroundColor: C.green, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 9 },
  card: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 12, marginBottom: 9 },
  stat: { flexBasis: '47%', flexGrow: 1, marginBottom: 0 },
  statWide: { flexBasis: '22%', flexGrow: 1, marginBottom: 0 },
  statHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statTitle: { color: C.muted, fontSize: 11.5 },
  tag: { color: C.green, fontSize: 10.5, backgroundColor: '#06260f', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  statValue: { color: C.text, fontSize: 26, fontWeight: '800', marginTop: 6 },
  statLine: { color: C.muted, fontSize: 11, marginTop: 3 },
  up: { color: C.green, fontWeight: '700' },
  down: { color: C.down, fontWeight: '700' },
  rowWide: { flexDirection: 'row', gap: 9 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { color: C.text, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  cardSub: { color: C.muted, fontSize: 11 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: BAR_H + 22, marginTop: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  barCol: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'stretch' },
  bar: { backgroundColor: C.deep, borderTopLeftRadius: 5, borderTopRightRadius: 5, borderTopWidth: 2, borderTopColor: C.green2 },
  barTop: { backgroundColor: C.green, shadowColor: C.green, shadowOpacity: 0.7, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  barNow: { opacity: 0.45 },
  barNum: { position: 'absolute', left: -14, right: -14, textAlign: 'center', color: '#9dffb4', fontSize: 9, fontWeight: '700', whiteSpace: 'nowrap' } as object,
  barLabels: { flexDirection: 'row', gap: 4, marginTop: 4 },
  barLabel: { flex: 1, textAlign: 'center', color: C.faint, fontSize: 10 },
  barLabelSmall: { fontSize: 7.5 },
  legend: { color: C.faint, fontSize: 10, marginTop: 6 },
  gauge: { width: G_W, height: G_CY + 10, alignSelf: 'center', marginTop: 8 },
  tick: { position: 'absolute', width: 4, height: 16, borderRadius: 2, backgroundColor: C.track },
  tickOn: { backgroundColor: C.green, shadowColor: C.green, shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  gaugePct: { position: 'absolute', left: 0, right: 0, bottom: 8, textAlign: 'center', color: C.text, fontSize: 26, fontWeight: '800' },
  gaugeSub: { color: C.muted, fontSize: 11, textAlign: 'center', marginTop: 3 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9 },
  rankName: { width: '38%', color: '#a8f5bb', fontSize: 11.5 },
  track: { flex: 1, height: 7, backgroundColor: C.track, borderRadius: 99, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: C.green, borderRadius: 99 },
  rankNum: { width: 58, textAlign: 'right', color: '#9dffb4', fontSize: 12, fontWeight: '700' },
  footer: { color: C.faint, fontSize: 10.5, marginTop: 6, textAlign: 'center' },
});
