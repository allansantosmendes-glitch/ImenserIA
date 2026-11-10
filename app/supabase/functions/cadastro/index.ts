// Saúde em Campo — cadastro de contas.
// Contas só são criadas aqui: pelo link de cadastro gerado por um administrador,
// ou no primeiro acesso do administrador (e-mail guardado como SHA-256 na tabela config).
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const PAPEIS = ["Médico(a)", "Missionário(a)", "Voluntário(a)"];
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Método não permitido." }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ erro: "Pedido inválido." }, 400); }
  const acao = String(body.acao ?? "");

  async function lerConvite(token: string) {
    if (!UUID.test(token)) return { status: "invalido" as const };
    const { data } = await db.from("convites").select("token, cancelado, usado_em, expira_em").eq("token", token).maybeSingle();
    if (!data) return { status: "invalido" as const };
    if (data.cancelado) return { status: "cancelado" as const };
    if (data.usado_em) return { status: "usado" as const };
    if (new Date(data.expira_em) < new Date()) return { status: "expirado" as const };
    return { status: "ok" as const };
  }

  if (acao === "validar") {
    return json(await lerConvite(String(body.token ?? "")));
  }

  if (acao !== "cadastrar" && acao !== "admin") return json({ erro: "Ação inválida." }, 400);

  const nome = String(body.nome ?? "").trim().replace(/\s+/g, " ");
  const email = String(body.email ?? "").trim().toLowerCase();
  const papel = String(body.papel ?? "");
  const senha = String(body.senha ?? "");
  if (nome.split(" ").length < 2 || nome.length > 120) return json({ erro: "Escreva o nome completo (nome e sobrenome)." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) return json({ erro: "Escreva um e-mail válido." }, 400);
  if (!PAPEIS.includes(papel)) return json({ erro: "Escolha a função: médico, missionário ou voluntário." }, 400);
  if (senha.length < 6 || senha.length > 72) return json({ erro: "A senha precisa ter entre 6 e 72 caracteres." }, 400);

  let token: string | null = null;
  let admin = false;

  if (acao === "admin") {
    if (!(await ehEmailAdmin(email))) return json({ erro: "Este e-mail não é o do administrador." }, 403);
    const { count } = await db.from("perfis").select("id", { count: "exact", head: true }).eq("admin", true);
    if ((count ?? 0) > 0) return json({ erro: "O administrador já foi cadastrado. Entre com seu e-mail e senha." }, 409);
    admin = true;
  } else {
    token = String(body.token ?? "");
    const c = await lerConvite(token);
    if (c.status !== "ok") return json({ erro: mensagemConvite(c.status), status: c.status }, 400);
    // Reserva o link antes de criar a conta, para ele não ser usado duas vezes.
    const { data: reservado } = await db.from("convites").update({ usado_em: new Date().toISOString() })
      .eq("token", token).is("usado_em", null).eq("cancelado", false).select("token");
    if (!reservado || reservado.length === 0) return json({ erro: mensagemConvite("usado"), status: "usado" }, 400);
  }

  const { data: criado, error } = await db.auth.admin.createUser({
    email, password: senha, email_confirm: true, user_metadata: { nome },
  });
  if (error || !criado.user) {
    if (token) await db.from("convites").update({ usado_em: null }).eq("token", token);
    const jaExiste = /already|registered|exists/i.test(error?.message ?? "");
    return json({ erro: jaExiste ? "Já existe uma conta com esse e-mail. Entre com seu e-mail e senha." : "Não foi possível criar a conta. Tente de novo." }, jaExiste ? 409 : 500);
  }

  const { error: erroPerfil } = await db.from("perfis").insert({ id: criado.user.id, nome, email, papel, admin });
  if (erroPerfil) {
    await db.auth.admin.deleteUser(criado.user.id);
    if (token) await db.from("convites").update({ usado_em: null }).eq("token", token);
    return json({ erro: "Não foi possível salvar o cadastro. Tente de novo." }, 500);
  }
  if (token) await db.from("convites").update({ usado_por: criado.user.id }).eq("token", token);
  return json({ ok: true });
});

// O e-mail do administrador fica no segredo ADMIN_EMAIL ou, como SHA-256, na tabela config.
async function ehEmailAdmin(email: string) {
  const env = (Deno.env.get("ADMIN_EMAIL") ?? "").trim().toLowerCase();
  if (env) return email === env;
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data } = await db.from("config").select("valor").eq("chave", "admin_email_sha256").maybeSingle();
  if (!data) return false;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email));
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === data.valor;
}

function mensagemConvite(s: string) {
  return {
    invalido: "Este link de cadastro é inválido. Peça um novo link ao administrador.",
    cancelado: "Este link foi cancelado pelo administrador. Peça um novo.",
    usado: "Este link já foi usado para um cadastro. Entre com seu e-mail e senha.",
    expirado: "Este link expirou. Peça um novo link ao administrador.",
  }[s] ?? "Link de cadastro inválido.";
}
