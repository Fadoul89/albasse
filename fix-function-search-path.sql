-- Sécurité (avis Supabase « Function Search Path Mutable ») : 8 fonctions reçoivent un chemin de recherche fixe.
-- Sans cela, une fonction pourrait, en théorie, utiliser une table piégée créée ailleurs avec le même nom.
-- Aucun changement de comportement : c'est le chemin qu'elles utilisaient déjà (public, puis extensions). Relançable.
alter function public.handle_new_user() set search_path = public, extensions;
alter function public.push_notify_product_notification() set search_path = public, extensions;
alter function public.assistant_device_label(text) set search_path = public, extensions;
alter function public.browsing_int(text, integer) set search_path = public, extensions;
alter function public.auto_restock_on_zero() set search_path = public, extensions;
alter function public.marketing_ai_guard() set search_path = public, extensions;
alter function public.zara_real_discount(numeric, numeric) set search_path = public, extensions;
alter function public.scheduled_pushes_touch_status() set search_path = public, extensions;
