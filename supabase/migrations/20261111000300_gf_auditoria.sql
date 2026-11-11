-- =====================================================================
-- Gestão Financeira — trilha de auditoria (quem alterou o quê e quando)
-- Criada depois da carga inicial para não poluir o histórico.
-- =====================================================================
create or replace function public.gf_auditar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row   jsonb;
  v_email text;
  v_emp   uuid;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  select p.email into v_email from public.gf_perfis p where p.id = auth.uid();
  if tg_table_name = 'gf_empresas' then
    v_emp := (v_row ->> 'id')::uuid;
  elsif v_row ? 'empresa_id' then
    v_emp := nullif(v_row ->> 'empresa_id', '')::uuid;
  end if;
  insert into public.gf_auditoria (tabela, acao, registro_id, empresa_id, usuario_id, usuario_email, dados, dados_anteriores)
  values (tg_table_name, lower(tg_op), v_row ->> 'id', v_emp, auth.uid(), v_email, v_row,
          case when tg_op = 'UPDATE' then to_jsonb(old) end);
  return coalesce(new, old);
end $$;

revoke execute on function public.gf_auditar() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['gf_empresas','gf_contratos','gf_orcamentos','gf_previsoes','gf_medicoes','gf_pendencias'] loop
    execute format('drop trigger if exists %I_auditoria on public.%I', t, t);
    execute format('create trigger %I_auditoria after insert or update or delete on public.%I for each row execute function public.gf_auditar()', t, t);
  end loop;
end $$;
