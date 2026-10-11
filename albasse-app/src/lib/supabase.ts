import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Meme projet Supabase que le site (albasseshopping.com) : comptes clients,
// produits et commandes sont partages entre le site et l'app. La cle ci-dessous
// est la cle publique "anon" — elle est deja exposee dans le bundle web public
// du site, la securite vient des policies RLS cote base, pas du secret de
// cette cle.
const SUPABASE_URL = 'https://xtitsmmccpkelxfjyqyh.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0aXRzbW1jY3BrZWx4Zmp5cXloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwOTA1NDQsImV4cCI6MjEwMTY2NjU0NH0.2WC2Q3Gp6A3GMe1HZdS7dhiMSg9xlTPiml11_-XQ6Zg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
