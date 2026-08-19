// provisiona um usuário interno (atendente ou técnico).
// não existe tela de autoatendimento porque enable_signup fica desligado
// (config.toml) -- só admin, com a chave de serviço, cria acesso.
//
// uso: npm run criar-usuario -- <email> <senha> "<nome>" <atendente|tecnico>

import { createClient } from "@supabase/supabase-js";

const [email, senha, nome, perfil] = process.argv.slice(2);

if (!email || !senha || !nome || !perfil) {
  console.error(
    'uso: npm run criar-usuario -- <email> <senha> "<nome>" <atendente|tecnico>'
  );
  process.exit(1);
}

if (perfil !== "atendente" && perfil !== "tecnico") {
  console.error("perfil precisa ser atendente ou tecnico");
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !chaveServico) {
  console.error(
    "defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente antes de rodar este script"
  );
  process.exit(1);
}

const supabaseAdmin = createClient(url, chaveServico, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });

  if (error || !data.user) {
    console.error("falha ao criar usuário de autenticação:", error?.message);
    process.exit(1);
  }

  const { error: erroPerfil } = await supabaseAdmin.from("usuario_perfil").insert({
    id: data.user.id,
    nome,
    perfil,
    ativo: true,
  });

  if (erroPerfil) {
    console.error("usuário criado, mas falhou ao gravar o perfil:", erroPerfil.message);
    process.exit(1);
  }

  console.log(`usuário criado: ${email} (${perfil})`);
}

main();
