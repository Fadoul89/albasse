import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { supabase } from '../../lib/supabase';

// Assistant marketing (admin) : écrit des publicités Facebook, TikTok, WhatsApp et Google à partir d'un article.
const CHANNELS = [
  { key: 'facebook', label: '📘 Facebook' },
  { key: 'tiktok', label: '🎵 TikTok' },
  { key: 'whatsapp', label: '💬 WhatsApp' },
  { key: 'google', label: '🔎 Google' },
] as const;

type ProductPick = { id: string; name: string };

export function AdminMarketingScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]['key']>('facebook');
  const [products, setProducts] = useState<ProductPick[]>([]);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<ProductPick | null>(null);
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.is_admin) return;
    let alive = true;
    Promise.resolve(supabase.from('products').select('id,name').eq('is_active', true).order('name').limit(500)).then(({ data }) => {
      if (alive && data) setProducts(data as ProductPick[]);
    });
    return () => {
      alive = false;
    };
  }, [profile?.is_admin]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 8);
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [products, search]);

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  const write = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    const { data, error: err } = await supabase.functions.invoke('marketing-ai', {
      body: { channel, productId: picked?.id ?? null, goal, note: '' },
    });
    setBusy(false);
    const d = data as { ok?: boolean; text?: string; reason?: string } | null;
    if (err || !d?.ok || !d.text) {
      setError(d?.reason === 'no_key' ? "La clé de l'IA n'est pas encore installée." : 'Impossible d’écrire le texte pour le moment. Réessayez dans un instant.');
      return;
    }
    // pas de mise en forme markdown dans l'écran : on retire les étoiles du gras et de l'italique
    setResult(d.text.replace(/\*+/g, ''));
  };

  return (
    <View style={styles.screen} testID="admin-marketing">
      <ScreenHeader title="Assistant marketing" showBack />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
        <Text style={styles.label}>Pour quel réseau ?</Text>
        <View style={styles.row}>
          {CHANNELS.map((c) => (
            <Pressable key={c.key} style={[styles.chip, channel === c.key && styles.chipActive]} onPress={() => setChannel(c.key)} testID={`marketing-channel-${c.key}`}>
              <Text style={[styles.chipText, channel === c.key && styles.chipTextActive]}>{c.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Quel article ? (facultatif)</Text>
        {picked ? (
          <Pressable onPress={() => setPicked(null)} style={styles.picked} testID="marketing-picked">
            <Text style={styles.pickedText} numberOfLines={1}>
              {picked.name}
            </Text>
            <Text style={styles.pickedClear}>Changer ✕</Text>
          </Pressable>
        ) : (
          <>
            <TextInput value={search} onChangeText={setSearch} placeholder="Chercher un article…" placeholderTextColor={colors.creamFaint} style={styles.input} />
            {matches.map((p) => (
              <Pressable key={p.id} style={styles.option} onPress={() => setPicked(p)}>
                <Text style={styles.optionText} numberOfLines={1}>
                  {p.name}
                </Text>
              </Pressable>
            ))}
          </>
        )}

        <Text style={styles.label}>Objectif (facultatif)</Text>
        <TextInput value={goal} onChangeText={setGoal} placeholder="ex. fête des mères, nouvelle arrivée, promo du week-end" placeholderTextColor={colors.creamFaint} style={styles.input} />

        <Pressable style={[styles.button, busy && { opacity: 0.6 }]} onPress={write} disabled={busy} testID="marketing-write">
          {busy ? <ActivityIndicator color={colors.background} /> : <Text style={styles.buttonText}>✍️ Écrire le texte</Text>}
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {result ? (
          <View style={styles.result} testID="marketing-result">
            <Text style={styles.resultHint}>Touchez le texte pour le sélectionner et le copier.</Text>
            <Text style={styles.resultText} selectable>
              {result}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  label: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13, marginTop: spacing.lg, marginBottom: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.panel },
  chipActive: { borderColor: colors.gold, backgroundColor: colors.panelAlt },
  chipText: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 13 },
  chipTextActive: { color: colors.goldLight },
  input: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.cream,
    fontFamily: fonts.body,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  option: { backgroundColor: colors.panel, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, marginTop: 6 },
  optionText: { color: colors.cream, fontFamily: fonts.body, fontSize: 13 },
  picked: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.panelAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gold, padding: 12 },
  pickedText: { flex: 1, color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 14, marginRight: 8 },
  pickedClear: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12 },
  button: { backgroundColor: colors.gold, borderRadius: radius.pill, alignItems: 'center', paddingVertical: 14, marginTop: spacing.lg },
  buttonText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 15 },
  error: { color: colors.error, fontFamily: fonts.body, fontSize: 13, marginTop: spacing.md },
  result: { backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.lg },
  resultHint: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginBottom: 8 },
  resultText: { color: colors.cream, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
});
