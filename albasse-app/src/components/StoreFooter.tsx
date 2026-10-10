import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { STORE_SETTINGS as s } from '../data/storeSettings';

export function StoreFooter() {
  const addressLine = [s.address, s.postalCode, s.city, s.country].filter(Boolean).join(', ');

  return (
    <View style={styles.wrapper}>
      <Text style={styles.shopName}>🏪 {s.shopName}</Text>
      <Text style={styles.line}>📍 {addressLine}</Text>
      <Pressable onPress={() => Linking.openURL(`tel:${s.phone.replace(/\s/g, '')}`)}>
        <Text style={styles.line}>📞 {s.phone}</Text>
      </Pressable>
      <Pressable onPress={() => Linking.openURL(`https://wa.me/${s.whatsapp.replace(/[^0-9]/g, '')}`)}>
        <Text style={styles.line}>💬 WhatsApp : {s.whatsapp}</Text>
      </Pressable>
      <Pressable onPress={() => Linking.openURL(`mailto:${s.email}`)}>
        <Text style={styles.line}>✉️ {s.email}</Text>
      </Pressable>
      <Text style={styles.line}>🕐 {s.hours}</Text>
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
