// O texto da ordem (arquivo .md) e o pedido que vai ao Orca para abrir o chat dela.
import { join } from 'node:path'
import { semAcento } from './orca-lancador.mjs'

const AQUI = import.meta.dirname

/** Começa o pedido: é por ele que o lançador reconhece o chat novo no Orca antes de o turno começar. */
export function marcadorDaOrdem(ordemId, papel) {
  return `ORDEM ${ordemId} (${papel}).`
}

export function textoDaOrdem(ordemId, papel, campos) {
  const criterios = campos.criterios.map((item, i) => `${i + 1}. ${item}`).join('\n')
  return [
    `# Ordem ${ordemId} (para ${papel})`,
    '',
    campos.titulo ? `**Título:** ${campos.titulo}\n` : '',
    `## Objetivo\n${campos.objetivo}\n`,
    `## Por quê\n${campos.porque}\n`,
    `## Critérios de aceite\n${criterios}\n`,
    `## Limites\n${campos.limites}\n`,
    `## Território\n${campos.territorio}\n`
  ].join('\n')
}

export function pedidoParaOrca(projeto, ordemId, papel, campos) {
  const papelArquivo = join(AQUI, 'papeis', `${papel}.md`)
  const ordemArquivo = join(projeto, '.hierarquia', 'ordens', `${ordemId}.md`)
  return semAcento(
    [
      marcadorDaOrdem(ordemId, papel),
      `PAPEL: ${papel} na hierarquia de chats do projeto ${projeto}.`,
      `Antes de qualquer coisa leia o seu papel em ${papelArquivo} e a sua ordem em ${ordemArquivo}.`,
      `Target: ${campos.territorio}.`,
      'Change: cumprir o objetivo descrito no arquivo da ordem.',
      'Constraints: os limites escritos na ordem e as proibicoes do seu papel.',
      'Ownership: somente o territorio escrito na ordem.',
      `Observable acceptance: produza a prova pedida nos criterios, rode: hierarquia entregar --ordem ${ordemId} --prova CAMINHO_DA_PROVA (uma opcao --prova por arquivo), e so depois envie worker_done como manda o seu preambulo.`
    ].join(' ')
  )
}
