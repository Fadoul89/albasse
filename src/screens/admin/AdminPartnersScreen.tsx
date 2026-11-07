// Mes partenaires locaux (administrateur seulement, docs/partenaires.md) : la liste, ajouter / modifier / supprimer, appeler ou écrire sur WhatsApp,
// et voir les articles de chaque partenaire. Confidentiel : jamais montré aux clients.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, Pressable, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { useProducts } from '../../hooks/useProducts';
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { GoldButton } from '../../components/GoldButton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { addPartner, deletePartner, fetchPartnerData, updatePartner, type PartnerData } from '../../lib/partnersData';
import { PARTNER_NOTE_MAX, articlesCountLabel, partnerCallLink, partnerPhoneLabel, partnerWhatsappLink, type Partner } from '../../lib/partners';

export function AdminPartnersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const showToast = useToastStore((s) => s.show);
  const { products } = useProducts({ raw: true });

  // undefined : lecture en cours ; null : pas disponible (script SQL pas lancé ou lecture impossible)
  const [data, setData] = useState<PartnerData | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Partner | null>(null);
  const [deleting, setDeleting] = useState(false);

  const reload = useCallback(async () => {
    setData(await fetchPartnerData());
  }, []);
  useEffect(() => {
    if (profile?.is_admin) void reload();
  }, [profile?.is_admin, reload]);

  const articlesOf = useMemo(() => {
    const names = new Map(products.map((p) => [p.id, p]));
    const out = new Map<string, { id: string; name: string; note: string | null }[]>();
    for (const l of data?.links ?? []) {
      const p = names.get(l.product_id);
      if (!p) continue;
      const list = out.get(l.partner_id) ?? [];
      list.push({ id: p.id, name: p.name, note: l.note });
      out.set(l.partner_id, list);
    }
    return out;
  }, [data, products]);

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  const handleAdd = async () => {
    setSaving(true);
    const res = await addPartner({ name, phone, note });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message, { title: 'Partenaire non enregistré', type: 'error' });
      return;
    }
    showToast(`« ${name.trim()} » est ajouté à vos partenaires.`, { title: 'Enregistré ✓', type: 'success' });
    setName('');
    setPhone('');
    setNote('');
    void reload();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const res = await deletePartner(pendingDelete.id);
    setDeleting(false);
    if (!res.ok) {
      showToast(res.message, { title: 'Suppression impossible', type: 'error' });
      return;
    }
    showToast(`« ${pendingDelete.name} » est supprimé. Ses articles ne sont pas touchés.`, { title: 'Partenaire supprimé', type: 'success' });
    setPendingDelete(null);
    void reload();
  };

  const countOf = (id: string) => articlesOf.get(id)?.length ?? 0;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Mes partenaires" showBack />
      {data === null ? (
        <Text style={styles.denied} testID="partners-unavailable">
          Les partenaires ne sont pas encore disponibles : lancez le script add-partners.sql dans Supabase › SQL Editor, puis rouvrez cette page.
        </Text>
      ) : (
        <FlatList
          data={data?.partners ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.md }}
          ListHeaderComponent={
            <View style={styles.form}>
              <Text style={styles.privacy} testID="partners-privacy">
                🔒 Cette liste est à vous seul. Les clients ne voient jamais à qui appartient un article.
              </Text>
              <Text style={styles.formTitle}>Ajouter un partenaire</Text>
              <TextInput value={name} onChangeText={setName} placeholder="Nom du partenaire" placeholderTextColor={colors.creamFaint} style={styles.input} testID="partners-form-name" maxLength={80} />
              <TextInput value={phone} onChangeText={setPhone} placeholder="Téléphone / WhatsApp (facultatif)" placeholderTextColor={colors.creamFaint} keyboardType="phone-pad" style={styles.input} testID="partners-form-phone" />
              <TextInput value={note} onChangeText={setNote} placeholder="Petit mot (facultatif) : quartier, ce qu'il vend…" placeholderTextColor={colors.creamFaint} style={styles.input} testID="partners-form-note" maxLength={PARTNER_NOTE_MAX} />
              <GoldButton label="Ajouter" onPress={handleAdd} loading={saving} testID="partners-form-add" />
              <Text style={styles.listTitle}>{data === undefined ? 'Chargement…' : `Mes partenaires (${data.partners.length})`}</Text>
              {data !== undefined && data.partners.length === 0 && <Text style={styles.empty}>Aucun partenaire pour l’instant. Ajoutez le premier ci-dessus, puis associez-lui ses articles dans « Modifier le produit ».</Text>}
            </View>
          }
          renderItem={({ item }) => (
            <PartnerRow
              partner={item}
              articles={articlesOf.get(item.id) ?? []}
              onSaved={reload}
              onDelete={() => setPendingDelete(item)}
              onOpenArticle={(productId) => navigation.navigate('AdminProductForm', { productId })}
            />
          )}
        />
      )}
      <ConfirmDialog
        visible={!!pendingDelete}
        title="Supprimer ce partenaire ?"
        message={`« ${pendingDelete?.name ?? ''} » sera retiré de la liste. Ses ${pendingDelete ? articlesCountLabel(countOf(pendingDelete.id)) : 'articles'} ne sont PAS supprimés : ils n'auront simplement plus de partenaire.`}
        confirmLabel="Supprimer"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </View>
  );
}

