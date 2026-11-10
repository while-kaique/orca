---
feature: 'hierarquia-de-chats'
id: '001'
status: draft # draft | approved | in-progress | done
created: '2026-11-10'
spec: './spec.md'
base: 'feat/orca-enxuto (quando terminar)'
---

# Plano: Hierarquia de chats (PO > Planejador > Executor)

> Este plano diz **como** construir o que a `spec.md` pede. A spec foi aprovada pelo Kaique em
> 10/11/2026. Nenhuma linha de código é escrita antes de este plano ser aprovado.

## 0. Duas decisões do Kaique que moldam o plano (10/11/2026)

1. **Sobe só na versão enxuta.** Outro chat está fazendo uma versão enxuta do Orca (pasta
   `Desktop\Projetos\orca-enxuto`, branch `feat/orca-enxuto`). O fluxograma v2 nasce em cima dela,
   depois que ela terminar.
2. **Teste só depois.** Nada de lançar chats de teste nem mudar configuração do Orca agora.

Consequência: as Fases 0 a 4 abaixo estão **todas paradas** até a versão enxuta ficar pronta.
O que dá para fazer antes disso é só o que está na seção 9.

**O que vi na versão enxuta hoje** (só leitura, 10/11/2026, 15 arquivos alterados e nenhum commit
ainda): ela desliga nuvem, celular, emulador, outros serviços de git além do GitHub e varreduras
do Codex (`src/main/orca-enxuto-switches.ts`). **Não mexe** na orquestração nem na pasta do
fluxograma. Como ela ainda está em andamento, isso é reconferido na Fase 0.

## 1. Ideia central: a regra mora em código, não em pedido

A spec tem regras que não podem depender de um chat "lembrar": quem pode criar quem, que modelo
cada papel usa, teto de chats, ordem com cinco campos, entrega só com prova, duas reprovações
sobem, nada junta sem OK.

Por isso o plano tem **um comando único**, chamado `hierarquia`, que é a única porta para criar
chat, entregar, conferir e pedir OK. O comando aplica as regras e escreve tudo num registro.
Os chats usam o comando; a tela lê o registro. Segue a regra já usada nos outros projetos:
processo aplicado por comando e por hook, não por lembrete.

```
PO / Planejador / Executor ──usam──> comando `hierarquia` ──chama──> motor do Orca
                                            │
                                            └──escreve──> registro do projeto ──lido por──> fluxograma
```

## 2. As peças

| Peça                     | O que é                                                                                                                         | Onde fica                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Comando `hierarquia`** | Script sem dependências que aplica as regras e chama o motor de trabalhadores do Orca                                           | `skills/hierarquia/` no repositório do fork (a pasta `skills/` já existe)        |
| **Papéis**               | Três textos curtos: o que o PO, o planejador e o executor fazem e não fazem                                                     | Junto do comando, em `skills/hierarquia/papeis/`                                 |
| **Pasta do projeto**     | `PRODUTO.md` (o que cumprir), `DECISOES.md` (decisões com data), `registro.jsonl` (histórico) e `estado.json` (foto do momento) | `.hierarquia/` dentro de cada projeto que adotar                                 |
| **Hooks do projeto**     | Travas que rodam sozinhas: papel injetado ao abrir o chat, bloqueio de juntar sem OK, aviso quando o Kaique entra no meio       | `.claude/settings.json` + `.claude/hooks/` do projeto piloto                     |
| **Tela**                 | Árvore PO > planejadores > executores, selo do modelo, estado do portão, Fila do Kaique                                         | `src/renderer/src/components/canvas-chats/`                                      |
| **Ponte**                | Canal para a tela ler o registro do projeto e gravar o OK                                                                       | Processo principal, no mesmo padrão dos canais `repos:*` que o fluxograma já usa |

### 2.1 O comando `hierarquia`

