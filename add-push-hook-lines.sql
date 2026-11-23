-- Bibliotheque de 200 accroches marketing (fournie par l'admin) pour que Zara choisisse
-- automatiquement une phrase d'accroche adaptee au type de notification (nouvel article /
-- promotion), au lieu d'un titre toujours identique ("Nouveau produit disponible", etc.).
--
-- kind_hint : 'new' (nouveaux articles), 'promo' (promotions/urgence/cadeaux), 'any' (les deux),
-- 'reactivation' (clients absents : categorie gardee en base pour un usage futur, mais jamais
-- choisie par pick_push_hook aujourd'hui, car hors perimetre du gardien automatique add-push-gate.sql).
--
-- Le fait reel (nom de l'article, prix, nombre d'articles) reste toujours dans le MESSAGE,
-- jamais invente dans l'accroche : seule l'accroche (generique, sans chiffre) est choisie ici.
-- Alternance des categories (regle marketing demandee) : pick_push_hook evite la derniere
-- categorie utilisee (product_notifications.hook_category) quand une autre option existe.
create table if not exists public.push_hook_lines (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  kind_hint text not null check (kind_hint in ('new', 'promo', 'any', 'reactivation')),
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.push_hook_lines enable row level security;
drop policy if exists "push_hook_lines_admin_read" on public.push_hook_lines;
create policy "push_hook_lines_admin_read" on public.push_hook_lines for select using (public.is_admin());
revoke all on public.push_hook_lines from anon;
revoke all on public.push_hook_lines from authenticated;
grant select on public.push_hook_lines to authenticated;

alter table public.product_notifications add column if not exists hook_category text;

insert into public.push_hook_lines (category, kind_hint, text) values
('SURPRISE ET DECOUVERTE', 'new', '👀 Vous ne devinerez jamais ce qu''on vient d''ajouter !'),
('SURPRISE ET DECOUVERTE', 'new', '🤫 On a quelque chose à vous montrer…'),
('SURPRISE ET DECOUVERTE', 'new', 'Attendez… cette surprise est pour vous !'),
('SURPRISE ET DECOUVERTE', 'new', '😍 Vous risquez de tomber amoureux de cette nouveauté !'),
('SURPRISE ET DECOUVERTE', 'new', 'Un petit secret vous attend sur notre site…'),
('SURPRISE ET DECOUVERTE', 'new', '🚨 Ne passez surtout pas à côté !'),
('SURPRISE ET DECOUVERTE', 'new', 'Quelque chose d''intéressant vient de se passer…'),
('SURPRISE ET DECOUVERTE', 'new', 'Vous êtes prêt pour une belle surprise ?'),
('SURPRISE ET DECOUVERTE', 'new', '👀 Regardez ça avant tout le monde !'),
('SURPRISE ET DECOUVERTE', 'new', 'On vous réserve une surprise inattendue !'),
('ENVIE D''ACHETER', 'any', 'Votre prochain coup de cœur est arrivé !'),
('ENVIE D''ACHETER', 'any', 'Ce style mérite votre attention !'),
('ENVIE D''ACHETER', 'any', 'Vous allez aimer ce qu''on a préparé.'),
('ENVIE D''ACHETER', 'any', 'Et si vous changiez de look aujourd''hui ?'),
('ENVIE D''ACHETER', 'any', 'Votre garde-robe vous remerciera !'),
('ENVIE D''ACHETER', 'any', 'Un nouveau style vous attend…'),
('ENVIE D''ACHETER', 'any', 'Vous méritez quelque chose de spécial !'),
('ENVIE D''ACHETER', 'any', 'Le détail qui change toute une tenue !'),
('ENVIE D''ACHETER', 'any', 'Aujourd''hui, soyez différent !'),
('ENVIE D''ACHETER', 'any', 'Votre élégance commence ici.'),
('PROMOTIONS ET BONNES AFFAIRES', 'promo', '😱 Des prix que vous devez absolument voir !'),
('PROMOTIONS ET BONNES AFFAIRES', 'promo', 'Et si vous payiez moins cher aujourd''hui ?'),
('PROMOTIONS ET BONNES AFFAIRES', 'promo', 'Une occasion à ne pas laisser passer !'),
('PROMOTIONS ET BONNES AFFAIRES', 'promo', 'Votre portefeuille va apprécier !'),
('PROMOTIONS ET BONNES AFFAIRES', 'promo', 'Des surprises côté prix vous attendent…'),
('PROMOTIONS ET BONNES AFFAIRES', 'promo', 'Vous allez aimer cette réduction !'),
('PROMOTIONS ET BONNES AFFAIRES', 'promo', 'Le moment idéal pour faire du shopping !'),
('PROMOTIONS ET BONNES AFFAIRES', 'promo', 'Certains prix viennent de changer…'),
('PROMOTIONS ET BONNES AFFAIRES', 'promo', 'Une bonne affaire se cache ici !'),
('PROMOTIONS ET BONNES AFFAIRES', 'promo', 'Cliquez avant de regretter !'),
('CADEAUX ET SURPRISES', 'promo', '🎁 Et si votre prochain achat vous offrait un cadeau ?'),
('CADEAUX ET SURPRISES', 'promo', 'Quelque chose de gratuit vous attend…'),
('CADEAUX ET SURPRISES', 'promo', 'Une petite surprise rien que pour vous !'),
('CADEAUX ET SURPRISES', 'promo', 'Vous aimez les cadeaux ? Alors cliquez !'),
('CADEAUX ET SURPRISES', 'promo', 'Votre fidélité pourrait vous surprendre !'),
('CADEAUX ET SURPRISES', 'promo', 'Un cadeau peut se cacher derrière ce clic…'),
('CADEAUX ET SURPRISES', 'promo', 'Aujourd''hui, on pense à vous !'),
('CADEAUX ET SURPRISES', 'promo', 'Votre prochaine commande réserve une surprise.'),
('CADEAUX ET SURPRISES', 'promo', 'Et si on vous faisait plaisir ?'),
('CADEAUX ET SURPRISES', 'promo', 'Ne ratez pas votre surprise du jour !'),
('URGENCE ET RARETE', 'promo', 'Dépêchez-vous, ça ne va pas durer !'),
('URGENCE ET RARETE', 'promo', 'Les bonnes occasions ne préviennent pas !'),
('URGENCE ET RARETE', 'promo', '⏰ Le temps joue contre vous…'),
('URGENCE ET RARETE', 'promo', 'Certains articles partent très vite !'),
('URGENCE ET RARETE', 'promo', 'Vous allez peut-être arriver trop tard…'),
('URGENCE ET RARETE', 'promo', 'Dernière occasion de profiter de cette offre !'),
('URGENCE ET RARETE', 'promo', 'Ne remettez pas à demain !'),
('URGENCE ET RARETE', 'promo', 'Ça pourrait disparaître aujourd''hui…'),
('URGENCE ET RARETE', 'promo', 'Votre article préféré est peut-être encore disponible !'),
('URGENCE ET RARETE', 'promo', 'Un petit clic avant qu''il ne soit trop tard !'),
('MODE ET ELEGANCE', 'any', 'Votre prochain look est juste ici !'),
('MODE ET ELEGANCE', 'any', 'Messieurs, quelque chose vous attend !'),
('MODE ET ELEGANCE', 'any', 'L''élégance n''attend pas !'),
('MODE ET ELEGANCE', 'any', 'Prêt à impressionner ?'),
('MODE ET ELEGANCE', 'any', 'Le style fait toute la différence !'),
('MODE ET ELEGANCE', 'any', 'Votre prochain ensemble est arrivé !'),
('MODE ET ELEGANCE', 'any', 'Un look qui attire les regards…'),
('MODE ET ELEGANCE', 'any', 'Découvrez ce que les hommes élégants choisissent !'),
('MODE ET ELEGANCE', 'any', 'Changez de style sans changer de personnalité.'),
('MODE ET ELEGANCE', 'any', 'Votre élégance mérite mieux !'),
('PERSONNALISATION ET EMOTION', 'any', 'On a pensé à vous aujourd''hui !'),
('PERSONNALISATION ET EMOTION', 'any', 'Vous méritez une petite attention.'),
('PERSONNALISATION ET EMOTION', 'any', 'Votre prochaine découverte vous attend !'),
('PERSONNALISATION ET EMOTION', 'any', 'Ça fait longtemps qu''on ne vous a pas surpris !'),
('PERSONNALISATION ET EMOTION', 'any', 'Revenez découvrir ce qui a changé…'),
('PERSONNALISATION ET EMOTION', 'any', 'Votre boutique préférée vous appelle !'),
('PERSONNALISATION ET EMOTION', 'any', 'On a quelque chose qui pourrait vous plaire.'),
('PERSONNALISATION ET EMOTION', 'any', 'Votre prochain achat pourrait vous étonner !'),
('PERSONNALISATION ET EMOTION', 'any', 'Une visite qui pourrait vous faire plaisir…'),
('PERSONNALISATION ET EMOTION', 'any', 'Vous nous avez manqué !'),
('MARKETING PSYCHOLOGIQUE', 'any', '9 personnes sur 10 aiment cette découverte !'),
('MARKETING PSYCHOLOGIQUE', 'any', 'Vous n''avez probablement jamais vu ce prix !'),
('MARKETING PSYCHOLOGIQUE', 'any', 'Ce détail pourrait changer votre choix…'),
('MARKETING PSYCHOLOGIQUE', 'any', 'Pourquoi tout le monde regarde cet article ?'),
('MARKETING PSYCHOLOGIQUE', 'any', 'Une découverte que vous allez raconter !'),
('MARKETING PSYCHOLOGIQUE', 'any', 'Le secret des hommes bien habillés…'),
('MARKETING PSYCHOLOGIQUE', 'any', 'Ce produit attire déjà les regards !'),
('MARKETING PSYCHOLOGIQUE', 'any', 'Vous comprendrez en cliquant…'),
('MARKETING PSYCHOLOGIQUE', 'any', 'Une découverte, plusieurs possibilités !'),
('MARKETING PSYCHOLOGIQUE', 'any', 'Attention, coup de cœur possible !'),
('DECOUVERTE ET ENGAGEMENT', 'new', 'Découvrez les nouveautés avant les autres !'),
('DECOUVERTE ET ENGAGEMENT', 'new', 'Votre prochaine trouvaille est ici !'),
('DECOUVERTE ET ENGAGEMENT', 'new', 'Cliquez, vous pourriez être surpris !'),
('DECOUVERTE ET ENGAGEMENT', 'new', 'Il y a du nouveau chez Albasse Shopping !'),
('DECOUVERTE ET ENGAGEMENT', 'new', 'Vous avez vu notre dernière collection ?'),
('DECOUVERTE ET ENGAGEMENT', 'new', 'Une nouvelle sélection vient d''arriver !'),
('DECOUVERTE ET ENGAGEMENT', 'new', 'Faites un tour, vous allez comprendre !'),
('DECOUVERTE ET ENGAGEMENT', 'new', 'Votre prochain favori est peut-être arrivé !'),
('DECOUVERTE ET ENGAGEMENT', 'new', 'Découvrez ce que vous avez manqué !'),
('DECOUVERTE ET ENGAGEMENT', 'new', 'Une visite de 30 secondes peut suffire !'),
('FIDELITE ET EXCLUSIVITE', 'any', 'Vous faites partie de nos privilégiés !'),
('FIDELITE ET EXCLUSIVITE', 'any', 'Une offre spéciale vous attend…'),
('FIDELITE ET EXCLUSIVITE', 'any', 'Les clients fidèles ont leurs avantages !'),
('FIDELITE ET EXCLUSIVITE', 'any', 'Votre prochain avantage est à découvrir !'),
('FIDELITE ET EXCLUSIVITE', 'any', 'Une surprise réservée à nos clients…'),
('FIDELITE ET EXCLUSIVITE', 'any', 'Votre fidélité a de la valeur !'),
('FIDELITE ET EXCLUSIVITE', 'any', 'Découvrez votre prochain privilège !'),
('FIDELITE ET EXCLUSIVITE', 'any', 'Les meilleures surprises commencent ici !'),
('FIDELITE ET EXCLUSIVITE', 'any', 'Vous avez peut-être un cadeau à réclamer !'),
('FIDELITE ET EXCLUSIVITE', 'any', 'Albasse Shopping a pensé à vous !'),
('MYSTERE QUI DONNE ENVIE DE CLIQUER', 'new', '🤫 On a quelque chose que vous allez adorer…'),
('MYSTERE QUI DONNE ENVIE DE CLIQUER', 'new', 'Vous devriez voir ce qui vous attend !'),
('MYSTERE QUI DONNE ENVIE DE CLIQUER', 'new', '😳 Cette surprise n''est pas un hasard…'),
('MYSTERE QUI DONNE ENVIE DE CLIQUER', 'new', 'Un petit secret vient d''être dévoilé !'),
('MYSTERE QUI DONNE ENVIE DE CLIQUER', 'new', 'Cliquez… vous comprendrez pourquoi !'),
('MYSTERE QUI DONNE ENVIE DE CLIQUER', 'new', 'On ne voulait pas vous le dire trop tôt…'),
('MYSTERE QUI DONNE ENVIE DE CLIQUER', 'new', 'Votre prochaine découverte est incroyable !'),
('MYSTERE QUI DONNE ENVIE DE CLIQUER', 'new', 'Il y a une raison de visiter notre boutique aujourd''hui…'),
('MYSTERE QUI DONNE ENVIE DE CLIQUER', 'new', 'Vous allez probablement nous remercier !'),
('MYSTERE QUI DONNE ENVIE DE CLIQUER', 'new', '👀 Ne restez pas sans découvrir ça !'),
('DECLENCHER L''ACHAT', 'any', 'Et si vous vous faisiez plaisir maintenant ?'),
('DECLENCHER L''ACHAT', 'any', 'Votre prochain achat vous attend !'),
('DECLENCHER L''ACHAT', 'any', 'Le style que vous cherchez est peut-être ici.'),
('DECLENCHER L''ACHAT', 'any', 'Ne laissez pas passer votre coup de cœur !'),
('DECLENCHER L''ACHAT', 'any', 'Une nouvelle raison de faire du shopping !'),
('DECLENCHER L''ACHAT', 'any', 'Vous avez le droit de vous faire plaisir !'),
('DECLENCHER L''ACHAT', 'any', 'Votre prochain look commence maintenant.'),
('DECLENCHER L''ACHAT', 'any', 'Aujourd''hui est un bon jour pour être élégant !'),
('DECLENCHER L''ACHAT', 'any', 'Faites-vous plaisir sans attendre !'),
('DECLENCHER L''ACHAT', 'any', 'Ce serait dommage de passer à côté !'),
('PROMOTIONS IRRESISTIBLES', 'promo', '🔥 Une offre vient de tomber !'),
('PROMOTIONS IRRESISTIBLES', 'promo', 'Vous allez aimer nos nouveaux prix !'),
('PROMOTIONS IRRESISTIBLES', 'promo', 'Votre budget va adorer cette surprise !'),
('PROMOTIONS IRRESISTIBLES', 'promo', 'Les prix ont décidé de vous faire plaisir !'),
('PROMOTIONS IRRESISTIBLES', 'promo', 'Une réduction vous attend peut-être…'),
('PROMOTIONS IRRESISTIBLES', 'promo', 'Aujourd''hui, achetez plus intelligemment !'),
('PROMOTIONS IRRESISTIBLES', 'promo', 'Découvrez les articles à prix réduits !'),
('PROMOTIONS IRRESISTIBLES', 'promo', 'Des économies vous attendent !'),
('PROMOTIONS IRRESISTIBLES', 'promo', 'Le bon moment pour acheter, c''est maintenant !'),
('PROMOTIONS IRRESISTIBLES', 'promo', 'Cliquez pour découvrir les offres du moment !'),
('CADEAUX ET RECOMPENSES', 'promo', '🎁 Vous pourriez repartir avec un cadeau !'),
('CADEAUX ET RECOMPENSES', 'promo', 'Et si votre commande vous rapportait plus ?'),
('CADEAUX ET RECOMPENSES', 'promo', 'Votre fidélité mérite une récompense !'),
('CADEAUX ET RECOMPENSES', 'promo', 'Un cadeau gratuit ? Découvrez comment !'),
('CADEAUX ET RECOMPENSES', 'promo', 'Votre prochaine surprise est à portée de clic !'),
('CADEAUX ET RECOMPENSES', 'promo', 'On aime gâter nos clients !'),
('CADEAUX ET RECOMPENSES', 'promo', 'Vous avez peut-être droit à un bonus !'),
('CADEAUX ET RECOMPENSES', 'promo', 'Acheter et recevoir une surprise ? Pourquoi pas !'),
('CADEAUX ET RECOMPENSES', 'promo', 'Votre prochain cadeau vous attend !'),
('CADEAUX ET RECOMPENSES', 'promo', 'Ne passez pas à côté de vos avantages !'),
('EXCLUSIVITE ET SENTIMENT VIP', 'any', '💎 Une surprise pour nos clients privilégiés !'),
('EXCLUSIVITE ET SENTIMENT VIP', 'any', 'Tout le monde n''a pas accès à cette offre…'),
('EXCLUSIVITE ET SENTIMENT VIP', 'any', 'Vous faites partie de nos clients spéciaux !'),
('EXCLUSIVITE ET SENTIMENT VIP', 'any', 'Découvrez vos privilèges chez Albasse Shopping.'),
('EXCLUSIVITE ET SENTIMENT VIP', 'any', 'Votre statut client vous réserve des avantages !'),
('EXCLUSIVITE ET SENTIMENT VIP', 'any', 'Une attention spéciale vous attend.'),
('EXCLUSIVITE ET SENTIMENT VIP', 'any', 'Les membres fidèles passent en premier !'),
('EXCLUSIVITE ET SENTIMENT VIP', 'any', 'Une offre à découvrir avant les autres !'),
('EXCLUSIVITE ET SENTIMENT VIP', 'any', 'Votre fidélité ouvre des portes !'),
('EXCLUSIVITE ET SENTIMENT VIP', 'any', 'Entrez dans le cercle des privilégiés !'),
('MODE MASCULINE ET SEDUCTION', 'any', 'Messieurs, votre prochain look est arrivé !'),
('MODE MASCULINE ET SEDUCTION', 'any', 'Une tenue qui ne passe pas inaperçue…'),
('MODE MASCULINE ET SEDUCTION', 'any', 'L''élégance attire toujours les regards !'),
('MODE MASCULINE ET SEDUCTION', 'any', 'Soyez l''homme qu''on remarque !'),
('MODE MASCULINE ET SEDUCTION', 'any', 'Votre style parle avant vous.'),
('MODE MASCULINE ET SEDUCTION', 'any', 'Une nouvelle collection vous attend !'),
('MODE MASCULINE ET SEDUCTION', 'any', 'Le détail qui fait toute la différence !'),
('MODE MASCULINE ET SEDUCTION', 'any', 'Le style commence par le bon choix.'),
('MODE MASCULINE ET SEDUCTION', 'any', 'Faites tourner les regards sans dire un mot !'),
('MODE MASCULINE ET SEDUCTION', 'any', 'Votre élégance mérite une mise à jour !'),
('PEUR DE MANQUER UNE OCCASION', 'promo', '🚨 Vous risquez de regretter cette occasion !'),
('PEUR DE MANQUER UNE OCCASION', 'promo', 'Certains articles ne resteront pas longtemps !'),
('PEUR DE MANQUER UNE OCCASION', 'promo', 'Plus vous attendez, plus vous risquez de manquer !'),
('PEUR DE MANQUER UNE OCCASION', 'promo', 'Ne laissez pas les autres choisir à votre place !'),
('PEUR DE MANQUER UNE OCCASION', 'promo', 'Une occasion peut disparaître en quelques heures !'),
('PEUR DE MANQUER UNE OCCASION', 'promo', 'Votre article préféré est-il encore disponible ?'),
('PEUR DE MANQUER UNE OCCASION', 'promo', 'Les bonnes affaires n''attendent personne !'),
('PEUR DE MANQUER UNE OCCASION', 'promo', 'C''est peut-être votre dernière chance !'),
('PEUR DE MANQUER UNE OCCASION', 'promo', 'Attention, les stocks peuvent diminuer !'),
('PEUR DE MANQUER UNE OCCASION', 'promo', 'Faites vite si cet article vous plaît !'),
('REACTIVATION DES ANCIENS CLIENTS', 'reactivation', 'Ça fait longtemps ! Une surprise vous attend…'),
('REACTIVATION DES ANCIENS CLIENTS', 'reactivation', 'Albasse Shopping a beaucoup changé !'),
('REACTIVATION DES ANCIENS CLIENTS', 'reactivation', 'Vous avez manqué quelques belles nouveautés !'),
('REACTIVATION DES ANCIENS CLIENTS', 'reactivation', 'Revenez voir ce qu''on vous a préparé !'),
('REACTIVATION DES ANCIENS CLIENTS', 'reactivation', 'Votre boutique préférée vous réserve du nouveau.'),
('REACTIVATION DES ANCIENS CLIENTS', 'reactivation', 'On a hâte de vous retrouver !'),
('REACTIVATION DES ANCIENS CLIENTS', 'reactivation', 'Et si on reprenait nos bonnes habitudes ?'),
('REACTIVATION DES ANCIENS CLIENTS', 'reactivation', 'Une nouvelle visite, une nouvelle découverte !'),
('REACTIVATION DES ANCIENS CLIENTS', 'reactivation', 'Vous souvenez-vous de votre dernier coup de cœur ?'),
('REACTIVATION DES ANCIENS CLIENTS', 'reactivation', 'Il est temps de revenir nous voir !'),
('PARFUMS MONTRES ET ACCESSOIRES', 'new', '🌹 Votre prochaine signature olfactive est ici !'),
('PARFUMS MONTRES ET ACCESSOIRES', 'new', 'Un parfum qui laisse un souvenir…'),
('PARFUMS MONTRES ET ACCESSOIRES', 'new', 'Votre élégance mérite une belle montre !'),
('PARFUMS MONTRES ET ACCESSOIRES', 'new', 'Le détail qui révèle votre personnalité.'),
('PARFUMS MONTRES ET ACCESSOIRES', 'new', 'Découvrez des parfums qui marquent les esprits !'),
('PARFUMS MONTRES ET ACCESSOIRES', 'new', 'Votre prochain parfum préféré vous attend.'),
('PARFUMS MONTRES ET ACCESSOIRES', 'new', 'Une montre peut tout changer !'),
('PARFUMS MONTRES ET ACCESSOIRES', 'new', 'Le luxe commence parfois par un détail.'),
('PARFUMS MONTRES ET ACCESSOIRES', 'new', 'Faites-vous remarquer sans parler !'),
('PARFUMS MONTRES ET ACCESSOIRES', 'new', 'Une découverte parfumée vous attend !'),
('INCITER A VISITER LE SITE', 'any', 'Votre boutique est ouverte, venez découvrir !'),
('INCITER A VISITER LE SITE', 'any', '30 secondes pour découvrir quelque chose de nouveau !'),
('INCITER A VISITER LE SITE', 'any', 'Vous n''avez pas encore vu nos nouveautés ?'),
('INCITER A VISITER LE SITE', 'any', 'Un petit tour sur notre site ?'),
('INCITER A VISITER LE SITE', 'any', 'Votre prochain coup de cœur est à un clic !'),
('INCITER A VISITER LE SITE', 'any', 'Cliquez maintenant, la surprise vous attend !'),
('INCITER A VISITER LE SITE', 'any', 'Découvrez les articles que vous avez manqués !'),
('INCITER A VISITER LE SITE', 'any', 'Une nouvelle expérience shopping vous attend !'),
('INCITER A VISITER LE SITE', 'any', 'Il se passe quelque chose chez Albasse Shopping…'),
('INCITER A VISITER LE SITE', 'any', '❤️ Votre prochain bonheur commence par un clic !');

-- Choisit une accroche : parmi les categories qui conviennent au type (new/promo/any), en
-- evitant la derniere categorie utilisee quand une autre option existe.
create or replace function public.pick_push_hook(p_kind text)
returns table(category text, line text)
language plpgsql
security definer
set search_path = public
as $$
declare
  last_cat text;
begin
  select pn.hook_category into last_cat
    from product_notifications pn
    where pn.hook_category is not null
    order by pn.created_at desc
    limit 1;

  return query
    select x.category, x.text from (
      select h.category, h.text, row_number() over (order by random()) as rn
      from push_hook_lines h
      where (h.kind_hint = p_kind or h.kind_hint = 'any')
        and (last_cat is null or h.category <> last_cat)
    ) x where x.rn = 1
    union all
    select y.category, y.text from (
      select h.category, h.text, row_number() over (order by random()) as rn
      from push_hook_lines h
      where h.kind_hint = p_kind or h.kind_hint = 'any'
    ) y where y.rn = 1
    limit 1;
end;
$$;

revoke all on function public.pick_push_hook(text) from public, anon, authenticated;

-- 5. Le gardien : envoie UNE notification au plus par passage (p_now : l'heure a laquelle on
-- regarde, pour les tests). Seul changement par rapport a add-push-gate.sql : le titre des
-- envois automatiques vient maintenant de pick_push_hook() au lieu d'un texte fige, et la
-- categorie choisie est enregistree (hook_category) pour alterner la prochaine fois.
create or replace function public.run_push_gate(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  gate_on boolean;
  new_on boolean;
  gap_min integer;
  per_day integer;
  w_start integer;
  w_end integer;
  chad_hour integer := extract(hour from (p_now at time zone 'Africa/Ndjamena'))::integer;
  day_start timestamptz := date_trunc('day', p_now at time zone 'Africa/Ndjamena') at time zone 'Africa/Ndjamena';
  last_push timestamptz;
  today_n integer;
  subs integer;
  sp record;
  best record;
  pick text;
  waiting integer;
  t text;
  m text;
  hook_cat text;
  hook_line text;
  sent_n integer := 0;
begin
  if not pg_try_advisory_xact_lock(hashtext('albasse-push-gate')) then
    return 0;
  end if;

  select push_gate_enabled, push_min_gap_minutes, push_max_per_day, push_window_start, push_window_end, push_new_products_enabled
    into gate_on, gap_min, per_day, w_start, w_end, new_on from store_settings where id = 1;
  gate_on := coalesce(gate_on, true);
  new_on := coalesce(new_on, false);
  gap_min := coalesce(gap_min, 180);
  per_day := coalesce(per_day, 2);
  w_start := coalesce(w_start, 9);
  w_end := coalesce(w_end, 20);
  if w_end <= w_start then w_start := 9; w_end := 20; end if;

  select count(*) into subs from web_push_subscriptions;

  -- Interrupteur « nouveaux articles » éteint : ceux qui attendaient encore dans la file ne partiront jamais
  if not new_on then
    update push_outbox set status = 'expired', note = 'nouveaux articles désactivés' where status = 'pending' and kind = 'new';
  end if;

  -- Gardien éteint : comme avant, tout ce qui attend part tout de suite (une ligne = une notification)
  if not gate_on then
    update scheduled_pushes set status = 'expired' where status = 'pending' and send_at < p_now - interval '6 hours';
    for sp in select * from scheduled_pushes where status = 'pending' and send_at <= p_now order by send_at limit 20 for update skip locked loop
      insert into product_notifications (product_id, title, message, created_at) values (sp.product_id, sp.title, sp.message, p_now);
      update scheduled_pushes set status = 'sent', sent_at = p_now, recipients = subs where id = sp.id;
      sent_n := sent_n + 1;
    end loop;
    for sp in select * from push_outbox where status = 'pending' order by created_at limit 20 for update skip locked loop
      insert into product_notifications (product_id, title, message, created_at) values (sp.product_id, sp.title, sp.message, p_now);
      update push_outbox set status = 'sent', sent_at = p_now, note = 'envoyée sans gardien' where id = sp.id;
      sent_n := sent_n + 1;
    end loop;
    return sent_n;
  end if;

  -- Ce qui n'a plus de sens n'est jamais annoncé
  update push_outbox set status = 'expired', note = 'trop ancienne (plus de 24 h)' where status = 'pending' and created_at < p_now - interval '24 hours';
  update scheduled_pushes set status = 'expired' where status = 'pending' and send_at < p_now - interval '24 hours';
  update push_outbox o set status = 'expired', note = 'article indisponible'
    from products p where o.product_id = p.id and o.status = 'pending' and (not coalesce(p.is_active, false) or coalesce(p.stock, 1) <= 0);
  update push_outbox o set status = 'expired', note = 'promotion terminée'
    from products p where o.product_id = p.id and o.status = 'pending' and o.kind = 'promo' and not coalesce(p.is_flash_sale, false);
  update scheduled_pushes s set status = 'expired'
    from products p where s.product_id = p.id and s.status = 'pending' and s.send_at <= p_now and (not coalesce(p.is_active, false) or coalesce(p.stock, 1) <= 0);

  -- Jamais deux notifications trop proches : on regarde la dernière qui est vraiment partie
  select max(created_at) into last_push from product_notifications where created_at <= p_now;
  if last_push is not null and last_push > p_now - make_interval(mins => gap_min) then
    return 0;
  end if;

  -- 1) Les notifications programmées par l'administrateur : à l'heure qu'il a choisie, passent avant tout
  select * into sp from scheduled_pushes where status = 'pending' and send_at <= p_now order by send_at limit 1 for update skip locked;
  if found then
    insert into product_notifications (product_id, title, message, created_at) values (sp.product_id, sp.title, sp.message, p_now);
    update scheduled_pushes set status = 'sent', sent_at = p_now, recipients = subs where id = sp.id;
    return 1;
  end if;

  -- 2) Les automatiques : fenêtre d'envoi, plafond du jour, bonne heure
  if chad_hour < w_start or chad_hour >= w_end then
    return 0;
  end if;
  select count(*) into today_n from product_notifications where created_at >= day_start and created_at <= p_now;
  if today_n >= per_day then
    return 0;
  end if;
  if not (chad_hour = any (public.push_good_hours(w_start, w_end, p_now))) then
    return 0;
  end if;

  -- les promotions d'abord, puis les nouveaux articles
  select kind into pick from push_outbox where status = 'pending' order by (kind = 'promo') desc limit 1;
  if pick is null then
    return 0;
  end if;
  select count(*) into waiting from push_outbox where status = 'pending' and kind = pick;
  if waiting = 0 then
    return 0;
  end if;
  -- l'article le plus regardé ces 7 jours passe en premier (à égalité : le plus récent)
  select o.id, o.product_id, o.title, o.message, p.name
    into best
    from push_outbox o join products p on p.id = o.product_id
    where o.status = 'pending' and o.kind = pick
    order by (select coalesce(sum(v.views), 0) from visitor_product_interest v where v.product_id = o.product_id::text and v.last_viewed_at > p_now - interval '7 days') desc,
             o.created_at desc
    limit 1;
  if best.id is null then
    return 0;
  end if;

  -- Accroche choisie dans la bibliotheque (bibliotheque fournie par l'admin, alternance des
  -- categories) ; le fait reel (nom, prix, nombre d'articles) reste toujours dans le message.
  select category, line into hook_cat, hook_line from public.pick_push_hook(pick);

  if waiting = 1 then
    t := coalesce(hook_line, best.title);
    m := best.message;
  elsif pick = 'promo' then
    t := coalesce(hook_line, '🔥 ' || waiting || ' promotions en cours');
    m := best.name || ' et ' || (waiting - 1) || case when waiting = 2 then ' autre article' else ' autres articles' end || ' en vente flash';
  else
    t := coalesce(hook_line, '🛍️ ' || waiting || ' nouveaux articles');
    m := best.name || ' et ' || (waiting - 1) || case when waiting = 2 then ' autre article' else ' autres articles' end || ' à découvrir';
  end if;
  insert into product_notifications (product_id, title, message, hook_category, created_at) values (best.product_id, t, m, hook_cat, p_now);
  update push_outbox set status = case when id = best.id then 'sent' else 'merged' end,
                         sent_at = p_now,
                         note = case when waiting = 1 then 'envoyée' when id = best.id then 'envoyée avec ' || (waiting - 1) || ' autre(s)' else 'regroupée dans une seule notification' end
    where status = 'pending' and kind = pick;
  return 1;
end;
$$;

revoke all on function public.run_push_gate(timestamptz) from public, anon, authenticated;
