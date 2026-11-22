// L'icône « Accueil » (demande du patron, 22 novembre 2026, sur le modèle qu'il a envoyé) : un rond bleu brillant et une maison blanche.
// Dessinée (pas d'image à charger, nette sur tous les écrans) ; en haut des pages (ScreenHeader) et dans la barre du bas.
import React from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export function HomeIcon({ size = 34 }: { size?: number }) {
  const k = size / 48; // dessin sur une grille de 48 × 48
  const u = (n: number) => Math.round(n * k * 10) / 10;
  return (
    <View
      accessible={false}
      style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', borderWidth: Math.max(1, u(1.5)), borderColor: '#9fdcff' }}
      testID="home-icon"
    >
      <LinearGradient colors={['#45b4ff', '#0b5fd8', '#1a8af2']} locations={[0, 0.6, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      {/* le reflet du verre */}
      <LinearGradient
        colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0)']}
        style={{ position: 'absolute', top: u(3), left: u(8.5), width: u(29), height: u(16), borderRadius: u(14) }}
      />
      {/* la cheminée, puis le toit, le mur et la porte */}
      <View style={{ position: 'absolute', left: u(29.5), top: u(13.5), width: u(3.6), height: u(8), backgroundColor: '#ffffff' }} />
      <View
        style={{
          position: 'absolute',
          left: u(10.5),
          top: u(12.5),
          width: 0,
          height: 0,
          borderLeftWidth: u(13.5),
          borderRightWidth: u(13.5),
          borderBottomWidth: u(13),
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: '#ffffff',
        }}
      />
      <View style={{ position: 'absolute', left: u(15.5), top: u(25), width: u(17), height: u(11.5), backgroundColor: '#ffffff' }} />
      <View style={{ position: 'absolute', left: u(21.6), top: u(29.4), width: u(4.8), height: u(7.1), backgroundColor: '#0d63d9' }} />
    </View>
  );
}
