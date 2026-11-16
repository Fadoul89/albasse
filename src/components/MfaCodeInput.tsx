import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { cleanCode } from '../lib/adminMfa';
import { colors, fonts } from '../theme';

// 6 cases pour le code de Google Authenticator. Une seule vraie zone de saisie (invisible) par-dessus les cases :
// le clavier chiffres s'ouvre, le code collé ou rempli automatiquement par le téléphone marche aussi.
export function MfaCodeInput({ value, onChange, onComplete, testID }: { value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; testID?: string }) {
  const input = useRef<TextInput>(null);
  const digits = value.split('');
  return (
    <Pressable onPress={() => input.current?.focus()} style={styles.wrap} accessibilityLabel="Code à 6 chiffres">
      <View style={styles.row} pointerEvents="none">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={[styles.box, i === Math.min(digits.length, 5) && styles.boxActive]}>
            <Text style={styles.digit}>{digits[i] ?? ''}</Text>
          </View>
        ))}
      </View>
      <TextInput
        ref={input}
        testID={testID}
        value={value}
        onChangeText={(t) => {
          const c = cleanCode(t);
          onChange(c);
          if (c.length === 6) onComplete?.(c);
        }}
        keyboardType="number-pad"
        inputMode="numeric"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={12}
        autoFocus
        style={styles.hidden}
        accessibilityLabel="Code à 6 chiffres de Google Authenticator"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', marginVertical: 14 },
  row: { flexDirection: 'row', gap: 8 },
  box: { width: 42, height: 52, borderRadius: 10, backgroundColor: '#f4f1ea', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  boxActive: { borderColor: colors.gold },
  digit: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 24 },
  hidden: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.01, color: 'transparent', fontSize: 16 },
});
