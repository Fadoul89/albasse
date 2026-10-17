import React from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { useInstallGuideStore } from '../store/installGuideStore';

// Fichiers dans public/ : tutoriel de 45 secondes, format vertical, avec les 4 etapes.
const VIDEO_URL = '/tutoriel-iphone.mp4';
const POSTER_URL = '/tutoriel-iphone-poster.jpg';
const VIDEO_MAX_WIDTH = 210;

// Lecteur video du navigateur. Pas de « playsInline » : au toucher, l'iPhone ouvre la
// video en plein ecran, ce qui rend les textes du tutoriel vertical bien lisibles.
// « preload none » : rien n'est telecharge (donnees mobiles) tant qu'on n'a pas touche ▶.
function GuideVideo({ width }: { width: number }) {
  if (Platform.OS !== 'web') return null;
  return React.createElement('video', {
    controls: true,
    preload: 'none',
    poster: POSTER_URL,
    src: VIDEO_URL,
    style: { width, height: Math.round((width * 16) / 9), borderRadius: 14, backgroundColor: '#000', display: 'block' },
  });
}

function B({ children }: { children: React.ReactNode }) {
  return <Text style={styles.bold}>{children}</Text>;
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepBadgeText}>{n}</Text>
      </View>
      <Text style={styles.stepText}>{children}</Text>
    </View>
  );
}

export function IosInstallGuide() {
  const visible = useInstallGuideStore((s) => s.visible);
  const hide = useInstallGuideStore((s) => s.hide);
  const { width, height } = useWindowDimensions();

  if (Platform.OS !== 'web') return null;

  const cardWidth = Math.min(width - spacing.lg * 2, 380);
  const videoWidth = Math.min(cardWidth - spacing.lg * 2 - 4, VIDEO_MAX_WIDTH);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={hide}>
      <View style={styles.overlay}>
        <View style={[styles.card, { width: cardWidth, maxHeight: height - spacing.lg * 2 }]}>
          <Pressable style={styles.closeBtn} onPress={hide} hitSlop={12} accessibilityRole="button" accessibilityLabel="Fermer">
            <Text style={styles.closeIcon}>✕</Text>
          </Pressable>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>📲 Installer Albasse sur iPhone</Text>
            <Text style={styles.intro}>Regardez la vidéo (45&nbsp;secondes), c'est très simple.</Text>

            <GuideVideo width={videoWidth} />
            <Text style={styles.hint}>Touchez ▶ : la vidéo s'ouvre en plein écran.</Text>

            <View style={styles.steps}>
              <Step n={1}>
                Touchez le bouton <B>Partager</B> (le carré avec une flèche).
              </Step>
              <Step n={2}>
                Touchez <B>«&nbsp;En voir plus&nbsp;»</B> si vous le voyez.
              </Step>
              <Step n={3}>
                Touchez <B>«&nbsp;Sur l'écran d'accueil&nbsp;»</B>, puis <B>«&nbsp;Ajouter&nbsp;»</B>.
              </Step>
              <Step n={4}>
                Ouvrez l'icône <B>Albasse</B> et touchez <B>«&nbsp;Activer&nbsp;»</B> pour recevoir les alertes.
              </Step>
            </View>

            <Text style={styles.note}>
              Le site s'est ouvert dans WhatsApp, Facebook ou Instagram&nbsp;? Ouvrez-le d'abord dans Safari. Les alertes demandent un
              iPhone sous iOS&nbsp;16.4 ou plus récent.
            </Text>

            <Pressable style={styles.okBtn} onPress={hide}>
              <Text style={styles.okBtnText}>J'ai compris</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    backgroundColor: colors.panelAlt,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.gold,
    overflow: 'hidden',
  },
  closeBtn: { position: 'absolute', top: 12, right: 14, zIndex: 2 },
  closeIcon: { color: colors.creamFaint, fontSize: 18 },
  content: { padding: spacing.lg, alignItems: 'center' },
  title: {
    color: colors.goldLight,
    fontFamily: fonts.displayBold,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  intro: { color: colors.cream, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: spacing.md },
  hint: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12, textAlign: 'center', marginTop: spacing.sm },
  steps: { alignSelf: 'stretch', gap: 10, marginTop: spacing.md },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepBadgeText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 12 },
  stepText: { flex: 1, color: colors.cream, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  bold: { fontFamily: fonts.bodyBold, color: colors.goldLight },
  note: {
    alignSelf: 'stretch',
    color: colors.creamMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
    marginTop: spacing.md,
  },
  okBtn: {
    alignSelf: 'stretch',
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  okBtnText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 13 },
});
