import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { GoldButton } from '../../components/GoldButton';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export function AdminMessagesScreen() {
  const profile = useAuthStore((s) => s.profile);
  const showToast = useToastStore((s) => s.show);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  const handleSendAll = async () => {
    if (!title.trim() || !message.trim()) {
      showToast('Merci de remplir le titre et le message.', { title: 'Champs manquants', type: 'error' });
      return;
    }
    if (!isSupabaseConfigured) {
      showToast('Connectez Supabase pour envoyer réellement des messages.', { title: 'Mode démo', type: 'error' });
      return;
    }
    setShowConfirm(false);
    setSending(true);
    try {
      const { data: clients, error: clientsError } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_admin', false);

      if (clientsError) throw clientsError;
      const rows = (clients ?? []).map((c) => ({
        user_id: c.id,
        admin_id: profile.id,
        title: title.trim(),
        message: message.trim(),
      }));

      if (rows.length === 0) {
        showToast('Aucun client à qui envoyer le message.', { title: 'Personne à contacter', type: 'error' });
        return;
      }

      const { error } = await supabase.from('customer_messages').insert(rows);
      if (error) throw error;

      showToast(`Message envoyé à ${rows.length} client(s).`, { title: 'Envoyé ✓', type: 'success' });
      setTitle('');
      setMessage('');
    } catch (e) {
      console.error('Erreur envoi message diffusion:', e);
      showToast(e instanceof Error ? e.message : String(e), { title: 'Erreur', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Message à tous les clients" showBack />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
        <Text style={styles.hint}>
          Ce message sera envoyé à tous vos clients (pas aux comptes admin) et apparaîtra dans leur
          section "Mon compte → Messages". Pour envoyer un message à un seul client, allez plutôt sur sa
          fiche dans Espace Admin → Clients.
        </Text>

        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Titre du message"
          placeholderTextColor={colors.creamFaint}
          style={styles.input}
        />
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Votre message..."
          placeholderTextColor={colors.creamFaint}
          style={[styles.input, styles.textarea]}
          multiline
          numberOfLines={6}
        />

        <GoldButton
          label="Envoyer à tous les clients"
          onPress={() => setShowConfirm(true)}
          loading={sending}
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>
      <ConfirmDialog
        visible={showConfirm}
        title="Envoyer à tous les clients ?"
        message="Ce message sera envoyé immédiatement à tous les comptes clients existants."
        confirmLabel="Envoyer"
        loading={sending}
        onConfirm={handleSendAll}
        onCancel={() => setShowConfirm(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  hint: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginBottom: spacing.lg },
  input: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.cream,
    fontFamily: fonts.body,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  textarea: { minHeight: 120, textAlignVertical: 'top' },
});
