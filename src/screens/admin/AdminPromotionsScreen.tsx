import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Switch,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../store/authStore';
import { useSmartPromotions } from '../../hooks/useSmartPromotions';
import { useCategories } from '../../hooks/useCategories';
import { useProducts } from '../../hooks/useProducts';
import { useStoreSettings } from '../../hooks/useStoreSettings';
import { useToastStore } from '../../store/toastStore';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { uploadProductImage } from '../../lib/imageUpload';
import { pickAndUploadVoiceover } from '../../lib/voiceoverUpload';
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { GoldButton } from '../../components/GoldButton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DateField } from '../../components/DateField';
import { TimeField } from '../../components/TimeField';
import type { SmartPromotion, AdItem } from '../../types';

type TargetType = 'category' | 'product' | 'none';

const todayStr = () => new Date().toISOString().slice(0, 10);

export function AdminPromotionsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const { promotions, isLoading, refresh } = useSmartPromotions();
  const { categories } = useCategories();
  const { products } = useProducts();
  const { settings: storeSettings, refresh: refreshStoreSettings } = useStoreSettings();
  const showToast = useToastStore((s) => s.show);

  const [voiceoverUrl, setVoiceoverUrl] = useState<string | null>(null);
  const [uploadingVoiceover, setUploadingVoiceover] = useState(false);
  const [savingVoiceover, setSavingVoiceover] = useState(false);

  useEffect(() => {
    setVoiceoverUrl(storeSettings.voiceover_url ?? null);
  }, [storeSettings]);

  const handlePickVoiceover = async () => {
    setUploadingVoiceover(true);
    const { url, error } = await pickAndUploadVoiceover();
    setUploadingVoiceover(false);
    if (error) {
      showToast(error, { title: 'Erreur', type: 'error' });
      return;
    }
    if (url) {
      setVoiceoverUrl(url);
      setSavingVoiceover(true);
      await supabase.from('store_settings').update({ voiceover_url: url }).eq('id', 1);
      setSavingVoiceover(false);
      refreshStoreSettings();
      showToast('Le message vocal a été mis à jour.', { title: 'Enregistré ✓', type: 'success' });
    }
  };

  const handleRemoveVoiceover = async () => {
    setSavingVoiceover(true);
    await supabase.from('store_settings').update({ voiceover_url: null }).eq('id', 1);
    setSavingVoiceover(false);
    setVoiceoverUrl(null);
    refreshStoreSettings();
  };

  const handlePreviewVoiceover = () => {
    if (!voiceoverUrl || Platform.OS !== 'web') return;
    new (window as any).Audio(voiceoverUrl).play();
  };

  type AdSlot = 'left' | 'right';
  const [leftAdItems, setLeftAdItems] = useState<AdItem[]>([]);
  const [rightAdItems, setRightAdItems] = useState<AdItem[]>([]);
  const [uploadingAd, setUploadingAd] = useState<AdSlot | null>(null);
  const [savingAds, setSavingAds] = useState(false);

  useEffect(() => {
    setLeftAdItems(storeSettings.left_ad_items ?? []);
    setRightAdItems(storeSettings.right_ad_items ?? []);
  }, [storeSettings]);

  const SETTERS: Record<AdSlot, React.Dispatch<React.SetStateAction<AdItem[]>>> = {
    left: setLeftAdItems,
    right: setRightAdItems,
  };

  const handleAddAdImages = async (slot: AdSlot) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast("Autorisez l'accès aux photos pour ajouter une image.", { title: 'Permission requise', type: 'error' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;

    setUploadingAd(slot);
    const newItems: AdItem[] = [];
    for (const asset of result.assets) {
      const { url, error } = await uploadProductImage(asset.uri);
      if (error) {
        showToast(error, { title: 'Erreur de téléversement', type: 'error' });
        continue;
      }
      if (url) newItems.push({ image_url: url, link: null });
    }
    setUploadingAd(null);
    if (newItems.length === 0) return;
    SETTERS[slot]((prev) => [...prev, ...newItems]);
  };

  const updateAdLink = (slot: AdSlot, index: number, link: string) => {
    SETTERS[slot]((prev) => prev.map((it, i) => (i === index ? { ...it, link: link || null } : it)));
  };

  const removeAdItem = (slot: AdSlot, index: number) => {
    SETTERS[slot]((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveAds = async () => {
    setSavingAds(true);
    const { error } = await supabase
      .from('store_settings')
      .update({ left_ad_items: leftAdItems, right_ad_items: rightAdItems })
      .eq('id', 1);
    setSavingAds(false);
    if (error) {
      showToast(error.message, { title: 'Erreur', type: 'error' });
      return;
    }
    refreshStoreSettings();
    showToast('Les publicités ont été mises à jour.', { title: 'Enregistré ✓', type: 'success' });
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [targetType, setTargetType] = useState<TargetType>('none');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [productQuery, setProductQuery] = useState('');
  const [gift, setGift] = useState('');
  const [minPurchase, setMinPurchase] = useState('0');
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [endTime, setEndTime] = useState('23:59');
  const [maxBeneficiaries, setMaxBeneficiaries] = useState('');
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [buttonText, setButtonText] = useState("PROFITER DE L'OFFRE");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SmartPromotion | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    setTargetType('none');
    setCategoryId(null);
    setProductId(null);
    setProductQuery('');
    setGift('');
    setMinPurchase('0');
    setStartDate(todayStr());
    setEndDate(todayStr());
    setEndTime('23:59');
    setMaxBeneficiaries('');
    setMessage('');
    setImageUrl(null);
    setButtonText("PROFITER DE L'OFFRE");
    setIsActive(true);
  };

  const startEdit = (promo: SmartPromotion) => {
    setEditingId(promo.id);
    setName(promo.name);
    setTargetType(promo.category_id ? 'category' : promo.product_id ? 'product' : 'none');
    setCategoryId(promo.category_id);
    setProductId(promo.product_id);
    setProductQuery(promo.product_id ? products.find((p) => p.id === promo.product_id)?.name ?? '' : '');
    setGift(promo.gift);
    setMinPurchase(String(promo.min_purchase));
    setStartDate(promo.start_date);
    setEndDate(promo.end_date);
    setEndTime(promo.end_time.slice(0, 5));
    setMaxBeneficiaries(promo.max_beneficiaries !== null ? String(promo.max_beneficiaries) : '');
    setMessage(promo.message);
    setImageUrl(promo.image_url);
    setButtonText(promo.button_text);
    setIsActive(promo.is_active);
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
    if (!name.trim() || !gift.trim() || !message.trim()) {
      showToast('Le nom, le cadeau et le message sont obligatoires.', { title: 'Champs manquants', type: 'error' });
      return;
    }
    if (!isSupabaseConfigured) {
      showToast('Connectez Supabase pour gérer réellement les promotions.', { title: 'Mode démo', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        category_id: targetType === 'category' ? categoryId : null,
        product_id: targetType === 'product' ? productId : null,
        gift: gift.trim(),
        min_purchase: Number(minPurchase) || 0,
        start_date: startDate,
        end_date: endDate,
        end_time: endTime || '23:59',
        max_beneficiaries: maxBeneficiaries.trim() ? Number(maxBeneficiaries) : null,
        message: message.trim(),
        image_url: imageUrl,
        button_text: buttonText.trim() || "PROFITER DE L'OFFRE",
        is_active: isActive,
      };

      const result = editingId
        ? await supabase.from('smart_promotions').update(payload).eq('id', editingId)
        : await supabase.from('smart_promotions').insert(payload);

      if (result.error) {
        console.error('Erreur enregistrement promotion:', result.error);
        showToast(result.error.message, { title: 'Erreur', type: 'error' });
        return;
      }

      showToast(`Promotion "${name}" ${editingId ? 'modifiée' : 'créée'}.`, { title: 'Enregistré ✓', type: 'success' });
      resetForm();
      refresh();
    } catch (e) {
      console.error('Exception enregistrement promotion:', e);
      showToast(e instanceof Error ? e.message : String(e), { title: 'Erreur inattendue', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const { error } = await supabase.from('smart_promotions').delete().eq('id', pendingDelete.id);
    setDeleting(false);
    if (error) {
      console.error('Erreur suppression promotion:', error);
      showToast(error.message, { title: 'Erreur', type: 'error' });
      return;
    }
    if (editingId === pendingDelete.id) resetForm();
    setPendingDelete(null);
    refresh();
  };

  const matchingProducts = productQuery.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(productQuery.trim().toLowerCase())).slice(0, 6)
    : [];

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Promotions intelligentes" showBack />
      <FlatList
        data={promotions}
        keyExtractor={(item) => item.id}
        refreshing={isLoading}
        onRefresh={refresh}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}
        ListHeaderComponent={
          <View style={styles.form}>
            <View style={styles.voiceoverBox}>
              <Text style={styles.formTitle}>Message vocal (voix off)</Text>
              <Text style={styles.helperText}>
                Ce message audio est joué automatiquement au client, une fois toutes les 24h, dès qu'il touche
                le site (les navigateurs bloquent le son automatique tant qu'il n'y a pas eu d'interaction).
              </Text>
              {voiceoverUrl ? (
                <View style={styles.voiceoverRow}>
                  <Text style={styles.voiceoverStatus}>🔊 Fichier audio configuré</Text>
                  <Pressable onPress={handlePreviewVoiceover}>
                    <Text style={styles.voiceoverAction}>▶ Écouter</Text>
                  </Pressable>
                  <Pressable onPress={handleRemoveVoiceover}>
                    <Text style={[styles.voiceoverAction, { color: colors.red }]}>Supprimer</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.voiceoverStatus}>Aucun fichier audio configuré.</Text>
              )}
              <GoldButton
                label={voiceoverUrl ? 'Remplacer le fichier audio' : 'Choisir un fichier audio'}
                variant="outline"
                onPress={handlePickVoiceover}
                loading={uploadingVoiceover || savingVoiceover}
                style={{ marginTop: spacing.sm }}
              />
            </View>

            <View style={styles.voiceoverBox}>
              <Text style={styles.formTitle}>Publicités latérales (accueil, grand écran)</Text>
              <Text style={styles.helperText}>
                Plusieurs images par côté défilent automatiquement toutes les 4-5 secondes. Uniquement sur les
                écrans assez larges (les téléphones n'ont pas la place). Ajoutez un lien par image pour la
                rendre cliquable (produit du site ou lien externe comme WhatsApp).
              </Text>

              <AdItemsEditor
                title="Publicité gauche"
                items={leftAdItems}
                uploading={uploadingAd === 'left'}
                onAdd={() => handleAddAdImages('left')}
                onLinkChange={(i, v) => updateAdLink('left', i, v)}
                onRemove={(i) => removeAdItem('left', i)}
              />

              <AdItemsEditor
                title="Publicité droite"
                items={rightAdItems}
                uploading={uploadingAd === 'right'}
                onAdd={() => handleAddAdImages('right')}
                onLinkChange={(i, v) => updateAdLink('right', i, v)}
                onRemove={(i) => removeAdItem('right', i)}
              />

              <GoldButton
                label="Enregistrer les publicités"
                variant="outline"
                onPress={handleSaveAds}
                loading={savingAds}
                style={{ marginTop: spacing.sm }}
              />
            </View>

            <Text style={styles.formTitle}>{editingId ? 'Modifier la promotion' : 'Nouvelle promotion'}</Text>

            <Field label="Nom de la promotion" value={name} onChangeText={setName} placeholder="Ex: Offre parfum du jour" />

            <Text style={styles.label}>Produit ou catégorie concernée</Text>
            <View style={styles.chipsRow}>
              <Pressable
                style={[styles.chip, targetType === 'none' && styles.chipActive]}
                onPress={() => setTargetType('none')}
              >
                <Text style={[styles.chipText, targetType === 'none' && styles.chipTextActive]}>Aucun ciblage</Text>
              </Pressable>
              <Pressable
                style={[styles.chip, targetType === 'category' && styles.chipActive]}
                onPress={() => setTargetType('category')}
              >
                <Text style={[styles.chipText, targetType === 'category' && styles.chipTextActive]}>Catégorie</Text>
              </Pressable>
              <Pressable
                style={[styles.chip, targetType === 'product' && styles.chipActive]}
                onPress={() => setTargetType('product')}
              >
                <Text style={[styles.chipText, targetType === 'product' && styles.chipTextActive]}>Produit précis</Text>
              </Pressable>
            </View>

            {targetType === 'category' && (
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
            )}

            {targetType === 'product' && (
              <View style={{ marginBottom: spacing.md }}>
                <TextInput
                  value={productQuery}
                  onChangeText={(t) => {
                    setProductQuery(t);
                    setProductId(null);
                  }}
                  placeholder="Rechercher un produit…"
                  placeholderTextColor={colors.creamFaint}
                  style={styles.input}
                />
                {matchingProducts.length > 0 && (
                  <View style={styles.suggestionsBox}>
                    {matchingProducts.map((p) => (
                      <Pressable
                        key={p.id}
                        style={styles.suggestionRow}
                        onPress={() => {
                          setProductId(p.id);
                          setProductQuery(p.name);
                        }}
                      >
                        <Text style={styles.suggestionText}>{p.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                {productId && <Text style={styles.selectedNote}>✓ Produit sélectionné</Text>}
              </View>
            )}

            <Field label="Cadeau offert" value={gift} onChangeText={setGift} placeholder="Ex: Déodorant offert" />
            <Field
              label="Prix minimum d'achat (FCFA)"
              value={minPurchase}
              onChangeText={setMinPurchase}
              keyboardType="numeric"
            />

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <DateField label="Date de début" value={startDate} onChange={setStartDate} />
              </View>
              <View style={{ flex: 1 }}>
                <DateField label="Date de fin" value={endDate} onChange={setEndDate} minimumDateStr={startDate} />
              </View>
            </View>
            <TimeField label="Heure de fin" value={endTime} onChange={setEndTime} />

            <Field
              label="Nombre maximum de bénéficiaires (vide = illimité)"
              value={maxBeneficiaries}
              onChangeText={setMaxBeneficiaries}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Message affiché au client</Text>
            <Text style={styles.helperText}>
              Utilisez {'{prenom}'} pour insérer automatiquement le prénom du client connecté.
            </Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Achetez un parfum aujourd'hui et recevez un cadeau offert ! 🎁"
              placeholderTextColor={colors.creamFaint}
              style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
              multiline
            />

            <Text style={styles.label}>Image de l'offre (optionnel)</Text>
            <Pressable style={styles.imagePicker} onPress={handlePickImage} disabled={uploadingImage}>
              {uploadingImage ? (
                <ActivityIndicator color={colors.gold} />
              ) : imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.imagePreview} contentFit="cover" />
              ) : (
                <Text style={styles.imagePickerText}>＋ Photo</Text>
              )}
            </Pressable>

            <Field label="Texte du bouton" value={buttonText} onChangeText={setButtonText} />

            <View style={styles.switchRow}>
              <Text style={styles.label}>Promotion active</Text>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{ true: colors.gold, false: colors.border }}
                thumbColor={colors.cream}
              />
            </View>

            <View style={styles.formActions}>
              {editingId && <GoldButton label="Annuler" variant="outline" onPress={resetForm} style={{ flex: 1 }} />}
              <GoldButton
                label={editingId ? 'Enregistrer' : 'Créer'}
                onPress={handleSave}
                loading={saving}
                style={{ flex: 1 }}
              />
            </View>

            <Text style={styles.listTitle}>Promotions existantes</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowMeta}>
                {item.is_active ? '🟢 Active' : '⚪ Inactive'} · {item.claimed_count}
                {item.max_beneficiaries !== null ? `/${item.max_beneficiaries}` : ''} bénéficiaire(s) · jusqu'au{' '}
                {item.end_date}
              </Text>
            </View>
            <Pressable onPress={() => startEdit(item)}>
              <Text style={styles.editLink}>Modifier</Text>
            </Pressable>
            <Pressable onPress={() => setPendingDelete(item)}>
              <Text style={styles.deleteLink}>Supprimer</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={!isLoading ? <Text style={styles.emptyText}>Aucune promotion pour le moment.</Text> : null}
      />
      <ConfirmDialog
        visible={!!pendingDelete}
        title="Supprimer cette promotion ?"
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

function Field({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.creamFaint} style={styles.input} {...props} />
    </View>
  );
}

function AdItemsEditor({
  title,
  items,
  uploading,
  onAdd,
  onLinkChange,
  onRemove,
}: {
  title: string;
  items: AdItem[];
  uploading: boolean;
  onAdd: () => void;
  onLinkChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{title}</Text>
      {items.map((item, index) => (
        <View key={`${item.image_url}-${index}`} style={styles.adItemCard}>
          <View style={styles.adItemHeader}>
            <Image source={{ uri: item.image_url }} style={styles.adItemThumb} contentFit="cover" />
            <Text style={styles.adItemNumber}>Photo {index + 1}</Text>
            <Pressable onPress={() => onRemove(index)} hitSlop={8} style={{ marginLeft: 'auto' }}>
              <Text style={[styles.voiceoverAction, { color: colors.red }]}>✕ Retirer</Text>
            </Pressable>
          </View>
          <Text style={styles.adItemLinkLabel}>🔗 URL du lien (optionnel — où aller quand on clique sur cette photo)</Text>
          <TextInput
            value={item.link ?? ''}
            onChangeText={(v) => onLinkChange(index, v)}
            placeholder="https://www.albasseshopping.com/produit/..."
            placeholderTextColor={colors.creamFaint}
            autoCapitalize="none"
            style={styles.input}
          />
        </View>
      ))}
      <Pressable style={styles.imagePicker} onPress={onAdd} disabled={uploading}>
        {uploading ? <ActivityIndicator color={colors.gold} /> : <Text style={styles.imagePickerText}>＋ Ajouter</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  form: { marginBottom: spacing.lg },
  formTitle: { color: colors.cream, fontFamily: fonts.display, fontSize: 17, marginBottom: spacing.md },
  voiceoverBox: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  voiceoverRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: spacing.sm, flexWrap: 'wrap' },
  voiceoverStatus: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 13, marginBottom: spacing.sm },
  voiceoverAction: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 13 },
  adItemCard: {
    backgroundColor: colors.panelAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  adItemHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.sm },
  adItemThumb: { width: 44, height: 44, borderRadius: radius.sm },
  adItemNumber: { color: colors.creamMuted, fontFamily: fonts.bodySemiBold, fontSize: 12 },
  adItemLinkLabel: { color: colors.goldLight, fontFamily: fonts.bodyMedium, fontSize: 11.5, marginBottom: 6 },
  label: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12, marginBottom: 6 },
  helperText: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginBottom: 6 },
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
  row2: { flexDirection: 'row', gap: 10 },
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
  suggestionsBox: { backgroundColor: colors.panel, borderRadius: radius.md, marginTop: -6, overflow: 'hidden' },
  suggestionRow: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  suggestionText: { color: colors.cream, fontFamily: fonts.body, fontSize: 13 },
  selectedNote: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 11, marginTop: 6 },
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
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  imagePreview: { width: '100%', height: '100%' },
  imagePickerText: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 12 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  formActions: { flexDirection: 'row', gap: 10, marginBottom: spacing.lg },
  listTitle: { color: colors.creamMuted, fontFamily: fonts.bodySemiBold, fontSize: 13, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowName: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  rowMeta: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  editLink: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 12, marginRight: 4 },
  deleteLink: { color: colors.red, fontFamily: fonts.bodyMedium, fontSize: 12 },
  emptyText: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', marginTop: 20 },
});
