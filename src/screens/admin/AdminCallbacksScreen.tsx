import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Linking } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { deleteCallback, fetchCallbacks, setCallbackDone, type CallbackListResult, type CallbackRow, type CallbackSource } from '../../lib/assistantData';
import { chadDayIso, dayLabelOf } from '../../lib/assistantSales';

// « Rappels WhatsApp » : les clients qui ont laissé leur numéro à Zara (avec leur accord). On les écrit au réveil.
const SOURCE_LABELS: Record<CallbackSource, string> = {
  later: 'A dit « je réfléchis »',
  price: 'Trouve que c’est cher',
  cart: 'Panier en attente',
  chat: 'A demandé un rappel',
};

const spaced = (digits: string) => digits.replace(/(\d{2})(?=\d)/g, '$1 ');

function ago(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return `il y a ${d} jour${d > 1 ? 's' : ''}`;
}

// Le jour choisi par le client : à faire aujourd'hui, en retard, ou à venir. Sans jour (anciennes demandes) : rien à afficher.
type DayState = 'late' | 'today' | 'soon';
function dayState(row: CallbackRow, today: string): DayState | null {
  if (!row.wanted_day) return null;
  return row.wanted_day < today ? 'late' : row.wanted_day === today ? 'today' : 'soon';
}

// À rappeler en premier : les jours déjà passés, puis aujourd'hui, puis les jours à venir ; les demandes sans jour viennent après (les plus récentes d'abord).
function byDay(a: CallbackRow, b: CallbackRow): number {
  if (a.wanted_day && b.wanted_day) return a.wanted_day.localeCompare(b.wanted_day) || a.created_at.localeCompare(b.created_at);
  if (a.wanted_day) return -1;
  if (b.wanted_day) return 1;
  return b.created_at.localeCompare(a.created_at);
}

const whatsappLink = (row: CallbackRow) =>
  `https://wa.me/235${row.phone}?text=${encodeURIComponent(`Bonjour ${row.name}, ici l'équipe Albasse Shopping 😊 Vous avez demandé que nous vous écrivions. Comment pouvons-nous vous aider ?`)}`;

type Tab = 'new' | 'done';

