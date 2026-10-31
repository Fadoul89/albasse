// Le choix « Homme » / « Femme » : deux gros boutons, un seul peut être choisi. Sert à l'inscription, au profil du client et à la carte de Zara.
// Sur les champs blancs de l'inscription (light) les boutons sont blancs comme les champs ; ailleurs ils suivent les cartes sombres du site.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { GENDERS, GENDER_ICON, GENDER_LABEL, type Gender } from '../lib/clientGender';

interface Props {
  value: '' | Gender;
  onChange: (gender: Gender) => void;
  testIDPrefix: string; // « register-gender » → register-gender-homme, register-gender-femme (et register-gender-group pour l'ensemble)
  light?: boolean;
  disabled?: boolean;
}

export function GenderPicker({ value, onChange, testIDPrefix, light, disabled }: Props) {
  return (
    <View style={styles.row} testID={`${testIDPrefix}-group`} role="radiogroup">
      {GENDERS.map((g) => {
        const selected = value === g;
        return (
          <Pressable
            key={g}
            testID={`${testIDPrefix}-${g}`}
            role="radio"
            aria-checked={selected}
            aria-disabled={!!disabled}
            disabled={disabled}
            onPress={() => onChange(g)}
            style={[styles.btn, light ? styles.btnLight : styles.btnDark, selected && styles.btnSelected, disabled && { opacity: 0.6 }]}
          >
            <Text style={[styles.icon]}>{GENDER_ICON[g]}</Text>
            <Text style={[styles.label, light && !selected ? styles.labelOnLight : null, selected && styles.labelSelected]}>{GENDER_LABEL[g]}</Text>
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
