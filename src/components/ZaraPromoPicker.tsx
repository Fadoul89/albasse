// Admin (page Promotions intelligentes) : Zara propose les articles de la Vente flash (24 h) et des Promotions (7 jours) d'après les statistiques réelles du site.
// L'administrateur voit la liste et les VRAIES raisons (vues, paniers, j'aime, ventes, stock), puis valide en un toucher : rien n'est publié avant.
// Aucun prix de vente n'est modifié : l'ancien prix barré ne s'affiche que pendant la Vente flash ou la Promotion (script add-zara-promotions.sql).
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useToastStore } from '../store/toastStore';
import { colors, fonts, radius, spacing } from '../theme';
import { GoldButton } from './GoldButton';
import { ConfirmDialog } from './ConfirmDialog';
import { FLASH_COUNT, FLASH_HOURS, PROMO_COUNT, PROMO_DAYS, pickPromotions, type PromoPick, type PromoPlan, type PromoStatRow } from '../lib/zaraPromoPicker';

const formatXAF = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

const isMissing = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === '42883' || error.code === 'PGRST202' || /Could not find the function|does not exist/i.test(error.message ?? ''));

export function ZaraPromoPicker() {
  const showToast = useToastStore((t) => t.show);
  const [rows, setRows] = useState<PromoStatRow[] | null>(null);
  const [plan, setPlan] = useState<PromoPlan | null>(null);
  const [busy, setBusy] = useState<'' | 'load' | 'apply' | 'stop'>('');
  const [missing, setMissing] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);

  const load = useCallback(async (): Promise<PromoStatRow[] | null> => {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase.rpc('zara_promotion_stats', { p_days: 7 });
    if (error) {
      if (isMissing(error)) setMissing(true);
      else showToast(error.message, { title: 'Statistiques indisponibles', type: 'error' });
      return null;
    }
    setMissing(false);
    const list = (Array.isArray(data) ? data : []) as PromoStatRow[];
    setRows(list);
    return list;
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const choose = async () => {
    if (busy) return;
    setBusy('load');
    const list = await load();
    setBusy('');
    if (list) setPlan(pickPromotions(list));
  };

  const publish = async () => {
    if (busy || !plan || plan.flash.length + plan.promo.length === 0) return;
    setBusy('apply');
    const { data, error } = await supabase.rpc('zara_apply_promotions', {
      p_flash: plan.flash.map((p) => p.id),
      p_promo: plan.promo.map((p) => p.id),
      p_flash_hours: FLASH_HOURS,
      p_promo_days: PROMO_DAYS,
    });
    setBusy('');
    if (error) {
      showToast(isMissing(error) ? 'Lancez d’abord le script add-zara-promotions.sql dans Supabase.' : error.message, { title: 'Pas publié', type: 'error' });
      return;
    }
    const r = (data ?? {}) as { flash?: number; promo?: number; skipped?: unknown[] };
    const skipped = Array.isArray(r.skipped) ? r.skipped.length : 0;
    showToast(`⚡ ${r.flash ?? 0} en Vente flash · 🏷️ ${r.promo ?? 0} en Promotions${skipped ? ` · ${skipped} refusé(s) (stock ou remise)` : ''}`, { title: 'Publié sur le site ✓', type: 'success' });
    setPlan(null);
    await load();
  };

  const stop = async () => {
    setConfirmStop(false);
    setBusy('stop');
    const { error } = await supabase.rpc('zara_stop_promotions');
    setBusy('');
    if (error) {
      showToast(isMissing(error) ? 'Lancez d’abord le script add-zara-promotions.sql dans Supabase.' : error.message, { title: 'Pas arrêté', type: 'error' });
      return;
    }
    showToast('Plus de Vente flash ni de promotion sur le site. Les anciens prix restent enregistrés.', { title: 'Arrêté ✓', type: 'success' });
    setPlan(null);
    await load();
  };

  const flashNow = rows ? rows.filter((r) => r.flash_active).length : 0;
  const promoNow = rows ? rows.filter((r) => r.promo_active).length : 0;

  return (
    <View style={styles.card} testID="zara-promo-picker">
      <Text style={styles.title}>⚡ Zara choisit : Vente flash et Promotions</Text>
      <Text style={styles.text}>
        Zara regarde les statistiques de la semaine (vues, ajouts au panier, j’aime, ventes, stock) et propose les articles. Elle ne change aucun prix : l’ancien prix barré s’affiche seulement
        pendant une Vente flash ({FLASH_HOURS} h, elle disparaît ensuite) ou une Promotion ({PROMO_DAYS} jours). Rien n’est publié avant votre « Valider ».
      </Text>

      {missing ? (
        <Text style={styles.warn} testID="zara-promo-missing">Lancez d’abord le script add-zara-promotions.sql dans Supabase (SQL Editor).</Text>
      ) : (
        <>
          <Text style={styles.status} testID="zara-promo-status">
            {rows === null ? 'Chargement…' : `En ce moment : ${flashNow} en Vente flash · ${promoNow} en Promotion`}
          </Text>
          <GoldButton label="🔎 Zara, choisis les articles" onPress={choose} loading={busy === 'load'} style={{ marginTop: spacing.sm }} />
        </>
      )}

      {plan ? (
        <View testID="zara-promo-plan" style={{ marginTop: spacing.md }}>
          <Text style={styles.small} testID="zara-promo-summary">
            {plan.considered} articles examinés · {plan.eligible} avec une vraie remise (5 à 60 %), en stock, pas déjà en promotion
          </Text>
          {plan.notes.map((note) => (
            <Text key={note} style={styles.note}>{note}</Text>
          ))}
          <PickList title={`⚡ Vente flash — ${FLASH_HOURS} h (${plan.flash.length} sur ${FLASH_COUNT})`} picks={plan.flash} testID="zara-promo-flash" />
          <PickList title={`🏷️ Promotions — ${PROMO_DAYS} jours (${plan.promo.length} sur ${PROMO_COUNT})`} picks={plan.promo} testID="zara-promo-promo" />
          <GoldButton
            label="✅ Valider et publier"
            onPress={publish}
            loading={busy === 'apply'}
            disabled={plan.flash.length + plan.promo.length === 0}
            style={{ marginTop: spacing.md }}
          />
        </View>
      ) : null}

      {!missing && (flashNow > 0 || promoNow > 0) ? (
        <Pressable style={styles.stopBtn} onPress={() => setConfirmStop(true)} disabled={busy !== ''} accessibilityRole="button" testID="zara-promo-stop">
          {busy === 'stop' ? <ActivityIndicator color={colors.cream} /> : <Text style={styles.stopText}>⏹ Arrêter la Vente flash et les promotions</Text>}
        </Pressable>
      ) : null}

      <ConfirmDialog
        visible={confirmStop}
        title="Arrêter la Vente flash et les promotions ?"
        message="Les articles reprennent leur prix normal sans ancien prix barré. Les anciens prix restent enregistrés : Zara pourra les remettre en promotion plus tard."
        confirmLabel="Oui, arrêter"
        destructive
        onConfirm={stop}
        onCancel={() => setConfirmStop(false)}
      />
    </View>
  );
}

function PickList({ title, picks, testID }: { title: string; picks: PromoPick[]; testID: string }) {
  return (
    <View style={{ marginTop: spacing.md }} testID={testID}>
      <Text style={styles.listTitle}>{title}</Text>
      {picks.length === 0 ? <Text style={styles.small}>Aucun article.</Text> : null}
      {picks.map((p) => (
        <View key={p.id} style={styles.row} testID={`${testID}-item`}>
          {p.image ? <Image source={{ uri: p.image }} style={styles.thumb} contentFit="cover" /> : <View style={[styles.thumb, { backgroundColor: colors.panelAlt }]} />}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name} numberOfLines={2}>{p.name.trim()}</Text>
            <Text style={styles.price}>
              {formatXAF(p.price)} <Text style={styles.old}>{formatXAF(p.oldPrice)}</Text> <Text style={styles.pct}>−{p.discountPct} %</Text>
            </Text>
            <Text style={styles.reasons}>{p.reasons.join(' · ')}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  title: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 14 },
  text: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, marginTop: 6 },
  warn: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 13, marginTop: spacing.sm },
  status: { color: colors.goldLight, fontFamily: fonts.bodyMedium, fontSize: 12, marginTop: spacing.sm },
  small: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  note: { color: colors.goldLight, fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 17, marginTop: 6 },
  listTitle: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 13, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: colors.panelAlt, borderRadius: radius.sm, padding: 8, marginBottom: 6 },
  thumb: { width: 54, height: 54, borderRadius: radius.sm, backgroundColor: colors.cream },
  name: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 13 },
  price: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 12.5, marginTop: 2 },
  old: { color: colors.creamFaint, textDecorationLine: 'line-through', fontFamily: fonts.body },
  pct: { color: '#7be0a0', fontFamily: fonts.bodyBold },
  reasons: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16, marginTop: 3 },
  stopBtn: { marginTop: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 10, alignItems: 'center' },
  stopText: { color: colors.creamMuted, fontFamily: fonts.bodySemiBold, fontSize: 13 },
});
