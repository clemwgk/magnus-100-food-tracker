import { createHash, randomBytes } from 'node:crypto'

function readHidden(prompt) {
  if (!process.stdin.isTTY) throw new Error('Run this helper in an interactive local terminal.')
  process.stdout.write(prompt)
  return new Promise((resolve, reject) => {
    let value = ''
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', (buffer) => {
      const key = buffer.toString('utf8')
      if (key === '\u0003') { cleanup(); reject(new Error('Cancelled.')); return }
      if (key === '\r' || key === '\n') { cleanup(); process.stdout.write('\n'); resolve(value); return }
      if (key === '\u007f' || key === '\b') {
        if (value) { value = value.slice(0, -1); process.stdout.write('\b \b') }
        return
      }
      if (!key.startsWith('\u001b')) { value += key; process.stdout.write('•') }
    })
    function cleanup() { process.stdin.setRawMode(false); process.stdin.pause() }
  })
}

try {
  const passcode = await readHidden('Enter the new family passcode (input is hidden): ')
  if (!passcode) throw new Error('A passcode is required.')
  const salt = randomBytes(24).toString('hex')
  const hash = createHash('sha256').update(`${salt}:${passcode}`, 'utf8').digest('hex')
  console.log('Add these two values to Apps Script Script Properties (not to this repository):')
  console.log(`FAMILY_PASSCODE_SALT=${salt}`)
  console.log(`FAMILY_PASSCODE_HASH=${hash}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Could not generate the passcode hash.')
  process.exitCode = 1
}
