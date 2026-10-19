import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { colors, fonts, radius, spacing } from '../theme';
import { GoldButton } from './GoldButton';
import { ConfirmDialog } from './ConfirmDialog';
import { DateField } from './DateField';
import { TimeField } from './TimeField';
import { useToastStore } from '../store/toastStore';
import { chadDayIso } from '../lib/assistantSales';
import {
  PUSH_MESSAGE_MAX,
  cancelScheduledPush,
  chadLabel,
  chadToIso,
  clickStats,
  createScheduledPush,
  defaultChadSlot,
  fetchScheduledPushes,
  pushTitleFor,
  scheduleProblem,
  sendScheduledPushNow,
  type ScheduledPush,
} from '../lib/scheduledPush';
import type { Product } from '../types';

const formatXAF = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

// Raccourcis : ce soir 19 h, demain 9 h, demain 18 h (heure du Tchad).
function quickSlots(now: Date = new Date()): { label: string; date: string; time: string }[] {
  const today = chadDayIso(now);
  const tomorrow = chadDayIso(new Date(now.getTime() + 86400000));
  const slots = [
    { label: 'Ce soir 19:00', date: today, time: '19:00' },
    { label: 'Demain 09:00', date: tomorrow, time: '09:00' },
    { label: 'Demain 18:00', date: tomorrow, time: '18:00' },
  ];
  return slots.filter((s) => new Date(chadToIso(s.date, s.time) ?? 0).getTime() > now.getTime());
}

