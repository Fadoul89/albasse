import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, fonts, radius, spacing } from '../theme';
import { supabase } from '../lib/supabase';
import { slugify } from '../lib/slugify';
import { uploadProductImage } from '../lib/imageUpload';
import { getCategories, getProducts, invalidateCatalogCache, type Category, type Product } from '../data';
import { useAuthStore } from '../store/authStore';
import { ScreenHeader } from '../components/ScreenHeader';
import { GoldButton } from '../components/GoldButton';

export default function AdminProductFormScreen() {
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const profile = useAuthStore((s) => s.profile);
  const isEditing = Boolean(productId);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingProduct, setLoadingProduct] = useState(isEditing);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [colors_, setColors_] = useState('');
  const [sizes, setSizes] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [isFlashSale, setIsFlashSale] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (!productId) return;
    getProducts().then((all) => {
      const p = all.find((x) => x.id === productId);
      if (p) applyProduct(p);
      setLoadingProduct(false);
    });
  }, [productId]);

  const applyProduct = (p: Product) => {
    setName(p.name);
    setDescription(p.description);
    setCategoryId(p.categoryId);
    setPrice(String(p.price));
    setCompareAtPrice(p.compareAtPrice ? String(p.compareAtPrice) : '');
    setStock(String(p.stock));
    setColors_(p.colors.join(', '));
    setSizes(p.sizes.join(', '));
    setImages(p.images);
    setIsActive(true);
    setIsFlashSale(p.isFlashSale);
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission requise', "Autorisez l'accès aux photos pour ajouter une image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;

    setUploadingImage(true);
    const { url, error } = await uploadProductImage(result.assets[0].uri);
    setUploadingImage(false);
    if (error || !url) {
      Alert.alert('Erreur', error ?? "Échec du téléversement.");
      return;
    }
    setImages((prev) => [...prev, url]);
  };

  const removeImage = (uri: string) => setImages((prev) => prev.filter((i) => i !== uri));

  const handleSave = async () => {
    if (!name.trim() || !price.trim()) {
      Alert.alert('Champs manquants', 'Le nom et le prix sont obligatoires.');
      return;
    }
    const priceNum = Number(price);
    if (Number.isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Prix invalide', 'Entrez un prix valide.');
      return;
    }
    if (images.length === 0) {
      Alert.alert('Photo manquante', 'Ajoutez au moins une photo.');
      return;
    }

    const payload = {
      name: name.trim(),
      description: description.trim(),
      category_id: categoryId,
      price: priceNum,
      compare_at_price: compareAtPrice.trim() ? Number(compareAtPrice) : null,
      stock: Number(stock) || 0,
      colors: colors_.split(',').map((c) => c.trim()).filter(Boolean),
      sizes: sizes.split(',').map((s) => s.trim()).filter(Boolean),
      images,
      is_active: isActive,
      is_flash_sale: isFlashSale,
      flash_sale_ends_at: isFlashSale ? new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString() : null,
    };

    setSaving(true);
    if (isEditing && productId) {
      const { error } = await supabase.from('products').update(payload).eq('id', productId);
      setSaving(false);
      if (error) {
        Alert.alert('Erreur', error.message);
        return;
      }
    } else {
      const slug = slugify(name.trim());
      const { error } = await supabase.from('products').insert({ ...payload, slug });
      setSaving(false);
      if (error) {
        Alert.alert('Erreur', error.message);
        return;
      }
    }

    invalidateCatalogCache();
    Alert.alert(isEditing ? 'Produit mis à jour ✓' : 'Produit créé ✓', '', [{ text: 'OK', onPress: () => router.back() }]);
  };

  const profileIsAdmin = profile?.is_admin;
  if (!profileIsAdmin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  if (loadingProduct) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title={isEditing ? 'Modifier le produit' : 'Nouveau produit'} showBack />
        <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title={isEditing ? 'Modifier le produit' : 'Nouveau produit'} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Photos</Text>
        <View style={styles.imagesRow}>
          {images.map((uri) => (
            <View key={uri} style={styles.imageWrap}>
              <Image source={{ uri }} style={styles.image} contentFit="cover" />
              <Pressable style={styles.removeImageBtn} onPress={() => removeImage(uri)}>
                <Text style={styles.removeImageText}>✕</Text>
              </Pressable>
            </View>
          ))}
          <Pressable style={styles.addImageBtn} onPress={handlePickImage} disabled={uploadingImage}>
            {uploadingImage ? <ActivityIndicator color={colors.gold} /> : <Text style={styles.addImageText}>＋{'\n'}Photo</Text>}
          </Pressable>
        </View>

        <Text style={styles.label}>Nom *</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} placeholderTextColor={colors.creamFaint} />

        <Text style={styles.label}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
          multiline
          placeholderTextColor={colors.creamFaint}
        />

        <Text style={styles.label}>Catégorie</Text>
        <View style={styles.chipsRow}>
          {categories.map((c) => (
            <Pressable key={c.id} style={[styles.chip, categoryId === c.id && styles.chipActive]} onPress={() => setCategoryId(c.id)}>
              <Text style={[styles.chipText, categoryId === c.id && styles.chipTextActive]}>
                {c.icon} {c.name}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Prix (FCFA) *</Text>
            <TextInput value={price} onChangeText={setPrice} keyboardType="numeric" style={styles.input} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Prix barré</Text>
            <TextInput value={compareAtPrice} onChangeText={setCompareAtPrice} keyboardType="numeric" style={styles.input} />
          </View>
        </View>

        <Text style={styles.label}>Stock</Text>
        <TextInput value={stock} onChangeText={setStock} keyboardType="numeric" style={styles.input} />

        <Text style={styles.label}>Couleurs (séparées par des virgules)</Text>
        <TextInput value={colors_} onChangeText={setColors_} style={styles.input} placeholder="Noir, Bleu Marine" placeholderTextColor={colors.creamFaint} />

        <Text style={styles.label}>Tailles (séparées par des virgules)</Text>
        <TextInput value={sizes} onChangeText={setSizes} style={styles.input} placeholder="S, M, L, XL" placeholderTextColor={colors.creamFaint} />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Produit actif</Text>
          <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: colors.gold, false: colors.border }} thumbColor={colors.cream} />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Vente flash</Text>
          <Switch value={isFlashSale} onValueChange={setIsFlashSale} trackColor={{ true: colors.gold, false: colors.border }} thumbColor={colors.cream} />
        </View>

        <GoldButton label={isEditing ? 'Enregistrer' : 'Créer le produit'} onPress={handleSave} loading={saving} style={{ marginTop: spacing.lg }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  content: { padding: spacing.md, paddingBottom: 60 },
  label: { color: colors.creamMuted, fontFamily: fonts.bodySemiBold, fontSize: 12, marginBottom: 6, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: colors.cream,
    fontFamily: fonts.body,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row2: { flexDirection: 'row', gap: 10 },
  imagesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  imageWrap: { width: 72, height: 88, borderRadius: radius.sm, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  removeImageBtn: { position: 'absolute', top: 2, right: 2, backgroundColor: colors.red, borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  removeImageText: { color: colors.cream, fontSize: 11, fontFamily: fonts.bodyBold },
  addImageBtn: { width: 72, height: 88, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.gold, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  addImageText: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 11, textAlign: 'center' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.panel },
  chipActive: { borderColor: colors.gold, backgroundColor: colors.panelAlt },
  chipText: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 11 },
  chipTextActive: { color: colors.goldLight },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  switchLabel: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 13 },
});
