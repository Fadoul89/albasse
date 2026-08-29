import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, Switch, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts, radius, spacing } from '../../theme';
import { useProduct, useProducts } from '../../hooks/useProducts';
import { useCategories } from '../../hooks/useCategories';
import { useToastStore } from '../../store/toastStore';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { uploadProductImage } from '../../lib/imageUpload';
import { slugify } from '../../lib/slugify';
import { ScreenHeader } from '../../components/ScreenHeader';
import { GoldButton } from '../../components/GoldButton';

interface Props {
  route: RouteProp<RootStackParamList, 'AdminProductForm'>;
}

export function AdminProductFormScreen({ route }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const productId = route.params?.productId;
  const { product: existing } = useProduct(productId ?? '');
  const { products: allProducts } = useProducts();
  const { categories } = useCategories();
  const isEditing = Boolean(productId && existing);

  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [price, setPrice] = useState(existing ? String(existing.price) : '');
  const [comparePrice, setComparePrice] = useState(existing?.compare_at_price ? String(existing.compare_at_price) : '');
  const [stock, setStock] = useState(existing ? String(existing.stock) : '');
  const [images, setImages] = useState<string[]>(existing?.images ?? []);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [colors_, setColors] = useState(existing?.colors.join(', ') ?? '');
  const [sizes, setSizes] = useState(existing?.sizes.join(', ') ?? '');
  const [categoryId, setCategoryId] = useState(existing?.category_id ?? '');
  const [isFlashSale, setIsFlashSale] = useState(existing?.is_flash_sale ?? false);
  const [notifyOnPublish, setNotifyOnPublish] = useState(existing?.notify_on_publish ?? !productId);
  const [commissionRate, setCommissionRate] = useState(
    existing?.affiliate_commission_rate != null ? String(existing.affiliate_commission_rate) : ''
  );
  const [saving, setSaving] = useState(false);
  const showToast = useToastStore((s) => s.show);

  useEffect(() => {
    if (!categoryId && categories.length > 0) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setDescription(existing.description);
      setPrice(String(existing.price));
      setComparePrice(existing.compare_at_price ? String(existing.compare_at_price) : '');
      setStock(String(existing.stock));
      setImages(existing.images);
      setColors(existing.colors.join(', '));
      setSizes(existing.sizes.join(', '));
      setCategoryId(existing.category_id);
      setIsFlashSale(existing.is_flash_sale);
      setNotifyOnPublish(existing.notify_on_publish);
      setCommissionRate(existing.affiliate_commission_rate != null ? String(existing.affiliate_commission_rate) : '');
    }
  }, [existing]);

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast("Autorisez l'accès aux photos pour ajouter des images.", { title: 'Permission requise', type: 'error' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;

    setUploadingImage(true);
    for (const asset of result.assets) {
      const { url, error } = await uploadProductImage(asset.uri);
      if (error) {
        showToast(error, { title: 'Erreur de téléversement', type: 'error' });
        continue;
      }
      if (url) setImages((prev) => [...prev, url]);
    }
    setUploadingImage(false);
  };

  const handleRemoveImage = (uri: string) => {
    setImages((prev) => prev.filter((i) => i !== uri));
  };

  const handleSave = async () => {
    if (!name || !price) {
      showToast('Le nom et le prix sont obligatoires.', { title: 'Champs manquants', type: 'error' });
      return;
    }
    if (!isSupabaseConfigured) {
      showToast('Connectez Supabase (.env) pour enregistrer réellement les produits.', { title: 'Mode démo', type: 'error' });
      return;
    }

    const baseSlug = slugify(name);
    let slug = baseSlug;
    let suffix = 2;
    while (allProducts.some((p) => p.slug === slug && p.id !== productId)) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const payload = {
      name,
      slug,
      description,
      price: Number(price),
      compare_at_price: comparePrice ? Number(comparePrice) : null,
      stock: Number(stock) || 0,
      images,
      colors: colors_.split(',').map((s) => s.trim()).filter(Boolean),
      sizes: sizes.split(',').map((s) => s.trim()).filter(Boolean),
      category_id: categoryId,
      is_flash_sale: isFlashSale,
      flash_sale_ends_at: isFlashSale ? new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString() : null,
      notify_on_publish: notifyOnPublish,
      affiliate_commission_rate: commissionRate.trim() ? Number(commissionRate.trim().replace(',', '.')) : null,
    };

    setSaving(true);
    try {
      const result = isEditing
        ? await supabase.from('products').update(payload).eq('id', productId)
        : await supabase.from('products').insert(payload);

      if (result.error) {
        console.error('Erreur enregistrement produit:', result.error);
        showToast(result.error.message, { title: 'Erreur', type: 'error' });
        return;
      }

      if (isEditing && existing && existing.slug !== slug) {
        await supabase.from('product_slug_history').insert({ slug: existing.slug, product_id: productId });
      }

      showToast(`"${name}" a bien été ${isEditing ? 'modifié' : 'créé'}.`, { title: 'Produit enregistré ✓', type: 'success' });
      navigation.goBack();
    } catch (e) {
      console.error('Exception enregistrement produit:', e);
      showToast(e instanceof Error ? e.message : String(e), { title: 'Erreur inattendue', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title={isEditing ? 'Modifier le produit' : 'Nouveau produit'} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Field label="Nom" value={name} onChangeText={setName} />
        <Field label="Description" value={description} onChangeText={setDescription} multiline />
        <Field label="Prix (FCFA)" value={price} onChangeText={setPrice} keyboardType="numeric" />
        <Field label="Prix barré (optionnel)" value={comparePrice} onChangeText={setComparePrice} keyboardType="numeric" />
        <Field label="Stock" value={stock} onChangeText={setStock} keyboardType="numeric" />
        <Text style={styles.label}>Photos</Text>
        <View style={styles.imagesRow}>
          {images.map((uri) => (
            <View key={uri} style={styles.imageThumbWrap}>
              <Image source={{ uri }} style={styles.imageThumb} contentFit="cover" />
              <Pressable style={styles.imageRemoveBtn} onPress={() => handleRemoveImage(uri)}>
                <Text style={styles.imageRemoveText}>✕</Text>
              </Pressable>
            </View>
          ))}
          <Pressable style={styles.addImageBtn} onPress={handlePickImage} disabled={uploadingImage}>
            {uploadingImage ? (
              <ActivityIndicator color={colors.gold} />
            ) : (
              <>
                <Text style={styles.addImageIcon}>＋</Text>
                <Text style={styles.addImageText}>Ajouter</Text>
              </>
            )}
          </Pressable>
        </View>
        <Field label="Couleurs (séparées par une virgule)" value={colors_} onChangeText={setColors} />
        <Field label="Tailles (séparées par une virgule)" value={sizes} onChangeText={setSizes} />

        <Text style={styles.label}>Catégorie</Text>
        <View style={styles.chipsRow}>
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

        <View style={styles.switchRow}>
          <Text style={styles.label}>Vente flash</Text>
          <Switch
            value={isFlashSale}
            onValueChange={setIsFlashSale}
            trackColor={{ true: colors.gold, false: colors.border }}
            thumbColor={colors.cream}
          />
        </View>

        <TextInput
          value={commissionRate}
          onChangeText={setCommissionRate}
          placeholder="Commission affilié % (optionnel, sinon taux de la catégorie/global)"
          placeholderTextColor={colors.creamFaint}
          keyboardType="numeric"
          style={styles.input}
        />

        <GoldButton
          label={isEditing ? 'Enregistrer les modifications' : 'Créer le produit'}
          onPress={handleSave}
          loading={saving}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    </View>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.creamFaint}
        style={[styles.input, props.multiline && { height: 80, textAlignVertical: 'top' }]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 60 },
  label: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.cream,
    fontFamily: fonts.body,
    borderWidth: 1,
    borderColor: colors.border,
  },
  imagesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.md },
  imageThumbWrap: { width: 84, height: 84, borderRadius: radius.md, overflow: 'hidden' },
  imageThumb: { width: '100%', height: '100%' },
  imageRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageRemoveText: { color: colors.cream, fontSize: 11, fontFamily: fonts.bodyBold },
  addImageBtn: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageIcon: { color: colors.gold, fontSize: 20, fontFamily: fonts.bodyBold },
  addImageText: { color: colors.creamMuted, fontSize: 10, fontFamily: fonts.bodyMedium, marginTop: 2 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.panel,
  },
  chipActive: { borderColor: colors.gold, backgroundColor: colors.panelAlt },
  chipText: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  chipTextActive: { color: colors.goldLight },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
});
