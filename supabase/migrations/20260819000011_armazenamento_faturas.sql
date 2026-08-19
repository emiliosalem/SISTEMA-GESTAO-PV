-- bucket privado para os pdfs/fotos de fatura enviados na conferência.
-- storage.objects já vem com row level security ativa por padrão no supabase.

insert into storage.buckets (id, name, public)
values ('faturas', 'faturas', false)
on conflict (id) do nothing;

create policy "usuario_interno_le_faturas_armazenadas"
  on storage.objects for select
  using (bucket_id = 'faturas' and e_usuario_interno_ativo());

create policy "usuario_interno_grava_faturas_armazenadas"
  on storage.objects for insert
  with check (bucket_id = 'faturas' and e_usuario_interno_ativo());

create policy "usuario_interno_atualiza_faturas_armazenadas"
  on storage.objects for update
  using (bucket_id = 'faturas' and e_usuario_interno_ativo())
  with check (bucket_id = 'faturas' and e_usuario_interno_ativo());

create policy "usuario_interno_apaga_faturas_armazenadas"
  on storage.objects for delete
  using (bucket_id = 'faturas' and e_usuario_interno_ativo());
