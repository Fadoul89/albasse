// Cases des formulaires de compte (inscription, connexion, mot de passe oublié) : claires sur le fond bleu, pour bien les voir
// (demande du patron : « tout est bleu »). Texte bleu marine, fine bordure orange.
import { StyleSheet } from 'react-native';
import { colors } from './colors';
import { fonts } from './typography';

const FIELD_COLORS = { background: '#ffffff', placeholder: '#7b8496', border: '#f97316' };

export const accountFieldPlaceholder = FIELD_COLORS.placeholder;

export const accountField = StyleSheet.create({
  input: {
    backgroundColor: FIELD_COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.background,
    fontFamily: fonts.body,
    borderWidth: 1.5,
    borderColor: FIELD_COLORS.border,
    marginBottom: 8,
  },
}).input;
