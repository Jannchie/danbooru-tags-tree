import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { basename } from 'node:path'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig, type Plugin } from 'vite'

const REQUIRED_OUTPUTS = [
  'taxonomy.json',
  'translations.json',
  'tag_frequency.json',
  'graph-layout.json',
] as const

function runBuildData(args: string[] = []): void {
  const commandArgs = ['build:data']

  if (args.length > 0) {
    commandArgs.push('--', ...args)
  }

  // `pnpm` is a shim on Windows, so it needs a shell to be spawnable.
  execFileSync('pnpm', commandArgs, { stdio: 'inherit', shell: process.platform === 'win32' })
}

/**
 * Vite plugin that rebuilds data JSON files when source YAML/CSV changes.
 * Only active in dev/serve mode.
 */
function dataRebuilder(): Plugin {
  return {
    name: 'data-rebuilder',
    configureServer(server) {
      const sourceDir = fileURLToPath(new URL('./data/source', import.meta.url))
      const outputDir = fileURLToPath(new URL('./public/output', import.meta.url))

      const missingOutputs = REQUIRED_OUTPUTS.filter((file) => !existsSync(`${outputDir}/${file}`))

      if (missingOutputs.length > 0) {
        console.log(`[data-rebuilder] Missing build artifacts (${missingOutputs.join(', ')}), rebuilding...`)
        runBuildData()
      }

      server.watcher.add(sourceDir)
      server.watcher.on('change', (path) => {
        if (!path.startsWith(sourceDir)) return

        console.log(`\n[data-rebuilder] ${path} changed, rebuilding...`)
        try {
          runBuildData([basename(path)])
          console.log('[data-rebuilder] Done. Reloading...')
          server.ws.send({ type: 'full-reload' })
        } catch {
          console.error('[data-rebuilder] Build failed.')
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), dataRebuilder()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