export function AdminCallbacksScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [tab, setTab] = useState<Tab>('new');
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<CallbackListResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // suppression en deux temps : « 🗑 » puis « Oui, supprimer » (pas de fenetre du navigateur)
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState(false);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const mine = ++latest.current;
    setLoading(true);
    const next = await fetchCallbacks();
    if (mine !== latest.current) return;
    setResult(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (profile?.is_admin) void load();
  }, [profile?.is_admin, load]);

  const toggle = async (row: CallbackRow) => {
    setBusy(row.id);
    const ok = await setCallbackDone(row.id, row.status === 'new');
    setBusy(null);
    if (ok) await load();
  };

  const remove = async (row: CallbackRow) => {
    setBusy(row.id);
    setDeleteError(false);
    const ok = await deleteCallback(row.id);
    setBusy(null);
    setConfirming(null);
    if (ok) await load();
    else setDeleteError(true);
  };

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  const rows = result && result.ok ? result.rows : [];
  const today = chadDayIso();
  const pending = rows.filter((r) => r.status === 'new').sort(byDay);
  const done = rows.filter((r) => r.status === 'done');
  const shown = tab === 'new' ? pending : done;

  return (
    <View style={styles.screen} testID="callbacks-screen">
      <ScreenHeader title="Rappels WhatsApp" showBack />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.gold} />}>
        <Text style={styles.note}>
          📲 Des clients ont laissé leur numéro à Zara pour que l'équipe leur écrive sur WhatsApp. Ils ont donné leur accord dans la conversation. Écrivez-leur, puis
          marquez « fait ».
        </Text>

        {loading && !result ? <Text style={styles.loading}>Chargement…</Text> : null}

        {deleteError ? (
          <Text style={styles.deleteError} testID="callbacks-delete-error">
            La suppression n’a pas marché. Réessayez dans un instant.
          </Text>
        ) : null}

        {result && !result.ok ? <Problem reason={result.reason} message={result.message} onRetry={load} /> : null}

        {result && result.ok ? (
          <>
            <View style={styles.tabs}>
              <Pressable style={[styles.tab, tab === 'new' && styles.tabActive]} onPress={() => setTab('new')} testID="callbacks-tab-new">
                <Text style={[styles.tabText, tab === 'new' && styles.tabTextActive]}>À rappeler ({pending.length})</Text>
              </Pressable>
              <Pressable style={[styles.tab, tab === 'done' && styles.tabActive]} onPress={() => setTab('done')} testID="callbacks-tab-done">
                <Text style={[styles.tabText, tab === 'done' && styles.tabTextActive]}>Faits ({done.length})</Text>
              </Pressable>
            </View>
            {shown.length === 0 ? (
              <Text style={styles.loading} testID="callbacks-empty">
                {tab === 'new' ? 'Aucune demande en attente pour le moment.' : 'Aucune demande traitée pour le moment.'}
              </Text>
            ) : (
              shown.map((row) => (
                <View key={row.id} style={styles.card} testID={`callback-row-${row.id}`}>
                  <View style={styles.cardTop}>
                    <Text style={styles.name}>{row.name}</Text>
                    <Text style={styles.time}>{ago(row.created_at)}</Text>
                  </View>
                  <Text style={styles.phone}>+235 {spaced(row.phone)}</Text>
                  <Text style={styles.source}>
                    {SOURCE_LABELS[row.source] ?? SOURCE_LABELS.chat}
                    {row.device && row.device !== 'Autre' ? ` · ${row.device}` : ''}
                  </Text>
                  {row.note ? <Text style={styles.noteLine}>À propos de : {row.note}</Text> : null}
                  {row.wanted_day ? (
                    <View style={[styles.dayBox, row.status === 'new' && dayState(row, today) === 'today' && styles.dayBoxToday, row.status === 'new' && dayState(row, today) === 'late' && styles.dayBoxLate]} testID={`callback-day-${row.id}`}>
                      <Text style={styles.dayText}>
                        📅 À rappeler : {dayLabelOf(row.wanted_day)}
                        {row.status === 'new' && dayState(row, today) === 'today' ? ' — aujourd’hui !' : ''}
                        {row.status === 'new' && dayState(row, today) === 'late' ? ' — en retard' : ''}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.actions}>
                    <Pressable style={styles.waBtn} onPress={() => Linking.openURL(whatsappLink(row))} testID={`callback-wa-${row.id}`}>
                      <Text style={styles.waText}>💬 Écrire sur WhatsApp</Text>
                    </Pressable>
                    <Pressable style={styles.callBtn} onPress={() => Linking.openURL(`tel:+235${row.phone}`)} testID={`callback-call-${row.id}`}>
                      <Text style={styles.callText}>📞</Text>
                    </Pressable>
                    <Pressable style={styles.doneBtn} disabled={busy === row.id} onPress={() => toggle(row)} testID={`callback-done-${row.id}`}>
                      <Text style={styles.doneText}>{row.status === 'new' ? '✅ Fait' : 'Remettre'}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.trashBtn}
                      onPress={() => {
                        setDeleteError(false);
                        setConfirming(confirming === row.id ? null : row.id);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Supprimer cette demande"
                      testID={`callback-delete-${row.id}`}
                    >
                      <Text style={styles.callText}>🗑</Text>
                    </Pressable>
                  </View>
                  {confirming === row.id ? (
                    <View style={styles.confirmBox} testID={`callback-confirm-${row.id}`}>
                      <Text style={styles.confirmText}>Supprimer cette demande pour toujours ?</Text>
                      <View style={styles.actions}>
                        <Pressable style={styles.confirmYes} disabled={busy === row.id} onPress={() => remove(row)} testID={`callback-delete-yes-${row.id}`}>
                          <Text style={styles.confirmYesText}>Oui, supprimer</Text>
                        </Pressable>
                        <Pressable style={styles.callBtn} onPress={() => setConfirming(null)} testID={`callback-delete-no-${row.id}`}>
                          <Text style={styles.doneText}>Non</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Problem({ reason, message, onRetry }: { reason: 'missing' | 'forbidden' | 'error'; message: string; onRetry: () => void }) {
  if (reason === 'missing') {
    return (
      <View style={styles.problem} testID="callbacks-not-installed">
        <Text style={styles.problemTitle}>Les rappels WhatsApp ne sont pas encore activés</Text>
        <Text style={styles.problemText}>
          La boutique marche normalement, mais la base n'a pas encore la liste des rappels. Pour l'activer :{'\n'}
          1. Ouvrez Supabase, puis « SQL Editor » et « New query ».{'\n'}
          2. Collez le contenu du fichier add-zara-sales-boost.sql, puis appuyez sur « Run ».{'\n'}
          3. Faites de même avec add-zara-callback-day.sql (le jour de rappel choisi par le client).{'\n'}
          4. Revenez ici et tirez la page vers le bas pour l'actualiser.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.problem} testID="callbacks-error">
      <Text style={styles.problemTitle}>{reason === 'forbidden' ? 'Accès refusé' : 'Impossible de lire les demandes'}</Text>
      <Text style={styles.problemText}>{reason === 'forbidden' ? 'Seul un administrateur peut voir cette page.' : message}</Text>
      {reason === 'error' ? (
        <Pressable onPress={onRetry} style={styles.retry} testID="callbacks-retry">
          <Text style={styles.retryText}>Réessayer</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  loading: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  note: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, backgroundColor: colors.panel, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  tabText: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 13 },
  tabTextActive: { color: colors.background, fontFamily: fonts.bodyBold },
  card: { backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm, gap: 4 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  name: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 16, flexShrink: 1 },
  time: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11 },
  phone: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 15 },
  source: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12 },
  noteLine: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  dayBox: { alignSelf: 'flex-start', marginTop: 4, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 5 },
  dayBoxToday: { borderColor: colors.gold, backgroundColor: 'rgba(212,175,55,0.14)' },
  dayBoxLate: { borderColor: colors.error, backgroundColor: 'rgba(220,70,70,0.12)' },
  dayText: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  waBtn: { backgroundColor: colors.success, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 },
  waText: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 13 },
  callBtn: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 9 },
  callText: { fontSize: 14 },
  doneBtn: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.gold, paddingHorizontal: 14, paddingVertical: 9 },
  doneText: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  trashBtn: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 9 },
  confirmBox: { marginTop: 6, borderRadius: radius.md, borderWidth: 1, borderColor: colors.error, padding: spacing.sm, gap: 6 },
  confirmText: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  confirmYes: { backgroundColor: colors.error, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 },
  confirmYesText: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 13 },
  deleteError: { color: colors.error, fontFamily: fonts.bodySemiBold, fontSize: 13, textAlign: 'center', marginBottom: spacing.sm },
  problem: { backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.gold, padding: spacing.md, gap: 8 },
  problemTitle: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 15 },
  problemText: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 20 },
  retry: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.gold },
  retryText: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: 13 },
});
