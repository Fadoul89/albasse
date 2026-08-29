import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToastStore } from '../../store/toastStore';
import type { FlightRequest, FlightRequestStatus } from '../../types';

const STATUS_LABELS: Record<FlightRequestStatus, string> = {
  pending: 'En attente',
  contacted: 'Client contacté',
  booked: 'Réservé',
  cancelled: 'Annulé',
};

const STATUS_FLOW: FlightRequestStatus[] = ['pending', 'contacted', 'booked'];

export function AdminTravelRequestsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [requests, setRequests] = useState<FlightRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<FlightRequest | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingFlag, setPendingFlag] = useState<FlightRequest | null>(null);
  const [flagging, setFlagging] = useState(false);
  const showToast = useToastStore((s) => s.show);

  useEffect(() => {
    if (!isSupabaseConfigured || !profile?.is_admin) {
      setLoading(false);
      return;
    }
    supabase
      .from('flight_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setRequests((data as FlightRequest[]) ?? []);
        setLoading(false);
      });
  }, [profile]);

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  const advanceStatus = async (request: FlightRequest) => {
    const currentIndex = STATUS_FLOW.indexOf(request.status);
    if (currentIndex === -1 || currentIndex === STATUS_FLOW.length - 1) return;
    const nextStatus = STATUS_FLOW[currentIndex + 1];
    await supabase.from('flight_requests').update({ status: nextStatus }).eq('id', request.id);
    setRequests((prev) => prev.map((r) => (r.id === request.id ? { ...r, status: nextStatus } : r)));
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const { error } = await supabase.from('flight_requests').delete().eq('id', pendingDelete.id);
    setDeleting(false);
    if (error) {
      console.error('Erreur suppression demande de voyage:', error);
      return;
    }
    setRequests((prev) => prev.filter((r) => r.id !== pendingDelete.id));
    setPendingDelete(null);
  };

  const confirmFlag = async () => {
    if (!pendingFlag) return;
    setFlagging(true);
    const { error } = await supabase.rpc('flag_fake_flight_request', { target_request_id: pendingFlag.id });
    setFlagging(false);
    if (error) {
      console.error('Erreur signalement demande de voyage:', error);
      showToast(error.message, { title: 'Erreur', type: 'error' });
      return;
    }
    setRequests((prev) => prev.map((r) => (r.id === pendingFlag.id ? { ...r, is_flagged_fake: true } : r)));
    showToast(
      `Demande signalée pour ${pendingFlag.full_name}. Le compte est banni automatiquement à la 3e (commandes et demandes de voyage confondues).`,
      { title: 'Signalée 🚩', type: 'success' }
    );
    setPendingFlag(null);
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Demandes de voyage" showBack />
      {!isSupabaseConfigured && (
        <Text style={styles.denied}>Connectez Supabase pour voir les demandes réelles.</Text>
      )}
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md }}
        refreshing={loading}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.route}>
                {item.origin_city} → {item.destination_city}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {item.is_flagged_fake && <Text style={styles.flaggedBadge}>🚩 Signalée</Text>}
                <Text style={styles.status}>{STATUS_LABELS[item.status]}</Text>
              </View>
            </View>
            <Text style={styles.customer}>{item.full_name} · {item.phone}</Text>
            <Text style={styles.dates}>
              Départ : {item.departure_date}
              {item.return_date ? ` · Retour : ${item.return_date}` : ''} · {item.passenger_count} passager(s)
            </Text>
            {item.preferred_airline ? (
              <Text style={styles.dates}>Compagnie souhaitée : {item.preferred_airline}</Text>
            ) : null}
            {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
            <View style={styles.actionsRow}>
              {item.status !== 'booked' && item.status !== 'cancelled' && (
                <Pressable style={styles.advanceBtn} onPress={() => advanceStatus(item)}>
                  <Text style={styles.advanceText}>Étape suivante →</Text>
                </Pressable>
              )}
              {!item.is_flagged_fake && (
                <Pressable style={styles.flagBtn} onPress={() => setPendingFlag(item)}>
                  <Text style={styles.flagText}>🚩 Signaler fausse demande</Text>
                </Pressable>
              )}
              <Pressable style={styles.deleteBtn} onPress={() => setPendingDelete(item)}>
                <Text style={styles.deleteText}>Supprimer</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={!loading ? <Text style={styles.denied}>Aucune demande pour le moment.</Text> : null}
      />
      <ConfirmDialog
        visible={!!pendingDelete}
        title="Supprimer cette demande ?"
        message={`La demande de ${pendingDelete?.full_name} (${pendingDelete?.origin_city} → ${pendingDelete?.destination_city}) sera supprimée définitivement.`}
        confirmLabel="Supprimer"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      <ConfirmDialog
        visible={!!pendingFlag}
        title="Signaler cette demande comme fausse ?"
        message={`La demande de ${pendingFlag?.full_name} sera marquée comme non sérieuse. À la 3e signalée (commande ou demande de voyage), le compte du client sera automatiquement banni.`}
        confirmLabel="Signaler"
        destructive
        loading={flagging}
        onConfirm={confirmFlag}
        onCancel={() => setPendingFlag(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 20, paddingHorizontal: 20 },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  route: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 14 },
  status: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 12 },
  customer: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 13, marginBottom: 2 },
  dates: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, marginBottom: 4 },
  notes: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12, fontStyle: 'italic', marginBottom: 6 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  advanceBtn: {},
  advanceText: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 12 },
  flagBtn: {},
  flagText: { color: '#f5c542', fontFamily: fonts.bodyMedium, fontSize: 12 },
  deleteBtn: { marginLeft: 'auto' },
  deleteText: { color: colors.red, fontFamily: fonts.bodyMedium, fontSize: 12 },
  flaggedBadge: {
    color: colors.red,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    backgroundColor: 'rgba(216,35,42,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
});
