// Fails the build if anything from docs/ reached dist/. The plans and renders
// are in the public repo, but the site has no use for them: it ships only the
// model.
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const bad = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(pdf|jpe?g)$/i.test(name) || p.includes('/docs/')) bad.push(p)
  }
}
const out = process.argv[2] ?? 'dist'
walk(out)
if (bad.length) {
  console.error(`${out} contains files that must not be deployed:\n  ` + bad.join('\n  '))
  process.exit(1)
}
console.log('check-dist: ok')
