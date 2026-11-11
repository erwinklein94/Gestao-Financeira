-- O papel interno admin passa a ser apresentado como Coordenador.
-- Mantém as permissões operacionais existentes, exceto acessos e auditoria.
create schema if not exists gf_private;
revoke all on schema gf_private from public, anon;
grant usage on schema gf_private to authenticated;

create or replace function public.gf_is_editor()
returns boolean language sql stable security invoker set search_path = '' as $$
  select coalesce(public.gf_papel() = 'editor', false)
$$;
revoke all on function public.gf_is_editor() from public, anon;
grant execute on function public.gf_is_editor() to authenticated;

drop policy gf_acessos_select on public.gf_acessos;
drop policy gf_acessos_insert on public.gf_acessos;
drop policy gf_acessos_update on public.gf_acessos;
drop policy gf_acessos_delete on public.gf_acessos;
create policy gf_acessos_select on public.gf_acessos for select to authenticated
  using ((select public.gf_is_editor()));
create policy gf_acessos_insert on public.gf_acessos for insert to authenticated
  with check ((select public.gf_is_editor()) and criado_por = (select auth.uid()));
create policy gf_acessos_update on public.gf_acessos for update to authenticated
  using ((select public.gf_is_editor()) and email <> lower((select auth.jwt())->>'email'))
  with check ((select public.gf_is_editor()) and email <> lower((select auth.jwt())->>'email'));
create policy gf_acessos_delete on public.gf_acessos for delete to authenticated
  using ((select public.gf_is_editor()) and email <> lower((select auth.jwt())->>'email'));
-- E-mail e autor são imutáveis na gestão de acessos.
revoke update on public.gf_acessos from authenticated;
grant update(nome, cargo, papel, ativo) on public.gf_acessos to authenticated;

drop policy gf_perfis_select on public.gf_perfis;
create policy gf_perfis_select on public.gf_perfis for select to authenticated
  using (id = (select auth.uid()) or (select public.gf_is_editor()));

alter table public.gf_auditoria add column usuario_papel text;
-- Não inferir papéis passados a partir do papel atual: antigos ficam desconhecidos.
drop policy gf_auditoria_select on public.gf_auditoria;
create policy gf_auditoria_select on public.gf_auditoria for select to authenticated
  using ((select public.gf_is_editor()) and (usuario_papel is null or usuario_papel <> 'editor'));
revoke insert, update, delete on public.gf_auditoria from authenticated;
create index gf_auditoria_paginacao_idx on public.gf_auditoria(created_at desc, id desc);

-- Trigger privado: o cliente nunca fornece ator, horário ou imagens das alterações.
create or replace function gf_private.auditar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb;
  v_old jsonb;
  v_email text;
  v_papel text;
  v_emp uuid;
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  v_papel := public.gf_papel();
  select email into v_email from public.gf_perfis where id = auth.uid();
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_old := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  if tg_op = 'UPDATE' and (v_row - 'updated_at' - 'ultimo_acesso') = (v_old - 'updated_at' - 'ultimo_acesso') then
    return new;
  end if;
  if tg_table_name = 'gf_empresas' then v_emp := (v_row->>'id')::uuid;
  elsif v_row ? 'empresa_id' then v_emp := (v_row->>'empresa_id')::uuid; end if;
  insert into public.gf_auditoria(tabela, acao, registro_id, empresa_id, usuario_id, usuario_email, usuario_papel, dados, dados_anteriores)
  values (tg_table_name, lower(tg_op), coalesce(v_row->>'id',v_row->>'email',v_row->>'codigo'), v_emp, auth.uid(), v_email, v_papel, v_row, v_old);
  return coalesce(new, old);
end $$;
revoke all on function gf_private.auditar() from public, anon, authenticated;
do $$ declare t text; begin
  foreach t in array array['gf_empresas','gf_contratos','gf_orcamentos','gf_previsoes','gf_medicoes','gf_pendencias','gf_medicao_itens','gf_servicos','gf_perfis','gf_acessos'] loop
    execute format('drop trigger if exists %I_auditoria on public.%I',t,t);
    execute format('create trigger %I_auditoria after insert or update or delete on public.%I for each row execute function gf_private.auditar()',t,t);
  end loop;
end $$;

-- Atualiza imediatamente perfis já existentes ao liberar, bloquear ou trocar papel.
create function gf_private.sincronizar_acesso()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.gf_is_editor() then raise exception 'Acesso exclusivo do editor'; end if;
  if tg_op = 'DELETE' then
    update public.gf_perfis set ativo = false where email = old.email;
  else
    update public.gf_perfis set papel = new.papel, ativo = new.ativo where email = new.email;
  end if;
  return coalesce(new, old);
end $$;
revoke all on function gf_private.sincronizar_acesso() from public, anon, authenticated;
create trigger gf_acessos_sincronizar after insert or update or delete on public.gf_acessos
  for each row execute function gf_private.sincronizar_acesso();

-- Entrada controlada de eventos de interface; sem senha, tokens ou dados livres.
create function gf_private.registrar_atividade(p_acao text, p_pagina text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_papel text; v_email text;
begin
  v_papel := public.gf_papel();
  if auth.uid() is null or v_papel is null then raise exception 'Acesso negado'; end if;
  if p_acao is null or p_acao not in ('acesso','pagina','saida','exportacao','senha') then raise exception 'Ação inválida'; end if;
  if p_pagina is null or length(p_pagina) > 180 or p_pagina !~ '^#/(painel|perfil|auditoria|catalogo|empresa/[a-zA-Z0-9_-]+(/(dashboard|registros)(/[a-zA-Z0-9_-]+)?)?)$' then
    raise exception 'Página inválida';
  end if;
  select email into v_email from public.gf_perfis where id = auth.uid();
  if p_acao = 'acesso' then update public.gf_perfis set ultimo_acesso = clock_timestamp() where id = auth.uid(); end if;
  insert into public.gf_auditoria(tabela,acao,usuario_id,usuario_email,usuario_papel,dados)
  values('site',p_acao,auth.uid(),v_email,v_papel,jsonb_build_object('pagina',p_pagina));
end $$;
revoke all on function gf_private.registrar_atividade(text,text) from public, anon;
grant execute on function gf_private.registrar_atividade(text,text) to authenticated;
create function public.gf_registrar_atividade(p_acao text, p_pagina text)
returns void language sql security invoker set search_path = '' as $$
  select gf_private.registrar_atividade(p_acao,p_pagina)
$$;
revoke all on function public.gf_registrar_atividade(text,text) from public, anon;
grant execute on function public.gf_registrar_atividade(text,text) to authenticated;

create function public.gf_auditoria_pessoas()
returns table(id uuid,email text,nome text,papel text,ativo boolean,ultimo_acesso timestamptz)
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.gf_is_editor() then raise exception 'Acesso exclusivo do editor'; end if;
  return query select p.id, coalesce(a.email,p.email),coalesce(p.nome,a.nome),coalesce(a.papel,p.papel),
    coalesce(a.ativo,false) and coalesce(p.ativo,true),p.ultimo_acesso
    from public.gf_acessos a full join public.gf_perfis p on p.email=a.email
    where coalesce(a.papel,p.papel) <> 'editor'
    order by coalesce(p.nome,a.nome,a.email,p.email);
end $$;
revoke all on function public.gf_auditoria_pessoas() from public, anon;
grant execute on function public.gf_auditoria_pessoas() to authenticated;
