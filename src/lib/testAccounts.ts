// Comptes de test (adresses e-mail d'essai) : cachés par défaut dans Admin › Clients et non comptés dans les publics des annonces de Zara.
export function isTestEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  return (
    lower.includes('test') ||
    lower.includes('@mailinator.') ||
    lower.includes('@yopmail.') ||
    lower.includes('@guerrillamail.') ||
    lower.includes('@example.') ||
    lower.includes('@fake.')
  );
}
