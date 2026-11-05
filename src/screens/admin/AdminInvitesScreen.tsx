// Admin › Parrainages : les gains « 5 amis = 1 parfum » à valider, les amis de chaque gagnant (nom, téléphone, application installée ou non),
// les boutons pour valider / marquer « remis » / refuser, et un message WhatsApp prêt pour le gagnant (docs/parrainage.md).
// Rien n'est remis automatiquement : le gain arrive « à valider » et c'est le patron qui décide après avoir vérifié les amis.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, ActivityIndicator, RefreshControl } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { fetchOverview, setRewardStatus } from '../../lib/friendInvitesApi';
import { REWARD_ACTIONS, adminStatusLabel, countingFriends, statusIcon, winnerMessage, type AdminOverview, type AdminReward, type RewardStatus } from '../../lib/friendInvites';
import { recoveryPhone } from '../../lib/passwordRecovery';
import { firstNameOf, whatsappLink } from '../../lib/relanceMessage';

const ORDER: Record<RewardStatus, number> = { a_valider: 0, valide: 1, remis: 2, refuse: 3 };
const day = (iso: string): string => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Africa/Ndjamena' }) : '';
};

export function AdminInvitesScreen() {
  const profile = useAuthStore((s) => s.profile);
  const showToast = useToastStore((s) => s.show);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [data, setData] = useState<AdminOverview | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [refusing, setRefusing] = useState<AdminReward | null>(null);

  const load = useCallback(async () => {
    const res = await fetchOverview();
    if (res.ok) {
      setData(res.data);
      setState('ready');
    } else {
      setState(res.reason);
    }
  }, []);

  useEffect(() => {
    if (profile?.is_admin) load();
  }, [load, profile?.is_admin]);

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.empty}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  const change = async (reward: AdminReward, status: RewardStatus) => {
    setBusy(reward.id);
    const error = await setRewardStatus(reward.id, status);
    setBusy(null);
    if (error) {
      showToast(error, { title: 'Pas enregistré', type: 'error' });
      return;
    }
    showToast(`Gain de ${reward.user.name} : ${adminStatusLabel(status).toLowerCase()}.`, { title: 'Enregistré ✓', type: 'success' });
    load();
  };

  const rewards = data ? [...data.rewards].sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.createdAt.localeCompare(a.createdAt)) : [];

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Parrainages" showBack />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.gold}
          />
        }
      >
        <Text style={styles.intro}>
          Un client invite ses amis avec son lien. Un ami compte quand il crée son compte avec le lien ET ouvre l’application installée. À chaque tranche de 5 amis : 1 parfum gratuit, que vous validez
          ici après avoir vérifié les amis.
        </Text>

        {state === 'loading' && <ActivityIndicator color={colors.gold} style={{ marginTop: 30 }} />}
        {state === 'missing' && (
          <Text style={styles.warn} testID="invites-missing">
            Lancez d’abord le script add-friend-invites.sql dans Supabase pour activer le parrainage.
          </Text>
        )}
        {state === 'error' && <Text style={styles.warn}>Impossible de charger les parrainages. Tirez la page vers le bas pour réessayer.</Text>}

        {state === 'ready' && data && (
          <>
            <View style={styles.totals} testID="invites-totals">
              <Total label="Clients qui invitent" value={data.totals.inviters} />
              <Total label="Amis inscrits" value={data.totals.joined} />
              <Total label="Ont ouvert l’application" value={data.totals.installed} />
              <Total label="Parfums à valider" value={data.totals.toValidate} highlight={data.totals.toValidate > 0} />
              <Total label="Parfums remis" value={data.totals.delivered} />
            </View>

            <Text style={styles.sectionTitle}>Parfums gagnés ({rewards.length})</Text>
            {rewards.length === 0 && <Text style={styles.rowText}>Aucun gain pour l’instant : personne n’a encore 5 amis.</Text>}
            {rewards.map((r) => {
              const number = recoveryPhone({ whatsapp_number: r.user.whatsapp, phone: r.user.phone });
              const counting = countingFriends(r.friends);
              return (
                <View key={r.id} style={[styles.card, r.status === 'a_valider' && styles.cardHot]} testID={`invite-admin-reward-${r.id}`}>
                  <View style={styles.cardHead}>
                    <Text style={styles.cardIcon}>{statusIcon(r.status)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{r.user.name}</Text>
                      <Text style={styles.rowText}>
                        Parfum n° {r.number} · gagné le {day(r.createdAt)}
                        {r.user.phone ? ` · 📞 ${r.user.phone}` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.badge, r.status === 'a_valider' && styles.badgeHot]} testID={`invite-admin-status-${r.id}`}>
                      {adminStatusLabel(r.status)}
                    </Text>
                  </View>

                  <Text style={styles.friendsTitle}>
                    {counting} ami{counting > 1 ? 's' : ''} qui comptent sur {r.friends.length} invité{r.friends.length > 1 ? 's' : ''}
                  </Text>
                  {r.friends.map((f, i) => (
                    <Text key={`${f.name}-${i}`} style={[styles.friend, f.banned && styles.friendBanned]}>
                      {f.banned ? '🚫' : f.installed ? '✅' : '⏳'} {f.name}
                      {f.phone ? ` · ${f.phone}` : ''}
                      {f.banned ? ' (compte banni)' : f.installed ? '' : ' (application pas encore ouverte)'}
                    </Text>
                  ))}
                  {r.note ? <Text style={styles.note}>Note : {r.note}</Text> : null}

                  <View style={styles.actions}>
                    {number && (
                      <Pressable style={[styles.btn, styles.btnWa]} onPress={() => Linking.openURL(whatsappLink(number, winnerMessage(firstNameOf(r.user.name))))} testID={`invite-admin-wa-${r.id}`}>
                        <Text style={styles.btnWaText}>💬 Écrire sur WhatsApp</Text>
                      </Pressable>
                    )}
                    {REWARD_ACTIONS.filter((a) => a.status !== r.status).map((a) => (
                      <Pressable
                        key={a.status}
                        disabled={busy === r.id}
                        style={[styles.btn, a.status === 'refuse' && styles.btnRed, busy === r.id && { opacity: 0.5 }]}
                        onPress={() => (a.status === 'refuse' ? setRefusing(r) : change(r, a.status))}
                        testID={`invite-admin-${a.status}-${r.id}`}
                      >
                        <Text style={[styles.btnText, a.status === 'refuse' && styles.btnRedText]}>{a.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              );
            })}

            <Text style={styles.sectionTitle}>Clients qui invitent ({data.inviters.length})</Text>
            {data.inviters.length === 0 && <Text style={styles.rowText}>Personne n’a encore invité d’ami.</Text>}
            {data.inviters.map((p) => (
              <View key={p.id} style={styles.row} testID={`invite-admin-inviter-${p.id}`}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{p.name}</Text>
                  {p.phone ? <Text style={styles.rowText}>📞 {p.phone}</Text> : null}
                </View>
                <Text style={styles.count}>
                  {p.installed} / {data.goal}
                </Text>
                <Text style={styles.rowText}> · {p.joined} inscrit{p.joined > 1 ? 's' : ''}</Text>
              </View>
            ))}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <ConfirmDialog
        visible={!!refusing}
        title="Refuser ce parfum ?"
        message={`${refusing?.user.name ?? 'Le client'} verra « Non validé par l’équipe ». Vous pourrez le remettre « à valider » plus tard.`}
        confirmLabel="Refuser"
        destructive
        loading={!!busy}
        onConfirm={async () => {
          const r = refusing;
          setRefusing(null);
          if (r) await change(r, 'refuse');
        }}
        onCancel={() => setRefusing(null)}
      />
    </View>
  );
}

function Total({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <View style={[styles.total, highlight && styles.totalHot]}>
      <Text style={[styles.totalValue, highlight && { color: colors.background }]}>{value}</Text>
      <Text style={[styles.totalLabel, highlight && { color: colors.background }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  empty: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  intro: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
  warn: { color: '#fbbf24', fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.md, lineHeight: 19 },
  totals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  total: { flexGrow: 1, minWidth: 100, backgroundColor: colors.panel, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
  totalHot: { backgroundColor: colors.gold },
  totalValue: { color: colors.gold, fontFamily: fonts.display, fontSize: 24 },
  totalLabel: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, textAlign: 'center', marginTop: 2 },
  sectionTitle: { color: colors.creamMuted, fontFamily: fonts.bodySemiBold, fontSize: 14, marginTop: spacing.lg, marginBottom: spacing.sm },
  card: { backgroundColor: colors.panel, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardHot: { borderColor: colors.gold },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.sm },
  cardIcon: { fontSize: 22 },
  cardTitle: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 15 },
  badge: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 11, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
  badgeHot: { backgroundColor: colors.gold, borderColor: colors.gold, color: colors.background },
  friendsTitle: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: 13, marginBottom: 4 },
  friend: { color: colors.cream, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  friendBanned: { color: colors.red, textDecorationLine: 'line-through' },
  note: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, marginTop: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.sm },
  btn: { borderWidth: 1, borderColor: colors.gold, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8 },
  btnText: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 12 },
  btnWa: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  btnWaText: { color: '#ffffff', fontFamily: fonts.bodySemiBold, fontSize: 12 },
  btnRed: { borderColor: colors.red },
  btnRedText: { color: colors.red, fontFamily: fonts.bodyMedium, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.panel, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm },
  rowTitle: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  rowText: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  count: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 15 },
});
