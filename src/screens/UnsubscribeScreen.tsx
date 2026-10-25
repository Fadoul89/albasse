import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, spacing } from '../theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { GoldButton } from '../components/GoldButton';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Page « albasseshopping.com/desinscription?t=… » : le lien « Me désinscrire » des e-mails publicitaires. Ouverte sans compte ; elle coupe
// seulement les e-mails publicitaires (les e-mails de commande et les notifications ne changent pas).
export function UnsubscribeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Unsubscribe'>>();
  const token = typeof route.params?.t === 'string' ? route.params.t : '';
  const [state, setState] = useState<'loading' | 'done' | 'invalid' | 'error'>('loading');

  useEffect(() => {
    let alive = true;
    if (!UUID.test(token) || !isSupabaseConfigured) {
      setState(UUID.test(token) ? 'error' : 'invalid');
      return;
    }
    Promise.resolve(supabase.rpc('email_unsubscribe', { p_token: token })).then(({ data, error }) => {
      if (!alive) return;
      setState(error ? 'error' : data === true ? 'done' : 'invalid');
    });
    return () => {
      alive = false;
    };
  }, [token]);

  return (
    <View style={styles.screen} testID="unsubscribe-screen">
      <ScreenHeader title="E-mails publicitaires" />
      <ScrollView contentContainerStyle={styles.content}>
        {state === 'loading' ? (
          <ActivityIndicator color={colors.gold} />
        ) : (
          <View style={styles.box} testID={`unsubscribe-${state}`}>
            <Text style={styles.title}>
              {state === 'done' ? '✅ Vous êtes désinscrit' : state === 'invalid' ? 'Lien non reconnu' : 'Désinscription impossible pour le moment'}
            </Text>
            <Text style={styles.text}>
              {state === 'done'
                ? 'Vous ne recevrez plus nos e-mails publicitaires. Vous recevrez toujours les e-mails de vos commandes.'
                : state === 'invalid'
                ? "Ce lien n'est pas valide. Utilisez le lien « Me désinscrire » en bas du dernier e-mail reçu."
                : 'Réessayez dans un instant.'}
            </Text>
          </View>
        )}
        <GoldButton label="Aller sur la plateforme" variant="outline" onPress={() => navigation.navigate('Tabs', { screen: 'Home' } as never)} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, alignItems: 'center', gap: spacing.lg },
  box: { alignSelf: 'stretch', maxWidth: 420, backgroundColor: colors.panelAlt, borderRadius: radius.md, borderLeftWidth: 4, borderLeftColor: colors.gold, padding: spacing.md, gap: 6 },
  title: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 16 },
  text: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
});
