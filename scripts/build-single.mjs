/**
 * build-single.mjs
 * Viteのビルド成果物をひとつのHTMLファイルにインライン化する。
 * file:// で開いても動作する（Service Workerは不要、localStorage で完全オフライン動作）。
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, join } from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')
const DIST = join(ROOT, 'dist')
const OUT = join(ROOT, 'yoused-inventory.html')

// ── 1. ビルド ──────────────────────────────────────────────────────────────
console.log('\n🔨 Building...')
execSync('npm run build', { stdio: 'inherit', cwd: ROOT })

// ── 2. dist/index.html を読み込む ──────────────────────────────────────────
let html = readFileSync(join(DIST, 'index.html'), 'utf-8')

// ── 3. CSS をインライン化 ──────────────────────────────────────────────────
html = html.replace(
  /<link\s+rel="stylesheet"\s+crossorigin\s+href="([^"]+)">/g,
  (_, href) => {
    const filePath = join(DIST, href.replace(/^\//, ''))
    if (!existsSync(filePath)) {
      console.warn(`  ⚠️  CSS not found: ${filePath}`)
      return ''
    }
    const css = readFileSync(filePath, 'utf-8')
    console.log(`  ✓ Inlined CSS  (${(css.length / 1024).toFixed(1)} KB): ${href}`)
    return `<style>${css}</style>`
  }
)

// ── 4. JS をインライン化 ───────────────────────────────────────────────────
html = html.replace(
  /<script\s+type="module"\s+crossorigin\s+src="([^"]+)"><\/script>/g,
  (_, src) => {
    const filePath = join(DIST, src.replace(/^\//, ''))
    if (!existsSync(filePath)) {
      console.warn(`  ⚠️  JS not found: ${filePath}`)
      return ''
    }
    const js = readFileSync(filePath, 'utf-8')
    console.log(`  ✓ Inlined JS   (${(js.length / 1024).toFixed(1)} KB): ${src}`)
    // type="module" を維持（strict mode + 遅延実行が保たれる）
    return `<script type="module">${js}</script>`
  }
)

// ── 5. modulepreload リンクは削除（インライン化済みのため不要）────────────
html = html.replace(/<link\s+rel="modulepreload"[^>]*>/g, '')

// ── 6. manifest.json / favicon の外部参照を除去（file:// では読めない）──
html = html.replace(/<link\s+rel="manifest"[^>]*>/g, '')
html = html.replace(/<link\s+rel="icon"[^>]*>/g, '')

// ── 7. 出力 ───────────────────────────────────────────────────────────────
writeFileSync(OUT, html, 'utf-8')
const sizeKB = (html.length / 1024).toFixed(0)
console.log(`\n✅ Done → yoused-inventory.html  (${sizeKB} KB)`)
console.log('   iPadのSafariでこのファイルを開くだけで動作します。\n')
