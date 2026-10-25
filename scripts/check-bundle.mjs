#!/usr/bin/env node
/**
 * check-bundle.mjs
 * Scans compiled output for forbidden words that reveal decoy identity.
 * Run as postbuild step.
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const BUILD_DIR = resolve(ROOT, 'decoy/static/bank-app')

const FORBIDDEN = /\b(ARGUS|honeypot|decoy|demo|simulation|telemetry|Kiro)\b/gi

function walk(dir) {
  let files = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      files = files.concat(walk(full))
    } else {
      files.push(full)
    }
  }
  return files
}

let errorCount = 0

try {
  const files = walk(BUILD_DIR)
  for (const file of files) {
    // Only scan text files
    if (!/\.(js|css|html|json|txt|map)$/.test(file)) continue
    const content = readFileSync(file, 'utf8')
    const matches = content.match(FORBIDDEN)
    if (matches) {
      for (const m of [...new Set(matches)]) {
        console.error(`ERROR: forbidden word "${m}" found in ${file.replace(ROOT + '/', '')}`)
        errorCount++
      }
    }
  }
} catch (e) {
  console.error(`ERROR: Could not scan build output: ${e.message}`)
  process.exit(1)
}

if (errorCount > 0) {
  console.error(`\n✗ bundle check FAILED with ${errorCount} error(s).`)
  process.exit(1)
} else {
  console.log('✓ bundle check passed')
  process.exit(0)
}
