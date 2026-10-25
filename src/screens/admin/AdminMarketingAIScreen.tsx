import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Platform, RefreshControl } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { supabase } from '../../lib/supabase';
import {
  EXCLUSION_LABELS,
  GATE_LABELS,
  MODE_LABELS,
  RUN_STATUS_LABELS,
  clampInt,
  gateOk,
  gateView,
  pct,
  since,
  type BrevoDetail,
  type MarketingMode,
  type MarketingReport,
  type MarketingRunRow,
  type MarketingSettingsRow,
  type PlanSummary,
  type ReportBucket,
} from '../../lib/marketingAI';

const formatXAF = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const RUN_COLS = 'id,created_at,run_date,mode,status,error,approved_at,planned:summary->>recipientCount,blocking:summary->>blocking';

// la fonction « brevo-email » : le serveur seul parle à Brevo (la clé n'est jamais ici)
async function callFn(action: string, extra: Record<string, unknown> = {}): Promise<any> {
  try {
    const { data, error } = await supabase.functions.invoke('brevo-email', { body: { action, ...extra } });
    if (data && typeof data === 'object') return data;
    return { ok: false, reason: error ? 'network' : 'empty' };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

export function AdminMarketingAIScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [settings, setSettings] = useState<MarketingSettingsRow | null>(null);
  const [missingSql, setMissingSql] = useState(false);
  const [runs, setRuns] = useState<MarketingRunRow[]>([]);
  const [plan, setPlan] = useState<{ run: MarketingRunRow; summary: PlanSummary } | null>(null);
  const [report, setReport] = useState<MarketingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [form, setForm] = useState({ run_hour: '9', daily_limit: '50', min_days_between: '7', max_per_30_days: '3', require_approval: true });
  const [preview, setPreview] = useState<string | null>(null);
  const latest = useRef(0);
  const now = Date.now();

  const load = useCallback(async () => {
    const mine = ++latest.current;
    setLoading(true);
    const s = await supabase.from('marketing_ai_settings').select('*').eq('id', 1).maybeSingle();
    if (mine !== latest.current) return;
    if (s.error || !s.data) {
      setMissingSql(true);
      setSettings(null);
      setLoading(false);
      return;
    }
    setMissingSql(false);
    const row = s.data as MarketingSettingsRow;
    setSettings(row);
    setForm({ run_hour: String(row.run_hour), daily_limit: String(row.daily_limit), min_days_between: String(row.min_days_between), max_per_30_days: String(row.max_per_30_days), require_approval: row.require_approval });
    const r = await supabase.from('marketing_runs').select(RUN_COLS).order('created_at', { ascending: false }).limit(14);
    if (mine !== latest.current) return;
    const list = (r.data ?? []) as unknown as MarketingRunRow[];
    setRuns(list);
    if (list[0]) {
      const d = await supabase.from('marketing_runs').select('summary').eq('id', list[0].id).maybeSingle();
      if (mine !== latest.current) return;
      setPlan(d.data?.summary ? { run: list[0], summary: d.data.summary as PlanSummary } : null);
    } else setPlan(null);
    setLoading(false);
  }, []);

  const loadReport = useCallback(async () => {
    const r = await callFn('marketing_report');
    if (r?.ok && r.report) setReport(r.report as MarketingReport);
  }, []);

  useEffect(() => {
    if (profile?.is_admin) {
      void load();
      void loadReport();
    }
  }, [profile?.is_admin, load, loadReport]);

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  const run = async (key: string, action: string, extra: Record<string, unknown>, describe: (r: any) => { ok: boolean; text: string }, after?: () => Promise<void>) => {
    setBusy(key);
    setMessage(null);
    const r = await callFn(action, extra);
    setMessage(describe(r));
    setBusy(null);
    await load();
    if (after) await after();
  };

  const doCheck = () =>
    run('check', 'check', {}, (r) => {
      const d = r as BrevoDetail & { ok: boolean };
      if (d.ok) return { ok: true, text: `Brevo reconnaît la clé ✓${d.limited_key ? ' (clé limitée : lecture du compte et des expéditeurs refusée, c’est normal et plus sûr)' : ''}.` };
      if (d.reason === 'no_key') return { ok: false, text: 'La clé Brevo (BREVO_API_KEY) est absente des Secrets de la fonction brevo-email.' };
      if (d.reason === 'unauthorized') return { ok: false, text: 'Brevo refuse la clé. Vérifiez-la dans Brevo (la clé existante ne doit pas être remplacée sans raison).' };
      if (d.reason === 'unreachable') return { ok: false, text: 'Brevo ne répond pas pour le moment. Réessayez dans quelques minutes.' };
      if (d.reason === 'sender_missing' || d.reason === 'sender_inactive') return { ok: false, text: 'L’adresse d’expédition n’est pas active chez Brevo.' };
      return { ok: false, text: `Contrôle Brevo impossible (${String(d.reason ?? 'erreur')}).` };
    });

  const doSimulate = () =>
    run('simulate', 'marketing_simulate', {}, (r) => {
      if (r.reason === 'sql_missing') return { ok: false, text: 'Lancez d’abord le script add-marketing-intelligence.sql dans Supabase.' };
      if (!r.ok) return { ok: false, text: 'La simulation a échoué. Réessayez.' };
      const blocking = Number(r.blocking) || 0;
      return { ok: blocking === 0, text: `Simulation faite : ${r.plan.recipientCount} client(s) retenu(s), ${blocking} blocage(s). Aucun e-mail n’a été envoyé ni mis en file.${r.demoted ? ' Le mode est retombé en simulation à cause d’un blocage.' : ''}` };
    });

  const doTest = () =>
    run('test', 'marketing_test_email', {}, (r) => {
      if (r.reason === 'no_key') return { ok: false, text: 'La clé Brevo (BREVO_API_KEY) est absente des Secrets de la fonction brevo-email.' };
      if (r.reason === 'brevo') return { ok: false, text: `Brevo a refusé l’envoi : ${String(r.detail ?? r.status ?? '')}` };
      if (r.reason === 'no_products') return { ok: false, text: 'Il faut au moins 2 articles valides (en stock, avec photo) pour l’exemple.' };
      if (!r.ok) return { ok: false, text: 'L’e-mail de test n’est pas parti. Réessayez.' };
      return r.confirmed ? { ok: true, text: `E-mail de test envoyé à ${r.to} : Brevo a confirmé (identifiant du message reçu).` } : { ok: false, text: `Brevo a accepté le message pour ${r.to} mais sans identifiant : ce n’est pas une confirmation, le contrôle n’est pas validé.` };
    });

  const setMode = (mode: MarketingMode, confirm?: string) =>
    run(`mode-${mode}`, 'marketing_set_mode', { mode, ...(confirm ? { confirm } : {}) }, (r) => {
      if (r.ok) return { ok: true, text: `Mode : ${MODE_LABELS[mode]}.` };
      if (r.reason === 'gate') return { ok: false, text: `Activation refusée : il manque ${(r.missing as string[]).map((m) => GATE_LABELS[m] ?? m).join(', ')}.` };
      if (r.reason === 'confirmation') return { ok: false, text: 'Activation refusée : tapez ACTIVER pour confirmer.' };
      return { ok: false, text: 'Le changement de mode a été refusé.' };
    }, async () => {
      setConfirmOpen(false);
      setConfirmText('');
    });

  const approve = (id: string) =>
    run('approve', 'marketing_approve', { run_id: id }, (r) => {
      if (r.ok) return { ok: true, text: `${r.queued} e-mail(s) mis en file : ils partent au goutte-à-goutte, après les e-mails de commande. Le tableau ci-dessous dira ce que Brevo confirme.` };
      if (r.reason === 'expired') return { ok: false, text: 'Cette campagne date d’hier : elle a expiré, rien n’est parti. Lancez une nouvelle simulation.' };
      if (r.reason === 'locked') return { ok: false, text: 'Le mode n’est plus « Actif » ou un contrôle n’est plus valable : rien n’est parti.' };
      return { ok: false, text: 'Approbation impossible (campagne déjà traitée ou introuvable).' };
    }, loadReport);

  const sync = () =>
    run('sync', 'marketing_sync', {}, (r) => (r.ok ? { ok: true, text: `Résultats lus chez Brevo : ${r.synced} e-mail(s) mis à jour${r.suppressed ? `, ${r.suppressed} adresse(s) mise(s) en suppression` : ''}${r.stopped ? ` (arrêt : ${r.stopped})` : ''}.` } : { ok: false, text: 'Brevo n’a pas répondu. Réessayez plus tard.' }), loadReport);

  const saveSettings = async () => {
    setBusy('save');
    const { error } = await supabase
      .from('marketing_ai_settings')
      .update({
        run_hour: clampInt(form.run_hour, 0, 23, 9),
        daily_limit: clampInt(form.daily_limit, 1, 200, 50),
        min_days_between: clampInt(form.min_days_between, 1, 60, 7),
        max_per_30_days: clampInt(form.max_per_30_days, 1, 15, 3),
        require_approval: form.require_approval,
      })
      .eq('id', 1);
    setBusy(null);
    setMessage(error ? { ok: false, text: settings?.mode === 'live' ? 'Réglages non enregistrés : tant que le mode est actif, les 3 contrôles doivent être à jour. Refaites-les, puis réessayez.' : 'Réglages non enregistrés.' } : { ok: true, text: 'Réglages enregistrés.' });
    await load();
  };

  const gate = settings ? gateView(settings, now) : [];
  const allGood = gateOk(gate);
  const pending = runs[0] && runs[0].mode === 'live' && runs[0].status === 'pending_approval' && runs[0].run_date === new Date(now + 3_600_000).toISOString().slice(0, 10) ? runs[0] : null;
  const detail = settings?.brevo_detail ?? null;

  return (
    <View style={styles.screen} testID="mkai-screen">
      <ScreenHeader title="Zara Marketing" showBack />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 80 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void load(); void loadReport(); }} tintColor={colors.gold} />}>
        <Text style={styles.note}>
          🤖 Chaque jour, Zara prépare des e-mails ciblés avec de vrais articles, de vrais prix et de vraies promotions, seulement pour les clients qui ont donné leur accord. Rien ne part tant que les 3 contrôles ci-dessous ne sont pas faits et que vous n’avez pas validé.
        </Text>

        {missingSql ? (
          <View style={styles.warnBox} testID="mkai-sql-missing">
            <Text style={styles.warnTitle}>Une étape manque</Text>
            <Text style={styles.text}>Lancez une fois le script « add-marketing-intelligence.sql » dans Supabase › SQL Editor. Tant que ce n’est pas fait, rien ne se passe et rien ne peut partir.</Text>
          </View>
        ) : null}

        {message ? (
          <View style={[styles.msg, message.ok ? styles.msgOk : styles.msgBad]} testID="mkai-message">
            <Text style={styles.msgText}>{message.ok ? '✅ ' : '⚠️ '}{message.text}</Text>
          </View>
        ) : null}

        {settings ? (
          <>
            {/* le mode */}
            <View style={styles.card} testID="mkai-mode-card">
              <Text style={styles.cardTitle}>Mode</Text>
              <Text style={[styles.modeBig, settings.mode === 'live' && { color: colors.goldLight }]} testID="mkai-mode">{MODE_LABELS[settings.mode]}</Text>
              <Text style={styles.text}>
                {settings.mode === 'off' ? 'Zara ne prépare rien.' : settings.mode === 'simulation' ? 'Chaque jour Zara prépare le plan et le rapport, sans rien mettre en file ni envoyer.' : settings.require_approval ? 'Chaque jour Zara prépare la campagne ; elle ne part qu’après votre approbation.' : 'Chaque jour la campagne est mise en file et part toute seule.'}
              </Text>
              <View style={styles.row}>
                <Pressable style={[styles.chip, settings.mode === 'off' && styles.chipActive]} onPress={() => setMode('off')} disabled={!!busy} testID="mkai-mode-off"><Text style={[styles.chipText, settings.mode === 'off' && styles.chipTextActive]}>Éteindre</Text></Pressable>
                <Pressable style={[styles.chip, settings.mode === 'simulation' && styles.chipActive]} onPress={() => setMode('simulation')} disabled={!!busy} testID="mkai-mode-simulation"><Text style={[styles.chipText, settings.mode === 'simulation' && styles.chipTextActive]}>Simulation</Text></Pressable>
                <Pressable style={[styles.chip, settings.mode === 'live' && styles.chipActive, !allGood && settings.mode !== 'live' && styles.chipLocked]} onPress={() => setConfirmOpen((v) => !v)} disabled={!!busy || !allGood || settings.mode === 'live'} testID="mkai-mode-live" accessibilityState={{ disabled: !allGood || settings.mode === 'live' }}>
                  <Text style={[styles.chipText, settings.mode === 'live' && styles.chipTextActive]}>{allGood ? 'Activer les envois' : '🔒 Activer les envois'}</Text>
                </Pressable>
              </View>
              {!allGood && settings.mode !== 'live' ? <Text style={styles.small}>Verrouillé : faites d’abord les 3 contrôles ci-dessous.</Text> : null}
              {confirmOpen && allGood && settings.mode !== 'live' ? (
                <View style={styles.confirm} testID="mkai-confirm">
                  <Text style={styles.text}>Les e-mails réels partiront vers les clients autorisés. Tapez ACTIVER pour confirmer.</Text>
                  <TextInput value={confirmText} onChangeText={setConfirmText} placeholder="ACTIVER" placeholderTextColor={colors.creamFaint} autoCapitalize="characters" style={styles.input} testID="mkai-confirm-input" />
                  <Pressable style={[styles.primary, confirmText !== 'ACTIVER' && { opacity: 0.4 }]} disabled={confirmText !== 'ACTIVER' || !!busy} onPress={() => setMode('live', confirmText)} testID="mkai-confirm-live"><Text style={styles.primaryText}>Valider l’activation</Text></Pressable>
                </View>
              ) : null}
            </View>

            {/* les 3 contrôles */}
            <View style={styles.card} testID="mkai-gate">
              <Text style={styles.cardTitle}>Les 3 contrôles avant l’activation</Text>
              {gate.map((g) => {
                const label = g.key === 'brevo' ? GATE_LABELS.controle_brevo : g.key === 'simulation' ? GATE_LABELS.simulation : GATE_LABELS.email_de_test_confirme;
                const status = g.ok ? `fait ${since(g.at, now)}` : g.stale ? `fait ${since(g.at, now)}, à refaire` : 'pas fait';
                return (
                  <View key={g.key} style={styles.gateRow} testID={`mkai-gate-${g.key}`}>
                    <Text style={styles.gateIcon}>{g.ok ? '✅' : '⬜'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.gateLabel}>{label}</Text>
                      <Text style={styles.small} testID={`mkai-gate-${g.key}-status`}>{status}</Text>
                      {g.key === 'brevo' && detail ? (
                        <Text style={styles.small}>
                          {detail.ok ? `Brevo reconnaît la clé.${detail.limited_key ? ' Clé limitée (compte, expéditeurs et domaine refusés) : normal.' : ''}${detail.events_api?.accessible ? ' Le journal des e-mails est lisible : livraison et clics seront mesurés.' : ' Le journal des e-mails n’est pas lisible : livraison et clics ne seront pas mesurés.'}` : `Échec : ${String(detail.reason ?? 'inconnu')}`}
                        </Text>
                      ) : null}
                      {g.key === 'simulation' && settings.last_simulation_at ? <Text style={styles.small}>{settings.last_simulation_blocking === 0 ? 'Aucun blocage.' : `${settings.last_simulation_blocking} blocage(s) à corriger.`}</Text> : null}
                      {g.key === 'test' ? <Text style={styles.small}>Part seulement vers votre adresse. Compte quand Brevo donne l’identifiant du message.</Text> : null}
                    </View>
                    <Pressable style={[styles.small2, busy === g.key && { opacity: 0.5 }]} disabled={!!busy} onPress={g.key === 'brevo' ? doCheck : g.key === 'simulation' ? doSimulate : doTest} testID={g.key === 'brevo' ? 'mkai-check-brevo' : g.key === 'simulation' ? 'mkai-run-simulation' : 'mkai-send-test'}>
                      <Text style={styles.small2Text}>{busy === g.key || (g.key === 'brevo' && busy === 'check') || (g.key === 'simulation' && busy === 'simulate') || (g.key === 'test' && busy === 'test') ? '…' : g.key === 'brevo' ? 'Contrôler' : g.key === 'simulation' ? 'Simuler' : 'Envoyer le test'}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>

            {/* campagne du jour en attente */}
            {pending ? (
              <View style={[styles.card, { borderColor: colors.gold }]} testID="mkai-pending">
                <Text style={styles.cardTitle}>Campagne du jour : votre approbation</Text>
                <Text style={styles.text}>{pending.planned ?? '0'} client(s) retenu(s). Regardez le plan et les aperçus ci-dessous, puis approuvez : seulement alors les e-mails sont mis en file.</Text>
                <Pressable style={styles.primary} onPress={() => approve(pending.id)} disabled={!!busy} testID="mkai-approve"><Text style={styles.primaryText}>{busy === 'approve' ? '…' : 'Approuver et mettre en file'}</Text></Pressable>
              </View>
            ) : null}

            {/* réglages */}
            <View style={styles.card} testID="mkai-settings">
              <Text style={styles.cardTitle}>Réglages</Text>
              <Field label="Heure du passage quotidien (heure de N’Djamena, 0 à 23)" value={form.run_hour} onChange={(v) => setForm((f) => ({ ...f, run_hour: v }))} testID="mkai-run-hour" />
              <Field label="Limite d’e-mails de campagne par jour (1 à 200)" value={form.daily_limit} onChange={(v) => setForm((f) => ({ ...f, daily_limit: v }))} testID="mkai-daily-limit" />
              <Field label="Jours minimum entre deux e-mails publicitaires à un même client (1 à 60)" value={form.min_days_between} onChange={(v) => setForm((f) => ({ ...f, min_days_between: v }))} testID="mkai-min-days" />
              <Field label="E-mails publicitaires maximum par client sur 30 jours (1 à 15)" value={form.max_per_30_days} onChange={(v) => setForm((f) => ({ ...f, max_per_30_days: v }))} testID="mkai-max-30" />
              <Pressable style={styles.approvalRow} onPress={() => setForm((f) => ({ ...f, require_approval: !f.require_approval }))} testID="mkai-require-approval" accessibilityRole="switch" accessibilityState={{ checked: form.require_approval }}>
                <Text style={styles.gateIcon}>{form.require_approval ? '☑️' : '⬜'}</Text>
                <Text style={[styles.text, { flex: 1 }]}>Me demander d’approuver chaque campagne avant l’envoi (recommandé)</Text>
              </Pressable>
              <Pressable style={styles.primary} onPress={saveSettings} disabled={!!busy} testID="mkai-save-settings"><Text style={styles.primaryText}>{busy === 'save' ? '…' : 'Enregistrer'}</Text></Pressable>
              <Text style={styles.small}>Une vente flash peut suivre un autre e-mail après 2 jours. Le plafond global des e-mails du site (EMAIL_DAILY_CAP) s’applique toujours en plus.</Text>
            </View>

            {/* plan */}
            {plan ? <PlanCard run={plan.run} summary={plan.summary} preview={preview} setPreview={setPreview} /> : (
              <View style={styles.card}><Text style={styles.cardTitle}>Plan du jour</Text><Text style={styles.text}>Aucune simulation pour l’instant. Touchez « Simuler » ci-dessus : vous verrez qui recevrait quoi, sans rien envoyer.</Text></View>
            )}
          </>
        ) : null}

        {/* rapport */}
        <ReportCard report={report} busy={busy === 'sync'} onSync={sync} />

        {/* journal */}
        {runs.length ? (
          <View style={styles.card} testID="mkai-runs">
            <Text style={styles.cardTitle}>Journal des passages</Text>
            {runs.map((r) => (
              <View key={r.id} style={styles.runRow}>
                <Text style={styles.runDate}>{r.run_date}</Text>
                <Text style={[styles.text, { flex: 1 }]}>{r.mode === 'live' ? 'Actif' : 'Simulation'} · {RUN_STATUS_LABELS[r.status]}{r.planned ? ` · ${r.planned} client(s)` : ''}{r.blocking && Number(r.blocking) > 0 ? ` · ${r.blocking} blocage(s)` : ''}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Field({ label, value, onChange, testID }: { label: string; value: string; onChange: (v: string) => void; testID: string }) {
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={styles.small}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} keyboardType="number-pad" style={styles.input} testID={testID} placeholderTextColor={colors.creamFaint} />
    </View>
  );
}

function PlanCard({ run, summary, preview, setPreview }: { run: MarketingRunRow; summary: PlanSummary; preview: string | null; setPreview: (v: string | null) => void }) {
  const excluded = Object.entries(summary.clients.excluded).sort((a, b) => b[1] - a[1]);
  return (
    <View style={styles.card} testID="mkai-plan">
      <Text style={styles.cardTitle}>Plan du {summary.runDate} · {run.mode === 'live' ? 'campagne' : 'simulation'}</Text>
      <Text style={styles.big} testID="mkai-plan-count">{summary.recipientCount}</Text>
      <Text style={styles.text}>client(s) retenu(s) sur {summary.clients.total} comptes{summary.deferred ? ` (${summary.deferred} reporté(s) : limite du jour)` : ''}. Articles vérifiés : {summary.catalog.verified} sur {summary.catalog.total}.</Text>
      {summary.issues.map((i) => (
        <Text key={i.code} style={[styles.issue, i.level === 'blocking' ? styles.issueBad : i.level === 'warning' ? styles.issueWarn : styles.issueInfo]} testID={`mkai-issue-${i.code}`}>
          {i.level === 'blocking' ? '⛔ Blocage : ' : i.level === 'warning' ? '⚠️ ' : 'ℹ️ '}{i.message}
        </Text>
      ))}
      <Text style={styles.subTitle}>Par segment</Text>
      {summary.segments.map((s) => (
        <View key={s.key} style={styles.segRow}>
          <Text style={[styles.text, { flex: 1 }]}>{s.label}</Text>
          <Text style={styles.segNum}>{s.planned}</Text>
          <Text style={styles.small}> / {s.eligible}</Text>
        </View>
      ))}
      <Text style={styles.small}>retenus aujourd’hui / qui conviennent</Text>
      {excluded.length ? <Text style={styles.subTitle}>Écartés</Text> : null}
      {excluded.map(([k, n]) => (
        <View key={k} style={styles.segRow}>
          <Text style={[styles.text, { flex: 1 }]}>{EXCLUSION_LABELS[k] ?? k}</Text>
          <Text style={styles.segNum}>{n}</Text>
        </View>
      ))}
      {summary.previews.length ? <Text style={styles.subTitle}>Aperçus (un par segment et par langue)</Text> : null}
      {summary.previews.map((p) => {
        const key = `${p.segment}-${p.lang}`;
        const open = preview === key;
        return (
          <View key={key} style={styles.previewBox}>
            <Pressable onPress={() => setPreview(open ? null : key)} testID={`mkai-preview-${key}`}>
              <Text style={styles.previewLabel}>{p.label} · {p.lang === 'ar' ? 'arabe' : 'français'} · variante {p.variant}</Text>
              <Text style={styles.previewSubject}>Objet : {p.subject}</Text>
              <Text style={styles.link}>{open ? 'Masquer l’aperçu' : 'Voir l’aperçu'}</Text>
            </Pressable>
            {open ? (Platform.OS === 'web' ? React.createElement('iframe', { srcDoc: p.html, title: p.label, style: { width: '100%', height: 520, border: '1px solid #2a3a66', borderRadius: 10, background: '#fff', marginTop: 8 }, 'data-testid': `mkai-preview-frame-${key}` }) : <Text style={styles.small}>L’aperçu complet s’ouvre sur le site web.</Text>) : null}
          </View>
        );
      })}
    </View>
  );
}

function Cell({ v, label }: { v: string; label: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellValue}>{v}</Text>
      <Text style={styles.cellLabel}>{label}</Text>
    </View>
  );
}

function ReportCard({ report, busy, onSync }: { report: MarketingReport | null; busy: boolean; onSync: () => void }) {
  if (!report) return <View style={styles.card}><Text style={styles.cardTitle}>Rapport (30 jours)</Text><Text style={styles.text}>Chargement ou fonction à mettre à jour…</Text></View>;
  const t = report.totals;
  const measured = t.measured > 0;
  const rate = (n: number, d: number) => (measured ? pct(n, d) : 'non mesuré');
  const seg = Object.entries(report.bySegment).filter(([, b]) => b.queued > 0 || b.orders > 0);
  const row = (name: string, b: ReportBucket) => (
    <View key={name} style={styles.tr}>
      <Text style={[styles.td, { flex: 2, textAlign: 'left' }]}>{name}</Text>
      <Text style={styles.td}>{b.queued}</Text>
      <Text style={styles.td}>{b.measured ? b.delivered : '—'}</Text>
      <Text style={styles.td}>{b.measured ? b.clicked : '—'}</Text>
      <Text style={styles.td}>{b.unsubscribed}</Text>
      <Text style={styles.td}>{b.orders}</Text>
    </View>
  );
  return (
    <View style={styles.card} testID="mkai-report">
      <Text style={styles.cardTitle}>Rapport ({report.days} derniers jours)</Text>
      <View style={styles.cells}>
        <Cell v={String(t.queued)} label="mis en file" />
        <Cell v={String(t.sent)} label="acceptés par Brevo" />
        <Cell v={String(t.confirmed)} label="confirmés (identifiant)" />
        <Cell v={rate(t.delivered, t.measured)} label="taux de livraison" />
        <Cell v={rate(t.clicked, t.delivered)} label="taux de clic" />
        <Cell v={measured ? pct(t.unsubscribed, t.delivered) : 'non mesuré'} label="désinscriptions" />
        <Cell v={String(t.bounced)} label="rebonds" />
        <Cell v={String(t.complaints)} label="plaintes" />
        <Cell v={String(t.failed)} label="refusés par Brevo" />
        <Cell v={String(t.orders)} label="commandes attribuées" />
        <Cell v={formatXAF(t.revenue)} label="revenu livré attribué" />
      </View>
      {report.eventsAwaiting > 0 ? <Text style={styles.small} testID="mkai-awaiting">{report.eventsAwaiting} e-mail(s) confirmés attendent encore la lecture de leurs résultats chez Brevo.</Text> : null}
      <Pressable style={[styles.small2, { alignSelf: 'flex-start', marginTop: spacing.sm }, busy && { opacity: 0.5 }]} onPress={onSync} disabled={busy} testID="mkai-sync"><Text style={styles.small2Text}>{busy ? '…' : 'Actualiser les résultats Brevo'}</Text></Pressable>
      <Text style={styles.subTitle}>Segments comparés</Text>
      <View style={styles.tableHeader}>
        <Text style={[styles.th, { flex: 2, textAlign: 'left' }]}>Segment</Text><Text style={styles.th}>File</Text><Text style={styles.th}>Livrés</Text><Text style={styles.th}>Clics</Text><Text style={styles.th}>Désins.</Text><Text style={styles.th}>Cmd</Text>
      </View>
      {seg.length ? seg.map(([k, b]) => row(SEGMENT_NAMES[k] ?? k, b)) : <Text style={styles.small}>Aucun e-mail de campagne pour l’instant.</Text>}
      {Object.keys(report.byVariant).length ? <Text style={styles.subTitle}>Variantes d’objet</Text> : null}
      {Object.entries(report.byVariant).sort().map(([k, b]) => row(`Variante ${k}`, b))}
      {report.errors.length ? <Text style={styles.subTitle}>Erreurs et e-mails annulés</Text> : null}
      {report.errors.map((e) => (
        <Text key={e.reason} style={styles.small}>• {e.count} × {e.reason}</Text>
      ))}
      <Text style={styles.footnote}>« Livrés », « clics », rebonds et plaintes sont lus chez Brevo : tant qu’ils ne sont pas lus, ils sont affichés « non mesuré » et jamais 0. {report.attribution.note}</Text>
    </View>
  );
}

const SEGMENT_NAMES: Record<string, string> = { flash: 'Vente flash', wishlist: 'Favoris', loyalty: 'Fidélité', winback: 'À reconquérir', new_arrivals: 'Nouveautés', inactive: 'Absents', nurture: 'Nouveaux comptes' };

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  note: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, backgroundColor: colors.panel, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md },
  warnBox: { backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.gold, padding: spacing.md, gap: 6, marginBottom: spacing.md },
  warnTitle: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 15 },
  msg: { borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md, borderWidth: 1 },
  msgOk: { borderColor: '#2e7d4f', backgroundColor: 'rgba(46,125,79,0.15)' },
  msgBad: { borderColor: colors.gold, backgroundColor: 'rgba(212,175,55,0.12)' },
  msgText: { color: colors.cream, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  card: { backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md, gap: 6 },
  cardTitle: { color: colors.cream, fontFamily: fonts.display, fontSize: 16, marginBottom: 2 },
  subTitle: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 13, marginTop: spacing.sm },
  modeBig: { color: colors.cream, fontFamily: fonts.displayBold, fontSize: 22 },
  big: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 34 },
  text: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  small: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, lineHeight: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipLocked: { opacity: 0.55 },
  chipText: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 13 },
  chipTextActive: { color: colors.background, fontFamily: fonts.bodyBold },
  confirm: { gap: 8, marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  input: { backgroundColor: colors.background, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, color: colors.cream, fontFamily: fonts.body, borderWidth: 1, borderColor: colors.border },
  primary: { backgroundColor: colors.gold, borderRadius: radius.pill, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  primaryText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 14 },
  gateRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  gateIcon: { fontSize: 18 },
  gateLabel: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  small2: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.gold },
  small2Text: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: 12 },
  approvalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: spacing.sm },
  issue: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, borderRadius: radius.md, padding: 8 },
  issueBad: { color: colors.cream, backgroundColor: 'rgba(192,38,45,0.25)' },
  issueWarn: { color: colors.cream, backgroundColor: 'rgba(212,175,55,0.15)' },
  issueInfo: { color: colors.creamMuted, backgroundColor: 'rgba(255,255,255,0.05)' },
  segRow: { flexDirection: 'row', alignItems: 'baseline', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  segNum: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 14 },
  previewBox: { marginTop: 6, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  previewLabel: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  previewSubject: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  link: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: 12, marginTop: 4 },
  cells: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '47%', backgroundColor: colors.background, borderRadius: radius.md, padding: 10 },
  cellValue: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 18 },
  cellLabel: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  tableHeader: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  th: { flex: 1, color: colors.creamFaint, fontFamily: fonts.bodySemiBold, fontSize: 10, textTransform: 'uppercase', textAlign: 'center' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border },
  td: { flex: 1, color: colors.cream, fontFamily: fonts.body, fontSize: 12, textAlign: 'center' },
  footnote: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, marginTop: spacing.sm },
  runRow: { flexDirection: 'row', gap: 8, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: colors.border },
  runDate: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 12, width: 82 },
});
