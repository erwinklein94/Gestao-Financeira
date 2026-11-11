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

1. A administradora libera o e-mail em **Meu perfil → Acessos autorizados** (permissões: Administradora, Editor ou Leitor).
2. A pessoa abre o site, escolhe **Primeiro acesso**, informa o e-mail liberado e cria a própria senha.

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
