import { expect, it } from 'vitest'
import { imagePathsIn } from './canvas-chat-artifacts'

it('finds the image files a chat printed, with or without spaces in the folder', () => {
  const text = [
    'Read(C:\\Users\\User\\Desktop\\Projetos\\Astra Designer\\saida\\banner final.png)',
    'salvo em /c/Users/User/AppData/Local/Temp/shot-2.jpeg e pronto',
    'veja C:/tmp/a.txt e depois C:/tmp/b.webp.'
  ].join('\n')
  expect(imagePathsIn(text)).toEqual([
    'C:\\Users\\User\\Desktop\\Projetos\\Astra Designer\\saida\\banner final.png',
    '/c/Users/User/AppData/Local/Temp/shot-2.jpeg',
    'C:/tmp/b.webp'
  ])
})
it('leaves out web addresses and paths that are not whole', () => {
  const text = [
    'https://exemplo.com/img/foto.png',
    'docs/imagens/tela.png',
    'veja em file:///C:/tmp/c.png'
  ].join('\n')
  expect(imagePathsIn(text)).toEqual([])
})
