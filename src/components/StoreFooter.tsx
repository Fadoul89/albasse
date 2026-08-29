import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { useStoreSettings } from '../hooks/useStoreSettings';
import { colors, fonts, radius, spacing } from '../theme';

export function StoreFooter() {
  const { settings } = useStoreSettings();

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
    </View>
  );
}

const styles = StyleSheet.create({
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
});
