import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { colors, fonts, radius, spacing } from '../theme';
import { formatXAF } from '../lib/format';
import { supabase } from '../lib/supabase';
import { getProducts, invalidateCatalogCache, type Product } from '../data';
import { useAuthStore } from '../store/authStore';
import { ScreenHeader } from '../components/ScreenHeader';

type StatusFilter = 'all' | 'active' | 'inactive' | 'out_of_stock' | 'low_stock' | 'flash_sale';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'active', label: '🟢 Actifs' },
  { key: 'inactive', label: '⚪ Inactifs' },
  { key: 'out_of_stock', label: '🔴 Rupture' },
  { key: 'low_stock', label: '🟠 Stock faible' },
  { key: 'flash_sale', label: '⚡ Flash' },
];

export default function AdminProductsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = () => {
    setIsLoading(true);
    invalidateCatalogCache();
    getProducts().then((data) => {
      setProducts(data);
      setIsLoading(false);
    });
  };

  React.useEffect(() => {
    if (profile?.is_admin) load();
    else setIsLoading(false);
  }, [profile?.id]);

  const filtered = useMemo(() => {
    let list = [...products];
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    switch (status) {
      case 'active':
        list = list.filter((p) => p.stock > 0);
        break;
      case 'out_of_stock':
        list = list.filter((p) => p.stock === 0);
        break;
      case 'low_stock':
        list = list.filter((p) => p.stock > 0 && p.stock <= 5);
        break;
      case 'flash_sale':
        list = list.filter((p) => p.isFlashSale);
        break;
    }
    return list;
  }, [products, query, status]);

  const quickUpdate = async (id: string, payload: Record<string, unknown>) => {
    setSavingId(id);
    const { error } = await supabase.from('products').update(payload).eq('id', id);
    setSavingId(null);
    if (error) {
      Alert.alert('Erreur', error.message);
      return;
    }
    invalidateCatalogCache();
    load();
  };

  const confirmDelete = (product: Product) => {
    Alert.alert('Supprimer ce produit ?', `"${product.name}" sera supprimé définitivement.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('products').delete().eq('id', product.id);
          if (error) {
            Alert.alert('Erreur', error.message);
            return;
          }
          invalidateCatalogCache();
          load();
        },
      },
    ]);
  };

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Gestion des produits"
        showBack
        right={
          <Pressable onPress={() => router.push('/admin-product-form')}>
            <Text style={styles.addIcon}>＋</Text>
          </Pressable>
        }
      />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshing={isLoading}
        onRefresh={load}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.md }}>
            <Text style={styles.total}>
              📦 {filtered.length} produit{filtered.length > 1 ? 's' : ''}
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
              {STATUS_FILTERS.map((f) => (
                <Pressable key={f.key} style={[styles.chip, status === f.key && styles.chipActive]} onPress={() => setStatus(f.key)}>
                  <Text style={[styles.chipText, status === f.key && styles.chipTextActive]}>{f.label}</Text>
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
                  {item.isFlashSale ? ' · ⚡ Flash' : ''}
                </Text>
              </View>
              <View style={styles.actions}>
                <Pressable onPress={() => router.push({ pathname: '/admin-product-form', params: { productId: item.id } })}>
                  <Text style={styles.editLink}>✏️ Modifier</Text>
                </Pressable>
                <Pressable onPress={() => confirmDelete(item)}>
                  <Text style={styles.deleteLink}>🗑️ Supprimer</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.quickEditRow}>
              <View style={styles.quickField}>
                <Text style={styles.quickLabel}>Prix</Text>
                <QuickNumberInput value={item.price} disabled={savingId === item.id} onCommit={(v) => quickUpdate(item.id, { price: v })} />
              </View>
              <View style={styles.quickField}>
                <Text style={styles.quickLabel}>Stock</Text>
                <QuickNumberInput value={item.stock} disabled={savingId === item.id} onCommit={(v) => quickUpdate(item.id, { stock: v })} />
              </View>
              <View style={styles.quickToggle}>
                <Text style={styles.quickLabel}>Flash</Text>
                <Switch
                  value={item.isFlashSale}
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
    </View>
  );
}

function QuickNumberInput({ value, onCommit, disabled }: { value: number; onCommit: (v: number) => void; disabled?: boolean }) {
  const [text, setText] = useState(String(value));
  React.useEffect(() => setText(String(value)), [value]);

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
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.panel },
  chipActive: { borderColor: colors.gold, backgroundColor: colors.panelAlt },
  chipText: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 11 },
  chipTextActive: { color: colors.goldLight },
  row: { backgroundColor: colors.panel, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm },
  rowTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  thumb: { width: 56, height: 68, borderRadius: radius.sm },
  name: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  meta: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 3 },
  actions: { alignItems: 'flex-end', gap: 6 },
  editLink: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 12 },
  deleteLink: { color: colors.red, fontFamily: fonts.bodyMedium, fontSize: 12 },
  quickEditRow: { flexDirection: 'row', gap: 10, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center' },
  quickField: { flex: 1, minWidth: 90 },
  quickLabel: { color: colors.creamFaint, fontFamily: fonts.bodyMedium, fontSize: 9, textTransform: 'uppercase', marginBottom: 2 },
  quickInput: { backgroundColor: colors.panelAlt, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 6, color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 12, borderWidth: 1, borderColor: colors.border },
  quickToggle: { alignItems: 'center' },
  emptyText: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', marginTop: 30 },
});
