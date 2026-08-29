import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { useStoreSettings } from '../hooks/useStoreSettings';
import { colors, fonts, radius, spacing } from '../theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { GoldButton } from '../components/GoldButton';

export function ContactScreen() {
  const { settings } = useStoreSettings();

  const addressLine = [settings.address, settings.postal_code, settings.city, settings.country]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Contact" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.shopName}>🏪 {settings.shop_name}</Text>

        <View style={styles.card}>
          {addressLine ? <Row icon="📍" label="Adresse" value={addressLine} /> : null}
          {settings.phone ? <Row icon="📞" label="Téléphone" value={settings.phone} /> : null}
          {settings.whatsapp ? <Row icon="💬" label="WhatsApp" value={settings.whatsapp} /> : null}
          {settings.email ? <Row icon="✉️" label="E-mail" value={settings.email} /> : null}
          {settings.hours ? <Row icon="🕐" label="Horaires" value={settings.hours} /> : null}
        </View>

        {settings.whatsapp && (
          <GoldButton
            label="Discuter sur WhatsApp"
            onPress={() => Linking.openURL(`https://wa.me/${settings.whatsapp!.replace(/[^0-9]/g, '')}`)}
            style={{ marginTop: spacing.lg }}
          />
        )}
        {settings.phone && (
          <GoldButton
            label="Appeler"
            variant="outline"
            onPress={() => Linking.openURL(`tel:${settings.phone!.replace(/\s/g, '')}`)}
            style={{ marginTop: spacing.sm }}
          />
        )}
        {settings.google_maps_url && (
          <Pressable onPress={() => Linking.openURL(settings.google_maps_url!)} style={{ marginTop: spacing.md }}>
            <Text style={styles.mapsLink}>Voir sur Google Maps →</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 60 },
  shopName: { color: colors.goldLight, fontFamily: fonts.display, fontSize: 20, textAlign: 'center', marginBottom: spacing.lg },
  card: { backgroundColor: colors.panel, borderRadius: radius.md, padding: spacing.md, gap: spacing.md },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  rowIcon: { fontSize: 16, marginTop: 2 },
  rowLabel: { color: colors.creamFaint, fontFamily: fonts.bodyMedium, fontSize: 11, textTransform: 'uppercase' },
  rowValue: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 14, marginTop: 2 },
  mapsLink: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 13, textAlign: 'center' },
});
