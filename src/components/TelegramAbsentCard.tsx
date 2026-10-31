// Admin › Assistant marketing : Telegram aux clients absents depuis 7 jours (interrupteur + nombre de clients qui ont lié leur Telegram).
// Les messages partent de la fonction serveur « telegram-promo » (add-telegram-absent.sql) ; le rapport arrive chaque jour à 17 h sur le Telegram de l'administrateur.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StoreSettingToggle } from './StoreSettingToggle';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { colors, fonts, spacing } from '../theme';

interface LinkedStats {
  linked: number;
  consented: number;
  stopped: number;
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export function TelegramAbsentCard() {
  // null : lecture en cours ; 'missing' : script SQL pas encore lancé
  const [stats, setStats] = useState<LinkedStats | 'missing' | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let alive = true;
    supabase.rpc('telegram_linked_stats').then(({ data, error }) => {
      if (!alive) return;
      const d = data as Partial<LinkedStats> | null;
      setStats(error || !d || typeof d.linked !== 'number' ? 'missing' : { linked: d.linked, consented: d.consented ?? 0, stopped: d.stopped ?? 0 });
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <View style={{ marginTop: spacing.md }} testID="telegram-absent-card">
      <StoreSettingToggle setting="telegramAbsent" />
      <Text style={styles.text}>
        Chaque matin à 9 h 30, Zara écrit sur Telegram à 50 clients au plus : ceux qui ont lié leur Telegram (bouton « Lier Telegram » dans leur compte), qui n'ont ni
        commandé ni visité le site depuis 7 jours et qui n'ont pas écrit STOP. Le message montre de vrais articles (la vente flash en cours d'abord). Un client
        reçoit au plus un message tous les 14 jours. Chaque jour à 17 h, vous recevez sur votre Telegram le rapport : e-mails et Telegram, clients revenus et commandes.
      </Text>
      {stats === 'missing' ? (
        <Text style={styles.text} testID="telegram-linked-stats">Lancez d'abord le script add-telegram-absent.sql dans Supabase pour voir le nombre de clients liés.</Text>
      ) : stats ? (
        <Text style={styles.stats} testID="telegram-linked-stats">
          {`✈️ ${stats.linked > 1 ? `${stats.linked} clients ont lié leur Telegram` : `${stats.linked} client a lié son Telegram`} · ${plural(stats.consented, 'reçoit', 'reçoivent')} les offres · ${plural(stats.stopped, 'a écrit STOP', 'ont écrit STOP')}`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  stats: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
});
