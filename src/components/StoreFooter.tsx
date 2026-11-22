import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStoreSettings } from '../hooks/useStoreSettings';
import { colors, fonts, radius, spacing } from '../theme';
import { YoutubeIcon } from './YoutubeIcon';
import { YOUTUBE_CHANNEL_URL } from '../lib/youtube';
import type { RootStackParamList } from '../navigation/types';

export function StoreFooter() {
  const { settings } = useStoreSettings();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const addressLine = [settings.address, settings.postal_code, settings.city, settings.country]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={styles.wrapper}>
      <Text style={styles.shopName}>🏪 {settings.shop_name}</Text>

      {addressLine ? (
        <Pressable
          disabled={!settings.google_maps_url}
          onPress={() => settings.google_maps_url && Linking.openURL(settings.google_maps_url)}
        >
          <Text style={styles.line}>📍 {addressLine}</Text>
        </Pressable>
      ) : null}

      {settings.phone && (
        <Pressable onPress={() => Linking.openURL(`tel:${settings.phone!.replace(/\s/g, '')}`)}>
          <Text style={styles.line}>📞 {settings.phone}</Text>
        </Pressable>
      )}

      {settings.whatsapp && (
        <Pressable
          onPress={() => Linking.openURL(`https://wa.me/${settings.whatsapp!.replace(/[^0-9]/g, '')}`)}
        >
          <Text style={styles.line}>💬 WhatsApp : {settings.whatsapp}</Text>
        </Pressable>
      )}

      {settings.email && (
        <Pressable onPress={() => Linking.openURL(`mailto:${settings.email}`)}>
          <Text style={styles.line}>✉️ {settings.email}</Text>
        </Pressable>
      )}

      {settings.hours && <Text style={styles.line}>🕐 {settings.hours}</Text>}

      {/* la chaîne YouTube de la boutique (demande du patron) */}
      <Pressable style={styles.youtube} onPress={() => Linking.openURL(YOUTUBE_CHANNEL_URL)} accessibilityRole="link" accessibilityLabel="Notre chaîne YouTube : abonnez-vous pour voir nos articles en vidéo" testID="footer-youtube">
        <YoutubeIcon width={30} inverted />
        <View style={{ flex: 1 }}>
          <Text style={styles.youtubeTitle}>Notre chaîne YouTube</Text>
          <Text style={styles.youtubeSub}>Abonnez-vous pour voir nos articles en vidéo</Text>
        </View>
        <Text style={styles.youtubeArrow}>›</Text>
      </Pressable>

      <View style={styles.legalRow} testID="footer-legal-links">
        <Pressable onPress={() => navigation.navigate('Terms')} hitSlop={8} accessibilityRole="link" testID="footer-terms">
          <Text style={styles.legalLink}>Conditions générales</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('ReturnPolicy')} hitSlop={8} accessibilityRole="link" testID="footer-returns">
          <Text style={styles.legalLink}>Conditions de retour</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('PrivacyPolicy')} hitSlop={8} accessibilityRole="link" testID="footer-privacy">
          <Text style={styles.legalLink}>Confidentialité</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Contact')} hitSlop={8} accessibilityRole="link" testID="footer-contact">
          <Text style={styles.legalLink}>Contact</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  youtube: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#ff0000', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8 },
  youtubeTitle: { color: '#ffffff', fontFamily: fonts.bodyBold, fontSize: 13 },
  youtubeSub: { color: '#ffffff', fontFamily: fonts.body, fontSize: 10.5, opacity: 0.92, marginTop: 1 },
  youtubeArrow: { color: '#ffffff', fontFamily: fonts.bodyBold, fontSize: 18 },
  wrapper: {
    backgroundColor: colors.panelAlt,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginTop: spacing.xl,
    gap: 6,
  },
  shopName: { color: colors.goldLight, fontFamily: fonts.display, fontSize: 16, marginBottom: 6 },
  line: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 13 },
  legalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  legalLink: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 12, textDecorationLine: 'underline' },
});
