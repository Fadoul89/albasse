import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { supabase } from '../lib/supabase';
import { colors, fonts, radius, spacing } from '../theme';
import { ScreenHeader } from '../components/ScreenHeader';

export function NotificationSettingsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const showToast = useToastStore((s) => s.show);
  const [saving, setSaving] = useState<string | null>(null);

  if (!profile) return null;

  const toggle = async (field: 'notify_new_products' | 'notify_promotions' | 'notify_flash_sale', value: boolean) => {
    setSaving(field);
    const { error } = await supabase.from('profiles').update({ [field]: value }).eq('id', profile.id);
    if (error) {
      showToast(error.message, { title: 'Erreur', type: 'error' });
    } else {
      await refreshProfile();
    }
    setSaving(null);
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Notifications" showBack />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
        <Text style={styles.sectionTitle}>Notifications marketing</Text>
        <Text style={styles.sectionHint}>
          Vous pouvez désactiver ces notifications à tout moment. Votre choix est enregistré immédiatement.
        </Text>

        <Row
          icon="🛍️"
          label="Nouveaux produits"
          value={profile.notify_new_products}
          disabled={saving === 'notify_new_products'}
          onChange={(v) => toggle('notify_new_products', v)}
        />
        <Row
          icon="🎁"
          label="Promotions"
          value={profile.notify_promotions}
          disabled={saving === 'notify_promotions'}
          onChange={(v) => toggle('notify_promotions', v)}
        />
        <Row
          icon="🔥"
          label="Vente Flash"
          value={profile.notify_flash_sale}
          disabled={saving === 'notify_flash_sale'}
          onChange={(v) => toggle('notify_flash_sale', v)}
        />

        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Notifications essentielles</Text>
        <View style={styles.row}>
          <Text style={styles.rowIcon}>📦</Text>
          <Text style={styles.rowLabel}>Notifications de commandes</Text>
          <Switch value disabled trackColor={{ true: colors.gold, false: colors.border }} thumbColor={colors.cream} />
        </View>
        <Text style={styles.sectionHint}>
          Toujours actives : confirmation, expédition et livraison de vos commandes.
        </Text>
      </ScrollView>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  disabled,
  onChange,
}: {
  icon: string;
  label: string;
  value: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.gold, false: colors.border }}
        thumbColor={colors.cream}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  sectionTitle: { color: colors.cream, fontFamily: fonts.display, fontSize: 16, marginBottom: 6 },
  sectionHint: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginBottom: spacing.md, lineHeight: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 12,
  },
  rowIcon: { fontSize: 18 },
  rowLabel: { flex: 1, color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 14 },
});
