import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const roots = ['src', 'apps-script', 'public', 'scripts', 'dist'].filter(existsSync)
const values = ['AIRTABLE_TOKEN', 'AIRTABLE_BASE_ID', 'FAMILY_PASSCODE_HASH', 'FAMILY_PASSCODE_SALT', 'TEST_FAMILY_PASSCODE', 'TEST_AIRTABLE_TOKEN']
  .map((name) => process.env[name]).filter((value) => typeof value === 'string' && value.length >= 8)
const tokenPattern = /\bpat[a-zA-Z0-9]{20,}\b/g
const findings = []

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const file = join(directory, entry)
    if (statSync(file).isDirectory()) walk(file)
    else {
      const content = readFileSync(file, 'utf8')
      const leaked = tokenPattern.test(content) || values.some((value) => content.includes(value))
      tokenPattern.lastIndex = 0
      if (leaked) findings.push(relative(process.cwd(), file))
    }
  }
}
roots.forEach(walk)
if (findings.length) {
  console.error(`Secret scan failed: ${findings.length} source or deploy file(s) contain a token-shaped or configured secret value.`)
  process.exitCode = 1
} else console.log('Secret scan passed: no token-shaped or configured secret values found in source or deploy output.')
