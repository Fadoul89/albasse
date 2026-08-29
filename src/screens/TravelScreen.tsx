import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, spacing } from '../theme';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { createFlightRequest } from '../lib/travel';
import { ScreenHeader } from '../components/ScreenHeader';
import { GoldButton } from '../components/GoldButton';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DateField } from '../components/DateField';
import { AIRLINES } from '../constants/airlines';

const today = new Date().toISOString().slice(0, 10);

export function TravelScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profile = useAuthStore((s) => s.profile);

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [airline, setAirline] = useState<string | null>(null);
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [passengers, setPassengers] = useState('1');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const showToast = useToastStore((s) => s.show);

  const handleSubmit = async () => {
    if (!profile) {
      setShowLoginPrompt(true);
      return;
    }
    if (!fullName || !phone || !origin || !destination || !departureDate) {
      showToast('Merci de remplir au minimum le nom, le téléphone, les villes et la date de départ.', {
        title: 'Champs manquants',
        type: 'error',
      });
      return;
    }

    setSubmitting(true);
    const { request, error } = await createFlightRequest({
      userId: profile.id,
      fullName,
      phone,
      originCity: origin,
      destinationCity: destination,
      preferredAirline: airline,
      departureDate,
      returnDate: returnDate || null,
      passengerCount: Number(passengers) || 1,
      notes,
    });
    setSubmitting(false);

    if (error || !request) {
      console.error('Erreur envoi demande de voyage:', error);
      showToast(error ?? "Impossible d'envoyer la demande.", { title: 'Erreur', type: 'error' });
      return;
    }

    showToast('Notre équipe vous contactera pour finaliser la réservation.', {
      title: 'Demande envoyée ✓',
      type: 'success',
    });
    navigation.goBack();
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Voyage — Billet d'avion" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Indiquez les détails de votre voyage. Notre équipe vous recontacte pour confirmer les
          disponibilités, le prix et le paiement.
        </Text>

        <Text style={styles.sectionTitle}>Vos coordonnées</Text>
        <Field label="Nom complet" value={fullName} onChangeText={setFullName} />
        <Field label="Téléphone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

        <Text style={styles.sectionTitle}>Détails du voyage</Text>
        <Field label="Ville de départ" value={origin} onChangeText={setOrigin} placeholder="N'Djamena" />
        <Field label="Ville de destination" value={destination} onChangeText={setDestination} placeholder="Paris" />

        <Text style={styles.label}>Compagnie aérienne préférée (optionnel)</Text>
        <View style={styles.airlineRow}>
          {AIRLINES.map((a) => (
            <Pressable
              key={a}
              style={[styles.airlineChip, airline === a && styles.airlineChipActive]}
              onPress={() => setAirline(airline === a ? null : a)}
            >
              <Text style={[styles.airlineText, airline === a && styles.airlineTextActive]}>{a}</Text>
            </Pressable>
          ))}
        </View>

        <DateField label="Date de départ" value={departureDate} onChange={setDepartureDate} minimumDateStr={today} />
        <DateField
          label="Date de retour (optionnel)"
          value={returnDate}
          onChange={setReturnDate}
          minimumDateStr={departureDate || today}
        />
        <Field
          label="Nombre de passagers"
          value={passengers}
          onChangeText={setPassengers}
          keyboardType="numeric"
        />
        <Field
          label="Remarques (optionnel)"
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="Classe souhaitée, escales, bagages…"
        />

        <View style={styles.warningBox}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningText}>
            Merci de ne faire une demande que si vous êtes réellement intéressé(e). Les demandes non sérieuses
            ou fausses ralentissent le traitement des vrais voyageurs et peuvent entraîner un blocage de votre
            compte.
          </Text>
        </View>

        <GoldButton
          label="Envoyer la demande"
          onPress={handleSubmit}
          loading={submitting}
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>
      <ConfirmDialog
        visible={showLoginPrompt}
        title="Connexion requise"
        message="Veuillez vous connecter pour envoyer une demande."
        confirmLabel="Se connecter"
        onConfirm={() => {
          setShowLoginPrompt(false);
          navigation.navigate('Login');
        }}
        onCancel={() => setShowLoginPrompt(false)}
      />
    </View>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.creamFaint}
        style={[styles.input, props.multiline && { height: 80, textAlignVertical: 'top' }]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 60 },
  intro: {
    color: colors.creamMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.cream,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  label: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12, marginBottom: 6 },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(216,35,42,0.12)',
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  warningIcon: { fontSize: 16 },
  warningText: { flex: 1, color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 17 },
  airlineRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  airlineChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.panel,
  },
  airlineChipActive: { borderColor: colors.gold, backgroundColor: colors.panelAlt },
  airlineText: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  airlineTextActive: { color: colors.goldLight },
  input: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.cream,
    fontFamily: fonts.body,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
