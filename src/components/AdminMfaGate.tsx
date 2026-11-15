import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useMfaStore } from '../store/mfaStore';
import { MFA_TEXT } from '../lib/adminMfa';
import { MfaCodeInput } from './MfaCodeInput';
import { GoldButton } from './GoldButton';
import { colors, fonts, radius, spacing } from '../theme';

// Écran « Code de vérification » : par-dessus tout le site, pour un administrateur qui a activé la double vérification
// et ne l'a pas encore tapée depuis sa connexion. Les clients ne le voient jamais.
export function AdminMfaGate() {
  const verify = useMfaStore((s) => s.verify);
  const done = useMfaStore((s) => s.done);
  const signOut = useAuthStore((s) => s.signOut);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [help, setHelp] = useState(false);

  const submit = async (value = code) => {
    if (busy || ok) return;
    setBusy(true);
    setError(null);
    const res = await verify(value);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? null);
      setCode('');
      return;
    }
    setOk(true);
    // « Code correct » un instant, puis on entre. Sur le site, la page est rechargée : les pages admin déjà ouvertes relisent
    // leurs données avec la nouvelle session (code tapé).
    setTimeout(() => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.reload();
      else done();
    }, 900);
  };

  return (
    <View style={styles.cover} testID="admin-mfa-gate">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.lock} accessibilityElementsHidden importantForAccessibility="no">🔐</Text>
        <Text style={styles.title} accessibilityRole="header">{MFA_TEXT.gateTitle}</Text>
        <Text style={styles.body}>{MFA_TEXT.gateBody}</Text>
        <View style={styles.card}>
          <MfaCodeInput value={code} onChange={(v) => { setCode(v); setError(null); }} onComplete={(v) => submit(v)} testID="admin-mfa-code" />
          {error ? <Text style={styles.error} testID="admin-mfa-error">{error}</Text> : null}
          {ok ? <Text style={styles.ok} testID="admin-mfa-ok">✓ {MFA_TEXT.success}</Text> : null}
          <GoldButton label={MFA_TEXT.validate} onPress={() => submit()} loading={busy} disabled={code.length !== 6 || ok} testID="admin-mfa-submit" style={{ marginTop: spacing.sm }} />
          <Pressable onPress={() => setHelp((v) => !v)} hitSlop={8} accessibilityRole="button" testID="admin-mfa-lost">
            <Text style={styles.link}>{MFA_TEXT.lostPhone}</Text>
          </Pressable>
          {help ? <Text style={styles.help} testID="admin-mfa-help">{MFA_TEXT.lostPhoneHelp}</Text> : null}
        </View>
        <Pressable onPress={() => signOut()} hitSlop={8} accessibilityRole="button" testID="admin-mfa-signout">
          <Text style={styles.signOut}>{MFA_TEXT.signOut}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.background, zIndex: 2000 },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, maxWidth: 460, width: '100%', alignSelf: 'center' },
  lock: { fontSize: 46, textAlign: 'center', marginBottom: 4 },
  title: { color: colors.cream, fontFamily: fonts.display, fontSize: 22, textAlign: 'center', marginBottom: 6 },
  body: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  card: { backgroundColor: colors.panel, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg },
  error: { color: colors.errorText, fontFamily: fonts.bodySemiBold, fontSize: 13, textAlign: 'center', marginTop: 4 },
  ok: { color: colors.successText, fontFamily: fonts.bodySemiBold, fontSize: 13.5, textAlign: 'center', marginTop: 4 },
  link: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 12.5, textDecorationLine: 'underline', textAlign: 'center', marginTop: 14 },
  help: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, textAlign: 'center', marginTop: 8 },
  signOut: { color: colors.creamMuted, fontFamily: fonts.bodySemiBold, fontSize: 13, textAlign: 'center', marginTop: spacing.lg, textDecorationLine: 'underline' },
});
