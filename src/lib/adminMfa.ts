// Double vérification des administrateurs (code à 6 chiffres de Google Authenticator, « TOTP »).
// Partie pure (sans React Native) : textes, nettoyage du code, choix de l'écran, messages d'erreur. Testée par tests/email/admin-mfa.test.ts.
// La vraie protection est dans la base : is_admin() exige une session « aal2 » (code tapé) dès que l'admin a activé la double vérification
// (add-admin-mfa.sql), et les fonctions serveur passent par is_admin(). Les clients ne sont jamais concernés.

export const MFA_TEXT = {
  // écran de connexion (admin qui a activé la double vérification)
  gateTitle: 'Code de vérification',
  gateBody: 'Ouvrez Google Authenticator et tapez le code à 6 chiffres d’Albasse Shopping.',
  validate: 'Valider',
  signOut: 'Se déconnecter',
  lostPhone: 'Téléphone perdu ? Comment récupérer l’accès',
  lostPhoneHelp:
    'Demandez à votre support technique de retirer l’ancien téléphone dans Supabase (Authentication › Users › votre compte). Ensuite, refaites la mise en route avec le nouveau téléphone.',
  success: 'Code correct : bienvenue dans l’administration',
  // page « Double vérification » de l'administration
  pageTitle: '🔐 Double vérification',
  intro: 'En plus du mot de passe, un code à 6 chiffres sera demandé à chaque connexion admin. Il change toutes les 30 secondes.',
  step1: 'Installez Google Authenticator sur votre téléphone.',
  step2: 'Touchez « + », puis « Scanner un QR code ».',
  step3: 'Tapez le code affiché :',
  keyLabel: 'Ou tapez cette clé dans l’application :',
  start: 'Commencer',
  activate: 'Activer',
  active: '✓ La double vérification est active sur ce compte.',
  activeHelp: 'À chaque connexion admin, le site vous demandera le code de Google Authenticator. Les clients ne voient aucun changement.',
  activated: '✓ Double vérification activée. À la prochaine connexion, le code vous sera demandé.',
  notAdmin: 'Cette page est réservée aux administrateurs.',
} as const;

/** Garde seulement les chiffres, 6 au plus (« 482 913 » collé avec un espace -> « 482913 »). */
export function cleanCode(input: string | null | undefined): string {
  return String(input ?? '').replace(/\D/g, '').slice(0, 6);
}

export function isCompleteCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

export interface AalInfo {
  currentLevel: string | null;
  nextLevel: string | null;
}

/** Faut-il demander le code ? Seulement à un admin qui a activé la double vérification (nextLevel aal2) et ne l'a pas encore tapé. */
export function needsCode(isAdmin: boolean | null | undefined, aal: AalInfo | null | undefined): boolean {
  if (!isAdmin || !aal) return false;
  return aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2';
}

export interface FactorLike {
  id: string;
  factor_type?: string;
  status?: string;
  created_at?: string;
}

/** Le téléphone déjà activé (facteur TOTP vérifié), s'il y en a un. */
export function verifiedTotp(factors: FactorLike[] | null | undefined): FactorLike | null {
  return (factors ?? []).find((f) => f.factor_type === 'totp' && f.status === 'verified') ?? null;
}

/** Les mises en route commencées mais jamais terminées : à retirer avant d'en commencer une nouvelle. */
export function unfinishedTotp(factors: FactorLike[] | null | undefined): FactorLike[] {
  return (factors ?? []).filter((f) => f.factor_type === 'totp' && f.status !== 'verified');
}

/** La clé à taper à la main, par groupes de 4 (« KJ4E WQ7S … »). */
export function groupSecret(secret: string | null | undefined): string {
  return String(secret ?? '').replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Image du QR code. supabase-js colle le dessin SVG tel quel derrière « data:image/svg+xml;utf-8, » : un « # » dans le dessin
 * couperait l'adresse. On le ré-encode proprement. Une adresse déjà encodée (base64, %3C…) est gardée.
 */
export function qrDataUrl(qr: string | null | undefined): string | null {
  const raw = String(qr ?? '').trim();
  if (!raw) return null;
  const m = raw.match(/^data:image\/svg\+xml;(?:utf-?8|charset=utf-?8),([\s\S]*)$/i);
  const svg = m ? m[1] : raw.startsWith('<') ? raw : null;
  if (svg === null) return raw;
  const plain = svg.startsWith('%3C') || svg.startsWith('%3c') ? decodeURIComponent(svg) : svg;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(plain)}`;
}

/** Message clair à partir de l'erreur de Supabase. */
export function mfaErrorText(message: string | null | undefined): string {
  const m = String(message ?? '').toLowerCase();
  if (/invalid.*(totp|code)|code.*invalid|incorrect/.test(m)) return 'Code incorrect. Regardez le code affiché maintenant (il change toutes les 30 secondes) et réessayez.';
  if (/expired|expir/.test(m)) return 'Le code a expiré. Tapez le nouveau code affiché.';
  if (/rate|too many|limit/.test(m)) return 'Trop d’essais. Attendez une minute puis réessayez.';
  if (/network|fetch|failed to fetch/.test(m)) return 'Pas de connexion internet. Vérifiez le réseau puis réessayez.';
  if (/mfa.*(disabled|not enabled)|totp.*disabled/.test(m)) return 'La double vérification n’est pas activée sur le projet Supabase (Authentication › Multi-Factor).';
  return 'La vérification n’a pas marché. Réessayez dans un instant.';
}
