# Gestão Financeira

Sistema web para a coordenação organizar e administrar a gestão financeira dos contratos das empresas prestadoras de serviços na ferrovia.

Controla o **orçamento programado** (anual e mensal, separado em **CAPEX** e **OPEX**), as **previsões (forecast)**, as **medições realizadas**, os **contratos** e as **pendências**, e transforma tudo em painéis gerenciais com projeção até dezembro e a **margem mensal** que ainda pode ser gasta sem estourar o orçamento.

## Páginas

| Página | O que tem |
|---|---|
| **Painel geral** | Resumo de todas as empresas: orçamento × realizado × projeção, consumo do orçamento, curva acumulada, quanto ainda pode gastar por mês (por empresa e CAPEX/OPEX), projeção mês a mês até dezembro, saldo projetado, mapa de calor, saúde dos contratos e alertas gerenciais. |
| **Empresa → Dashboard** | KPIs da empresa, gastos mensais previstos × reais, aderência ao forecast, curva acumulada, CAPEX × OPEX, contratos (consumo, saldo SAP, cobertura do saldo), medições por status, pendências e detalhamento mensal. |
| **Empresa → Registros** | Abas de **Medições** (realizado), **Previsões** (grade contrato × mês), **Orçamento** (grade CAPEX/OPEX × mês, com distribuir, sugerir e copiar do ano anterior), **Contratos**, **Pendências** e **Dados da empresa**. Exporta CSV. |
| **Catálogo CAPEX/OPEX** | Consulta da classificação contábil de cada código de serviço (importado de planilha pela administradora). Usado também no lançamento de medições. |
| **Meu perfil** | Dados do usuário, troca de senha, atividade recente e (para administradora) gestão de acessos. |

As empresas são cadastradas no banco de dados (protegido por login) e aparecem no menu automaticamente.

Recursos gerais: menu lateral recolhível, **tema claro/escuro** (padrão claro), **modo apresentação** (tela cheia, navegação entre painéis com ← →, avanço automático), seletor de ano e identidade visual corporativa (sem logotipos).

## Como os números são calculados

- **Realizado** = soma das medições do mês (exceto glosadas/canceladas).
- **Projeção** dos meses em aberto = forecast cadastrado; sem forecast, o **ritmo atual** (média dos últimos 3 meses fechados).
- **Saldo do orçamento** = orçamento anual − realizado no ano.
- **Pode gastar por mês (margem segura)** = saldo do orçamento ÷ meses restantes do ano.
- **Situação**: *Estouro previsto* quando a projeção anual passa do orçamento; *Atenção* acima de 95%.

## Acesso

O login usa Supabase Auth (e-mail e senha). Só entram e-mails liberados na lista de **acessos autorizados**:

1. O Editor libera o e-mail em **Meu perfil → Acessos autorizados** (permissões: Coordenador, Editor ou Leitor).
2. A pessoa abre o site, escolhe **Primeiro acesso**, informa o e-mail liberado e cria a própria senha.

O **Coordenador** mantém a gestão operacional anterior, mas não consulta auditoria nem gerencia acessos. Para compatibilidade com os cadastros existentes, seu papel interno continua `admin`. Somente o **Editor** vê Auditoria e gerencia acessos, com proteção tanto na interface quanto por RLS. O editor não pode remover ou rebaixar o próprio acesso.

### Auditoria e implantação

Aplique `supabase/migrations/20261111231026_gf_editor_auditoria.sql` no mesmo projeto configurado em `js/config.js` antes de usar os novos recursos. O push do site não aplica migrações no Supabase. O primeiro Editor deve ser autorizado por um operador do banco, mantendo dados pessoais de provisionamento fora do repositório.

- A página Auditoria consulta 200 registros por página, em ordem de data e ID, com filtros de pessoa e ação.
- Triggers registram inserções, alterações e exclusões nas tabelas de negócio, catálogo, itens, perfis e acessos. Guardam ator, papel no momento da ação, horário do servidor e imagens antes/depois.
- A interface informa entrada no site, páginas abertas, saída pelo botão, exportação CSV e troca de senha. Esses eventos dependem do navegador e não representam cada clique nem fechamento da aba. Alterações de dados não dependem desses eventos: são auditadas no banco.
- Último acesso significa a última entrada/reabertura autenticada do site, e não um indicador de presença online. Os horários da auditoria são exibidos em Brasília.
- Eventos de editores são excluídos da consulta. Eventos antigos sem papel registrado permanecem identificados como históricos, sem atribuir retrospectivamente um papel que pode ter mudado.
- Não há reconstrução de eventos anteriores à ativação da trilha. Senhas e tokens não são registrados.

### Testes

Execute `pnpm install --frozen-lockfile` e `pnpm test`. Os testes aplicam todas as migrações em PostgreSQL local isolado (PGlite) e verificam permissões de Editor/Coordenador/Leitor, alterações antes/depois, bloqueio de acesso, prevenção de elevação de privilégios e paginação. Também verificam a renderização da página com API simulada. Não usam nem alteram o banco publicado.

## Tecnologia

- Site estático (HTML + CSS + JavaScript em módulos), publicado no **GitHub Pages** — sem etapa de build.
- **Supabase**: banco Postgres com **Row Level Security** em todas as tabelas (prefixo `gf_`), autenticação e trilha de auditoria. Nenhum dado é acessível sem login autorizado.
- Gráficos com **Apache ECharts**; leitura de planilhas com **SheetJS** (carregado só na importação).

```
index.html            aplicação (rotas com #)
css/                  tokens da identidade visual + estilos
js/app.js             inicialização, login e controle de acesso
js/state.js           dados em memória e gravação no Supabase
js/calc.js            cálculos financeiros (projeção, margens, alertas)
js/charts.js          gráficos e paleta de cores
js/ui/shell.js        menu lateral, barra superior, tema e modo apresentação
js/pages/             painel, dashboard e registros da empresa, perfil, catálogo, login
supabase/migrations/  estrutura do banco e segurança (RLS)
```