| Ação              | Quem usa               | O que faz                                                                                                                                                                                         | Requisito                             |
| ----------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `criar-po`        | Kaique (botão na tela) | Cria `.hierarquia/`, abre o chat do PO com Fable e anota qual aba é o PO                                                                                                                          | FR-1, FR-2                            |
| `ordem`           | PO, planejador         | Recusa se faltar um dos cinco campos, se o papel não puder criar aquele filho ou se o teto estourar (aí entra em espera). Escolhe o modelo pelo papel. Cria o chat numa cópia separada do projeto | FR-3, FR-4, FR-5, FR-10, FR-19, FR-20 |
| `entregar`        | Executor, planejador   | Recusa se a prova citada nos critérios não existir                                                                                                                                                | FR-11                                 |
| `conferir`        | Planejador, PO         | Aprova ou reprova com motivo. Conta reprovações; na segunda, sobe o caso                                                                                                                          | FR-12, FR-13                          |
| `perguntar`       | Qualquer um            | Manda a dúvida para cima; se chegar ao PO sem resposta, vai para a Fila do Kaique                                                                                                                 | FR-16, FR-18                          |
| `pedir-ok`        | PO                     | Põe a entrega na Fila do Kaique com resumo e prova                                                                                                                                                | FR-14, FR-16                          |
| `ok` / `devolver` | Kaique (botão na tela) | Registra a decisão dele                                                                                                                                                                           | FR-14, FR-15                          |
| `estado`          | Qualquer um            | Mostra as frentes: o que terminou, o que parou, o que espera                                                                                                                                      | FR-9, SC-5                            |

Papel e modelo: PO = Fable, planejador = Opus, executor = Sonnet. O modelo é passado ao Orca pela
opção de modelo do lançador de trabalhadores (Anexo A da spec, fato 1).

### 2.2 Como cada chat sabe o papel que tem

- **Planejador e executor:** a ordem que recebem já começa dizendo o papel e apontando o texto
  do papel. O comando `hierarquia` monta esse cabeçalho; o chat que dá a ordem não escreve à mão.
- **PO:** um hook de abertura de sessão no projeto compara a aba atual com a aba anotada como PO
  em `estado.json`. Se for a mesma, injeta o papel de PO e manda ler `PRODUTO.md`, `DECISOES.md`
  e o resultado de `hierarquia estado` antes de responder. Vale também depois de compactar.
  _Depende de o Orca informar a aba ao chat; o hook de nome da aba já usa isso
  (`ORCA_TAB_ID`, descrito no `ONDE-PARAMOS.md`, seção 25/09)._

### 2.3 As travas (hooks do projeto piloto)

| Trava                  | Quando dispara                                                                | O que faz                                                                  | Requisito |
| ---------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------- |
| Juntar sem OK          | Antes de comando que junta na versão principal ou envia ao GitHub             | Bloqueia, a menos que o registro tenha um OK do Kaique para aquela entrega | FR-14     |
| Gravar em sistema real | Antes de rodar o robô em modo que cria de verdade no Spree, Factory ou portal | Bloqueia sem OK registrado. Ensaio e leitura passam                        | FR-14a    |
| Kaique no meio         | Quando chega mensagem digitada num planejador ou executor                     | Marca o chat e obriga o relato para cima no fim do turno                   | FR-17     |
| Executor criando chat  | Coberta pelo comando `ordem`, que recusa                                      | Não precisa de hook                                                        | FR-5      |

A trava "Kaique no meio" depende de distinguir mensagem do Kaique de mensagem que veio da
orquestração. Hipótese: a ordem chega com um cabeçalho próprio do Orca e os recados seguintes
chegam por leitura de caixa de entrada, não por digitação; então toda mensagem digitada depois
da primeira é do Kaique. **Não testado**; é o item 0.5.

### 2.4 A tela

1. **Dados** (`canvas-chats-data.ts`): cada chat ganha papel, modelo, pai e estado do portão.
   O pai vem da função que o painel de agentes já usa (`buildAgentRowLineageTree`); o modelo vem
   pelo mesmo caminho que a barra lateral usa. Regra da casa mantida: nunca ler campo cru do status.
   Papel e portão vêm do registro do projeto, pela ponte.
2. **Desenho** (`canvas-chats-layout.ts`): hoje é projeto > chats lado a lado > agentes
   empilhados. Passa a aceitar três andares: PO em cima, planejadores lado a lado, executores
   debaixo de cada planejador. Executor do atalho fica direto debaixo do PO. Projeto sem
   `.hierarquia/` passa pelo caminho antigo sem mudança (FR-27).
