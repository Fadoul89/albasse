import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  destructive,
  loading,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.row}>
            <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={loading}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, destructive && styles.destructiveBtn]}
              onPress={onConfirm}
              disabled={loading}
            >
              <Text style={[styles.confirmText, destructive && styles.destructiveText]}>
                {loading ? '…' : confirmLabel}
              </Text>
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
    maxWidth: 380,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.cream, fontFamily: fonts.display, fontSize: 18, marginBottom: 8 },
  message: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, marginBottom: spacing.lg },
  row: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
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
    backgroundColor: colors.gold,
  },
  destructiveBtn: { backgroundColor: colors.red },
  confirmText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 13 },
  destructiveText: { color: colors.cream },
});
