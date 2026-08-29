import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Switch } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts, radius, spacing } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { useProducts } from '../../hooks/useProducts';
import { useCategories } from '../../hooks/useCategories';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useToastStore } from '../../store/toastStore';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { Product } from '../../types';

const formatXAF = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

type StatusFilter = 'all' | 'active' | 'inactive' | 'out_of_stock' | 'low_stock' | 'flash_sale';
type SortKey = 'date' | 'price_asc' | 'price_desc' | 'name' | 'stock';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'active', label: '🟢 Actifs' },
  { key: 'inactive', label: '⚪ Inactifs' },
  { key: 'out_of_stock', label: '🔴 Rupture' },
  { key: 'low_stock', label: '🟠 Stock faible' },
  { key: 'flash_sale', label: '⚡ Vente flash' },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'date', label: 'Plus récents' },
  { key: 'price_asc', label: 'Prix croissant' },
  { key: 'price_desc', label: 'Prix décroissant' },
  { key: 'name', label: 'Nom (A-Z)' },
  { key: 'stock', label: 'Stock croissant' },
];

export function AdminProductsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const { products, isLoading, refresh } = useProducts();
  const { categories } = useCategories();
  const showToast = useToastStore((s) => s.show);

  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('date');
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  const filtered = useMemo(() => {
    let list = [...products];

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    if (categoryId) {
      list = list.filter((p) => p.category_id === categoryId);
    }
    switch (status) {
      case 'active':
        list = list.filter((p) => p.is_active);
        break;
      case 'inactive':
        list = list.filter((p) => !p.is_active);
        break;
      case 'out_of_stock':
        list = list.filter((p) => p.stock === 0);
        break;
      case 'low_stock':
        list = list.filter((p) => p.stock > 0 && p.stock <= 5);
        break;
      case 'flash_sale':
        list = list.filter((p) => p.is_flash_sale);
        break;
    }

    switch (sort) {
      case 'price_asc':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        list.sort((a, b) => b.price - a.price);
        break;
      case 'name':
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'stock':
        list.sort((a, b) => a.stock - b.stock);
        break;
      default:
        list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    }

    return list;
  }, [products, query, categoryId, status, sort]);

  const quickUpdate = async (id: string, payload: Partial<Product>) => {
    if (!isSupabaseConfigured) return;
    setSavingId(id);
    const { error } = await supabase.from('products').update(payload).eq('id', id);
    setSavingId(null);
    if (error) {
      showToast(error.message, { title: 'Erreur', type: 'error' });
      return;
    }
    showToast('Produit mis à jour avec succès', { title: '✅ Enregistré', type: 'success' });
    refresh?.();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    if (!isSupabaseConfigured) {
      setPendingDelete(null);
      return;
    }
    setDeleting(true);
    const { error } = await supabase.from('products').delete().eq('id', pendingDelete.id);
    setDeleting(false);
    if (error) {
      showToast(error.message, { title: 'Erreur', type: 'error' });
      return;
    }
    setPendingDelete(null);
    refresh?.();
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Gestion des produits"
        showBack
        right={
          <Pressable onPress={() => navigation.navigate('AdminProductForm', {})}>
            <Text style={styles.addIcon}>＋</Text>
          </Pressable>
        }
      />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshing={isLoading}
        onRefresh={refresh}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.md }}>
            <Text style={styles.total}>
              📦 Total : {filtered.length} produit{filtered.length > 1 ? 's' : ''}
              {filtered.length !== products.length ? ` (sur ${products.length})` : ''}
            </Text>

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="🔎 Rechercher un produit…"
              placeholderTextColor={colors.creamFaint}
              style={styles.searchInput}
            />

            <View style={styles.chipsRow}>
              <Pressable
                style={[styles.chip, !categoryId && styles.chipActive]}
                onPress={() => setCategoryId(null)}
              >
                <Text style={[styles.chipText, !categoryId && styles.chipTextActive]}>Toutes catégories</Text>
              </Pressable>
              {categories.map((c) => (
                <Pressable
                  key={c.id}
                  style={[styles.chip, categoryId === c.id && styles.chipActive]}
                  onPress={() => setCategoryId(c.id)}
                >
                  <Text style={[styles.chipText, categoryId === c.id && styles.chipTextActive]}>{c.name}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.chipsRow}>
              {STATUS_FILTERS.map((f) => (
                <Pressable
                  key={f.key}
                  style={[styles.chip, status === f.key && styles.chipActive]}
                  onPress={() => setStatus(f.key)}
                >
                  <Text style={[styles.chipText, status === f.key && styles.chipTextActive]}>{f.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.chipsRow}>
              <Text style={styles.sortLabel}>Trier :</Text>
              {SORT_OPTIONS.map((o) => (
                <Pressable
                  key={o.key}
                  style={[styles.chip, sort === o.key && styles.chipActive]}
                  onPress={() => setSort(o.key)}
                >
                  <Text style={[styles.chipText, sort === o.key && styles.chipTextActive]}>{o.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowTop}>
              <Image source={{ uri: item.images[0] }} style={styles.thumb} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.meta}>
                  {item.stock === 0 ? '🔴 Rupture' : item.stock <= 5 ? `🟠 ${item.stock} restant(s)` : `Stock : ${item.stock}`}
                  {item.is_flash_sale ? ' · ⚡ Flash' : ''}
                  {!item.is_active ? ' · ⚪ Inactif' : ''}
                </Text>
              </View>
              <View style={styles.actions}>
                <Pressable onPress={() => navigation.navigate('AdminProductForm', { productId: item.id })}>
                  <Text style={styles.editLink}>✏️ Modifier</Text>
                </Pressable>
                <Pressable onPress={() => setPendingDelete(item)}>
                  <Text style={styles.deleteLink}>🗑️ Supprimer</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.quickEditRow}>
              <View style={styles.quickField}>
                <Text style={styles.quickLabel}>Prix</Text>
                <QuickNumberInput
                  value={item.price}
                  disabled={savingId === item.id}
                  onCommit={(v) => quickUpdate(item.id, { price: v })}
                  suffix=" FCFA"
                />
              </View>
              <View style={styles.quickField}>
                <Text style={styles.quickLabel}>Stock</Text>
                <QuickNumberInput
                  value={item.stock}
                  disabled={savingId === item.id}
                  onCommit={(v) => quickUpdate(item.id, { stock: v })}
                />
              </View>
              <View style={styles.quickToggle}>
                <Text style={styles.quickLabel}>Actif</Text>
                <Switch
                  value={item.is_active}
                  disabled={savingId === item.id}
                  onValueChange={(v) => quickUpdate(item.id, { is_active: v })}
                  trackColor={{ true: colors.gold, false: colors.border }}
                  thumbColor={colors.cream}
                />
              </View>
              <View style={styles.quickToggle}>
                <Text style={styles.quickLabel}>Flash</Text>
                <Switch
                  value={item.is_flash_sale}
                  disabled={savingId === item.id}
                  onValueChange={(v) =>
                    quickUpdate(item.id, {
                      is_flash_sale: v,
                      flash_sale_ends_at: v ? new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString() : null,
                    })
                  }
                  trackColor={{ true: colors.gold, false: colors.border }}
                  thumbColor={colors.cream}
                />
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={!isLoading ? <Text style={styles.emptyText}>Aucun produit ne correspond à ces filtres.</Text> : null}
      />
      <ConfirmDialog
        visible={!!pendingDelete}
        title="Voulez-vous vraiment supprimer ce produit ?"
        message={`"${pendingDelete?.name}" sera supprimé définitivement. Cette action est irréversible.`}
        confirmLabel="Supprimer"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </View>
  );
}

function QuickNumberInput({
  value,
  onCommit,
  disabled,
  suffix,
}: {
  value: number;
  onCommit: (v: number) => void;
  disabled?: boolean;
  suffix?: string;
}) {
  const [text, setText] = useState(String(value));

  React.useEffect(() => {
    setText(String(value));
  }, [value]);

  return (
    <TextInput
      value={text}
      onChangeText={setText}
      onBlur={() => {
        const n = Number(text);
        if (!Number.isNaN(n) && n !== value) onCommit(n);
        else setText(String(value));
      }}
      keyboardType="numeric"
      editable={!disabled}
      style={styles.quickInput}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  addIcon: { color: colors.gold, fontSize: 22, fontFamily: fonts.bodyBold },
  total: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 13, marginBottom: spacing.sm },
  searchInput: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: colors.cream,
    fontFamily: fonts.body,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: spacing.sm },
  sortLabel: { color: colors.creamFaint, fontFamily: fonts.bodyMedium, fontSize: 11, marginRight: 2 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.panel,
  },
  chipActive: { borderColor: colors.gold, backgroundColor: colors.panelAlt },
  chipText: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 11 },
  chipTextActive: { color: colors.goldLight },
  row: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  thumb: { width: 56, height: 68, borderRadius: radius.sm },
  name: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  meta: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 3 },
  actions: { alignItems: 'flex-end', gap: 6 },
  editLink: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 12 },
  deleteLink: { color: colors.red, fontFamily: fonts.bodyMedium, fontSize: 12 },
  quickEditRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  quickField: { flex: 1, minWidth: 90 },
  quickLabel: { color: colors.creamFaint, fontFamily: fonts.bodyMedium, fontSize: 9, textTransform: 'uppercase', marginBottom: 2 },
  quickInput: {
    backgroundColor: colors.panelAlt,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: colors.cream,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickToggle: { alignItems: 'center' },
  emptyText: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', marginTop: 30 },
});
