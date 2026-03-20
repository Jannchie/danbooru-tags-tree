import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const OUT = resolve(ROOT, 'public', 'output')
const REQUIRED_OUTPUTS = [
  'taxonomy.json',
  'translations.json',
  'tag_frequency.json',
  'graph-layout.json',
] as const

function hasRequiredOutputs(): boolean {
  return REQUIRED_OUTPUTS.every((file) => existsSync(resolve(OUT, file)))
}

if (!hasRequiredOutputs()) {
  console.log('[dev] Missing build artifacts, running `pnpm build:data`...')

  const build = spawnSync('pnpm', ['build:data'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (build.status !== 0) {
    process.exit(build.status ?? 1)
  }
}

const viteArgs = ['exec', 'vite', '--port', '5832', ...process.argv.slice(2)]
const vite = spawn('pnpm', viteArgs, {
  cwd: ROOT,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

vite.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
