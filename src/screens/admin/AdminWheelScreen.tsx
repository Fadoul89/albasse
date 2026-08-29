import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, Pressable, Switch } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { GoldButton } from '../../components/GoldButton';
import type { WheelPrize } from '../../types';

export function AdminWheelScreen() {
  const profile = useAuthStore((s) => s.profile);
  const showToast = useToastStore((s) => s.show);
  const [prizes, setPrizes] = useState<WheelPrize[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('🎁');
  const [weight, setWeight] = useState('10');
  const [isGrandPrize, setIsGrandPrize] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { data } = await supabase.from('wheel_prizes').select('*').order('sort_order', { ascending: true });
    setPrizes((data as WheelPrize[]) ?? []);
    setIsLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  const handleAdd = async () => {
    if (!label.trim()) {
      showToast('Merci de donner un nom au lot.', { title: 'Nom manquant', type: 'error' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('wheel_prizes').insert({
      label: label.trim(),
      icon: icon.trim() || '🎁',
      weight: Number(weight) || 1,
      is_grand_prize: isGrandPrize,
      is_lose: false,
      sort_order: prizes.length + 1,
    });
    setSaving(false);
    if (error) {
      showToast(error.message, { title: 'Erreur', type: 'error' });
      return;
    }
    showToast(`Lot "${label}" ajouté.`, { title: 'Enregistré ✓', type: 'success' });
    setLabel('');
    setIcon('🎁');
    setWeight('10');
    setIsGrandPrize(false);
    refresh();
  };

  const toggleActive = async (prize: WheelPrize) => {
    await supabase.from('wheel_prizes').update({ is_active: !prize.is_active }).eq('id', prize.id);
    setPrizes((prev) => prev.map((p) => (p.id === prize.id ? { ...p, is_active: !p.is_active } : p)));
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Roue de la chance — Lots" showBack />
      <FlatList
        data={prizes}
        keyExtractor={(item) => item.id}
        refreshing={isLoading}
        onRefresh={refresh}
        contentContainerStyle={{ padding: spacing.md }}
        ListHeaderComponent={
          <View style={styles.form}>
            <Text style={styles.hint}>
              🏆 "Lot premium" est offert de façon garantie tous les 10, 20, 30... commandes livrées.{'\n'}
              Les autres lots sont tirés au sort (pondérés) tous les 5, 15, 25... commandes livrées.
            </Text>
            <Text style={styles.formTitle}>Ajouter un lot</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={icon}
                onChangeText={setIcon}
                placeholder="🎁"
                placeholderTextColor={colors.creamFaint}
                style={[styles.input, { width: 60, textAlign: 'center' }]}
              />
              <TextInput
                value={label}
                onChangeText={setLabel}
                placeholder="Nom du lot"
                placeholderTextColor={colors.creamFaint}
                style={[styles.input, { flex: 1 }]}
              />
            </View>
            <TextInput
              value={weight}
              onChangeText={setWeight}
              placeholder="Poids (probabilité relative, ex: 10)"
              placeholderTextColor={colors.creamFaint}
              keyboardType="numeric"
              style={styles.input}
            />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Lot premium (palier 10, 20, 30...)</Text>
              <Switch
                value={isGrandPrize}
                onValueChange={setIsGrandPrize}
                trackColor={{ true: colors.gold, false: colors.border }}
              />
            </View>
            <GoldButton label="Ajouter" onPress={handleAdd} loading={saving} />
            <Text style={styles.listTitle}>Lots existants</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowIcon}>{item.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>
                {item.label} {item.is_grand_prize && '🏆'} {item.is_lose && '(perdant)'}
              </Text>
              <Text style={styles.rowMeta}>Poids : {item.weight}</Text>
            </View>
            <Switch
              value={item.is_active}
              onValueChange={() => toggleActive(item)}
              trackColor={{ true: colors.gold, false: colors.border }}
            />
          </View>
        )}
        ListEmptyComponent={!isLoading ? <Text style={styles.denied}>Aucun lot configuré.</Text> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  form: { marginBottom: spacing.lg },
  hint: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16, marginBottom: spacing.lg },
  formTitle: { color: colors.cream, fontFamily: fonts.display, fontSize: 16, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.cream,
    fontFamily: fonts.body,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  switchLabel: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12, flex: 1 },
  listTitle: { color: colors.creamMuted, fontFamily: fonts.bodySemiBold, fontSize: 13, marginTop: spacing.lg, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowIcon: { fontSize: 24 },
  rowLabel: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  rowMeta: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
});