3. **Cards** (`CanvasChatsNodes.tsx`): selo com papel e modelo; faixa com o estado do portão
   (os sete estados do FR-25); marca "mexido pelo Kaique".
4. **Fila do Kaique:** painel no fluxograma com os itens de todos os projetos. Cada item tem
   projeto, chat de origem, resumo e os botões OK e Devolver. Clicar leva ao chat.
5. **Regras visuais já aprovadas ficam:** texto de tamanho fixo no zoom, nome nunca cortado,
   linhas finas, nada de polígono ou constelação. Cores e tamanhos saem do guia de estilo do
   repositório (`docs/STYLEGUIDE.md`), sem inventar cor nova.

### 2.5 Testes automatizados

O método é SDD e o repositório pede "não criar teste por padrão". Entram só dois grupos, porque
são regra pura e quebram se a mudança for desfeita:

- **Regras do comando `hierarquia`:** quem pode criar quem, teto, cinco campos, prova ausente,
  segunda reprovação.
- **Desenho da árvore:** posição dos três andares (o arquivo `canvas-chats-layout.test.ts` já existe).

A tela em si é conferida por print automático, sem pedir ao Kaique para testar.

## 3. Fases

Cada fase termina com uma prova. Só passa para a seguinte com a prova na mão.

### Fase 0 — Base e prova do motor (meio dia)

| #   | O que fazer                                                                                                                                                    | Prova                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 0.1 | Criar a branch do fluxograma v2 a partir da versão enxuta pronta                                                                                               | Branch criada; checagem de tipos limpa                                                                                               |
| 0.2 | Conferir que a versão enxuta manteve a orquestração e a pasta do fluxograma                                                                                    | Lista dos interruptores dela, sem orquestração entre os desligados                                                                   |
| 0.3 | Fazer os chats do fork usarem o comando `orca` do próprio fork                                                                                                 | Versão impressa pelo comando igual à do fork. Hoje o `orca` do terminal é o instalado (1.4.209) e o da pasta do fork está em 1.4.197 |
| 0.4 | Subir o limite de níveis de 1 para 2 e lançar a prova mínima: um Opus que cria um Sonnet, cada um com o modelo pedido                                          | Saída do comando com os dois chats, pai e modelo certos                                                                              |
| 0.5 | Na mesma prova: conferir se o nome "fable" é aceito como modelo, se a tela enxerga o pai nos dois níveis e se dá para distinguir mensagem digitada pelo Kaique | Print e saída anotados no plano                                                                                                      |
| 0.6 | Registrar as pastas novas como confiáveis antes de lançar (senão o chat morre na pergunta de confiança, como em 20/10)                                         | Os dois chats da prova chegam a trabalhar                                                                                            |

