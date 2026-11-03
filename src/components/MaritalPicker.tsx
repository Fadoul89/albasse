// Le choix « Célibataire » / « Marié(e) » : deux gros boutons, un seul peut être choisi. Sert à l'inscription et au profil du client.
// Même allure que GenderPicker (blanc sur les champs blancs de l'inscription, sombre ailleurs).
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { MARITALS, MARITAL_ICON, MARITAL_LABEL, type MaritalStatus } from '../lib/clientBirthMarital';

interface Props {
  value: '' | MaritalStatus;
  onChange: (marital: MaritalStatus) => void;
  testIDPrefix: string; // « register-marital » → register-marital-celibataire, register-marital-marie (et register-marital-group pour l'ensemble)
  light?: boolean;
  disabled?: boolean;
}

export function MaritalPicker({ value, onChange, testIDPrefix, light, disabled }: Props) {
  return (
    <View style={styles.row} testID={`${testIDPrefix}-group`} role="radiogroup">
      {MARITALS.map((m) => {
        const selected = value === m;
        return (
          <Pressable
            key={m}
            testID={`${testIDPrefix}-${m}`}
            role="radio"
            aria-checked={selected}
            aria-disabled={!!disabled}
            disabled={disabled}
            onPress={() => onChange(m)}
            style={[styles.btn, light ? styles.btnLight : styles.btnDark, selected && styles.btnSelected, disabled && { opacity: 0.6 }]}
          >
            <Text style={styles.icon}>{MARITAL_ICON[m]}</Text>
            <Text style={[styles.label, light && !selected ? styles.labelOnLight : null, selected && styles.labelSelected]}>{MARITAL_LABEL[m]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: 8 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  btnLight: { backgroundColor: '#ffffff', borderColor: '#f97316' },
  btnDark: { backgroundColor: colors.panel, borderColor: colors.border },
  btnSelected: { backgroundColor: colors.gold, borderColor: colors.gold },
  icon: { fontSize: 18 },
  label: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  labelOnLight: { color: colors.background },
  labelSelected: { color: colors.background },
});
