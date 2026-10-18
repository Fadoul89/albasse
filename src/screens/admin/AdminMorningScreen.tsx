import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useAbandonedCarts } from '../../hooks/useAbandonedCarts';
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { fetchMorningSources, type MorningSources } from '../../lib/assistantData';
import { MORNING_WINDOWS, MORNING_WINDOW_LABELS, buildMorningReport, morningSince, plural, type MorningWindow } from '../../lib/morningReport';

// « Le matin avec Zara » : ce qui s'est passé pendant que vous dormiez, avec les vrais chiffres, et ce qu'il faut faire en premier.
const formatXAF = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const formatPct = (n: number | null) => (n === null ? null : `${String(n).replace('.', ',')} %`);

export function AdminMorningScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const [window, setWindow] = useState<MorningWindow>('night');
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<MorningSources | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const latest = useRef(0);
  const { carts: abandoned, isLoading: cartsLoading } = useAbandonedCarts();

  const load = useCallback(async (w: MorningWindow) => {
    const mine = ++latest.current;
    setLoading(true);
    const at = Date.now();
    const next = await fetchMorningSources(morningSince(w, at));
    if (mine !== latest.current) return; // une demande plus récente est partie entre-temps
    setNow(at);
    setSources(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (profile?.is_admin) void load(window);
  }, [window, profile?.is_admin, load]);

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  const ready = !!sources && !loading && !cartsLoading;
  const report = ready && sources
    ? buildMorningReport({
        now,
        since: morningSince(window, now),
        stats: sources.stats,
        browsing: sources.browsing,
        orders: sources.orders,
        callbacks: sources.callbacks,
        catalog: sources.catalog,
        abandonedCarts: abandoned.length,
      })
    : null;

  return (
    <View style={styles.screen} testID="morning-screen">
      <ScreenHeader title="Le matin avec Zara" showBack />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(window)} tintColor={colors.gold} />}>
        <Text style={styles.note}>
          ☀️ Bonjour ! Voici ce qui s'est passé pendant que vous dormiez, avec les vrais chiffres de la boutique, et ce qu'il faut faire en premier.
        </Text>

        <View style={styles.periodRow}>
          {MORNING_WINDOWS.map((w) => (
            <Pressable key={w} style={[styles.chip, window === w && styles.chipActive]} onPress={() => setWindow(w)} testID={`morning-window-${w}`}>
              <Text style={[styles.chipText, window === w && styles.chipTextActive]}>{MORNING_WINDOW_LABELS[w]}</Text>
            </Pressable>
          ))}
        </View>

        {!report ? <Text style={styles.loading}>Chargement…</Text> : null}

        {report ? (
          <>
            <Card title="✅ À faire en premier" testID="morning-todo">
              {report.todo.length === 0 ? (
                <Text style={styles.good} testID="morning-nothing">
                  Rien d’urgent pour le moment ✅
                </Text>
              ) : (
                report.todo.map((item) => (
                  <Pressable key={item.key} style={styles.todoRow} onPress={() => navigation.navigate(item.route)} testID={`morning-todo-${item.key}`}>
                    <Text style={styles.todoText}>
                      {item.icon} {item.text}
                    </Text>
                    <Text style={styles.arrow}>→</Text>
                  </Pressable>
                ))
              )}
            </Card>

            <Card title="💰 Ventes" testID="morning-sales">
              {report.sales ? (
                <>
                  <Text style={styles.big}>
                    {plural(report.sales.orders, 'commande')} · {formatXAF(report.sales.amount)}
                  </Text>
                  <Text style={styles.line}>
                    Dont par Zara : {plural(report.sales.zaraOrders, 'commande')} · {formatXAF(report.sales.zaraAmount)}
                    {formatPct(report.sales.zaraShare) ? ` (${formatPct(report.sales.zaraShare)} des commandes)` : ''}
                  </Text>
                  {report.toProcess ? (
                    <Text style={styles.line}>
                      À traiter en ce moment : {plural(report.toProcess.count, 'commande')}
                      {report.toProcess.count > 0 ? ` · ${formatXAF(report.toProcess.amount)}` : ''}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Unavailable id="sales" />
              )}
            </Card>

            <Card title="📲 Rappels WhatsApp" testID="morning-callbacks">
              {report.callbacks ? (
                <>
                  <Text style={styles.big}>
                    {report.callbacks.due} à faire aujourd’hui
                    {report.callbacks.late > 0 ? ` (dont ${report.callbacks.late} en retard)` : ''}
                  </Text>
                  <Text style={styles.line}>
                    {plural(report.callbacks.pending, 'demande')} en attente en tout · {plural(report.callbacks.newSince, 'nouvelle demande', 'nouvelles demandes')} pendant la période
                  </Text>
                </>
              ) : (
                <Unavailable id="callbacks" />
              )}
            </Card>

            <Card title="🛒 Presque acheté" testID="morning-carts">
              {report.carts ? (
                <>
                  <Text style={styles.big}>
                    {plural(report.carts.visitors, 'visiteur')} avec un panier non commandé
                  </Text>
                  {report.carts.products.map((p) => (
                    <Text key={p.name} style={styles.line}>
                      • {p.name} : {plural(p.visitors, 'visiteur')}
                    </Text>
                  ))}
                  {report.carts.abandoned !== null ? (
                    <Text style={styles.line}>{plural(report.carts.abandoned, 'panier abandonné', 'paniers abandonnés')} de clients connectés (relance WhatsApp en un clic)</Text>
                  ) : null}
                </>
              ) : (
                <Unavailable id="carts" />
              )}
            </Card>

            <Card title="👀 Les plus regardés" testID="morning-watched">
              {report.watched ? (
                <>
                  {report.visitors !== null ? <Text style={styles.line}>{plural(report.visitors, 'visiteur suivi', 'visiteurs suivis')} pendant la période</Text> : null}
                  {report.watched.products.length === 0 ? <Text style={styles.line}>Pas encore d’article regardé sur cette période.</Text> : null}
                  {report.watched.products.map((p) => (
                    <View key={p.name} style={styles.watchRow}>
                      <Text style={styles.watchName} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={styles.watchStat}>
                        {p.views} vues · {p.visitors} visiteur{p.visitors > 1 ? 's' : ''}
                      </Text>
                      {p.soldOut ? <Text style={styles.badgeRed}>Épuisé</Text> : p.lowStock ? <Text style={styles.badgeGold}>Presque épuisé ({p.stock})</Text> : null}
                    </View>
                  ))}
                  {report.watched.searches.length > 0 ? (
                    <Text style={[styles.line, { marginTop: 6 }]}>🔎 Recherches : {report.watched.searches.map((s) => `${s.query} (${s.count})`).join(', ')}</Text>
                  ) : null}
                </>
              ) : (
                <Unavailable id="watched" />
              )}
            </Card>

            <Card title="💬 Zara" testID="morning-zara">
              {report.zara ? (
                <Text style={styles.line}>
                  {plural(report.zara.conversations, 'conversation')} · {plural(report.zara.accounts, 'compte créé', 'comptes créés')} · {plural(report.zara.installs, 'installation')} de l’application
                </Text>
              ) : (
                <Unavailable id="zara" />
              )}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Card({ title, testID, children }: { title: string; testID: string; children: React.ReactNode }) {
  return (
    <View style={styles.card} testID={testID}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Unavailable({ id }: { id: string }) {
  return (
    <Text style={styles.unavailable} testID={`morning-unavailable-${id}`}>
      Ce chiffre n’a pas pu être lu pour le moment. Tirez la page vers le bas pour réessayer.
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  loading: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  note: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, backgroundColor: colors.panel, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md },
  periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 13 },
  chipTextActive: { color: colors.background, fontFamily: fonts.bodyBold },
  card: { backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm, gap: 4 },
  cardTitle: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 14, marginBottom: 4 },
  big: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 16 },
  line: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  good: { color: colors.success, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  todoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gold, backgroundColor: 'rgba(212,175,55,0.08)', marginBottom: 6 },
  todoText: { flex: 1, color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 19 },
  arrow: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 16 },
  watchRow: { paddingVertical: 4, gap: 2 },
  watchName: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  watchStat: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12 },
  badgeGold: { alignSelf: 'flex-start', color: colors.background, backgroundColor: colors.gold, fontFamily: fonts.bodyBold, fontSize: 11, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden' },
  badgeRed: { alignSelf: 'flex-start', color: colors.cream, backgroundColor: colors.error, fontFamily: fonts.bodyBold, fontSize: 11, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden' },
  unavailable: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
});
