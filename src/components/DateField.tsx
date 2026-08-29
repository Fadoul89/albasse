import React, { useState } from 'react';
import { Platform, View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../theme';

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minimumDateStr?: string;
}

export function DateField({ label, value, onChange, minimumDateStr }: Props) {
  const [showPicker, setShowPicker] = useState(false);

  if (Platform.OS === 'web') {
    return (
      <View style={{ marginBottom: 8 }}>
        <Text style={styles.label}>{label}</Text>
        {React.createElement('input', {
          type: 'date',
          value: value || '',
          min: minimumDateStr,
          onChange: (e: { target: { value: string } }) => onChange(e.target.value),
          style: webInputStyle,
        })}
      </View>
    );
  }

  const DateTimePicker = require('@react-native-community/datetimepicker').default;
  const dateValue = value ? new Date(value) : new Date();
  const minimumDate = minimumDateStr ? new Date(minimumDateStr) : undefined;

  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.input} onPress={() => setShowPicker(true)}>
        <Text style={{ color: value ? colors.cream : colors.creamFaint, fontFamily: fonts.body, fontSize: 14 }}>
          {value || 'Sélectionner une date'}
        </Text>
      </Pressable>
      {showPicker && (
        <DateTimePicker
          value={dateValue}
          mode="date"
          minimumDate={minimumDate}
          onChange={(_event: unknown, selectedDate?: Date) => {
            setShowPicker(false);
            if (selectedDate) {
              onChange(selectedDate.toISOString().slice(0, 10));
            }
          }}
        />
      )}
    </View>
  );
}

const webInputStyle = {
  backgroundColor: colors.panel,
  borderRadius: radius.md,
  padding: 12,
  color: colors.cream,
  border: `1px solid ${colors.border}`,
  fontFamily: fonts.body,
  fontSize: 14,
  width: '100%' as const,
  colorScheme: 'dark' as const,
};

const styles = StyleSheet.create({
  label: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
