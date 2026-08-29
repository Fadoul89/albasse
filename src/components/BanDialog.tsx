import React, { useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';

const REASONS = [
  'Mauvais comportement',
  'Spam',
  'Fraude / tentative de fraude',
  'Abus du service',
  'Violation des conditions d\'utilisation',
  'Autre',
];

interface Props {
  visible: boolean;
  loading?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export function BanDialog({ visible, loading, onConfirm, onCancel }: Props) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState('');

  const isCustom = selectedReason === 'Autre';
  const finalReason = isCustom ? customReason.trim() : selectedReason ?? '';
  const canConfirm = finalReason.length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Voulez-vous vraiment bannir ce client ?</Text>
          <Text style={styles.subtitle}>Sélectionnez un motif :</Text>

          <View style={styles.reasonsRow}>
            {REASONS.map((r) => (
              <Pressable
                key={r}
                style={[styles.reasonChip, selectedReason === r && styles.reasonChipActive]}
                onPress={() => setSelectedReason(r)}
              >
                <Text style={[styles.reasonText, selectedReason === r && styles.reasonTextActive]}>{r}</Text>
              </Pressable>
            ))}
          </View>

          {isCustom && (
            <TextInput
              value={customReason}
              onChangeText={setCustomReason}
              placeholder="Précisez le motif…"
              placeholderTextColor={colors.creamFaint}
              style={styles.input}
              multiline
            />
          )}

          <View style={styles.actionsRow}>
            <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={loading}>
              <Text style={styles.cancelText}>Annuler</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
              onPress={() => canConfirm && onConfirm(finalReason)}
              disabled={!canConfirm || loading}
            >
              <Text style={styles.confirmText}>{loading ? '…' : 'Bannir le client'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.panelAlt,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.cream, fontFamily: fonts.display, fontSize: 17, marginBottom: 6 },
  subtitle: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12, marginBottom: spacing.sm },
  reasonsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  reasonChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.panel,
  },
  reasonChipActive: { borderColor: colors.red, backgroundColor: colors.panel },
  reasonText: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  reasonTextActive: { color: colors.red },
  input: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.cream,
    fontFamily: fonts.body,
    fontSize: 13,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  actionsRow: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: spacing.sm },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 13 },
  confirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.red,
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmText: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 13 },
});
