import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts, radius, spacing } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { useCustomers } from '../../hooks/useCustomers';
import { useCustomerActivity } from '../../hooks/useCustomerActivity';
import { useCustomerSanctions } from '../../hooks/useCustomerSanctions';
import { supabase } from '../../lib/supabase';
import {
  formatDuration,
  formatDate,
  formatDateTime,
  engagementLevel,
  ENGAGEMENT_LABEL,
  accountStatus,
  ACCOUNT_STATUS_LABEL,
} from '../../lib/formatDuration';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { BanDialog } from '../../components/BanDialog';
import { GoldButton } from '../../components/GoldButton';

const formatXAF = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

interface Props {
  route: RouteProp<RootStackParamList, 'AdminCustomerDetail'>;
}

export function AdminCustomerDetailScreen({ route }: Props) {
  const { userId } = route.params;
  const adminProfile = useAuthStore((s) => s.profile);
  const showToast = useToastStore((s) => s.show);
  const { customers, refresh: refreshCustomers } = useCustomers();
  const { orders, viewedProducts, cartAddCount, isLoading } = useCustomerActivity(userId);
  const { sanctions, refresh: refreshSanctions } = useCustomerSanctions(userId);

  const [showBanDialog, setShowBanDialog] = useState(false);
  const [showReactivateDialog, setShowReactivateDialog] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [msgTitle, setMsgTitle] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  if (!adminProfile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  const customer = customers.find((c) => c.profile.id === userId);

  if (!customer) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Client" showBack />
        <Text style={styles.denied}>{isLoading ? 'Chargement…' : 'Client introuvable.'}</Text>
      </View>
    );
  }

  const { profile } = customer;
  const level = engagementLevel(customer.totalDurationSeconds);
  const status = accountStatus(profile.banned, profile.last_login_at);
  const avgSessionSeconds = customer.sessionCount > 0 ? customer.totalDurationSeconds / customer.sessionCount : 0;

  const handleBan = async (reason: string) => {
    setProcessing(true);
    const { error } = await supabase.rpc('admin_set_ban_status', {
      target_user_id: profile.id,
      new_banned: true,
      ban_reason: reason,
    });
    setProcessing(false);
    setShowBanDialog(false);
    if (error) {
      showToast(error.message, { title: 'Erreur', type: 'error' });
      return;
    }
    showToast(`${profile.full_name ?? profile.email} a été banni.`, { title: 'Client banni 🔴', type: 'success' });
    refreshCustomers();
    refreshSanctions();
  };

  const handleReactivate = async () => {
    setProcessing(true);
    const { error } = await supabase.rpc('admin_set_ban_status', {
      target_user_id: profile.id,
      new_banned: false,
      ban_reason: null,
    });
    setProcessing(false);
    setShowReactivateDialog(false);
    if (error) {
      showToast(error.message, { title: 'Erreur', type: 'error' });
      return;
    }
    showToast(`${profile.full_name ?? profile.email} a été réactivé.`, { title: 'Client réactivé 🟢', type: 'success' });
    refreshCustomers();
    refreshSanctions();
  };

  const handleSendMessage = async () => {
    if (!msgTitle.trim() || !msgBody.trim()) {
      showToast('Merci de remplir le titre et le message.', { title: 'Champs manquants', type: 'error' });
      return;
    }
    setSendingMsg(true);
    const { error } = await supabase.from('customer_messages').insert({
      user_id: profile.id,
      admin_id: adminProfile.id,
      title: msgTitle.trim(),
      message: msgBody.trim(),
    });
    setSendingMsg(false);
    if (error) {
      showToast(error.message, { title: 'Erreur', type: 'error' });
      return;
    }
    showToast(`Message envoyé à ${profile.full_name ?? profile.email}.`, { title: 'Envoyé ✓', type: 'success' });
    setMsgTitle('');
    setMsgBody('');
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title={profile.full_name ?? profile.email} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.badgeRow}>
          <Text style={styles.engagementBadge}>{ENGAGEMENT_LABEL[level]}</Text>
          <Text style={styles.accountStatus}>{ACCOUNT_STATUS_LABEL[status]}</Text>
        </View>

        {status === 'banned' ? (
          <Pressable style={styles.reactivateBtn} onPress={() => setShowReactivateDialog(true)}>
            <Text style={styles.reactivateBtnText}>🟢 RÉACTIVER LE CLIENT</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.banBtn} onPress={() => setShowBanDialog(true)}>
            <Text style={styles.banBtnText}>🔴 BANNIR LE CLIENT</Text>
          </Pressable>
        )}

        <Section title="✉️ Envoyer un message">
          <TextInput
            value={msgTitle}
            onChangeText={setMsgTitle}
            placeholder="Titre du message"
            placeholderTextColor={colors.creamFaint}
            style={styles.msgInput}
          />
          <TextInput
            value={msgBody}
            onChangeText={setMsgBody}
            placeholder="Votre message..."
            placeholderTextColor={colors.creamFaint}
            style={[styles.msgInput, styles.msgTextarea]}
            multiline
            numberOfLines={4}
          />
          <GoldButton label="Envoyer à ce client" onPress={handleSendMessage} loading={sendingMsg} />
        </Section>

        <Section title="👤 Identité">
          <Row label="Nom et prénom" value={profile.full_name ?? '—'} />
          <Row label="Téléphone" value={profile.phone ?? '—'} />
          <Row label="Profession" value={profile.profession ?? '—'} />
          <Row label="Ville" value={profile.region ?? '—'} />
          <Row label="Pays" value={profile.country ?? '—'} />
          <Row label="Adresse" value={profile.address ?? '—'} />
          <Row label="Email" value={profile.email} />
          <Row label="🚩 Fausses commandes signalées" value={`${profile.fake_order_count} / 3`} />
        </Section>

        <Section title="📅 Compte">
          <Row label="Créé le" value={formatDateTime(profile.created_at)} />
          <Row label="Dernière connexion" value={formatDateTime(profile.last_login_at)} />
          <Row label="Nombre de connexions" value={String(profile.login_count)} />
          <Row label="Statut" value={ACCOUNT_STATUS_LABEL[status]} />
        </Section>

        <Section title="🛒 Activité commerciale">
          <Row label="Nombre de commandes" value={String(customer.orderCount)} />
          <Row label="Montant total" value={formatXAF(customer.totalSpent)} />
          <Row label="Dernière commande" value={formatDate(customer.lastOrderAt)} />
          <Row label="Commandes livrées" value={String(customer.completedOrders)} />
          <Row label="Commandes annulées" value={String(customer.cancelledOrders)} />
          <Row label="Produits ajoutés au panier" value={String(cartAddCount)} />
        </Section>

        <Section title="📊 Activité du visiteur">
          <View style={styles.highlightBox}>
            <Text style={styles.highlightText}>
              Temps total passé : {formatDuration(customer.totalDurationSeconds)}
            </Text>
            <Text style={styles.highlightSub}>
              {customer.sessionCount} session(s) — {customer.productViewCount} produit(s) consulté(s)
            </Text>
          </View>
          <Row label="Temps moyen par session" value={formatDuration(Math.round(avgSessionSeconds))} />
          <Row label="Dernière visite" value={formatDateTime(customer.lastVisitAt)} />
          <Row
            label="Conversion en commande"
            value={customer.sessionCount > 0 ? `${Math.round((customer.orderCount / customer.sessionCount) * 100)}%` : '—'}
          />
          <Row label="Source d'arrivée" value={customer.topReferrerSource ?? 'Inconnue'} />
        </Section>

        {viewedProducts.length > 0 && (
          <Section title="👁️ Produits consultés">
            {viewedProducts.slice(0, 10).map((p) => (
              <Row key={p.product_id} label={p.name} value={`${p.count}×`} />
            ))}
          </Section>
        )}

        {orders.length > 0 && (
          <Section title="📦 Commandes">
            {orders.map((o) => (
              <Row key={o.id} label={`#${o.id.slice(0, 8)} · ${formatDate(o.created_at)}`} value={formatXAF(o.total)} />
            ))}
          </Section>
        )}

        {sanctions.length > 0 && (
          <Section title="📋 Historique des sanctions">
            {sanctions.map((s) => (
              <View key={s.id} style={styles.sanctionCard}>
                <Text style={styles.sanctionAction}>
                  {s.action === 'ban' ? '🔴 Bannissement' : '🟢 Réactivation'}
                </Text>
                <Text style={styles.sanctionMeta}>{formatDateTime(s.created_at)}</Text>
                <Text style={styles.sanctionMeta}>Par : {s.admin_name ?? 'Admin'}</Text>
                {s.reason && <Text style={styles.sanctionReason}>Motif : {s.reason}</Text>}
              </View>
            ))}
          </Section>
        )}
      </ScrollView>

      <BanDialog
        visible={showBanDialog}
        loading={processing}
        onConfirm={handleBan}
        onCancel={() => setShowBanDialog(false)}
      />
      <ConfirmDialog
        visible={showReactivateDialog}
        title="Réactiver ce client ?"
        message={`${profile.full_name ?? profile.email} retrouvera un accès normal à son compte.`}
        confirmLabel="Réactiver"
        loading={processing}
        onConfirm={handleReactivate}
        onCancel={() => setShowReactivateDialog(false)}
      />
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  content: { padding: spacing.md, paddingBottom: 60 },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  engagementBadge: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  accountStatus: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  msgInput: {
    backgroundColor: colors.panelAlt,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.cream,
    fontFamily: fonts.body,
    fontSize: 13,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  msgTextarea: { minHeight: 90, textAlignVertical: 'top' },
  banBtn: {
    backgroundColor: colors.red,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  banBtnText: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 14, letterSpacing: 0.5 },
  reactivateBtn: {
    backgroundColor: '#2e8b57',
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  reactivateBtnText: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 14, letterSpacing: 0.5 },
  section: { marginBottom: spacing.lg },
  sectionTitle: { color: colors.cream, fontFamily: fonts.display, fontSize: 16, marginBottom: spacing.sm },
  sectionBody: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  rowLabel: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, flex: 1 },
  rowValue: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 12, flexShrink: 0, maxWidth: '55%' },
  highlightBox: {
    backgroundColor: colors.panelAlt,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  highlightText: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 15 },
  highlightSub: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12, marginTop: 4 },
  sanctionCard: {
    backgroundColor: colors.panelAlt,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  sanctionAction: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13, marginBottom: 2 },
  sanctionMeta: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11 },
  sanctionReason: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12, marginTop: 4 },
});
