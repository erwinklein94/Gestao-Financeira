# Informações complementares de medição

O acervo `gf_fontes_medicao` é privado, acessível apenas a admin/leitor. Não publicar arquivos Excel nem cargas financeiras no Git. O cliente só consulta; importações são feitas pelo processo administrativo.

Cada documento identifica empresa, ano, mês e arquivo. `dados` contém:

- `total_planilha`: valor salvo na linha TOTAL de TOTAL REV00, sem recalcular fórmulas nem somar os subtotais novamente.
- `contratuais`: linhas não zeradas de ITENS CONTRATUAIS, com código, descrição original, unidade, quantidade, valor e aba.
- `retroativos`: linhas cuja aba identifica explicitamente valores retroativos. Não entram automaticamente nos itens financeiros.
- `execucoes`: abas vinculadas aos itens já importados, com período, supervisor, descrição e quilometragem original. O diário preserva os quadros com datas válidas e quantidades não zeradas: `[data ISO, código, unidade, quantidade, SUB, OS, comentário]`. Datas são valores salvos do Excel, não a competência inferida do nome do arquivo.
- `controle_os`: campos originais A–J da aba OS OUT. Células vazias não são convertidas em reprovação ou pendência.

Vínculos de execução usam mês, arquivo e aba; agrupamento financeiro inclui a OS. Nunca unir revisões/abas somente pelo número da OS. Não somar quantidades com unidades diferentes. O gráfico documental usa `status_planilha`, sem converter ausência em aprovação. Os valores continuam medidos, não pagos.

Reconciliação compara todas as naturezas, mesmo quando há filtro contábil. Tolerância de apresentação de dois centavos; diferenças maiores permanecem a conferir. Uma diferença não gera um lançamento. Itens contratuais sem correspondência são evidências para revisão, não saldo automaticamente devido.

PDF inclui conferência, OS, itens contratuais pendentes, retroativos, diários e controle de OS. Filtros locais de busca não omitem dados do relatório; a execução diária da aba mantém todas as naturezas, explicitamente identificadas.
