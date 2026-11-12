-- Editor administra auditoria/perfis; não recebe o acervo financeiro complementar.
alter policy fontes_leitura on public.gf_fontes_medicao
  using ((select public.gf_papel()) in ('admin','leitor'));
