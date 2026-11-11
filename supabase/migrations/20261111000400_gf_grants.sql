-- Projetos novos do Supabase não concedem privilégios automáticos às tabelas.
-- O acesso efetivo continua controlado pelas políticas RLS.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.gf_empresas, public.gf_contratos, public.gf_orcamentos,
  public.gf_previsoes, public.gf_medicoes, public.gf_pendencias, public.gf_servicos, public.gf_acessos to authenticated;
grant select on public.gf_auditoria to authenticated;
grant select on public.gf_perfis to authenticated;
grant update (nome, cargo, area, telefone, localidade, preferencias) on public.gf_perfis to authenticated;
