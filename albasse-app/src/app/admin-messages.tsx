import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { ScreenHeader } from '../components/ScreenHeader';
import { GoldButton } from '../components/GoldButton';

export default function AdminMessagesScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  const sendToAll = async () => {
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
        Alert.alert('Personne à contacter', 'Aucun client à qui envoyer le message.');
        return;
      }

      const { error } = await supabase.from('customer_messages').insert(rows);
      if (error) throw error;

      let telegramNote = '';
      try {
        const { data: tgData } = await supabase.functions.invoke('telegram-broadcast', {
          body: { title: title.trim(), message: message.trim() },
        });
        if (tgData?.sent) telegramNote = ` (+ ${tgData.sent} via Telegram)`;
      } catch (tgError) {
        console.error('Erreur diffusion Telegram:', tgError);
      }

      Alert.alert('Envoyé ✓', `Message envoyé à ${rows.length} client(s)${telegramNote}.`);
      setTitle('');
      setMessage('');
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const handleSendAll = () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Champs manquants', 'Merci de remplir le titre et le message.');
      return;
    }
    Alert.alert(
      'Envoyer à tous les clients ?',
      'Ce message sera envoyé immédiatement à tous les comptes clients existants.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Envoyer', style: 'destructive', onPress: sendToAll },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Message à tous les clients" showBack />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
        <Text style={styles.hint}>
          Ce message sera envoyé à tous vos clients (pas aux comptes admin) et apparaîtra dans leur
          section "Mon compte → Messages".
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
          onPress={handleSendAll}
          loading={sending}
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>
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
