// Lecture, pour l'administrateur, des e-mails publicitaires que Zara a envoyés (table email_outbox : la base ne la laisse lire qu'aux administrateurs, règle RLS
// « email_outbox_admin_read »). Aucun script SQL : la règle et le droit de lecture existent déjà.
// La base ne renvoie que 1 000 lignes par demande : on lit page par page, du plus récent au plus ancien (10 pages au plus = 10 000 e-mails).
import { supabase } from './supabase';
import { ZARA_EMAIL_KINDS, lastZaraEmails, type LastEmail, type SentEmailRow } from './lastEmail';

const PAGE = 1000;
const MAX_PAGES = 10;

export interface LastEmailData {
  byUser: Map<string, LastEmail>;
  // false : plus de 10 000 e-mails, les plus anciens n'ont pas été lus : un client sans ligne n'est alors PAS « sans e-mail » (l'écran n'affiche rien pour lui)
  complete: boolean;
}

// null : lecture impossible (réseau, droits) ; l'écran n'affiche alors aucune ligne « Dernier e-mail Zara » (jamais un faux « aucun e-mail »)
export async function fetchLastZaraEmails(): Promise<LastEmailData | null> {
  try {
    const rows: SentEmailRow[] = [];
    let complete = true;
    for (let page = 0; page < MAX_PAGES; page++) {
      const { data, error } = await supabase
        .from('email_outbox')
        .select('user_id,kind,status,sent_at,click_count,bounce_type,complaint_at')
        .in('kind', [...ZARA_EMAIL_KINDS])
        .eq('status', 'sent')
        .not('user_id', 'is', null)
        .order('sent_at', { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (error || !data) return null;
      rows.push(...(data as SentEmailRow[]));
      if (data.length < PAGE) break;
      if (page === MAX_PAGES - 1) complete = false;
    }
    return { byUser: lastZaraEmails(rows), complete };
  } catch {
    return null;
  }
}
