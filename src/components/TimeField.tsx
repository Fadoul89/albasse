import React, { useState } from 'react';
import { Platform, View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../theme';

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function TimeField({ label, value, onChange }: Props) {
  const [showPicker, setShowPicker] = useState(false);

  if (Platform.OS === 'web') {
    return (
      <View style={{ marginBottom: 8 }}>
        <Text style={styles.label}>{label}</Text>
        {React.createElement('input', {
          type: 'time',
          value: value || '',
          onChange: (e: { target: { value: string } }) => onChange(e.target.value),
          style: webInputStyle,
        })}
      </View>
    );
  }

  const DateTimePicker = require('@react-native-community/datetimepicker').default;
  const [h, m] = (value || '23:59').split(':').map(Number);
  const timeValue = new Date();
  timeValue.setHours(h || 0, m || 0, 0, 0);

  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.input} onPress={() => setShowPicker(true)}>
        <Text style={{ color: value ? colors.cream : colors.creamFaint, fontFamily: fonts.body, fontSize: 14 }}>
          {value || 'Sélectionner une heure'}
        </Text>
      </Pressable>
      {showPicker && (
        <DateTimePicker
          value={timeValue}
          mode="time"
          onChange={(_event: unknown, selectedDate?: Date) => {
            setShowPicker(false);
            if (selectedDate) {
              const hh = String(selectedDate.getHours()).padStart(2, '0');
              const mm = String(selectedDate.getMinutes()).padStart(2, '0');
              onChange(`${hh}:${mm}`);
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
