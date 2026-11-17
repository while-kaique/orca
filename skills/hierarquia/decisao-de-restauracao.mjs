// `hierarquia restaurar`: quem pode restaurar qual chat. Puro.
import { MODELO_DO_TESTE, PAPEIS } from './regras.mjs'

/**
 * Quem pode restaurar o chat antigo: o PO atual restaura os chats abaixo dele (ou quem criou a ordem); o PO morto
 * e restaurado por qualquer chat, desde que o projeto esteja sem PO (ou o registrado seja o proprio antigo).
 */
export function decidirRestauracao(estado, { eu, chatAnterior, vida }) {
  const antigo = estado.chats[chatAnterior]
  if (!antigo) {
    return { acao: 'recusar', motivo: `O chat ${chatAnterior} não está no registro deste projeto.` }
  }
  if (vida === 'ligado') {
    return {
      acao: 'recusar',
      motivo: `O chat ${chatAnterior} ainda está ligado (com terminal vivo): restaurar abriria um segundo chat para o mesmo trabalho. Feche a aba dele primeiro.`
    }
  }
  const poSemDono = estado.po === null || estado.po === antigo.id
  const pode = antigo.papel === 'po' ? poSemDono : eu === estado.po || eu === antigo.pai
  if (!pode) {
    return {
      acao: 'recusar',
      motivo:
        antigo.papel === 'po'
          ? `Este projeto já tem outro PO aberto (${String(estado.po)}); feche a aba dele antes de restaurar o PO antigo.`
          : 'Só o PO atual (ou quem criou a ordem) restaura o chat de uma ordem.'
    }
  }
  return {
    acao: 'restaurar',
    papel: antigo.papel,
    modelo: antigo.teste ? MODELO_DO_TESTE : PAPEIS[antigo.papel].modelo
  }
}
