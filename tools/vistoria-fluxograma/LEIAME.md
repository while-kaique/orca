# Vistoria da junção do fluxograma

**O que faz:** monta a branch atual, abre um Orca de teste **escondido** com uma cópia do estado guardado do
Orca em uso, tira o print do fluxograma, confere se cada card está do lado certo (hierarquia embaixo do
projeto, livre em cima) e fecha tudo sem deixar processo nem janela.

**Comando (da raiz do projeto):**

```
node tools/vistoria-fluxograma/vistoria-juncao.mjs
```

| Opção                     | Para quê                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--sem-montar`            | pula a montagem e usa o que já está em `out/` (só use se a branch não mudou desde a última montagem feita por este comando)                                        |
| `--saida PASTA`           | onde guardar o resultado (padrão: `.cache/vistoria-fluxograma/juncao/`)                                                                                            |
| `--posicoes ARQUIVO.json` | troca as posições arrastadas guardadas por essas (formato de `orca-fork.canvas-offsets`, ex.: `{"<id do chat>":{"dx":0,"dy":-400}}`) para simular cards arrastados |
| `--manter`                | não apaga o mundo de teste no fim (para investigar)                                                                                                                |

**Onde sai o print:** `.cache/vistoria-fluxograma/juncao/fluxograma.png`, mais `fluxograma-fatos.json` (lugar
de cada card), `rodada.txt` (o relato da rodada com o tempo de cada passo) e `montagem.log`.

**Quanto demora:** cerca de 3 a 4 minutos com montagem (a montagem é quase tudo) e cerca de 1 minuto com
`--sem-montar`. Montagem roda pela vez do comando `hierarquia vez`, então espera se outro comando pesado estiver rodando.

**Como termina:** a última linha diz `RESULTADO: tudo no lugar, nada sobrou` (saída 0) ou `RESULTADO: ha o que
olhar` (saída 1), com a lista de cards no lado errado, processos que sobraram ou janelas visíveis.

**O que garante que nada do Orca em uso é tocado:**

- O Orca de teste usa um perfil próprio em `%TEMP%\vistoria-fluxograma\mundo\perfil` (apagado no fim) e porta
  de inspeção própria; o Orca em uso não é fechado, reiniciado nem reconstruído.
- `preparar-estado.py` só **lê** o estado do Orca em uso. Todo caminho sob `Desktop\Projetos` e
  `orca\workspaces` é trocado por uma pasta de teste (repositório git vazio mais a cópia do
  `.hierarquia/estado.json`), então o Orca de teste nunca enxerga a pasta de verdade e não consegue escrever nela.
- A janela abre oculta (`ORCA_BACKGROUND_LAUNCH=1`) e o print vem por CDP, sem tirar foco.
- Ao fechar, a ferramenta mata só os processos cuja linha de comando cita a pasta do mundo de teste e confere
  que não restou nenhum.

**Limites:** o estado copiado é o de agora (inclusive posições arrastadas); o Orca de teste não acorda os
terminais dos chats. Para ver o PO nascendo ou a máscara de carregamento no programa de verdade, use as funções
de `orca-de-teste.mjs` (`abrirOrcaDeTeste`, `abrirFluxograma`, `lerFluxograma`) num roteiro próprio.
