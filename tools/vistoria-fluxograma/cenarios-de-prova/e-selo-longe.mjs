// Tipo e: solta de proposito os selos (anexos) longe do card dono, so para provar que a vistoria pega.
// O selo solto do print de 13/11 nao tem causa achada no codigo; a vistoria trava qualquer selo a mais de 16.
export default async function (page, { lerTela, dizer }) {
  const fatos = await lerTela()
  if (fatos.selos.length === 0) {
    throw new Error('a copia do estado precisa de pelo menos um chat com selo (anexo)')
  }
  await page.addStyleTag({
    content: '.cc-chips { transform: translate(-340px, 170px) !important; }'
  })
  dizer(`${fatos.selos.length} selos deslocados de proposito (cenario)`)
}
