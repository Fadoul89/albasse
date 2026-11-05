// « Inviter mes amis » : le lien du client, sa progression (0 / 5 amis), ses amis et ses parfums gagnés (docs/parrainage.md).
// Un ami compte quand il crée son compte avec le lien ET ouvre l'application installée. À chaque tranche de 5 amis : 1 parfum gratuit (validé par l'équipe).
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, Platform, ActivityIndicator } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { GoldButton } from '../components/GoldButton';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { useMyInvites } from '../hooks/useMyInvites';
import { inviteLink, inviteShareText, progressView, rewardStatusLabel, statusIcon, whatsappShareUrl } from '../lib/friendInvites';

export function InviteFriendsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const showToast = useToastStore((s) => s.show);
  const { state, progress, refresh } = useMyInvites(!!profile);

  if (!profile) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Inviter mes amis" showBack />
        <Text style={styles.empty}>Connectez-vous pour inviter vos amis.</Text>
      </View>
    );
  }

  if (state === 'loading') {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Inviter mes amis" showBack />
        <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (state !== 'ready' || !progress || !progress.code) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Inviter mes amis" showBack />
        <Text style={styles.empty} testID="invite-unavailable">
          {state === 'missing' ? 'L’invitation d’amis n’est pas encore disponible.' : 'Impossible de charger vos invitations pour le moment. Réessayez dans un instant.'}
        </Text>
        {state === 'error' && <GoldButton label="Réessayer" onPress={refresh} style={{ marginHorizontal: spacing.md }} />}
      </View>
    );
  }

  const view = progressView(progress);
  const link = inviteLink(progress.code);
  const share = inviteShareText(progress.code);

  const copy = async () => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(link);
        showToast('Envoyez-le à vos amis.', { title: 'Lien copié ✓', type: 'success' });
      }
    } catch {
      showToast('Touchez longuement le lien pour le copier.', { title: 'Copie impossible', type: 'error' });
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Inviter mes amis" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>🎁</Text>
          <Text style={styles.heroTitle}>Invite 5 amis, gagne un parfum</Text>
          <Text style={styles.heroText} testID="invite-headline">
            {view.headline}
          </Text>
          <View style={styles.bar} testID="invite-bar">
            {Array.from({ length: progress.goal }).map((_, i) => (
              <View key={i} style={[styles.dot, i < view.inTranche && styles.dotOn]} />
            ))}
          </View>
          <Text style={styles.barLabel} testID="invite-bar-label">
            {view.barLabel}
          </Text>
          {view.earned > 0 && (
            <Text style={styles.won} testID="invite-earned">
              🎉 {view.earned} parfum{view.earned > 1 ? 's' : ''} gagné{view.earned > 1 ? 's' : ''}
            </Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>Ton lien</Text>
        <View style={styles.linkBox}>
          <Text selectable style={styles.link} testID="invite-link">
            {link}
          </Text>
        </View>
        <GoldButton label="Envoyer à mes amis sur WhatsApp" onPress={() => Linking.openURL(whatsappShareUrl(share))} testID="invite-whatsapp" />
        <GoldButton label="Copier le lien" variant="outline" onPress={copy} style={{ marginTop: spacing.sm }} testID="invite-copy" />

        <Text style={styles.sectionTitle}>Comment ça marche</Text>
        <View style={styles.steps}>
          <Text style={styles.step}>1️⃣  Tu envoies ton lien à tes amis.</Text>
          <Text style={styles.step}>2️⃣  Ils créent leur compte avec ton lien.</Text>
          <Text style={styles.step}>3️⃣  Ils installent l’application Albasse et l’ouvrent : ils comptent pour toi.</Text>
          <Text style={styles.step}>🎁  Chaque fois que 5 amis comptent : 1 parfum gratuit. L’équipe vérifie vos amis, puis vous contacte sur WhatsApp.</Text>
        </View>

        {view.waitingInstall > 0 && (
          <Text style={styles.warn} testID="invite-waiting">
            {view.waitingInstall} ami{view.waitingInstall > 1 ? 's ont' : ' a'} créé son compte mais n’a pas encore ouvert l’application. Dis-lui de l’installer, puis de l’ouvrir et de se connecter.
          </Text>
        )}

        {progress.rewards.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Mes parfums</Text>
            {progress.rewards.map((r) => (
              <View key={r.number} style={styles.row} testID={`invite-reward-${r.number}`}>
                <Text style={styles.rowIcon}>{statusIcon(r.status)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>Parfum n° {r.number}</Text>
                  <Text style={styles.rowText}>{rewardStatusLabel(r.status)}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Mes amis ({progress.friends.length})</Text>
        {progress.friends.length === 0 ? (
          <Text style={styles.rowText}>Personne pour l’instant. Envoie ton lien !</Text>
        ) : (
          progress.friends.map((f, i) => (
            <View key={`${f.name}-${i}`} style={styles.row} testID={`invite-friend-${i}`}>
              <Text style={styles.rowIcon}>{f.installed ? '✅' : '⏳'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{f.name}</Text>
                <Text style={styles.rowText}>{f.installed ? 'Compte créé, application installée' : 'Compte créé, application pas encore ouverte'}</Text>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  empty: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', margin: spacing.lg },
  hero: { backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.gold, padding: spacing.md, alignItems: 'center', marginBottom: spacing.md },
  heroIcon: { fontSize: 38, marginBottom: 4 },
  heroTitle: { color: colors.gold, fontFamily: fonts.display, fontSize: 21, textAlign: 'center' },
  heroText: { color: colors.cream, fontFamily: fonts.body, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  bar: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  dot: { width: 36, height: 12, borderRadius: 6, backgroundColor: colors.panelAlt, borderWidth: 1, borderColor: colors.border },
  dotOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  barLabel: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 15, marginTop: 8 },
  won: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: 15, marginTop: 8 },
  sectionTitle: { color: colors.creamMuted, fontFamily: fonts.bodySemiBold, fontSize: 14, marginTop: spacing.lg, marginBottom: spacing.sm },
  linkBox: { backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, marginBottom: spacing.sm },
  link: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 13 },
  steps: { backgroundColor: colors.panel, borderRadius: radius.md, padding: spacing.md, gap: 8 },
  step: { color: colors.cream, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  warn: { color: '#fbbf24', fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.md, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.panel, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm },
  rowIcon: { fontSize: 20 },
  rowTitle: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  rowText: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
});
