import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { GoldButton } from '../components/GoldButton';
import { NOT_FOUND_TEXT } from '../lib/notFoundText';
import { colors, fonts, radius, spacing } from '../theme';

// Page 404 : une adresse qui n'existe pas (ou qui a changé) → un message clair et des chemins pour continuer, au lieu de la page d'accueil sans explication.
export function NotFoundScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.screen} testID="not-found-screen">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.code} accessibilityElementsHidden importantForAccessibility="no">404</Text>
        <Text style={styles.title} accessibilityRole="header">{NOT_FOUND_TEXT.title}</Text>
        <Text style={styles.body}>{NOT_FOUND_TEXT.body}</Text>

        <GoldButton
          label={NOT_FOUND_TEXT.home}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'Home' } }] })}
          testID="not-found-home"
          style={styles.button}
        />
        <GoldButton
          label={NOT_FOUND_TEXT.search}
          variant="outline"
          onPress={() => navigation.navigate('Tabs', { screen: 'Search' } as never)}
          testID="not-found-search"
          style={styles.button}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, maxWidth: 480, width: '100%', alignSelf: 'center' },
  code: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 64, textAlign: 'center', marginBottom: 4 },
  title: { color: colors.cream, fontFamily: fonts.display, fontSize: 22, textAlign: 'center', marginBottom: spacing.sm },
  body: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: spacing.lg },
  button: { marginBottom: spacing.sm, borderRadius: radius.md },
});
