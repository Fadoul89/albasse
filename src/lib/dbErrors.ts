// La base répond qu'une colonne n'existe pas (script SQL pas encore appliqué) : PostgREST dit PGRST204, Postgres dit 42703.
// Sert aux statistiques de Zara : une commande, une connexion ou une installation ne doit JAMAIS échouer à cause d'elles.
export function isMissingColumn(error: { code?: string; message?: string } | null | undefined, column: string): boolean {
  if (!error) return false;
  return (error.code === 'PGRST204' || error.code === '42703') && String(error.message ?? '').includes(column);
}
