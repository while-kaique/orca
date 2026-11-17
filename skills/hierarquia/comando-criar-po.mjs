// `hierarquia criar-po`: registra o chat como PO do projeto. Nunca um chat que já é executor ou planejador.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { foraDoGit } from './pasta-fora-do-git.mjs'
import { projetosDaMaquina } from './porta-do-orca.mjs'
import { anotar, caminhos, lerEventos, sair } from './registro.mjs'
import { montarEstado } from './regras.mjs'

const AQUI = import.meta.dirname

export function comandoCriarPo(op, eu, meuTerminal) {
  const projeto = resolve(op.projeto ?? process.cwd())
  // Executor ou planejador nunca vira PO, nem para teste: o card dele ganharia a etiqueta PO (o-032, 12/11).
  for (const outro of projetosDaMaquina([process.cwd(), projeto])) {
    const papel = montarEstado(lerEventos(outro)).chats[eu]
    if (papel?.ativo && (papel.papel !== 'po' || resolve(outro) !== projeto)) {
      sair(
        `Este chat já é ${papel.papel} em ${outro}: não vira PO de outro registro, nem com --teste. Para testar um lançamento, use um chat de teste: hierarquia ordem --teste --para executor --arquivo ordem.json (título começando com TESTE; não ocupa vaga de trabalho).`
      )
    }
  }
  const { base, ordens, registro } = caminhos(projeto)
  mkdirSync(ordens, { recursive: true })
  foraDoGit(projeto)
  const estado = montarEstado(lerEventos(projeto))
  if (estado.po && estado.po !== eu) {
    sair(`Já há um PO aberto neste projeto (${String(estado.po)}); feche a aba dele antes.`)
  }
  for (const [nome, inicial] of [
    ['PRODUTO.md', '# Produto\n\n(vazio: o PO entrevista o Kaique antes de criar qualquer chat)\n'],
    ['DECISOES.md', '# Decisões\n']
  ]) {
    if (!existsSync(join(base, nome))) {
      writeFileSync(join(base, nome), inicial, 'utf8')
    }
  }
  if (!existsSync(registro)) {
    writeFileSync(registro, '', 'utf8')
  }
  anotar(projeto, 'po_criado', { chatId: eu, handle: meuTerminal })
  console.log(
    `PO registrado em ${base}. Leia o seu papel em ${join(AQUI, 'papeis', 'po.md')}, depois PRODUTO.md e DECISOES.md, antes de responder.`
  )
}
