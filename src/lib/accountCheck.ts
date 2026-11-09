// « Mot de passe oublié » : on confirme d'abord que la personne a un compte ICI (demande du patron, 9 novembre 2026), avant de la laisser nous écrire
// sur WhatsApp ou de prévenir l'équipe. Avant, quelqu'un qui n'avait aucun compte pouvait écrire « j'ai oublié le mot de passe de mon compte ».
// La base répond seulement vrai / faux (fonction account_exists_for_login, script add-account-check.sql) : jamais un nom, un numéro ni une adresse.
// Si la réponse est inconnue (script pas encore lancé, réseau, erreur) : null, et l'écran marche exactement comme avant : un vrai client n'est jamais bloqué.
import { supabase } from './supabase';
import { readAccountAnswer } from './accountCheckRules';

export { noAccountText, readAccountAnswer, type LoginKind } from './accountCheckRules';

export const ACCOUNT_CHECK_RPC = 'account_exists_for_login';
const MAX_LOGIN_LENGTH = 120;
const TIMEOUT_MS = 8000;

export async function accountExists(login: string): Promise<boolean | null> {
  const value = login.trim().slice(0, MAX_LOGIN_LENGTH);
  if (!value) return null;
  try {
    const answer = await Promise.race([
      supabase.rpc(ACCOUNT_CHECK_RPC, { p_login: value }).then(({ data, error }) => readAccountAnswer(data, error)),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
    return answer;
  } catch {
    return null;
  }
}
