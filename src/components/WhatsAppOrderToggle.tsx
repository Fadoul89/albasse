// Admin (page Produits) : afficher ou cacher le bouton « Commander sur WhatsApp » de toutes les fiches produit.
// Enregistré tout de suite (store_settings.whatsapp_order_enabled, script add-whatsapp-order-toggle.sql).
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { useStoreSettings } from '../hooks/useStoreSettings';
import { useToastStore } from '../store/toastStore';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { colors, fonts, radius, spacing } from '../theme';

export function WhatsAppOrderToggle() {
  const { settings, isLoading, refresh } = useStoreSettings();
  const showToast = useToastStore((s) => s.show);
  const [enabled, setEnabled] = useState(settings.whatsapp_order_enabled !== false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEnabled(settings.whatsapp_order_enabled !== false);
  }, [settings]);

  const change = async (value: boolean) => {
    if (!isSupabaseConfigured) return;
    setEnabled(value);
    setSaving(true);
    const { error } = await supabase.from('store_settings').update({ whatsapp_order_enabled: value }).eq('id', 1);
    setSaving(false);
    if (error) {
      setEnabled(!value);
      const missing = error.code === '42703' || error.code === 'PGRST204' || /whatsapp_order_enabled/.test(error.message ?? '');
      showToast(missing ? 'Lancez d’abord le script add-whatsapp-order-toggle.sql dans Supabase.' : error.message, {
        title: 'Pas enregistré',
        type: 'error',
      });
      return;
    }
    showToast(
      value ? 'Le bouton est de nouveau visible sur tous les articles.' : 'Le bouton est caché sur tous les articles.',
      { title: value ? '💬 WhatsApp activé' : '🚫 WhatsApp désactivé', type: 'success' },
    );
    refresh();
  };

  return (
    <View style={styles.card} testID="wa-order-toggle">
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>💬 Bouton « Commander sur WhatsApp »</Text>
        <Text style={[styles.status, enabled ? styles.on : styles.off]} testID="wa-order-status">
          {enabled ? '🟢 Activé : visible sur tous les articles' : '🔴 Désactivé : caché sur tous les articles'}
        </Text>
      </View>
      <Switch
        testID="wa-order-switch"
        value={enabled}
        disabled={saving || isLoading}
        onValueChange={change}
        trackColor={{ true: '#25D366', false: colors.border }}
        thumbColor={colors.cream}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  title: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 14 },
  status: { fontFamily: fonts.bodyMedium, fontSize: 12, marginTop: 4 },
  on: { color: '#25D366' },
  off: { color: '#f87171' },
});