// Programmer des notifications push : un article, un message court, un jour et une heure ; autant qu'on veut.
export function ScheduledPushes({ products }: { products: Product[] }) {
  const showToast = useToastStore((s) => s.show);
  const [rows, setRows] = useState<ScheduledPush[]>([]);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [productId, setProductId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const initial = defaultChadSlot();
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState<{ kind: 'cancel' | 'now'; row: ScheduledPush } | null>(null);
  const [acting, setActing] = useState(false);

  const load = async () => {
    const res = await fetchScheduledPushes();
    setRows(res.rows);
    setMissing(res.missing);
    setLoadError(res.missing ? null : res.error);
  };
  useEffect(() => {
    void load();
  }, []);

  const product = productId ? products.find((p) => p.id === productId) ?? null : null;
  const matches = query.trim()
    ? products.filter((p) => p.is_active !== false && p.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6)
    : [];
  const title = product ? pushTitleFor(product.name) : '';
  const upcoming = rows.filter((r) => r.status === 'pending').sort((a, b) => a.send_at.localeCompare(b.send_at));
  const history = rows.filter((r) => r.status !== 'pending').slice(0, 20);

  const schedule = async () => {
    const issue = scheduleProblem({ productId, message, date, time });
    setProblem(issue);
    if (issue || !product) return;
    setSaving(true);
    const error = await createScheduledPush({ productId: product.id, title, message, sendAt: chadToIso(date, time) as string });
    setSaving(false);
    if (error === 'missing') {
      setMissing(true);
      return;
    }
    if (error) {
      setProblem(error);
      return;
    }
    showToast(`Elle partira ${chadLabel(chadToIso(date, time) as string)}.`, { title: 'Notification programmée ✓', type: 'success' });
    void load();
  };

  const confirmAction = async () => {
    if (!pending) return;
    setActing(true);
    const error = pending.kind === 'cancel' ? await cancelScheduledPush(pending.row.id) : await sendScheduledPushNow(pending.row.id);
    setActing(false);
    setPending(null);
    if (error) {
      showToast(error, { title: 'Erreur', type: 'error' });
      return;
    }
    showToast(pending.kind === 'cancel' ? 'Cette notification ne partira pas.' : 'Elle part dans la minute.', {
      title: pending.kind === 'cancel' ? 'Annulée' : 'Envoi en cours',
      type: 'success',
    });
    void load();
  };

  return (
    <View style={styles.box} testID="scheduled-pushes">
      <Text style={styles.title}>📣 Notifications push programmées</Text>
      <Text style={styles.helper}>
        Choisissez un article, écrivez un message court, puis le jour et l'heure (heure du Tchad). À l'heure dite, la
        notification part sur tous les téléphones abonnés, avec la photo de l'article ; un toucher ouvre sa fiche. Vous
        pouvez en programmer autant que vous voulez.
      </Text>

      {missing ? (
        <View style={styles.warning} testID="push-missing">
          <Text style={styles.warningText}>
            Pour activer les notifications programmées, il faut lancer une fois le script « add-scheduled-push.sql » dans
            Supabase (SQL Editor).
          </Text>
        </View>
      ) : null}
      {loadError ? (
        <Text style={styles.error} testID="push-load-error">
          Liste indisponible : {loadError}
        </Text>
      ) : null}

      <Text style={styles.label}>1. L'article</Text>
      {product ? (
        <View style={styles.productCard} testID="push-product-selected">
          {product.images?.[0] ? <Image source={{ uri: product.images[0] }} style={styles.thumb} contentFit="cover" /> : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.productName} numberOfLines={2}>
              {product.name}
            </Text>
            <Text style={styles.productMeta}>{formatXAF(product.price)}</Text>
          </View>
          <Pressable
            onPress={() => {
              setProductId(null);
              setQuery('');
            }}
            hitSlop={8}
          >
            <Text style={styles.link}>Changer</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ marginBottom: spacing.md }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher un article…"
            placeholderTextColor={colors.creamFaint}
            style={styles.input}
            testID="push-product-search"
          />
          {matches.length > 0 ? (
            <View style={styles.suggestions}>
              {matches.map((p) => (
                <Pressable
                  key={p.id}
                  style={styles.suggestion}
                  onPress={() => {
                    setProductId(p.id);
                    setProblem(null);
                  }}
                  testID={`push-product-option-${p.id}`}
                >
                  {p.images?.[0] ? <Image source={{ uri: p.images[0] }} style={styles.smallThumb} contentFit="cover" /> : null}
                  <Text style={styles.suggestionText} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={styles.productMeta}>{formatXAF(p.price)}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      )}

      <Text style={styles.label}>2. Le message court</Text>
      <TextInput
        value={message}
        onChangeText={(t) => setMessage(t.slice(0, PUSH_MESSAGE_MAX))}
        placeholder="Ex : -20 % ce soir seulement, livraison rapide à N'Djamena 🔥"
        placeholderTextColor={colors.creamFaint}
        style={[styles.input, { height: 74, textAlignVertical: 'top', marginBottom: 4 }]}
        multiline
        maxLength={PUSH_MESSAGE_MAX}
        testID="push-message"
      />
      <Text style={styles.counter}>
        {message.length}/{PUSH_MESSAGE_MAX}
      </Text>

      {product || message.trim() ? (
        <View style={styles.preview} testID="push-preview">
          <Image source={require('../../assets/logo.jpg')} style={styles.previewIcon} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text style={styles.previewTitle} numberOfLines={1}>
              {title || 'Albasse Shopping'}
            </Text>
            <Text style={styles.previewText} numberOfLines={3}>
              {message.trim() || '…'}
            </Text>
          </View>
          {product?.images?.[0] ? <Image source={{ uri: product.images[0] }} style={styles.previewImage} contentFit="cover" /> : null}
        </View>
      ) : null}

      <Text style={styles.label}>3. Le jour et l'heure (heure du Tchad)</Text>
      <View style={styles.chips}>
        {quickSlots().map((s) => (
          <Pressable
            key={s.label}
            style={[styles.chip, date === s.date && time === s.time && styles.chipActive]}
            onPress={() => {
              setDate(s.date);
              setTime(s.time);
              setProblem(null);
            }}
          >
            <Text style={[styles.chipText, date === s.date && time === s.time && styles.chipTextActive]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.row2} testID="push-when">
        <View style={{ flex: 1 }}>
          <DateField label="Jour" value={date} onChange={setDate} minimumDateStr={chadDayIso()} />
        </View>
        <View style={{ flex: 1 }}>
          <TimeField label="Heure" value={time} onChange={setTime} />
        </View>
      </View>
      {chadToIso(date, time) ? <Text style={styles.when}>Départ : {chadLabel(chadToIso(date, time) as string)}</Text> : null}

      {problem ? (
        <Text style={styles.error} testID="push-problem">
          {problem}
        </Text>
      ) : null}
      <View testID="push-schedule">
        <GoldButton label="📣 Programmer la notification" onPress={schedule} loading={saving} disabled={missing} style={{ marginTop: spacing.sm }} />
      </View>
      <Text style={styles.helper}>Pour en programmer une autre, changez l'article, le message ou l'heure puis touchez de nouveau le bouton.</Text>

      <Text style={styles.listTitle}>À venir ({upcoming.length})</Text>
      {upcoming.length === 0 ? <Text style={styles.empty}>Aucune notification programmée.</Text> : null}
      {upcoming.map((r) => (
        <PushRow key={r.id} row={r}>
          <Pressable onPress={() => setPending({ kind: 'now', row: r })} hitSlop={6} testID={`push-now-${r.id}`}>
            <Text style={styles.link}>Envoyer maintenant</Text>
          </Pressable>
          <Pressable onPress={() => setPending({ kind: 'cancel', row: r })} hitSlop={6} testID={`push-cancel-${r.id}`}>
            <Text style={styles.danger}>Annuler</Text>
          </Pressable>
        </PushRow>
      ))}

      {history.length > 0 ? (
        <View style={styles.historyHead}>
          <Text style={[styles.listTitle, { marginBottom: 0 }]}>Historique</Text>
          <Pressable onPress={() => void load()} hitSlop={8} testID="push-refresh">
            <Text style={styles.link}>↻ Actualiser les clics</Text>
          </Pressable>
        </View>
      ) : null}
      {history.map((r) => (
        <PushRow key={r.id} row={r} />
      ))}

      <ConfirmDialog
        visible={!!pending}
        title={pending?.kind === 'cancel' ? 'Annuler cette notification ?' : 'Envoyer maintenant ?'}
        message={
          pending
            ? pending.kind === 'cancel'
              ? `« ${pending.row.message} » ne partira pas.`
              : `« ${pending.row.message} » part dans la minute sur tous les téléphones abonnés.`
            : ''
        }
        confirmLabel={pending?.kind === 'cancel' ? 'Oui, annuler' : 'Oui, envoyer'}
        cancelLabel="Non"
        destructive={pending?.kind === 'cancel'}
        loading={acting}
        onConfirm={confirmAction}
        onCancel={() => setPending(null)}
      />
    </View>
  );
}

const STATUS: Record<string, string> = {
  pending: '⏰ Programmée',
  sent: '✅ Envoyée',
  expired: '⏱ Pas envoyée (trop en retard)',
  cancelled: '✖ Annulée',
};

function PushRow({ row, children }: { row: ScheduledPush; children?: React.ReactNode }) {
  const image = row.product?.images?.[0];
  return (
    <View style={styles.row} testID={`push-row-${row.id}`}>
      {image ? <Image source={{ uri: image }} style={styles.smallThumb} contentFit="cover" /> : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {row.product?.name ?? row.title}
        </Text>
        <Text style={styles.rowMessage} numberOfLines={2}>
          {row.message}
        </Text>
        <Text style={styles.rowMeta}>
          {STATUS[row.status] ?? row.status} · {chadLabel(row.status === 'sent' && row.sent_at ? row.sent_at : row.send_at)}
        </Text>
        {row.status === 'sent' ? <ClickBadge row={row} /> : null}
        {children ? <View style={styles.rowActions}>{children}</View> : null}
      </View>
    </View>
  );
}

// Les clics d'une notification envoyée, bien visibles (vert) : « 👆 3 clics » et « envoyée à 11 téléphones · 27 % ».
function ClickBadge({ row }: { row: ScheduledPush }) {
  const stats = clickStats(row.clicks, row.recipients);
  return (
    <View style={styles.clickBadge} testID={`push-clicks-${row.id}`}>
      <Text style={styles.clickMain}>{stats.main}</Text>
      {stats.sub ? <Text style={styles.clickSub}>{stats.sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  historyHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, marginBottom: spacing.sm },
  clickBadge: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    marginTop: 8,
    backgroundColor: '#16a34a',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  clickMain: { color: '#ffffff', fontFamily: fonts.bodyBold, fontSize: 13.5 },
  clickSub: { color: '#eafff1', fontFamily: fonts.bodyMedium, fontSize: 11.5 },
  box: { backgroundColor: colors.panel, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.xl },
  title: { color: colors.cream, fontFamily: fonts.display, fontSize: 17, marginBottom: spacing.sm },
  helper: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginBottom: spacing.sm },
  label: { color: colors.creamMuted, fontFamily: fonts.bodySemiBold, fontSize: 12.5, marginBottom: 6, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.panelAlt,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.cream,
    fontFamily: fonts.body,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  counter: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, textAlign: 'right', marginBottom: spacing.sm },
  suggestions: { backgroundColor: colors.panelAlt, borderRadius: radius.md, overflow: 'hidden' },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  suggestionText: { flex: 1, color: colors.cream, fontFamily: fonts.body, fontSize: 13 },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.panelAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  thumb: { width: 52, height: 52, borderRadius: radius.sm },
  smallThumb: { width: 38, height: 38, borderRadius: radius.sm },
  productName: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13.5 },
  productMeta: { color: colors.goldLight, fontFamily: fonts.bodyMedium, fontSize: 12 },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f4f4f6',
    borderRadius: 14,
    padding: 10,
    marginBottom: spacing.sm,
  },
  previewIcon: { width: 30, height: 30, borderRadius: 8 },
  previewTitle: { color: '#111', fontFamily: fonts.bodyBold, fontSize: 13 },
  previewText: { color: '#333', fontFamily: fonts.body, fontSize: 12.5 },
  previewImage: { width: 46, height: 46, borderRadius: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.panelAlt,
  },
  chipActive: { borderColor: colors.gold },
  chipText: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  chipTextActive: { color: colors.goldLight },
  row2: { flexDirection: 'row', gap: 10 },
  when: { color: colors.goldLight, fontFamily: fonts.bodyMedium, fontSize: 12.5, marginBottom: spacing.sm },
  error: { color: colors.red, fontFamily: fonts.bodyMedium, fontSize: 12.5, marginBottom: spacing.sm },
  warning: { backgroundColor: colors.panelAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gold, padding: spacing.sm, marginBottom: spacing.sm },
  warningText: { color: colors.goldLight, fontFamily: fonts.bodyMedium, fontSize: 12.5 },
  listTitle: { color: colors.creamMuted, fontFamily: fonts.bodySemiBold, fontSize: 13, marginTop: spacing.md, marginBottom: spacing.sm },
  empty: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12 },
  row: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.panelAlt,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowTitle: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  rowMessage: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12.5, marginTop: 2 },
  rowMeta: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 4 },
  rowActions: { flexDirection: 'row', gap: 16, marginTop: 6 },
  link: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 12.5 },
  danger: { color: colors.red, fontFamily: fonts.bodyMedium, fontSize: 12.5 },
});
