# Onde paramos — fork do Orca "PC como mesa"

**Atualizado:** 23/09/2026, fim do dia.

## Estado
- Fork `while-kaique/orca`, branch `feat/pc-como-mesa`, clonado em `Desktop\Projetos\orca`.
- Plano completo: `PLANO-PC-COMO-MESA.md` (fases 0 a 3).
- **Fase 0 (montar o app): feita.** Abrir com dois cliques em `dev-orca.bat`
  (perfil separado em `%APPDATA%\orca-fork`, não mexe no Orca instalado).
- **Fase 1 (barra lateral nova): escrita e commitada** (`19d2e023`), checagem de tipos e lint limpos.
  App aberto em 23/09 para teste; o Kaique ainda não testou.
- Aviso "opencode / SQLite database does not exist" no log é inofensivo (opencode não instalado).

## O que a fase 1 mudou
1. Clicar no nome do projeto abre a pasta dele (a setinha continua abrindo/fechando o grupo).
2. Todos os projetos aparecem sempre; worktree só aparece enquanto tiver chat aberto nela.
3. Em projeto com git, o **+** virou **⑂ N**: lista "Pasta do projeto", worktrees ativas e "Criar worktree nova…".

## Próximo passo (24/09)
1. Abrir `dev-orca.bat` e testar os 3 itens acima.
2. O Kaique tem **ajustes** para passar — ouvir e aplicar antes de seguir.
3. Depois: fase 2 (cada lado da tela dividida escolhe pasta/worktree, ~1 a 2 dias).
