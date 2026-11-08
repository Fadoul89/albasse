// Fonction « admin-client-account » : la suite des étapes, sans Deno ni réseau (les accès à la base et à la connexion Supabase sont passés en `deps`).
// Testée avec de FAUX accès : tests/account/admin-client-account.test.ts. index.ts branche les vrais.
import { checkNewLogin, closedEmail, confirmWord, formatClientNumber, isLoginTaken, loginKindOf, prettyPhone, randomSecret, type Request } from "./rules.ts";

export interface Target {
  id: string;
  email: string; // profiles.email (peut être l'adresse tirée du numéro, ou le vrai e-mail de contact)
  is_admin: boolean;
  client_number: number | null;
  phone: string | null;
  whatsapp_number: string | null;
}
export interface Deps {
  getTarget(id: string): Promise<Target | null>;
  getLoginEmail(id: string): Promise<string | null>; // auth.users.email
  ordersCount(id: string): Promise<number>;
  updateAuth(id: string, attrs: Record<string, unknown>): Promise<{ message: string } | null>; // null = réussi
  deleteAuth(id: string): Promise<{ message: string } | null>;
  updateProfile(id: string, patch: Record<string, unknown>): Promise<{ message: string } | null>;
  addSanction(userId: string, reason: string, adminId: string): Promise<void>;
  log(entry: { admin_id: string; target_id: string; client_number: number | null; action: string; detail: string }): Promise<void>;
}
export type Result = { ok: true; detail: string; login?: string } | { ok: false; reason: string };

const digitsOf = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

export async function run(deps: Deps, adminId: string, req: Request): Promise<Result> {
  const target = await deps.getTarget(req.userId);
  if (!target) return { ok: false, reason: "not_found" };
  if (target.is_admin) return { ok: false, reason: "is_admin" };
  if (req.userId === adminId) return { ok: false, reason: "is_admin" };
  const login = await deps.getLoginEmail(req.userId);
  if (!login) return { ok: false, reason: "not_found" };
  const kind = loginKindOf(login);

  if (req.action === "change_login") {
    const check = checkNewLogin(kind, req.value, login);
    if (!check.ok) return { ok: false, reason: check.reason };
    const err = await deps.updateAuth(req.userId, { email: check.login, email_confirm: true });
    if (err) return { ok: false, reason: isLoginTaken(err.message) ? "login_taken" : "auth_error" };
    // la fiche suit la connexion
    const patch: Record<string, unknown> = {};
    if (kind === "phone" && check.digits) {
      const oldDigits = digitsOf(login.split("@")[0]);
      patch.phone = prettyPhone(check.digits);
      // le WhatsApp suivait le téléphone (inscription) : il le suit encore ; un WhatsApp différent reste
      if (!target.whatsapp_number || digitsOf(target.whatsapp_number).slice(-8) === oldDigits.slice(-8)) patch.whatsapp_number = prettyPhone(check.digits);
      // pas de vrai e-mail de contact : la fiche garde l'adresse tirée du numéro
      if (loginKindOf(target.email) === "phone") patch.email = check.login;
    } else if (kind === "email") {
      patch.email = check.login;
    }
    const perr = await deps.updateProfile(req.userId, patch);
    const detail = kind === "phone" ? "connexion changée (numéro de téléphone)" : "connexion changée (e-mail)";
    await deps.log({ admin_id: adminId, target_id: req.userId, client_number: target.client_number, action: "change_login", detail: perr ? `${detail} ; fiche à corriger à la main` : detail });
    return { ok: true, detail, login: check.login };
  }

  if (req.action === "close") {
    if (kind === "closed") return { ok: false, reason: "already_closed" };
    if (req.confirm.toUpperCase() !== "FERMER") return { ok: false, reason: "bad_confirm" };
    const closed = closedEmail(target.client_number, req.userId);
    const err = await deps.updateAuth(req.userId, { email: closed, email_confirm: true, password: randomSecret(), ban_duration: "876000h" });
    if (err) return { ok: false, reason: "auth_error" };
    const perr = await deps.updateProfile(req.userId, {
      email: closed,
      full_name: "Compte fermé",
      phone: null,
      whatsapp_number: null,
      region: null,
      address: null,
      profession: null,
      avatar_url: null,
      gender: null,
      birth_date: null,
      marital_status: null,
      banned: true,
      notify_new_products: false,
      notify_promotions: false,
      notify_flash_sale: false,
      telegram_chat_id: null,
    });
    await deps.addSanction(req.userId, "Compte fermé" + (req.reason ? ` : ${req.reason}` : ""), adminId).catch(() => {});
    const detail = "compte fermé" + (req.reason ? ` : ${req.reason}` : "");
    await deps.log({ admin_id: adminId, target_id: req.userId, client_number: target.client_number, action: "close", detail: perr ? `${detail} ; fiche à effacer à la main` : detail });
    return { ok: true, detail };
  }

  // delete
  if ((await deps.ordersCount(req.userId)) > 0) return { ok: false, reason: "has_orders" };
  if (req.confirm.toUpperCase() !== confirmWord(target.client_number, req.userId).toUpperCase()) return { ok: false, reason: "bad_confirm" };
  const err = await deps.deleteAuth(req.userId);
  if (err) return { ok: false, reason: "auth_error" };
  const detail = "compte supprimé pour de bon (aucune commande)";
  await deps.log({ admin_id: adminId, target_id: req.userId, client_number: target.client_number, action: "delete", detail });
  return { ok: true, detail };
}
export { formatClientNumber };
