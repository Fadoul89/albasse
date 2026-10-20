// « Se souvenir de mon mot de passe » à la connexion. Coché : le numéro (ou l'e-mail) est gardé sur le téléphone, le navigateur
// (Google) propose d'enregistrer le mot de passe et le remplit la fois suivante, et le client reste connecté. Décoché : rien n'est
// gardé et la connexion s'arrête quand le navigateur ou l'application est fermé. Le site ne garde jamais le mot de passe lui-même.
const ID_KEY = 'albasse_login_id';
const SESSION_ONLY_KEY = 'albasse_session_only';
const TAB_KEY = 'albasse_session_tab';

const local = () => (typeof window !== 'undefined' ? window.localStorage : null);
const tab = () => (typeof window !== 'undefined' ? window.sessionStorage : null);

export function rememberedIdentifier(): string {
  try {
    return local()?.getItem(ID_KEY) ?? '';
  } catch {
    return '';
  }
}

export function rememberLogin(identifier: string, remember: boolean) {
  try {
    if (remember) {
      local()?.setItem(ID_KEY, identifier.trim());
      local()?.removeItem(SESSION_ONLY_KEY);
    } else {
      local()?.removeItem(ID_KEY);
      local()?.setItem(SESSION_ONLY_KEY, '1');
      tab()?.setItem(TAB_KEY, '1');
    }
  } catch {
    // stockage bloqué : la connexion marche quand même
  }
}

// Connexion « sans se souvenir » et navigateur rouvert depuis : on déconnecte (puis on oublie la consigne).
export function sessionShouldEnd(): boolean {
  try {
    return local()?.getItem(SESSION_ONLY_KEY) === '1' && tab()?.getItem(TAB_KEY) !== '1';
  } catch {
    return false;
  }
}

export function forgetSessionOnly() {
  try {
    local()?.removeItem(SESSION_ONLY_KEY);
  } catch {
    // rien
  }
}
