import React, { useState } from 'react';
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
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { GoldButton } from '../../components/GoldButton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { Category } from '../../types';

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function AdminCategoriesScreen() {
  const profile = useAuthStore((s) => s.profile);
  const { categories, isLoading, refresh } = useCategories();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [commissionRate, setCommissionRate] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const showToast = useToastStore((s) => s.show);

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
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setName(category.name);
    setCommissionRate(category.affiliate_commission_rate === null ? '' : String(category.affiliate_commission_rate));
    setImageUrl(category.image_url);
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
      const payload = {
        name: name.trim(),
        image_url: imageUrl,
        slug: slugify(name.trim()),
        affiliate_commission_rate: commissionRate.trim() ? Number(commissionRate.trim().replace(',', '.')) : null,
      };
      const result = editingId
        ? await supabase.from('categories').update(payload).eq('id', editingId)
        : await supabase.from('categories').insert(payload);

      if (result.error) {
        console.error('Erreur enregistrement catégorie:', result.error);
        showToast(result.error.message, { title: 'Erreur', type: 'error' });
        return;
      }

      showToast(`Catégorie "${name}" ${editingId ? 'modifiée' : 'créée'}.`, { title: 'Enregistré ✓', type: 'success' });
      resetForm();
      refresh();
    } catch (e) {
      console.error('Exception enregistrement catégorie:', e);
      showToast(e instanceof Error ? e.message : String(e), { title: 'Erreur inattendue', type: 'error' });
    } finally {
      setSaving(false);
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
        data={categories}
        keyExtractor={(item) => item.id}
        refreshing={isLoading}
        onRefresh={refresh}
        contentContainerStyle={{ padding: spacing.md }}
        ListHeaderComponent={
          <View style={styles.form}>
            <Text style={styles.formTitle}>
              {editingId ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
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
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.rowImage} contentFit="cover" />
            ) : (
              <View style={styles.rowImagePlaceholder} />
            )}
            <Text style={styles.rowName}>{item.name}</Text>
            <Pressable onPress={() => startEdit(item)}>
              <Text style={styles.editLink}>Modifier</Text>
            </Pressable>
            <Pressable onPress={() => setPendingDelete(item)}>
              <Text style={styles.deleteLink}>Supprimer</Text>
            </Pressable>
          </View>
        )}
      />
      <ConfirmDialog
        visible={!!pendingDelete}
        title="Supprimer cette catégorie ?"
        message={`"${pendingDelete?.name}" sera supprimée définitivement.`}
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
  listTitle: { color: colors.creamMuted, fontFamily: fonts.bodySemiBold, fontSize: 13, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowImage: { width: 40, height: 40, borderRadius: 20 },
  rowImagePlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.panelAlt },
  rowName: { flex: 1, color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  editLink: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 12, marginRight: 12 },
  deleteLink: { color: colors.red, fontFamily: fonts.bodyMedium, fontSize: 12 },
});
