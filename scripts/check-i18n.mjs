#!/usr/bin/env node
/**
 * check-i18n.mjs
 * Validates translation completeness and Amharic allow-list compliance.
 * Run as prebuild step.
 *
 * Amharic allow-list: PDF, JPG, PNG, DOC, DOCX, @, ., example.com
 * The email value "support@geberewbank.example.com" is handled as a whole-value
 * exemption when the value is an email address (contains @).
 * "English" is allowed as the UI language toggle button label.
 * KB and MB are file-size units necessarily shown to the user.
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { resolve, dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// Explicit word-level allow-list (case-insensitive comparison)
const ALLOW_WORDS_UPPER = new Set(['PDF', 'JPG', 'PNG', 'DOC', 'DOCX', 'KB', 'MB', 'GB', 'ENGLISH'])
// Whole-value exemptions: if the entire value matches one of these patterns, skip all checks
const ALLOW_PATTERN = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/ // email addresses

function loadJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch (e) {
    console.error(`ERROR: Cannot read ${filePath}: ${e.message}`)
    process.exit(1)
  }
}

const enPath = resolve(ROOT, 'decoy-ui-app/src/i18n/en.json')
const amPath = resolve(ROOT, 'decoy-ui-app/src/i18n/am.json')

const en = loadJson(enPath)
const am = loadJson(amPath)

let errors = 0

// Check key parity: en → am
for (const key of Object.keys(en)) {
  if (!(key in am)) {
    console.error(`ERROR: Key "${key}" exists in en.json but not in am.json`)
    errors++
  }
}

// Check key parity: am → en
for (const key of Object.keys(am)) {
  if (!(key in en)) {
    console.error(`ERROR: Key "${key}" exists in am.json but not in en.json`)
    errors++
  }
}

// Check non-empty values
for (const [key, val] of Object.entries(en)) {
  if (typeof val !== 'string' || val.trim() === '') {
    console.error(`ERROR: en.json key "${key}" has an empty value`)
    errors++
  }
}
for (const [key, val] of Object.entries(am)) {
  if (typeof val !== 'string' || val.trim() === '') {
    console.error(`ERROR: am.json key "${key}" has an empty value`)
    errors++
  }
}

// Check Amharic allow-list
for (const [key, val] of Object.entries(am)) {
  // Whole-value exemption: if value is an email address, skip
  if (ALLOW_PATTERN.test(val.trim())) continue

  // Extract Latin-letter sequences (contiguous alpha chars, optionally with digits)
  const latinWords = val.match(/[a-zA-Z][a-zA-Z]*/g) || []
  for (const word of latinWords) {
    if (!ALLOW_WORDS_UPPER.has(word.toUpperCase())) {
      console.error(`ERROR: am.json key "${key}" contains disallowed Latin word "${word}" in value: "${val}"`)
      errors++
    }
  }
}

if (errors > 0) {
  console.error(`\n✗ i18n check FAILED with ${errors} error(s).`)
  process.exit(1)
} else {
  console.log('✓ i18n check passed')
  process.exit(0)
}
