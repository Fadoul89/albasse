// Admin (page « Zara SEO ») : Zara regarde la photo des fiches produit faibles (sans description ou trop courte) et PROPOSE une description pour la
// page produit et pour Google. L'administrateur lit, corrige si besoin, coche, puis valide : rien n'est publié avant. Chaque ancienne description est gardée
// (bouton « Remettre l'ancienne »). Zara n'écrit ni prix, ni promotion, ni stock, ni livraison, ni marque inventée (règles : supabase/functions/zara-seo/rules.ts).
// Script SQL à lancer d'abord : add-zara-seo.sql ; fonction serveur : zara-seo.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useToastStore } from '../store/toastStore';
import { colors, fonts, radius, spacing } from '../theme';
import { GoldButton } from './GoldButton';
import {
  BATCH_SIZE,
  WEAK_MIN_LEN,
  applySuggestions,
  descriptionLevel,
  fetchSeoRows,
  isSeoSetupMissing,
  pickWeak,
  requestSuggestions,
  seoOverview,
  undoSuggestions,
  type SeoRow,
  type SeoSuggestion,
} from '../lib/zaraSeo';

interface Draft {
  item: SeoSuggestion;
  text: string;
  keep: boolean;
}

const MAX_TEXT = 320;

export function ZaraSeoPanel() {
  const showToast = useToastStore((t) => t.show);
  const [rows, setRows] = useState<SeoRow[] | null>(null);
  const [setupMissing, setSetupMissing] = useState(false);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [busy, setBusy] = useState<'' | 'prepare' | 'apply' | 'undo'>('');
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [showDup, setShowDup] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(async () => {
    const r = await fetchSeoRows();
    if (r.error && !r.setupMissing) showToast(r.error, { title: 'Fiches indisponibles', type: 'error' });
    setSetupMissing(r.setupMissing);
    setRows(r.rows);
    return r.rows;
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const overview = useMemo(() => (rows ? seoOverview(rows) : null), [rows]);
  const photoOf = useMemo(() => new Map((rows ?? []).map((r) => [r.id, r.images?.[0] ?? null])), [rows]);
  const done = useMemo(
    () => (rows ?? []).filter((r) => !!r.description_zara_at).sort((a, b) => String(b.description_zara_at).localeCompare(String(a.description_zara_at))),
    [rows]
  );

  const prepare = async () => {
    if (busy || !rows) return;
    const picks = pickWeak(rows, BATCH_SIZE, seen);
    if (picks.length === 0) {
      showToast('Toutes les fiches faibles ont déjà été traitées.', { title: 'Rien à faire', type: 'success' });
      return;
    }
    setBusy('prepare');
    const res = await requestSuggestions(picks.map((p) => p.id));
    setBusy('');
    if (res.error) {
      showToast(res.error, { title: 'Pas de proposition', type: 'error' });
      return;
    }
    setSeen((prev) => new Set([...prev, ...picks.map((p) => p.id)]));
    setDrafts(res.items.map((item) => ({ item, text: item.proposal, keep: true })));
  };

  const publish = async () => {
    if (busy || !drafts) return;
    const chosen = drafts.filter((d) => d.keep && d.text.trim().length >= 40);
    if (chosen.length === 0) return;
    setBusy('apply');
    const res = await applySuggestions(chosen.map((d) => ({ id: d.item.id, description: d.text.trim() })));
    setBusy('');
    if (res.error) {
      showToast(res.setupMissing ? 'Lancez d’abord le script add-zara-seo.sql dans Supabase.' : res.error, { title: 'Pas publié', type: 'error' });
      return;
    }
    showToast(`${res.applied} description${res.applied > 1 ? 's' : ''} publiée${res.applied > 1 ? 's' : ''}${res.skipped ? ` · ${res.skipped} refusée(s) (longueur)` : ''}`, { title: 'Publié sur le site ✓', type: 'success' });
    setDrafts(null);
    await load();
  };

  const undo = async (row: SeoRow) => {
    if (busy) return;
    setBusy('undo');
    const res = await undoSuggestions([row.id]);
    setBusy('');
    if (res.error) {
      showToast(res.error, { title: 'Pas remis', type: 'error' });
      return;
    }
    showToast('L’ancienne description est remise.', { title: 'Remis ✓', type: 'success' });
    await load();
  };

  const toPublish = drafts ? drafts.filter((d) => d.keep && d.text.trim().length >= 40).length : 0;
  const remaining = useMemo(() => (rows ? pickWeak(rows, 100000, seen).length : 0), [rows, seen]);

  return (
    <View style={styles.card} testID="zara-seo-panel">
      <Text style={styles.title}>🔎 Zara SEO : les descriptions des articles</Text>
      <Text style={styles.text}>
        Google lit la description de chaque article. Zara regarde la photo des fiches qui n’ont pas de description (ou une trop courte) et PROPOSE un texte. Vous lisez, vous corrigez si besoin, vous validez : rien n’est publié
        avant. Zara n’écrit ni prix, ni promotion, ni stock, ni marque inventée. L’ancienne description est toujours gardée.
      </Text>

      {setupMissing ? (
        <Text style={styles.warn} testID="zara-seo-missing">Lancez d’abord le script add-zara-seo.sql dans Supabase (SQL Editor).</Text>
      ) : null}

      <View style={styles.stats} testID="zara-seo-stats">
        {overview === null ? (
          <Text style={styles.small}>Chargement…</Text>
        ) : (
          <>
            <Stat label="Articles en vente" value={overview.active} />
            <Stat label="Sans description" value={overview.none} tone={overview.none > 0 ? 'bad' : 'good'} />
            <Stat label={`Trop courte (< ${WEAK_MIN_LEN})`} value={overview.short} tone={overview.short > 0 ? 'warn' : 'good'} />
            <Stat label="Correcte" value={overview.ok} tone="good" />
          </>
        )}
      </View>

      {overview && overview.duplicates.length > 0 ? (
        <View style={{ marginTop: spacing.sm }}>
          <Pressable onPress={() => setShowDup((v) => !v)} accessibilityRole="button" testID="zara-seo-dup-toggle">
            <Text style={styles.link}>
              {showDup ? '▾' : '▸'} {overview.duplicates.length} nom{overview.duplicates.length > 1 ? 's' : ''} d’article en double (Google préfère des noms différents)
            </Text>
          </Pressable>
          {showDup ? (
            <View testID="zara-seo-dup-list">
              {overview.duplicates.slice(0, 30).map((d) => (
                <Text key={d.name} style={styles.small}>• {d.name} ({d.count} fois)</Text>
              ))}
              <Text style={styles.small}>À renommer vous-même dans Admin › Produits : Zara ne change jamais un nom.</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {!drafts ? (
        <GoldButton
          label={remaining > 0 ? `🔎 Zara, prépare ${Math.min(BATCH_SIZE, remaining)} descriptions (${remaining} à faire)` : '✅ Aucune fiche faible à traiter'}
          onPress={prepare}
          loading={busy === 'prepare'}
          disabled={!rows || setupMissing || remaining === 0}
          style={{ marginTop: spacing.md }}
        />
      ) : (
        <View style={{ marginTop: spacing.md }} testID="zara-seo-drafts">
          <Text style={styles.listTitle}>Propositions de Zara ({drafts.length})</Text>
          {drafts.map((d, i) => {
            const photo = photoOf.get(d.item.id);
            const len = d.text.trim().length;
            return (
              <View key={d.item.id} style={[styles.draft, !d.keep && { opacity: 0.55 }]} testID="zara-seo-draft">
                <View style={styles.draftHead}>
                  {photo ? <Image source={{ uri: photo }} style={styles.thumb} contentFit="cover" /> : <View style={[styles.thumb, { backgroundColor: colors.panelAlt }]} />}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.name} numberOfLines={2}>{d.item.name.replace(/\s+/g, ' ').trim()}</Text>
                    <Text style={styles.badge}>{d.item.source === 'ia' ? '📷 écrit d’après la photo' : '🧩 écrit avec les faits connus (nom, catégorie, couleurs, tailles)'}</Text>
                  </View>
                </View>
                <Text style={styles.label}>Avant :</Text>
                <Text style={styles.before}>{d.item.current.trim() ? d.item.current.trim() : '— aucune description —'}</Text>
                <Text style={styles.label}>Proposition (vous pouvez la modifier) :</Text>
                <TextInput
                  style={styles.input}
                  multiline
                  value={d.text}
                  onChangeText={(text) => setDrafts((all) => (all ? all.map((x, j) => (j === i ? { ...x, text } : x)) : all))}
                  accessibilityLabel={`Description de ${d.item.name}`}
                  testID="zara-seo-text"
                />
                <Text style={[styles.count, (len < WEAK_MIN_LEN || len > MAX_TEXT) && { color: '#ff9a8a' }]}>
                  {len} caractères {len < WEAK_MIN_LEN ? `(${WEAK_MIN_LEN} au moins conseillé)` : len > MAX_TEXT ? `(${MAX_TEXT} au plus conseillé)` : '✓'}
                </Text>
                <Pressable
                  onPress={() => setDrafts((all) => (all ? all.map((x, j) => (j === i ? { ...x, keep: !x.keep } : x)) : all))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: d.keep }}
                  style={styles.keepRow}
                  testID="zara-seo-keep"
                >
                  <Text style={styles.keepBox}>{d.keep ? '☑' : '☐'}</Text>
                  <Text style={styles.keepText}>{d.keep ? 'À publier' : 'Je ne publie pas celle-ci'}</Text>
                </Pressable>
              </View>
            );
          })}
          <GoldButton label={`✅ Valider et publier (${toPublish})`} onPress={publish} loading={busy === 'apply'} disabled={toPublish === 0} style={{ marginTop: spacing.sm }} />
          <Pressable style={styles.cancelBtn} onPress={() => setDrafts(null)} disabled={busy !== ''} accessibilityRole="button" testID="zara-seo-cancel">
            <Text style={styles.cancelText}>Annuler ces propositions</Text>
          </Pressable>
        </View>
      )}

      {done.length > 0 ? (
        <View style={{ marginTop: spacing.md }}>
          <Pressable onPress={() => setShowDone((v) => !v)} accessibilityRole="button" testID="zara-seo-done-toggle">
            <Text style={styles.link}>{showDone ? '▾' : '▸'} {done.length} description{done.length > 1 ? 's' : ''} déjà écrite{done.length > 1 ? 's' : ''} par Zara</Text>
          </Pressable>
          {showDone ? (
            <View testID="zara-seo-done-list">
              {done.slice(0, 15).map((r) => (
                <View key={r.id} style={styles.doneRow} testID="zara-seo-done-item">
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.name} numberOfLines={1}>{r.name.replace(/\s+/g, ' ').trim()}</Text>
                    <Text style={styles.small} numberOfLines={2}>{r.description}</Text>
                  </View>
                  <Pressable onPress={() => undo(r)} disabled={busy !== ''} accessibilityRole="button" style={styles.undoBtn} testID="zara-seo-undo">
                    <Text style={styles.undoText}>↩ Remettre l’ancienne</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'good' | 'warn' | 'bad' }) {
  const color = tone === 'bad' ? '#ff9a8a' : tone === 'warn' ? colors.goldLight : tone === 'good' ? '#7be0a0' : colors.cream;
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]} testID="zara-seo-stat-value">{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  title: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 14 },
  text: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, marginTop: 6 },
  warn: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 13, marginTop: spacing.sm },
  small: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginTop: 2 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.md },
  stat: { flexGrow: 1, flexBasis: '45%', backgroundColor: colors.panelAlt, borderRadius: radius.sm, padding: 10 },
  statValue: { fontFamily: fonts.display, fontSize: 22 },
  statLabel: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 11.5, marginTop: 2 },
  link: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 12.5, paddingVertical: 4 },
  listTitle: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 13, marginBottom: 6 },
  draft: { backgroundColor: colors.panelAlt, borderRadius: radius.sm, padding: 10, marginBottom: 8 },
  draftHead: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 6 },
  thumb: { width: 54, height: 54, borderRadius: radius.sm, backgroundColor: colors.cream },
  name: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 13 },
  badge: { color: colors.goldLight, fontFamily: fonts.bodyMedium, fontSize: 11.5, marginTop: 2 },
  label: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 11.5, marginTop: 6 },
  before: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginTop: 2 },
  input: {
    backgroundColor: colors.panel,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.cream,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    padding: 10,
    marginTop: 4,
    minHeight: 84,
    textAlignVertical: 'top',
  },
  count: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 11.5, marginTop: 3 },
  keepRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, paddingVertical: 4 },
  keepBox: { color: colors.goldLight, fontSize: 20 },
  keepText: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 12.5 },
  cancelBtn: { marginTop: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 10, alignItems: 'center' },
  cancelText: { color: colors.creamMuted, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  doneRow: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.panelAlt, borderRadius: radius.sm, padding: 8, marginTop: 6 },
  undoBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 10 },
  undoText: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 11.5 },
});
