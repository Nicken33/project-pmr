// Скачивает фото для демо (npm run demo:photos) по списку mock/media/demo/CREDITS.txt.
// Фото с Wikimedia Commons, свободные лицензии; авторы и ссылки — в CREDITS.txt.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'media', 'demo')
const rows = fs.readFileSync(path.join(dir, 'CREDITS.txt'), 'utf8').trim().split('\n').slice(1)

let ok = 0
for (const row of rows) {
  const [file, source] = row.split('\t')
  const out = path.join(dir, file)
  if (fs.existsSync(out)) {
    ok++
    continue
  }
  const name = source.replace(/^File:/, '').replace(/ /g, '_')
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=1600`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'talentro-demo/1.0' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()))
    ok++
    console.log('✓', file)
  } catch (e) {
    console.log('✗', file, e.message)
  }
}
console.log(`Готово: ${ok} из ${rows.length}`)
