# Plano — Orca com "o PC é minha área de trabalho"

Data: 23/09/2026 · Base: código do Orca clonado em `Projetos\orca` (licença MIT)

## A ideia em uma frase

Hoje, no Orca, a worktree é a mesa de trabalho e o projeto é só uma gaveta onde elas ficam.
Depois do rework, **o projeto é a pasta do seu PC**: clicar no nome abre os chats daquela pasta,
e a worktree vira um lugar para onde você leva um chat quando pede, e de onde volta quando quiser.

## Como vai ficar (visão do usuário)

```
PROJECTS                         [filtro] [+ pasta]
▸ Creative Studio        [⑂ 2]   ← clique no nome = abre os chats desta pasta
    ● chat: revisar prompt
    ○ chat: deploy v112
▸ mapa-de-dores                  ← pasta sem git: sem botão de worktree
    ● chat: cards Claude
▸ social-strategy        [⑂ 1]   ← ⑂ = lista as worktrees ativas, escolhe uma e entra
```

Dentro do chat, com a tela dividida em 2:

```
┌─ 📁 Creative Studio ▾ ─────────┬─ ⑂ feat/trava-escala ▾ ──────────┐
│ claude …                       │ claude …                         │
└────────────────────────────────┴──────────────────────────────────┘
      ▾ abre: • pasta do projeto (no PC)
              • feat/trava-escala
              • fix-login
              + criar worktree nova…
```

## Descoberta que já resolve metade: por que 21 projetos git sumiram

Não é bug. Dois filtros estão ligados no seu perfil: **"Hide sleeping"** (esconde tudo que não
tem terminal aberto) e **"Except default branch"** desligado (então esconde até a pasta
principal). Resolve em 10 segundos, sem código: ícone de filtro (o que tem o "2") →
ligar **Except default branch**. Na versão modificada isso vira regra fixa: pasta de projeto
nunca some.

## Fases

### Fase 0 — Montar sua versão do app · ~30 min

1. Instalar o `pnpm` (`corepack enable`), rodar `pnpm install`.
2. Criar a branch `feat/pc-como-mesa` no clone local.
3. Rodar com `pnpm dev-stable-name`: abre uma cópia separada, que não briga com o Orca instalado
   nem é apagada pela atualização automática.

### Fase 1 — Barra lateral nova · ~1 dia

| O que muda | Onde no código |
|---|---|
| Clicar no nome do projeto abre a pasta dele (hoje só abre/fecha o grupo) | `components/sidebar/worktree-list/rows/SectionHeader.tsx:283-295` → chamar `activateAndRevealWorktree` com o id da pasta principal (`getRepoMainWorktreeId`) |
| Embaixo do projeto aparecem os **chats**, não as worktrees | `worktree-list/grouping/build-rows.ts` + reaproveitar `useWorktreeAgentRows.ts` |
| Pasta de projeto nunca é escondida pelo filtro de "sleeping" | `components/sidebar/visible-worktree-kinds.ts:12-17` |
| Botão **⑂ N** no projeto (só se tiver git): lista as worktrees ativas → escolhe → entra | `rows/repo-header-project-actions.tsx`, dados de `worktreesByRepo` |
| O **+** do topo vira "novo chat na pasta" em vez de "nova worktree" | `sidebar-header-actions.tsx` (`NewWorkspaceButton`) |

Tudo isso fica atrás de uma opção nova ("Modo: PC como mesa"), para dar para voltar ao
jeito original sem desfazer código.

### Fase 2 — Trocar a pasta de cada lado da tela dividida · ~1 a 2 dias (a parte difícil)

- Botão **📁 nome ▾** no topo de cada painel de chat: `terminal-pane/TerminalPaneHeaderOverlay.tsx:248-398`
  (já é onde ficam os botões por painel).
- **Como funciona por baixo:** o chat continua "morando" no projeto; cada painel ganha só um
  campo novo "pasta atual". Trocar = reiniciar aquele painel na pasta escolhida. O Orca já aceita
  terminal em qualquer pasta (`src/shared/terminal-startup-cwd.ts`), então não precisa reescrever
  o motor, só guardar esse campo por painel (`TerminalLayoutSnapshot`, em `src/shared/terminal-tab-types.ts:131-145`).
- **Limite real:** o Claude Code guarda cada conversa amarrada à pasta onde ela começou. Então
  trocar de pasta **abre um chat novo** na pasta nova; o chat antigo continua salvo e pode ser
  retomado na pasta original. (Ver decisão 1.)

### Fase 3 — Painel da direita segue o chat em foco · ~meio dia

Hoje o painel de git/arquivos da direita segue o projeto ativo. Com um lado na pasta e outro na
worktree, ele precisa seguir **o painel onde você clicou por último**. Sem isso, você olharia os
arquivos da pasta errada.

## Riscos que o código mostrou

1. **Bolinha de status do agente** aparece no projeto, não na worktree onde ele está rodando.
   Aceitável no modo "PC como mesa"; ajuste fino na fase 3.
2. **Apagar uma worktree** não fecha um chat que está dentro dela (porque o chat mora no projeto).
   Precisa de uma checagem extra: fechar/mover o painel antes de apagar.
3. **Atualizações do Orca oficial:** cada versão nova precisa ser juntada com a sua. Calcule
   ~30 min por atualização que você quiser trazer; dá para ficar semanas sem trazer.

## Decisões suas antes de eu começar

1. **Trocar a pasta de um chat em andamento:** abrir chat novo na pasta nova *(recomendo; é o
   que o Claude permite sem gambiarra)*, ou só permitir trocar em chat vazio?
2. **Onde guardar sua versão:** fork no seu GitHub pessoal (`while-kaique/orca`) *(recomendo:
   o trabalho não se perde)* ou só local no PC?

## Ordem de execução

Fase 0 → Fase 1 (você já testa o dia a dia) → Fase 2 → Fase 3. Cada fase termina com o app
rodando e você testando antes da próxima.
