import React, { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useAuthStore } from '../../store/authStore';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { MFA_TEXT, groupSecret, mfaErrorText, qrDataUrl, unfinishedTotp, verifiedTotp } from '../../lib/adminMfa';
import { ScreenHeader } from '../../components/ScreenHeader';
import { GoldButton } from '../../components/GoldButton';
import { MfaCodeInput } from '../../components/MfaCodeInput';
import { colors, fonts, radius, spacing } from '../../theme';

// Mise en route de la double vérification (une seule fois) : QR code à scanner avec Google Authenticator, puis le code affiché.
// Ensuite, le code est demandé à chaque connexion admin (components/AdminMfaGate) et la base l'exige (add-admin-mfa.sql).
type Step = 'loading' | 'active' | 'idle' | 'setup' | 'done';

export function AdminSecurityScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [step, setStep] = useState<Step>('loading');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!profile?.is_admin || !isSupabaseConfigured) return;
    (async () => {
      const { data, error: e } = await supabase.auth.mfa.listFactors();
      if (e) {
        setError(mfaErrorText(e.message));
        setStep('idle');
        return;
      }
      setStep(verifiedTotp(data?.all as never) ? 'active' : 'idle');
    })();
  }, [profile?.is_admin]);

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title={MFA_TEXT.pageTitle} showBack />
        <Text style={[styles.p, { padding: spacing.md }]}>{MFA_TEXT.notAdmin}</Text>
      </View>
    );
  }

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      // une mise en route commencée mais pas terminée : on la retire avant d'en refaire une
      const { data: list } = await supabase.auth.mfa.listFactors();
      for (const f of unfinishedTotp(list?.all as never)) await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error: e } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Albasse admin ${Date.now()}` });
      if (e || !data) throw e ?? new Error('enroll');
      setFactorId(data.id);
      setQr(qrDataUrl(data.totp.qr_code));
      setSecret(data.totp.secret);
      setStep('setup');
    } catch (e) {
      setError(mfaErrorText(e instanceof Error ? e.message : String(e)));
    }
    setBusy(false);
  };

  const activate = async (value = code) => {
    if (!factorId || busy || value.length !== 6) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: value });
    setBusy(false);
    if (e) {
      setError(mfaErrorText(e.message));
      setCode('');
      return;
    }
    setStep('done');
  };

  const copy = async () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(secret).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <View style={styles.screen} testID="admin-security">
      <ScreenHeader title={MFA_TEXT.pageTitle} showBack />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 'loading' ? <Text style={styles.p}>…</Text> : null}

        {step === 'active' || step === 'done' ? (
          <View style={styles.card} testID="admin-security-active">
            <Text style={styles.okTitle}>{step === 'done' ? MFA_TEXT.activated : MFA_TEXT.active}</Text>
            <Text style={styles.p}>{MFA_TEXT.activeHelp}</Text>
          </View>
        ) : null}

        {step === 'idle' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Protégez votre compte admin</Text>
            <Text style={styles.p}>{MFA_TEXT.intro}</Text>
            <Step n={1} text={MFA_TEXT.step1} />
            <GoldButton label={MFA_TEXT.start} onPress={start} loading={busy} testID="admin-security-start" style={{ marginTop: spacing.sm }} />
          </View>
        ) : null}

        {step === 'setup' ? (
          <View style={styles.card} testID="admin-security-setup">
            <Text style={styles.cardTitle}>Protégez votre compte admin</Text>
            <Text style={styles.p}>{MFA_TEXT.intro}</Text>
            <Step n={1} text={MFA_TEXT.step1} />
            <Step n={2} text={MFA_TEXT.step2} />
            {qr ? (
              <View style={styles.qrWrap}>
                <Image source={{ uri: qr }} style={styles.qr} contentFit="contain" accessibilityLabel="QR code à scanner avec Google Authenticator" testID="admin-security-qr" />
              </View>
            ) : null}
            <Text style={styles.keyLabel}>{MFA_TEXT.keyLabel}</Text>
            <Pressable onPress={copy} accessibilityRole="button" testID="admin-security-secret">
              <Text style={styles.key} selectable>{groupSecret(secret)}</Text>
              <Text style={styles.copy}>{copied ? '✓ Clé copiée' : 'Copier la clé'}</Text>
            </Pressable>
            <Step n={3} text={MFA_TEXT.step3} />
            <MfaCodeInput value={code} onChange={(v) => { setCode(v); setError(null); }} onComplete={(v) => activate(v)} testID="admin-security-code" />
            <GoldButton label={MFA_TEXT.activate} onPress={() => activate()} loading={busy} disabled={code.length !== 6} testID="admin-security-activate" />
          </View>
        ) : null}

        {error ? <Text style={styles.error} testID="admin-security-error">{error}</Text> : null}
      </ScrollView>
    </View>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.num}><Text style={styles.numText}>{n}</Text></View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 60, maxWidth: 560, width: '100%', alignSelf: 'center' },
  card: { backgroundColor: colors.panel, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  cardTitle: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: 15, marginBottom: 8 },
  okTitle: { color: colors.successText, fontFamily: fonts.bodySemiBold, fontSize: 14.5, marginBottom: 8 },
  p: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, marginBottom: 6 },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginVertical: 8 },
  num: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  numText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 13 },
  stepText: { flex: 1, color: colors.cream, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19 },
  qrWrap: { alignItems: 'center', marginVertical: 8 },
  qr: { width: 190, height: 190, backgroundColor: '#ffffff', borderRadius: 10 },
  keyLabel: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', marginTop: 4 },
  key: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 14, letterSpacing: 1, textAlign: 'center', marginTop: 4 },
  copy: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 12, textAlign: 'center', textDecorationLine: 'underline', marginTop: 4 },
  error: { color: colors.errorText, fontFamily: fonts.bodySemiBold, fontSize: 13, textAlign: 'center', marginTop: spacing.sm },
});