**Se 0.4 falhar** (o motor não aguentar chat criando chat), vale o **plano B**: só o PO lança
chats; o planejador pede ao PO, pelo comando `ordem`, e o PO lança o executor em nome dele.
O registro guarda "criado a pedido de" como pai. Conferido contra a spec: FR-3, FR-5, FR-6,
FR-19, FR-20 e toda a tela continuam valendo como estão; **FR-4 muda de texto** ("o planejador
cria" vira "o planejador pede e o PO cria"). Essa troca de texto precisa do OK do Kaique na hora,
e a spec é atualizada junto. Custo do plano B: o PO vira gargalo de lançamento.

### Fase 1 — Comando e papéis, sem tela (2 dias)

| #   | O que fazer                                                                           | Prova                                                                               |
| --- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1.1 | Escrever o comando `hierarquia` com `criar-po`, `ordem`, `estado` e o registro        | Testes das regras passando                                                          |
| 1.2 | Escrever os três textos de papel                                                      | Lidos e aprovados pelo Kaique                                                       |
| 1.3 | Hook de abertura do PO                                                                | PO recriado do zero responde a perguntas que só estão nos arquivos (ensaio do CS-3) |
| 1.4 | Rodar um pedido de mentira até o executor trabalhar, num projeto de teste descartável | Registro com PO, planejador e executor, pai e modelo certos                         |

### Fase 2 — Portões e travas (2 dias)

| #   | O que fazer                                                       | Prova                                                                                                      |
| --- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 2.1 | `entregar`, `conferir`, `perguntar`, `pedir-ok`, `ok`, `devolver` | Testes das regras passando (prova ausente, segunda reprovação)                                             |
| 2.2 | Travas de juntar sem OK e de gravar em sistema real               | Cada hook testado com entrada simulada antes de confiar, nos dois sentidos: bloqueia sem OK, libera com OK |
| 2.3 | Trava "Kaique no meio"                                            | Mensagem digitada num executor aparece no registro e chega ao PO                                           |
| 2.4 | Chat que morre sem entregar                                       | Matar um executor de propósito; a tarefa volta para a fila com o trabalho preservado (SC-9)                |
| 2.5 | Reabrir o Orca no meio de um pedido                               | `hierarquia estado` mostra o que terminou, o que parou e o que espera, sem nada falso como pronto (SC-5)   |

### Fase 3 — Tela (3 dias)

| #   | O que fazer                                                           | Prova                                                                   |
| --- | --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 3.1 | Ponte entre a tela e o registro do projeto                            | Mudança no registro aparece na tela sem recarregar                      |
| 3.2 | Dados e desenho em três andares                                       | Teste do desenho passando; print com um projeto com hierarquia e um sem |
| 3.3 | Selo de papel e modelo, faixa do portão, marca do Kaique              | Print de cada um dos sete estados                                       |
| 3.4 | Fila do Kaique com OK e Devolver                                      | Print; clicar no item abre o chat de origem; OK aparece no registro     |
| 3.5 | Medir a velocidade do fluxograma com 11 chats contra a versão de hoje | Dois números lado a lado, anotados aqui                                 |

### Fase 4 — Piloto na Automação de Cadastros (3 a 5 dias de uso)

| #   | O que fazer                                                                                                          | Prova                                                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 | Criar o PO do projeto e preencher `PRODUTO.md` em entrevista com o Kaique                                            | Arquivo aprovado por ele                                                                                                                                                  |
| 4.2 | Instalar as travas no projeto                                                                                        | Os mesmos testes da 2.2, rodados lá                                                                                                                                       |
| 4.3 | Três pedidos reais, escolhidos com o Kaique                                                                          | Critérios CS-1 a CS-6 da spec, um por um                                                                                                                                  |
| 4.4 | Medir o gasto por pedido somando o uso anotado nas conversas de cada chat, contra o mesmo tipo de pedido num chat só | Tabela com os três pedidos (CS-6). Se as conversas não guardarem o uso de forma somável, a medida passa a ser o painel de uso da assinatura antes e depois de cada pedido |
| 4.5 | Relatório do piloto e decisão: segue, ajusta ou para                                                                 | Kaique decide                                                                                                                                                             |

**Aviso sobre o piloto:** em 10/11/2026 o próximo passo da Automação de Cadastros está travado em
terceiro (acesso de administrador no Spree) e parte do trabalho está indo para um bot numa máquina
virtual, fora do Orca (`ONDE-PARAMOS.md` do projeto). Se continuar assim quando o piloto começar,
os três pedidos têm que ser de coisas que não dependem do Spree, ou o piloto muda de projeto.
Decisão do Kaique na etapa 4.3.

**Total estimado:** 8 a 10 dias de trabalho depois que a versão enxuta ficar pronta, mais os
dias de uso do piloto. Estimativa minha, sem base medida.

## 4. Requisito por requisito: onde cada um é atendido

| Requisitos                               | Peça                                                            | Fase  |
| ---------------------------------------- | --------------------------------------------------------------- | ----- |
| FR-1, FR-2                               | `criar-po`                                                      | 1     |
| FR-3 a FR-6, FR-10, FR-19, FR-20, FR-20a | `ordem` + registro                                              | 1     |
| FR-7 a FR-9                              | Pasta do projeto + hook de abertura do PO                       | 1     |
| FR-11 a FR-13, FR-15                     | `entregar`, `conferir` + registro                               | 2     |
| FR-14, FR-14a                            | Travas                                                          | 2     |
| FR-14b                                   | Texto do papel do PO + `pedir-ok` em modo proposta              | 2     |
| FR-16, FR-18                             | `perguntar`, `pedir-ok` + Fila do Kaique                        | 2 e 3 |
| FR-17                                    | Trava "Kaique no meio"                                          | 2     |
| FR-21, FR-22                             | `conferir` encerra o executor; vigia de chat parado no `estado` | 2     |
| FR-23 a FR-28                            | Tela                                                            | 3     |

## 5. O que este plano não muda

- A voz, o espiar, as fotos de página, os processos de fundo e as cordas manuais.
- O motor de trabalhadores do Orca: o plano usa, não reescreve. A única mudança de configuração é
  o limite de níveis (de 1 para 2).
- Projetos sem `.hierarquia/`.
- Os pontos de decisão do próprio Orca não são usados: a Fila do Kaique sai do registro do
  projeto, para ter um lugar só com o histórico.

## 6. Segredos

Este plano não cria nem lê senha, chave ou segredo. O registro guarda só texto de ordem, entrega
e decisão. As senhas do piloto (Spree, portais) continuam onde o projeto já define, fora do
alcance desta entrega. Regra para os papéis: nenhum chat copia segredo para ordem, entrega ou
registro.

## 7. Riscos do plano

| #   | Risco                                                                   | O que fazer                                                                                    | Responsável                 | Prazo        |
| --- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------- | ------------ |
| P-1 | A versão enxuta mudar a orquestração ou o fluxograma até terminar       | Etapa 0.2 antes de qualquer código                                                             | Claude                      | Fase 0       |
| P-2 | Motor não aguentar dois níveis                                          | Plano B da Fase 0, com OK do Kaique para o novo texto do FR-4                                  | Claude prova; Kaique decide | Fase 0       |
| P-3 | Não dar para distinguir mensagem do Kaique da mensagem da orquestração  | Se a hipótese da seção 2.3 falhar, a marca passa a ser um botão "vou mexer aqui" no card       | Claude                      | Fase 0 (0.5) |
| P-4 | Chat ignorar o comando e usar o motor do Orca direto, pulando as regras | Texto do papel proíbe; a tela mostra como "fora da hierarquia" todo chat sem linha no registro | Claude                      | Fase 2       |
| P-5 | Onze chats derrubarem o serviço de terminais por memória                | Subir o teto aos poucos no piloto: começar com 1 planejador e 2 executores                     | Claude                      | Fase 4       |
| P-6 | Piloto travado por acesso de terceiro                                   | Aviso da Fase 4; decisão na etapa 4.3                                                          | Kaique                      | Fase 4       |

Os prazos são por fase porque a data de início depende de a versão enxuta terminar.

## 8. Desvios do pedido original, com quem autorizou

| Desvio                                                                                           | Autorizado por                                       | Quando     |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | ---------- |
| Método SDD em vez de TDD                                                                         | Kaique                                               | 10/11/2026 |
| O que o PO sabe em arquivo; atalho do pedido pequeno; limite de duas reprovações; Fila do Kaique | Kaique                                               | 10/11/2026 |
| Teto: 2 planejadores, até 4 executores cada                                                      | Kaique                                               | 10/11/2026 |
| Testar só depois e subir só na versão enxuta                                                     | Kaique                                               | 10/11/2026 |
| Cordas manuais continuam só desenho; piloto só em projeto com git                                | Sugestão do Claude, **sem resposta do Kaique ainda** | —          |

## 9. O que dá para fazer antes de a versão enxuta terminar

Nada disto lança chat, muda configuração ou toca no código do Orca:

1. Escrever os três textos de papel (etapa 1.2) para o Kaique ler.
2. Escrever o modelo do `PRODUTO.md` e as perguntas da entrevista do PO (etapa 4.1).
3. Escrever o `tasks.md` das Fases 0 e 1.

## 10. Próximo documento

`tasks.md`: a lista de tarefas, uma por linha, com a prova de cada uma. As tarefas das Fases 2
a 4 só são fechadas depois do resultado da Fase 0, porque o plano B muda parte delas.
