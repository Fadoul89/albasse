// Choix du partenaire d'un article (formulaire d'article, administrateur seulement) + petit message privé sur l'article.
// « Aucun (article à moi) » = pas de partenaire. Rien de tout cela n'est visible des clients (docs/partenaires.md).
import React from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { PARTNER_NOTE_MAX, partnerPhoneLabel, type Partner } from '../lib/partners';

interface Props {
  partners: readonly Partner[];
  value: string | null;
  note: string;
  onChange: (partnerId: string | null) => void;
  onNoteChange: (note: string) => void;
  onManage: () => void;
  testIDPrefix?: string;
}

export function PartnerPicker({ partners, value, note, onChange, onNoteChange, onManage, testIDPrefix = 'product-partner' }: Props) {
  const selected = partners.find((p) => p.id === value) ?? null;
  return (
    <View style={styles.box} testID={`${testIDPrefix}-box`}>
      <Text style={styles.title}>🤝 Partenaire de l’article</Text>
      <Text style={styles.hint}>Visible par vous seul : jamais montré aux clients. Il apparaît sur vos commandes et dans l’alerte Telegram.</Text>
      <View style={styles.chips}>
        <Pressable style={[styles.chip, !value && styles.chipOn]} onPress={() => onChange(null)} accessibilityRole="button" testID={`${testIDPrefix}-none`}>
          <Text style={[styles.chipText, !value && styles.chipTextOn]}>Aucun (article à moi)</Text>
        </Pressable>
        {partners.map((p) => (
          <Pressable key={p.id} style={[styles.chip, value === p.id && styles.chipOn]} onPress={() => onChange(p.id)} accessibilityRole="button" testID={`${testIDPrefix}-${p.id}`}>
            <Text style={[styles.chipText, value === p.id && styles.chipTextOn]} numberOfLines={1}>
              {p.name}
            </Text>
          </Pressable>
        ))}
      </View>
      {partners.length === 0 && <Text style={styles.empty}>Aucun partenaire pour l’instant.</Text>}
      <Pressable onPress={onManage} accessibilityRole="button" testID={`${testIDPrefix}-manage`}>
        <Text style={styles.link}>{partners.length === 0 ? '➕ Ajouter mes partenaires' : '✏️ Gérer mes partenaires'}</Text>
      </Pressable>
      {selected && (
        <>
          {partnerPhoneLabel(selected.phone) && <Text style={styles.phone}>📞 {partnerPhoneLabel(selected.phone)}</Text>}
          <TextInput
            value={note}
            onChangeText={onNoteChange}
            placeholder="Petit message privé sur cet article (facultatif)"
            placeholderTextColor={colors.creamFaint}
            maxLength={PARTNER_NOTE_MAX}
            style={styles.input}
            testID={`${testIDPrefix}-note`}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.md },
  title: { color: colors.cream, fontFamily: fonts.display, fontSize: 15 },
  hint: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, marginTop: 4, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7, maxWidth: '100%' },
  chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  chipTextOn: { color: colors.background, fontFamily: fonts.bodyBold },
  empty: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, marginTop: spacing.sm },
  link: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 12, marginTop: spacing.sm },
  phone: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12, marginTop: spacing.sm },
  input: { backgroundColor: colors.panelAlt, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, color: colors.cream, fontFamily: fonts.body, fontSize: 13, paddingHorizontal: 12, paddingVertical: 10, marginTop: spacing.sm },
});