function PartnerRow({
  partner,
  articles,
  onSaved,
  onDelete,
  onOpenArticle,
}: {
  partner: Partner;
  articles: { id: string; name: string; note: string | null }[];
  onSaved: () => void;
  onDelete: () => void;
  onOpenArticle: (productId: string) => void;
}) {
  const showToast = useToastStore((s) => s.show);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(partner.name);
  const [phone, setPhone] = useState(partner.phone ?? '');
  const [note, setNote] = useState(partner.note ?? '');
  const [saving, setSaving] = useState(false);
  const wa = partnerWhatsappLink(partner);
  const call = partnerCallLink(partner);

  const save = async () => {
    setSaving(true);
    const res = await updatePartner(partner.id, { name, phone, note });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message, { title: 'Modification impossible', type: 'error' });
      return;
    }
    setEditing(false);
    showToast('Partenaire modifié.', { title: 'Enregistré ✓', type: 'success' });
    onSaved();
  };

  return (
    <View style={styles.row} testID="partner-row">
      <View style={styles.rowTop}>
        <Text style={styles.rowName} numberOfLines={1} testID="partner-name">
          {partner.name}
        </Text>
        <Text style={styles.count} testID="partner-articles-count">
          {articlesCountLabel(articles.length)}
        </Text>
      </View>
      {editing ? (
        <View style={styles.editBox}>
          <TextInput value={name} onChangeText={setName} placeholder="Nom" placeholderTextColor={colors.creamFaint} style={styles.editInput} testID="partner-edit-name" maxLength={80} />
          <TextInput value={phone} onChangeText={setPhone} placeholder="Téléphone / WhatsApp" placeholderTextColor={colors.creamFaint} keyboardType="phone-pad" style={styles.editInput} testID="partner-edit-phone" />
          <TextInput value={note} onChangeText={setNote} placeholder="Petit mot" placeholderTextColor={colors.creamFaint} style={styles.editInput} testID="partner-edit-note" maxLength={PARTNER_NOTE_MAX} />
          <View style={styles.editActions}>
            <Pressable onPress={() => setEditing(false)} accessibilityRole="button">
              <Text style={styles.cancelLink}>Annuler</Text>
            </Pressable>
            <Pressable onPress={save} disabled={saving} accessibilityRole="button" testID="partner-edit-save">
              <Text style={styles.saveLink}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          {partnerPhoneLabel(partner.phone) && (
            <Text style={styles.meta} testID="partner-phone">
              📞 {partnerPhoneLabel(partner.phone)}
            </Text>
          )}
          {!!partner.note && <Text style={styles.meta}>📝 {partner.note}</Text>}
          <View style={styles.actions}>
            {call && (
              <Pressable style={styles.actionBtn} onPress={() => Linking.openURL(call)} accessibilityRole="button" testID="partner-call">
                <Text style={styles.actionText}>📞 Appeler</Text>
              </Pressable>
            )}
            {wa && (
              <Pressable style={[styles.actionBtn, styles.waBtn]} onPress={() => Linking.openURL(wa)} accessibilityRole="button" testID="partner-whatsapp">
                <Text style={styles.actionText}>💬 WhatsApp</Text>
              </Pressable>
            )}
            <Pressable style={styles.actionBtn} onPress={() => setOpen((v) => !v)} accessibilityRole="button" testID="partner-articles-toggle">
              <Text style={styles.actionText}>{open ? '▲ Masquer les articles' : '▼ Ses articles'}</Text>
            </Pressable>
            <Pressable onPress={() => setEditing(true)} accessibilityRole="button" testID="partner-edit">
              <Text style={styles.editLink}>✏️ Modifier</Text>
            </Pressable>
            <Pressable onPress={onDelete} accessibilityRole="button" testID="partner-delete">
              <Text style={styles.deleteLink}>🗑️ Supprimer</Text>
            </Pressable>
          </View>
          {open && (
            <View style={styles.articles}>
              {articles.length === 0 ? (
                <Text style={styles.meta}>Aucun article associé. Choisissez ce partenaire dans « Modifier le produit ».</Text>
              ) : (
                articles.map((a) => (
                  <Pressable key={a.id} onPress={() => onOpenArticle(a.id)} accessibilityRole="button" testID="partner-article-item">
                    <Text style={styles.articleLine} numberOfLines={2}>
                      • {a.name}
                      {a.note ? ` — ${a.note}` : ''}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40, paddingHorizontal: spacing.lg, lineHeight: 20 },
  form: { marginBottom: spacing.lg },
  privacy: { color: colors.goldLight, fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 18, marginBottom: spacing.md },
  formTitle: { color: colors.cream, fontFamily: fonts.display, fontSize: 17, marginBottom: spacing.md },
  input: { backgroundColor: colors.panel, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: colors.cream, fontFamily: fonts.body, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  listTitle: { color: colors.creamMuted, fontFamily: fonts.bodySemiBold, fontSize: 13, marginTop: spacing.md, marginBottom: spacing.sm },
  empty: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  row: { backgroundColor: colors.panel, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowName: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 15, flex: 1 },
  count: { color: colors.goldLight, fontFamily: fonts.bodyMedium, fontSize: 12 },
  meta: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 5, lineHeight: 17 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: spacing.sm },
  actionBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 11, paddingVertical: 6 },
  waBtn: { backgroundColor: 'rgba(37,211,102,0.18)', borderColor: 'rgba(37,211,102,0.5)' },
  actionText: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 12 },
  editLink: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 12 },
  deleteLink: { color: '#ff8a80', fontFamily: fonts.bodyMedium, fontSize: 12 },
  articles: { marginTop: spacing.sm, backgroundColor: colors.panelAlt, borderRadius: radius.sm, padding: spacing.sm, gap: 6 },
  articleLine: { color: colors.cream, fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  editBox: { marginTop: 8, gap: 6 },
  editInput: { backgroundColor: colors.panelAlt, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8, color: colors.cream, fontFamily: fonts.body, fontSize: 12, borderWidth: 1, borderColor: colors.border },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 4 },
  cancelLink: { color: colors.creamFaint, fontFamily: fonts.bodyMedium, fontSize: 12 },
  saveLink: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 12 },
});
