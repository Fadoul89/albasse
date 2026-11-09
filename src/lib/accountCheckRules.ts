// Règles pures de la vérification « cette personne a-t-elle un compte ICI ? » (sans réseau : testées dans tests/zara/zara-password.test.ts).
// Le code qui interroge la base est dans accountCheck.ts. Voir add-account-check.sql.

// Ce que la base a répondu : true (compte trouvé), false (aucun compte), null (on ne sait pas : on laisse faire comme avant)
export function readAccountAnswer(data: unknown, error: unknown): boolean | null {
  if (error) return null;
  return typeof data === 'boolean' ? data : null;
}

// Ce que le client a écrit : un e-mail, un numéro client (AS-000123) ou un numéro de téléphone (pour le texte « aucun compte avec… »)
export type LoginKind = 'email' | 'clientNumber' | 'phone';
export function noAccountText(kind: LoginKind, shown: string): string {
  const what = kind === 'email' ? `l’e-mail ${shown}` : kind === 'clientNumber' ? `le numéro client ${shown}` : `le numéro ${shown}`;
  const other = kind === 'email' ? 'votre numéro de téléphone ou votre numéro client' : kind === 'clientNumber' ? 'votre numéro de téléphone ou votre e-mail' : 'votre e-mail ou votre numéro client';
  return `Nous ne trouvons aucun compte avec ${what}. Vérifiez ce que vous avez écrit, ou essayez avec ${other}. Pas encore de compte ? Créez-le gratuitement, c’est rapide.`;
}
