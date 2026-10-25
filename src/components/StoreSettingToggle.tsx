// Admin : un réglage du site en un toucher (colonne booléenne de store_settings), enregistré tout de suite.
// Le bouton « Commander sur WhatsApp » des fiches produit (page Produits), le compte obligatoire à l'entrée (page Clients) et les e-mails
// automatiques aux clients et la publicité aux clients absents (page Assistant marketing).
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { useStoreSettings } from '../hooks/useStoreSettings';
import { useToastStore } from '../store/toastStore';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { colors, fonts, radius, spacing } from '../theme';
import type { StoreSettings } from '../types';

interface Setting {
  column: 'whatsapp_order_enabled' | 'account_required' | 'order_emails_enabled' | 'inactive_emails_enabled';
  // valeur quand la colonne n'existe pas encore (script SQL pas lancé)
  missingValue: boolean;
  script: string;
  testID: string;
  title: string;
  onText: string;
  offText: string;
  onToast: { title: string; message: string };
  offToast: { title: string; message: string };
}

const SETTINGS: Record<'whatsappOrder' | 'accountRequired' | 'orderEmails' | 'inactiveEmails', Setting> = {
  whatsappOrder: {
    column: 'whatsapp_order_enabled',
    missingValue: true,
    script: 'add-whatsapp-order-toggle.sql',
    testID: 'wa-order',
    title: '💬 Bouton « Commander sur WhatsApp »',
    onText: '🟢 Activé : visible sur tous les articles',
    offText: '🔴 Désactivé : caché sur tous les articles',
    onToast: { title: '💬 WhatsApp activé', message: 'Le bouton est de nouveau visible sur tous les articles.' },
    offToast: { title: '🚫 WhatsApp désactivé', message: 'Le bouton est caché sur tous les articles.' },
  },
  accountRequired: {
    column: 'account_required',
    missingValue: false,
    script: 'add-account-required.sql',
    testID: 'account-required',
    title: '🔐 Compte obligatoire à l’entrée du site',
    onText: '🟢 Activé : les visiteurs créent un compte avant de voir le site',
    offText: '⚪ Désactivé : tout le monde voit le site sans compte',
    onToast: { title: '🔐 Compte obligatoire', message: 'Les nouveaux visiteurs doivent créer un compte pour entrer.' },
    offToast: { title: '🔓 Site ouvert', message: 'Tout le monde peut de nouveau voir le site sans compte.' },
  },
  orderEmails: {
    column: 'order_emails_enabled',
    missingValue: false,
    script: 'add-order-emails.sql',
    testID: 'order-emails',
    title: '📧 E-mails automatiques aux clients',
    onText: '🟢 Activé : « bienvenue », « commande reçue » et « commande livrée » partent tout seuls',
    offText: '⚪ Désactivé : aucun e-mail n’est envoyé aux clients',
    onToast: { title: '📧 E-mails activés', message: 'Les clients qui ont une vraie adresse e-mail reçoivent le mot de bienvenue, la confirmation et l’avis de livraison.' },
    offToast: { title: '📪 E-mails coupés', message: 'Plus aucun e-mail n’est envoyé aux clients.' },
  },
  inactiveEmails: {
    column: 'inactive_emails_enabled',
    missingValue: false,
    script: 'add-inactive-promo-emails.sql',
    testID: 'inactive-emails',
    title: '📣 E-mails publicitaires (clients absents depuis 7 jours)',
    onText: '🟢 Activé : Zara écrit chaque matin aux clients absents depuis 7 jours',
    offText: '⚪ Désactivé : aucun e-mail publicitaire n’est envoyé',
    onToast: { title: '📣 Publicité par e-mail activée', message: 'Chaque matin, un petit nombre de clients absents depuis 7 jours reçoivent vos articles du moment.' },
    offToast: { title: '📪 Publicité par e-mail coupée', message: 'Plus aucun e-mail publicitaire n’est envoyé.' },
  },
};

const valueOf = (settings: StoreSettings, s: Setting) => {
  const v = settings[s.column];
  return typeof v === 'boolean' ? v : s.missingValue;
};

export function StoreSettingToggle({ setting }: { setting: keyof typeof SETTINGS }) {
  const s = SETTINGS[setting];
  const { settings, isLoading, refresh } = useStoreSettings();
  const showToast = useToastStore((t) => t.show);
  const [enabled, setEnabled] = useState(valueOf(settings, s));
  const [saving, setSaving] = useState(false);
  // bloqué seulement pendant la toute première lecture (pas pendant les relectures après un changement)
  const loadedOnce = useRef(!isLoading);
  if (!isLoading) loadedOnce.current = true;

  useEffect(() => {
    setEnabled(valueOf(settings, s));
  }, [settings, s]);

  const change = async (value: boolean) => {
    if (!isSupabaseConfigured) return;
    setEnabled(value);
    setSaving(true);
    const { error } = await supabase.from('store_settings').update({ [s.column]: value }).eq('id', 1);
    setSaving(false);
    if (error) {
      setEnabled(!value);
      const missing = error.code === '42703' || error.code === 'PGRST204' || (error.message ?? '').includes(s.column);
      showToast(missing ? `Lancez d’abord le script ${s.script} dans Supabase.` : error.message, {
        title: 'Pas enregistré',
        type: 'error',
      });
      return;
    }
    const toast = value ? s.onToast : s.offToast;
    showToast(toast.message, { title: toast.title, type: 'success' });
    refresh();
  };

  return (
    <View style={styles.card} testID={`${s.testID}-toggle`}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{s.title}</Text>
        <Text style={[styles.status, enabled ? styles.on : styles.off]} testID={`${s.testID}-status`}>
          {enabled ? s.onText : s.offText}
        </Text>
      </View>
      <Switch
        testID={`${s.testID}-switch`}
        value={enabled}
        disabled={saving || !loadedOnce.current}
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
