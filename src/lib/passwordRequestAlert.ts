// Alerte Telegram à l'administrateur quand un client demande un nouveau mot de passe (écran « Mot de passe oublié »).
// Le message part de la base (fonction notify_admin_password_request, script add-password-request-alert.sql) : nom, numéro, ville et lien vers la fiche du client.
// Le site dit seulement QUI a demandé (ce que le client a écrit) ; la base retrouve le compte, limite les alertes (1 par client / 30 min, 20 par heure)
// et répond toujours pareil : on ne peut pas deviner quels numéros ont un compte. L'alerte est un plus : si elle échoue (script pas encore lancé, réseau),
// l'écran marche exactement comme avant.
import { supabase } from './supabase';

export const PASSWORD_ALERT_RPC = 'notify_admin_password_request';
const MAX_LOGIN_LENGTH = 120;

export async function alertPasswordRequest(login: string): Promise<void> {
  const value = login.trim().slice(0, MAX_LOGIN_LENGTH);
  if (!value) return;
  try {
    await supabase.rpc(PASSWORD_ALERT_RPC, { p_login: value });
  } catch {
    // rien : l'alerte ne doit jamais gêner le client
  }
}
