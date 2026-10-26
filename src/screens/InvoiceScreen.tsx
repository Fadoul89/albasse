import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useRoute, type RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, spacing } from '../theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { GoldButton } from '../components/GoldButton';
import { InvoiceDownloadButton } from '../components/InvoiceDownloadButton';
import { useAuthStore } from '../store/authStore';
import { useStoreSettings } from '../hooks/useStoreSettings';
import { useCities } from '../hooks/useCities';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { PAYMENT_LABELS, STATUS_LABELS, formatXAF, invoiceBreakdown, invoiceNumber, orderNumberLabel } from '../lib/invoice';
import type { Order } from '../types';

const LOGO = require('../../assets/logo.jpg');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Quand on imprime, seule la facture (le « papier » blanc) sort : le reste de la page est caché.
const PRINT_CSS = `@media print {
  body * { visibility: hidden !important; }
  [data-testid="invoice-paper"], [data-testid="invoice-paper"] * { visibility: visible !important; }
  [data-testid="invoice-paper"] { position: fixed !important; left: 0; top: 0; right: 0; width: 100% !important; max-width: none !important; border-radius: 0 !important; }
  @page { margin: 12mm; }
}`;

const dateLabel = (iso: string) => new Date(Date.parse(iso) + 3600_000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// Facture électronique d'une commande : albasseshopping.com/facture/<commande>. Le client voit seulement ses commandes, l'administrateur toutes.
export function InvoiceScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Invoice'>>();
  const orderId = typeof route.params?.orderId === 'string' ? route.params.orderId : '';
  const authLoading = useAuthStore((s) => s.isLoading);
  const userId = useAuthStore((s) => s.profile?.id ?? null);
  const { settings } = useStoreSettings();
  const { cities } = useCities();
  const [order, setOrder] = useState<Order | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading');

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const el = document.createElement('style');
    el.setAttribute('data-invoice-print', '1');
    el.textContent = PRINT_CSS;
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    if (!UUID.test(orderId)) {
      setState('missing');
      return;
    }
    if (!isSupabaseConfigured) {
      setState('error');
      return;
    }
    if (authLoading) return; // on attend de savoir qui est connecté : sans compte, la base ne montre aucune commande
    setState('loading');
    Promise.resolve(supabase.from('orders').select('*').eq('id', orderId)).then(({ data, error }) => {
      if (!alive) return;
      if (error) return setState('error');
      const found = Array.isArray(data) ? (data[0] as Order | undefined) : undefined;
      if (!found) return setState('missing');
      setOrder(found);
      setState('ok');
    });
    return () => {
      alive = false;
    };
  }, [orderId, authLoading, userId]);

  const print = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.print();
  };

  const b = order ? invoiceBreakdown(order) : null;
  const city = order ? cities.find((c) => c.name.toLowerCase() === (order.shipping_city ?? '').toLowerCase()) : undefined;
  const deliveryText = !b ? '' : b.delivery > 0 ? formatXAF(b.delivery) : city && city.delivery_fee === null ? 'À définir' : 'Gratuite';
  const cancelled = order?.status === 'cancelled';
  const shopLines = [settings.address, [settings.postal_code, settings.city].filter(Boolean).join(' '), settings.country].filter((l) => !!l && String(l).trim() !== '');

  return (
    <View style={styles.screen} testID="invoice-screen">
      <ScreenHeader title="Facture" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        {state === 'loading' ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xl }} />
        ) : state !== 'ok' || !order || !b ? (
          <View style={styles.notice} testID={`invoice-${state}`}>
            <Text style={styles.noticeTitle}>{state === 'error' ? 'Facture indisponible pour le moment' : 'Facture introuvable'}</Text>
            <Text style={styles.noticeText}>
              {state === 'error'
                ? 'Réessayez dans un instant.'
                : "Connectez-vous avec le compte qui a passé la commande, ou ouvrez la facture depuis « Mes commandes »."}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.paper} testID="invoice-paper">
              <View style={styles.topRow}>
                <View style={{ flex: 1, minWidth: 220 }}>
                  <View style={styles.brandRow}>
                    <View testID="invoice-logo" style={styles.logoWrap}>
                      <Image source={LOGO} style={styles.logo} contentFit="cover" />
                    </View>
                    <Text style={styles.shopName}>{settings.shop_name || 'Albasse Shopping'}</Text>
                  </View>
                  {shopLines.map((l) => (
                    <Text key={String(l)} style={styles.small}>{l}</Text>
                  ))}
                  {settings.phone ? <Text style={styles.small}>Tél. {settings.phone}</Text> : null}
                  {settings.email ? <Text style={styles.small}>{settings.email}</Text> : null}
                </View>
                <View style={styles.titleBox}>
                  <Text style={styles.docTitle}>FACTURE</Text>
                  <Text style={styles.docNumber} testID="invoice-number">{invoiceNumber(order)}</Text>
                  <Text style={styles.small}>Date : {dateLabel(order.created_at)}</Text>
                  <Text style={styles.small} testID="invoice-order-number">Commande {orderNumberLabel(order)}</Text>
                </View>
              </View>

              {cancelled ? <Text style={styles.cancelled} testID="invoice-cancelled">COMMANDE ANNULÉE</Text> : null}

              <View style={styles.block}>
                <Text style={styles.blockTitle}>Client et livraison</Text>
                <Text style={styles.strong}>{order.shipping_name}</Text>
                <Text style={styles.small}>{order.shipping_phone}</Text>
                <Text style={styles.small}>{[order.shipping_address, order.shipping_city].filter(Boolean).join(', ')}</Text>
              </View>

              <View style={styles.table}>
                <View style={[styles.tr, styles.thRow]}>
                  <Text style={[styles.th, { flex: 1 }]}>Désignation</Text>
                  <Text style={[styles.th, styles.colQty]}>Qté</Text>
                  <Text style={[styles.th, styles.colPrice]}>Prix unit.</Text>
                  <Text style={[styles.th, styles.colTotal]}>Total</Text>
                </View>
                {b.rows.map((r, i) => (
                  <View key={`${r.name}-${i}`} style={styles.tr} testID="invoice-row">
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cell}>{r.name}</Text>
                      {r.variant ? <Text style={styles.variant}>{r.variant}</Text> : null}
                    </View>
                    <Text style={[styles.cell, styles.colQty]}>{r.quantity}</Text>
                    <Text style={[styles.cell, styles.colPrice]}>{formatXAF(r.unitPrice)}</Text>
                    <Text style={[styles.cell, styles.colTotal]}>{formatXAF(r.total)}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.totals}>
                <TotalLine label="Articles" value={formatXAF(b.itemsTotal)} />
                {b.loyaltyDiscount > 0 ? <TotalLine label="Remise fidélité −10 %" value={`−${formatXAF(b.loyaltyDiscount)}`} /> : null}
                {b.giftWrap > 0 ? <TotalLine label="Emballage cadeau" value={formatXAF(b.giftWrap)} /> : null}
                <TotalLine label="Livraison" value={deliveryText} testID="invoice-delivery" />
                <TotalLine label="TOTAL À PAYER" value={formatXAF(b.total)} strong testID="invoice-total" />
              </View>

              <View style={styles.block}>
                <Text style={styles.small}>
                  Paiement : {PAYMENT_LABELS[order.payment_method] ?? order.payment_method}
                  {order.payment_reference ? ` (réf. ${order.payment_reference})` : ''}
                </Text>
                <Text style={styles.small}>Statut de la commande : {STATUS_LABELS[order.status] ?? order.status}</Text>
              </View>

              <View style={styles.footerBox}>
                {settings.invoice_legal_line ? <Text style={styles.legal} testID="invoice-legal">{settings.invoice_legal_line}</Text> : null}
                <Text style={styles.thanks}>Merci pour votre confiance · albasseshopping.com</Text>
              </View>
            </View>

            {Platform.OS === 'web' ? (
              <View style={styles.actions}>
                <InvoiceDownloadButton orderId={order.id} />
                <GoldButton label="🖨️ Imprimer / Enregistrer en PDF" variant="outline" onPress={print} />
                <Text style={styles.hint}>Dans la fenêtre d'impression, choisissez « Enregistrer au format PDF ».</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function TotalLine({ label, value, strong, testID }: { label: string; value: string; strong?: boolean; testID?: string }) {
  return (
    <View style={[styles.totalLine, strong && styles.totalStrongLine]}>
      <Text style={[styles.totalLabel, strong && styles.totalStrong]}>{label}</Text>
      <Text style={[styles.totalValue, strong && styles.totalStrong]} testID={testID}>{value}</Text>
    </View>
  );
}

const INK = '#1d2433';
const MUTED = '#5b6475';
const LINE = '#e3e6ee';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 60, alignItems: 'center' },
  notice: { alignSelf: 'stretch', maxWidth: 480, backgroundColor: colors.panelAlt, borderRadius: radius.md, borderLeftWidth: 4, borderLeftColor: colors.gold, padding: spacing.md, gap: 6, marginTop: spacing.lg },
  noticeTitle: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 16 },
  noticeText: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  paper: { alignSelf: 'stretch', maxWidth: 720, width: '100%', backgroundColor: '#ffffff', borderRadius: radius.md, padding: spacing.lg, gap: spacing.md },
  topRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.md },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  logoWrap: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', backgroundColor: '#000000' },
  logo: { width: 64, height: 64 },
  shopName: { flexShrink: 1, color: '#062266', fontFamily: fonts.bodyBold, fontSize: 20 },
  titleBox: { alignItems: 'flex-end', gap: 2 },
  docTitle: { color: INK, fontFamily: fonts.bodyBold, fontSize: 22, letterSpacing: 2 },
  docNumber: { color: '#062266', fontFamily: fonts.bodyBold, fontSize: 15 },
  small: { color: MUTED, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18 },
  strong: { color: INK, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  cancelled: { color: '#c0262d', fontFamily: fonts.bodyBold, fontSize: 16, textAlign: 'center', borderWidth: 2, borderColor: '#c0262d', borderRadius: radius.sm, paddingVertical: 6 },
  block: { gap: 2 },
  blockTitle: { color: MUTED, fontFamily: fonts.bodySemiBold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  table: { borderTopWidth: 1, borderTopColor: LINE },
  tr: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: LINE },
  thRow: { backgroundColor: '#f4f5f9' },
  th: { color: MUTED, fontFamily: fonts.bodySemiBold, fontSize: 11.5 },
  cell: { color: INK, fontFamily: fonts.body, fontSize: 13 },
  variant: { color: MUTED, fontFamily: fonts.body, fontSize: 11.5, marginTop: 1 },
  colQty: { width: 34, textAlign: 'right' },
  colPrice: { width: 96, textAlign: 'right' },
  colTotal: { width: 104, textAlign: 'right' },
  totals: { alignSelf: 'flex-end', width: '100%', maxWidth: 320, gap: 4 },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  totalLabel: { color: MUTED, fontFamily: fonts.body, fontSize: 13 },
  totalValue: { color: INK, fontFamily: fonts.bodyMedium, fontSize: 13 },
  totalStrongLine: { borderTopWidth: 2, borderTopColor: INK, paddingTop: 6, marginTop: 4 },
  totalStrong: { color: '#062266', fontFamily: fonts.bodyBold, fontSize: 15 },
  footerBox: { borderTopWidth: 1, borderTopColor: LINE, paddingTop: spacing.sm, gap: 4 },
  legal: { color: MUTED, fontFamily: fonts.body, fontSize: 11.5, textAlign: 'center' },
  thanks: { color: MUTED, fontFamily: fonts.bodyMedium, fontSize: 12, textAlign: 'center' },
  actions: { alignSelf: 'stretch', maxWidth: 720, width: '100%', marginTop: spacing.lg, gap: spacing.sm },
  hint: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, textAlign: 'center' },
});
