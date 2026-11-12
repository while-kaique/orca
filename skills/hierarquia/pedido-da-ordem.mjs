// O texto da ordem (arquivo .md) e o pedido que vai ao Orca para abrir o chat dela.
import { join } from 'node:path'
import { semAcento } from './orca-lancador.mjs'

const AQUI = import.meta.dirname

/** Começa o pedido: é por ele que se acha a ordem digitada na tela do chat. */
export function marcadorDaOrdem(ordemId, papel) {
  return `ORDEM ${ordemId} (${papel}).`
}

/** O `task-list` do Orca só devolve este título, não o texto do pedido: é por ele que o chat novo é reconhecido. */
export function tituloDaTarefa(ordem) {
  return semAcento(`${ordem.papel}: ${ordem.campos.titulo ?? ordem.id}`).slice(0, 70)
}

/** Começo do texto enviado, como a tela mostra (uma linha, sem acento): serve para achar o texto na caixa do chat. */
export function trechoDoPedido(texto) {
  return semAcento(texto).replace(/\s+/gu, ' ').slice(0, 40)
}

export function pedidoDaCorrecao(ordemId, motivo) {
  return semAcento(
    `Sua entrega da ordem ${ordemId} foi REPROVADA. Motivo: ${motivo}. Corrija so o que o motivo aponta, produza prova nova, rode hierarquia entregar --ordem ${ordemId} --prova CAMINHO e depois envie worker_done.`
  )
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
