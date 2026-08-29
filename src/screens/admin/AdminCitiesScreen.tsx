import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, Pressable, Switch } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { useCities } from '../../hooks/useCities';
import { useToastStore } from '../../store/toastStore';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { GoldButton } from '../../components/GoldButton';
import type { City } from '../../types';

const formatXAF = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

export function AdminCitiesScreen() {
  const profile = useAuthStore((s) => s.profile);
  const { cities, isLoading, refresh } = useCities(true);

  const [name, setName] = useState('');
  const [fee, setFee] = useState('');
  const [agency, setAgency] = useState('');
  const [saving, setSaving] = useState(false);
  const showToast = useToastStore((s) => s.show);

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  const handleAdd = async () => {
    if (!name.trim()) {
      showToast('Merci de donner un nom à la ville.', { title: 'Nom manquant', type: 'error' });
      return;
    }
    if (!isSupabaseConfigured) {
      showToast('Connectez Supabase pour gérer réellement les villes.', { title: 'Mode démo', type: 'error' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('cities').insert({
      name: name.trim(),
      delivery_fee: fee.trim() ? Number(fee.trim()) : null,
      delivery_agency: agency.trim() || null,
      sort_order: cities.length + 1,
    });
    setSaving(false);
    if (error) {
      showToast(error.message, { title: 'Erreur', type: 'error' });
      return;
    }
    showToast(`Ville "${name}" ajoutée.`, { title: 'Enregistré ✓', type: 'success' });
    setName('');
    setFee('');
    setAgency('');
    refresh();
  };

  const updateCity = async (city: City, patch: Partial<City>) => {
    const { error } = await supabase.from('cities').update(patch).eq('id', city.id);
    if (error) {
      showToast(error.message, { title: 'Erreur', type: 'error' });
      return;
    }
    refresh();
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= cities.length) return;
    const a = cities[index];
    const b = cities[target];
    await Promise.all([
      supabase.from('cities').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('cities').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    refresh();
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Livraison — Villes" showBack />
      <FlatList
        data={cities}
        keyExtractor={(item) => item.id}
        refreshing={isLoading}
        onRefresh={refresh}
        contentContainerStyle={{ padding: spacing.md }}
        ListHeaderComponent={
          <View style={styles.form}>
            <Text style={styles.formTitle}>Ajouter une ville</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Nom de la ville"
              placeholderTextColor={colors.creamFaint}
              style={styles.input}
            />
            <TextInput
              value={fee}
              onChangeText={setFee}
              placeholder="Frais de livraison en FCFA (0 = gratuit, vide = à définir)"
              placeholderTextColor={colors.creamFaint}
              keyboardType="numeric"
              style={styles.input}
            />
            <TextInput
              value={agency}
              onChangeText={setAgency}
              placeholder="Agence / point d'expédition (optionnel)"
              placeholderTextColor={colors.creamFaint}
              style={styles.input}
            />
            <GoldButton label="Ajouter" onPress={handleAdd} loading={saving} />
            <Text style={styles.listTitle}>Villes existantes ({cities.length})</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <CityRow
            city={item}
            onMoveUp={index > 0 ? () => move(index, -1) : undefined}
            onMoveDown={index < cities.length - 1 ? () => move(index, 1) : undefined}
            onUpdate={(patch) => updateCity(item, patch)}
          />
        )}
      />
    </View>
  );
}

function CityRow({
  city,
  onMoveUp,
  onMoveDown,
  onUpdate,
}: {
  city: City;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onUpdate: (patch: Partial<City>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [fee, setFee] = useState(city.delivery_fee === null ? '' : String(city.delivery_fee));
  const [agency, setAgency] = useState(city.delivery_agency ?? '');

  const saveEdit = () => {
    onUpdate({
      delivery_fee: fee.trim() ? Number(fee.trim()) : null,
      delivery_agency: agency.trim() || null,
    });
    setEditing(false);
  };

  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={[styles.rowName, !city.is_active && styles.rowNameInactive]}>{city.name}</Text>
        <View style={styles.moveButtons}>
          {onMoveUp && (
            <Pressable onPress={onMoveUp}>
              <Text style={styles.moveBtn}>▲</Text>
            </Pressable>
          )}
          {onMoveDown && (
            <Pressable onPress={onMoveDown}>
              <Text style={styles.moveBtn}>▼</Text>
            </Pressable>
          )}
        </View>
      </View>

      {editing ? (
        <View style={styles.editBox}>
          <TextInput
            value={fee}
            onChangeText={setFee}
            placeholder="Frais (FCFA, vide = à définir)"
            placeholderTextColor={colors.creamFaint}
            keyboardType="numeric"
            style={styles.editInput}
          />
          <TextInput
            value={agency}
            onChangeText={setAgency}
            placeholder="Agence"
            placeholderTextColor={colors.creamFaint}
            style={styles.editInput}
          />
          <View style={styles.editActions}>
            <Pressable onPress={() => setEditing(false)}>
              <Text style={styles.cancelLink}>Annuler</Text>
            </Pressable>
            <Pressable onPress={saveEdit}>
              <Text style={styles.saveLink}>Enregistrer</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setEditing(true)}>
          <Text style={styles.rowMeta}>
            🚚 {city.delivery_fee === null ? 'À définir' : city.delivery_fee === 0 ? 'Gratuit' : formatXAF(city.delivery_fee)}
            {'  ·  '}🏢 {city.delivery_agency ?? 'À définir'} (modifier)
          </Text>
        </Pressable>
      )}

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>{city.is_active ? 'Active (visible)' : 'Désactivée (masquée)'}</Text>
        <Switch
          value={city.is_active}
          onValueChange={(v) => onUpdate({ is_active: v })}
          trackColor={{ true: colors.gold, false: colors.border }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  form: { marginBottom: spacing.lg },
  formTitle: { color: colors.cream, fontFamily: fonts.display, fontSize: 17, marginBottom: spacing.md },
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
  listTitle: { color: colors.creamMuted, fontFamily: fonts.bodySemiBold, fontSize: 13, marginTop: spacing.md, marginBottom: spacing.sm },
  row: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowName: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  rowNameInactive: { color: colors.creamFaint, textDecorationLine: 'line-through' },
  moveButtons: { flexDirection: 'row', gap: 10 },
  moveBtn: { color: colors.gold, fontSize: 12 },
  rowMeta: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 6 },
  editBox: { marginTop: 8, gap: 6 },
  editInput: {
    backgroundColor: colors.panelAlt,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.cream,
    fontFamily: fonts.body,
    fontSize: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 4 },
  cancelLink: { color: colors.creamFaint, fontFamily: fonts.bodyMedium, fontSize: 12 },
  saveLink: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  switchLabel: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11 },
});
