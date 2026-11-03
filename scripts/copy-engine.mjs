import { mkdir, copyFile, access } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const destination = join(root, 'public', 'engine')
const source = join(root, 'node_modules', 'stockfish', 'bin')
const filenames = ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']

try {
  await mkdir(destination, { recursive: true })
  for (const filename of filenames) {
    await access(join(source, filename))
    await copyFile(join(source, filename), join(destination, filename))
  }
  console.log('✔ Silnik Stockfish 19 Lite WASM jest gotowy do pracy lokalnej.')
} catch (error) {
  console.error('Nie udało się przygotować plików Stockfish. Uruchom npm install. ', error)
  process.exitCode = 1
}
