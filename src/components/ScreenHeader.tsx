import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';

interface Props {
  title: string;
  showBack?: boolean;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, showBack, right }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleBack = () => {
    // Apres une redirection (ex: retour a la page demandee post-connexion),
    // l'historique peut etre vide : dans ce cas on revient a l'accueil au
    // lieu de laisser le bouton "retour" ne rien faire.
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Tabs', { screen: 'Home' } as never);
    }
  };

  return (
    <View style={styles.header}>
      <View style={[styles.side, styles.sideStart]}>
        {showBack && (
          <>
            <Pressable onPress={handleBack} hitSlop={12}>
              <Text style={styles.back}>←</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('Tabs', { screen: 'Home' } as never)} hitSlop={12}>
              <Text style={styles.home}>🏠</Text>
            </Pressable>
          </>
        )}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  side: { width: 76 },
  sideStart: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  back: { color: colors.gold, fontSize: 28 },
  home: { fontSize: 26 },
  title: {
    flex: 1,
    color: colors.cream,
    fontFamily: fonts.display,
    fontSize: 18,
    textAlign: 'center',
  },
});
