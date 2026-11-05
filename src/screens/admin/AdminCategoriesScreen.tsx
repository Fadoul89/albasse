import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../store/authStore';
import { useCategories } from '../../hooks/useCategories';
import { useToastStore } from '../../store/toastStore';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { uploadProductImage } from '../../lib/imageUpload';
import { orderUpdates } from '../../lib/categoryOrder';
import {
  flattenTree,
  hasParentColumn,
  mainCategories,
  moveInGroup,
  parentChoices,
  parentOf,
  subCategoriesOf,
  uniqueSlug,
} from '../../lib/subCategories';
import { isMissingColumn } from '../../lib/dbErrors';
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { GoldButton } from '../../components/GoldButton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { Category } from '../../types';

export function AdminCategoriesScreen() {
  const profile = useAuthStore((s) => s.profile);
  const { categories, isLoading, refresh } = useCategories();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [commissionRate, setCommissionRate] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  // sous-catégories : la catégorie principale choisie dans le formulaire (null = catégorie principale)
  const [parentId, setParentId] = useState<string | null>(null);
  const listRef = useRef<FlatList<Category>>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  // ordre changé avec les flèches, affiché tout de suite (la liste relue de la base le remplace)
  const [ordered, setOrdered] = useState<Category[] | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const showToast = useToastStore((s) => s.show);
  const list = ordered ?? categories;
  const rows = useMemo(() => flattenTree(list), [list]);
  // la base a la colonne parent_id (script add-subcategories.sql lancé) : sans elle, pas de sous-catégories
  const subColumn = hasParentColumn(categories);
  const parentOptions = parentChoices(list, editingId);

  useEffect(() => setOrdered(null), [categories]);

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setCommissionRate('');
    setImageUrl(null);
    setParentId(null);
  };

  const startSub = (main: Category) => {
    resetForm();
    setParentId(main.id);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setName(category.name);
    setCommissionRate(category.affiliate_commission_rate === null ? '' : String(category.affiliate_commission_rate));
    setImageUrl(category.image_url);
    setParentId(parentOf(list, category)?.id ?? null);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast("Autorisez l'accès aux photos pour ajouter une image.", { title: 'Permission requise', type: 'error' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;

    setUploadingImage(true);
    const { url, error } = await uploadProductImage(result.assets[0].uri);
    setUploadingImage(false);
    if (error) {
      showToast(error, { title: 'Erreur de téléversement', type: 'error' });
      return;
    }
    if (url) setImageUrl(url);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Merci de donner un nom à la catégorie.', { title: 'Nom manquant', type: 'error' });
      return;
    }
    if (!isSupabaseConfigured) {
      showToast('Connectez Supabase pour gérer réellement les catégories.', { title: 'Mode démo', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      const parent = parentId ? list.find((c) => c.id === parentId) ?? null : null;
      const payload = {
        name: name.trim(),
        image_url: imageUrl,
        slug: uniqueSlug(name.trim(), list, parent, editingId),
        affiliate_commission_rate: commissionRate.trim() ? Number(commissionRate.trim().replace(',', '.')) : null,
        // la colonne parent_id n'existe qu'après le script add-subcategories.sql : sans elle, on n'écrit rien dedans
        ...(subColumn ? { parent_id: parent?.id ?? null } : {}),
      };
      const result = editingId
        ? await supabase.from('categories').update(payload).eq('id', editingId)
        : await supabase.from('categories').insert(payload);

      if (result.error) {
        console.error('Erreur enregistrement catégorie:', result.error);
        showToast(
          isMissingColumn(result.error, 'parent_id') ? 'Lancez d’abord le script add-subcategories.sql dans Supabase.' : result.error.message,
          { title: 'Erreur', type: 'error' }
        );
        return;
      }

      showToast(`${parent ? 'Sous-catégorie' : 'Catégorie'} "${name}" ${editingId ? 'modifiée' : 'créée'}.`, { title: 'Enregistré ✓', type: 'success' });
      resetForm();
      refresh();
    } catch (e) {
      console.error('Exception enregistrement catégorie:', e);
      showToast(e instanceof Error ? e.message : String(e), { title: 'Erreur inattendue', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // ▲ ▼ : la catégorie monte ou descend parmi ses « frères » (les catégories principales entre elles, les sous-catégories d'une même catégorie entre elles)
  const move = async (item: Category, delta: -1 | 1) => {
    const next = moveInGroup(list, item.id, delta);
    if (next === list || savingOrder) return;
    setOrdered(next);
    setSavingOrder(true);
    const results = await Promise.all(
      orderUpdates(list, next).map((u) => supabase.from('categories').update({ sort_order: u.sort_order }).eq('id', u.id))
    );
    setSavingOrder(false);
    const failed = results.find((r) => r.error)?.error;
    if (failed) {
      console.error('Erreur ordre des catégories:', failed);
      showToast(
        isMissingColumn(failed, 'sort_order')
          ? 'Lancez d’abord le script add-category-order.sql dans Supabase.'
          : failed.message,
        { title: 'Ordre non enregistré', type: 'error' }
      );
      refresh();
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const { error } = await supabase.from('categories').delete().eq('id', pendingDelete.id);
    setDeleting(false);
    if (error) {
      console.error('Erreur suppression catégorie:', error);
      return;
    }
    if (editingId === pendingDelete.id) resetForm();
    setPendingDelete(null);
    refresh();
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Gestion des catégories" showBack />
      <FlatList
        ref={listRef}
        data={rows.map((r) => r.category)}
        keyExtractor={(item) => item.id}
        refreshing={isLoading}
        onRefresh={refresh}
        initialNumToRender={50}
        contentContainerStyle={{ padding: spacing.md }}
        ListHeaderComponent={
          <View style={styles.form}>
            <Text style={styles.formTitle} testID="category-form-title">
              {editingId
                ? parentId
                  ? 'Modifier la sous-catégorie'
                  : 'Modifier la catégorie'
                : parentId
                  ? `Nouvelle sous-catégorie de « ${list.find((c) => c.id === parentId)?.name ?? ''} »`
                  : 'Nouvelle catégorie'}
            </Text>
            <Pressable style={styles.imagePicker} onPress={handlePickImage} disabled={uploadingImage}>
              {uploadingImage ? (
                <ActivityIndicator color={colors.gold} />
              ) : imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.imagePreview} contentFit="cover" />
              ) : (
                <Text style={styles.imagePickerText}>＋ Photo</Text>
              )}
            </Pressable>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Nom de la catégorie"
              placeholderTextColor={colors.creamFaint}
              style={styles.input}
            />
            {subColumn ? (
              <View style={styles.parentBox} testID="category-parent-box">
                <Text style={styles.parentLabel}>Catégorie principale</Text>
                {editingId && parentOptions.length === 0 ? (
                  <Text style={styles.orderHint} testID="category-parent-locked">
                    Cette catégorie a des sous-catégories : elle reste une catégorie principale.
                  </Text>
                ) : (
                  <View style={styles.chipsRow}>
                    <Pressable
                      testID="category-parent-none"
                      onPress={() => setParentId(null)}
                      style={[styles.chip, parentId === null && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, parentId === null && styles.chipTextActive]}>Aucune (catégorie principale)</Text>
                    </Pressable>
                    {parentOptions.map((c) => (
                      <Pressable
                        key={c.id}
                        testID={`category-parent-${c.slug}`}
                        onPress={() => setParentId(c.id)}
                        style={[styles.chip, parentId === c.id && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, parentId === c.id && styles.chipTextActive]}>{c.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <Text style={styles.orderHint} testID="category-sub-missing">
                Pour créer des sous-catégories, lancez d’abord le script add-subcategories.sql dans Supabase.
              </Text>
            )}
            <TextInput
              value={commissionRate}
              onChangeText={setCommissionRate}
              placeholder="Commission affilié % (optionnel, sinon taux global)"
              placeholderTextColor={colors.creamFaint}
              keyboardType="numeric"
              style={styles.input}
            />
            <View style={styles.formActions}>
              {editingId && (
                <GoldButton label="Annuler" variant="outline" onPress={resetForm} style={{ flex: 1 }} />
              )}
              <GoldButton
                label={editingId ? 'Enregistrer' : 'Ajouter'}
                onPress={handleSave}
                loading={saving}
                style={{ flex: 1 }}
              />
            </View>
            <Text style={styles.listTitle}>Catégories existantes</Text>
            <Text style={styles.orderHint}>
              Touchez ▲ ▼ pour choisir l’ordre sur le site : la n° 1 s’affiche en premier. Les sous-catégories se rangent sous leur catégorie principale.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const parent = parentOf(list, item);
          const isSubRow = parent !== null;
          const siblings = parent ? subCategoriesOf(list, parent.id) : mainCategories(list);
          const position = siblings.findIndex((c) => c.id === item.id);
          const first = position <= 0;
          const last = position === siblings.length - 1;
          return (
            <View style={[styles.row, isSubRow && styles.rowSub]} testID={`category-row-${item.slug}`}>
              <Text style={styles.rowRank}>{isSubRow ? '↳' : position + 1}</Text>
              <View style={styles.moveCol}>
                <Pressable
                  testID={`category-up-${item.slug}`}
                  accessibilityLabel={`Monter ${item.name}`}
                  onPress={() => move(item, -1)}
                  disabled={first || savingOrder}
                  style={[styles.moveBtn, first && styles.moveBtnOff]}
                >
                  <Text style={styles.moveText}>▲</Text>
                </Pressable>
                <Pressable
                  testID={`category-down-${item.slug}`}
                  accessibilityLabel={`Descendre ${item.name}`}
                  onPress={() => move(item, 1)}
                  disabled={last || savingOrder}
                  style={[styles.moveBtn, last && styles.moveBtnOff]}
                >
                  <Text style={styles.moveText}>▼</Text>
                </Pressable>
              </View>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.rowImage} contentFit="cover" />
              ) : (
                <View style={styles.rowImagePlaceholder} />
              )}
              <View style={styles.rowBody}>
                <Text style={styles.rowName}>{item.name}</Text>
                {isSubRow && <Text style={styles.rowParent}>Sous-catégorie de {parent.name}</Text>}
                {!isSubRow && subCategoriesOf(list, item.id).length > 0 && (
                  <Text style={styles.rowParent}>{subCategoriesOf(list, item.id).length} sous-catégorie(s)</Text>
                )}
                <View style={styles.rowActions}>
                  <Pressable onPress={() => startEdit(item)}>
                    <Text style={styles.editLink}>Modifier</Text>
                  </Pressable>
                  {subColumn && !isSubRow && (
                    <Pressable testID={`category-add-sub-${item.slug}`} onPress={() => startSub(item)}>
                      <Text style={styles.editLink}>＋ Sous-catégorie</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => setPendingDelete(item)}>
                    <Text style={styles.deleteLink}>Supprimer</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
      />
      <ConfirmDialog
        visible={!!pendingDelete}
        title="Supprimer cette catégorie ?"
        message={
          pendingDelete && subCategoriesOf(list, pendingDelete.id).length > 0
            ? `"${pendingDelete.name}" sera supprimée définitivement. Ses ${subCategoriesOf(list, pendingDelete.id).length} sous-catégories deviennent des catégories principales (leurs articles restent classés). Les articles rangés directement dans "${pendingDelete.name}" n’auront plus de catégorie.`
            : `"${pendingDelete?.name}" sera supprimée définitivement. Les articles rangés dedans n’auront plus de catégorie.`
        }
        confirmLabel="Supprimer"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  form: { marginBottom: spacing.lg },
  formTitle: { color: colors.cream, fontFamily: fonts.display, fontSize: 17, marginBottom: spacing.md },
  imagePicker: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  imagePreview: { width: '100%', height: '100%' },
  imagePickerText: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 12 },
  input: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.cream,
    fontFamily: fonts.body,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  formActions: { flexDirection: 'row', gap: 10, marginBottom: spacing.lg },
  listTitle: { color: colors.creamMuted, fontFamily: fonts.bodySemiBold, fontSize: 13, marginBottom: 4 },
  orderHint: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  parentBox: { marginBottom: spacing.md },
  parentLabel: { color: colors.creamMuted, fontFamily: fonts.bodySemiBold, fontSize: 13, marginBottom: 6 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 12 },
  chipTextActive: { color: colors.background },
  rowSub: { marginLeft: 28, borderLeftWidth: 2, borderLeftColor: colors.gold },
  rowParent: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  rowRank: { width: 22, color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 15, textAlign: 'center' },
  moveCol: { gap: 4 },
  moveBtn: {
    width: 30,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveBtnOff: { opacity: 0.25 },
  moveText: { color: colors.gold, fontSize: 11 },
  rowImage: { width: 40, height: 40, borderRadius: 20 },
  rowImagePlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.panelAlt },
  rowBody: { flex: 1 },
  rowName: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4, marginTop: 4 },
  editLink: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 12 },
  deleteLink: { color: colors.red, fontFamily: fonts.bodyMedium, fontSize: 12 },
});
