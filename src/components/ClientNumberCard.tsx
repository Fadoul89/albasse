// Compte › « 🪪 Mon numéro client » : le numéro unique du compte (AS-000123), lié au téléphone et à l'e-mail du compte (lib/clientNumber, docs/numero-client.md).
// Le client le garde (capture d'écran, copie, WhatsApp) : si un jour il perd l'accès à son compte, il le donne à l'équipe, qui retrouve le bon compte plus vite.
// Ce n'est pas un mot de passe : il ne donne aucun accès. La carte n'apparaît que si le compte a un numéro (script add-client-number.sql lancé).
import React from 'react';
import { View, Text, Pressable, StyleSheet, Linking, Platform } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { useToastStore } from '../store/toastStore';
import { formatClientNumber, keepMessage } from '../lib/clientNumber';
import { visibleEmail } from '../lib/phoneAuth';
import { whatsappShareUrl } from '../lib/friendInvites';
import type { Profile } from '../types';

export function ClientNumberCard({ profile }: { profile: Profile }) {
  const showToast = useToastStore((s) => s.show);
  const number = formatClientNumber(profile.client_number);
  if (!number) return null;
  const mail = visibleEmail(profile.email);

  const copy = async () => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(number);
        showToast(`${number} est copié.`, { title: 'Numéro copié ✓', type: 'success' });
        return;
      }
    } catch {
      // le téléphone refuse la copie : on montre le numéro pour le recopier à la main
    }
    showToast(`Votre numéro client : ${number}`, { title: 'Copie impossible', type: 'info' });
  };

  const keepOnWhatsapp = () => {
    const text = keepMessage({ number: profile.client_number, phone: profile.phone, email: mail });
    if (text) void Linking.openURL(whatsappShareUrl(text));
  };

  return (
    <View style={styles.card} testID="client-number-card">
      <Text style={styles.title}>🪪 Mon numéro client</Text>
      <Text style={styles.number} testID="client-number-value" selectable>
        {number}
      </Text>
      <Text style={styles.linked} testID="client-number-linked">
        {[profile.phone ? `📞 ${profile.phone}` : null, mail ? `✉️ ${mail}` : null].filter(Boolean).join('   ')}
      </Text>
      <Text style={styles.hint}>
        Gardez ce numéro (copie, capture d’écran ou WhatsApp). Si vous perdez l’accès à votre compte, donnez-le à l’équipe : elle retrouve votre compte plus vite. Ce n’est pas un mot de passe : il ne donne aucun accès.
      </Text>
      <View style={styles.row}>
        <Pressable style={styles.btn} onPress={copy} accessibilityRole="button" testID="client-number-copy">
          <Text style={styles.btnText}>📋 Copier</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={keepOnWhatsapp} accessibilityRole="button" testID="client-number-whatsapp">
          <Text style={styles.btnText}>💬 Me l’envoyer sur WhatsApp</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  title: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  number: { color: colors.cream, fontFamily: fonts.display, fontSize: 28, letterSpacing: 1.5, marginTop: 4 },
  linked: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12, marginTop: 4 },
  hint: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginTop: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.sm },
  btn: { borderWidth: 1, borderColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  btnText: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: 13 },
});
