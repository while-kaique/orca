// Tira print de um arquivo HTML solto (ex.: uma página de opções antes de publicar), sem abrir janela.
// Uso: node tools/vistoria-fluxograma/print-html.mjs entrada.html saida.png [largura]
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright-core'

const [, , input, output, width = '900'] = process.argv
const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font:14px system-ui}</style></head><body>${readFileSync(input, 'utf8')}</body></html>`
const wrapped = output.replace(/\.png$/u, '.full.html')
writeFileSync(wrapped, page)

let browser
for (const channel of [undefined, 'chrome', 'msedge']) {
  try {
    browser = await chromium.launch(channel ? { channel } : {})
    break
  } catch {
    // Tenta o próximo navegador instalado.
  }
}
if (!browser) {
  throw new Error(
    'Nenhum navegador sem janela encontrado (Chromium do Playwright, Chrome ou Edge).'
  )
}
const tab = await browser.newPage({ viewport: { width: Number(width), height: 900 } })
await tab.goto(pathToFileURL(wrapped).href)
await tab.screenshot({ path: output, fullPage: true })
await browser.close()
console.log(output)
