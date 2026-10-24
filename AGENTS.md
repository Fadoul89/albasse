# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Supabase : nouvelles tables (depuis le 30 octobre 2026)

Supabase ne donne plus automatiquement l'accès au site (Data API) aux NOUVELLES tables du schéma `public`.
Tout script SQL qui crée une table doit donc ajouter ses `grant` explicites (ex. `grant select, insert on public.ma_table to anon, authenticated;`,
selon ce dont le site a besoin), en plus des règles RLS. Les tables existantes ne changent pas.
