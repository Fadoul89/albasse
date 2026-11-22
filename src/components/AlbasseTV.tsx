// « Albasse TV » sur l'accueil (demande du patron, 22 novembre 2026 : « un espace qui ouvre automatiquement la première vidéo ») :
// la dernière vidéo de la chaîne YouTube démarre seule, sans le son ; « S'abonner » et « Toutes nos vidéos ».
// Données mobiles : le lecteur ne se charge que si l'espace reste 1,5 s à l'écran (pas pendant le chargement de la page),
// et la vidéo se met en pause dès que l'espace sort de l'écran, puis reprend quand il revient.
// Sur le site seulement (le lecteur YouTube est une page web).
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Linking, useWindowDimensions } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { YoutubeIcon } from './YoutubeIcon';
import { ALBASSE_TV_DWELL_MS, YOUTUBE_CHANNEL_URL, YOUTUBE_EMBED_ORIGIN, YOUTUBE_SUBSCRIBE_URL, albasseTvEmbedUrl, youtubeCommand } from '../lib/youtube';

export function AlbasseTV() {
  const { width } = useWindowDimensions();
  const boxRef = useRef<View>(null);
  const [loaded, setLoaded] = useState(false);
  const onScreen = useRef(false);

  // le lecteur : lecture quand l'espace est à l'écran, pause sinon
  const command = (func: 'playVideo' | 'pauseVideo') => {
    const box = boxRef.current as unknown as HTMLElement | null;
    const frame = box?.querySelector?.('iframe');
    try {
      frame?.contentWindow?.postMessage(youtubeCommand(func), YOUTUBE_EMBED_ORIGIN);
    } catch {
      // lecteur pas encore prêt
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = boxRef.current as unknown as Element | null;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setLoaded(true);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const io = new IntersectionObserver(
      (entries) => {
        const now = entries.some((e) => e.isIntersecting);
        if (now === onScreen.current) return;
        onScreen.current = now;
        if (now) {
          timer = setTimeout(() => setLoaded(true), ALBASSE_TV_DWELL_MS);
          command('playVideo');
        } else {
          if (timer) clearTimeout(timer);
          timer = null;
          command('pauseVideo');
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => {
      if (timer) clearTimeout(timer);
      io.disconnect();
    };
  }, []);

  if (Platform.OS !== 'web') return null;

  // le lecteur au format des Shorts (9:16) : un peu plus de la moitié de la carte sur téléphone, 280 px au plus sur ordinateur
  const playerWidth = Math.min(280, Math.round((Math.min(width, 900) - 2 * spacing.md - 2 * 12) * 0.56));

  return (
    <View style={styles.card} testID="albasse-tv">
      <View style={styles.header}>
        <YoutubeIcon width={30} />
        <Text style={styles.title}>Albasse TV</Text>
        <Text style={styles.badge}>● DERNIÈRE VIDÉO</Text>
      </View>
      <View style={styles.body}>
        <View ref={boxRef} style={[styles.player, { width: playerWidth, height: Math.round((playerWidth * 16) / 9) }]} testID="albasse-tv-player">
          {loaded
            ? React.createElement('iframe', {
                src: albasseTvEmbedUrl(undefined, typeof window !== 'undefined' ? window.location.origin : undefined),
                title: 'Albasse TV : la dernière vidéo de notre chaîne YouTube',
                allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
                allowFullScreen: true,
                referrerPolicy: 'strict-origin-when-cross-origin',
                style: { width: '100%', height: '100%', border: 0, display: 'block' },
              })
            : null}
        </View>
        <View style={styles.side}>
          <Text style={styles.lead}>Nos dernières vidéos : arrivages, essayages, promos.</Text>
          <Text style={styles.hint}>🔇 La vidéo démarre sans le son. Touchez-la pour l'écouter.</Text>
          <Pressable style={styles.subscribe} onPress={() => Linking.openURL(YOUTUBE_SUBSCRIBE_URL)} accessibilityRole="link" accessibilityLabel="S'abonner à notre chaîne YouTube" testID="albasse-tv-subscribe">
            <Text style={styles.subscribeText}>S'abonner</Text>
          </Pressable>
          <Pressable style={styles.all} onPress={() => Linking.openURL(YOUTUBE_CHANNEL_URL)} accessibilityRole="link" accessibilityLabel="Toutes nos vidéos sur YouTube" testID="albasse-tv-channel">
            <Text style={styles.allText}>Toutes nos vidéos ›</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(199, 154, 62, 0.5)',
    padding: 12,
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  title: { color: colors.cream, fontFamily: fonts.display, fontSize: 17 },
  badge: { marginLeft: 'auto', color: '#ffffff', backgroundColor: colors.red, fontFamily: fonts.bodyBold, fontSize: 10, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, overflow: 'hidden' },
  body: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  player: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#000000' },
  side: { flex: 1, gap: 10 },
  lead: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 18 },
  hint: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 11, lineHeight: 16 },
  subscribe: { backgroundColor: '#ff0000', borderRadius: 18, paddingVertical: 9, alignItems: 'center' },
  subscribeText: { color: '#ffffff', fontFamily: fonts.bodyBold, fontSize: 12 },
  all: { borderWidth: 1.5, borderColor: colors.gold, borderRadius: 18, paddingVertical: 8, alignItems: 'center' },
  allText: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 12 },
});
