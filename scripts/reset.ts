import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { seed } from './seed'

const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_initial_schema.sql')

function prompt(question: string): Promise<void> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, () => {
      rl.close()
      resolve()
    })
  })
}

async function reset() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Database Reset')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log()
  console.log('Please run the migration SQL manually in the Supabase SQL editor:')
  console.log()
  console.log(`  File: ${sqlPath}`)
  console.log()
  console.log('Steps:')
  console.log('  1. Open https://supabase.com/dashboard → your project → SQL Editor')
  console.log('  2. Paste the contents of the migration file above')
  console.log('  3. Click "Run"')
  console.log()

  await prompt('Press Enter once the migration is complete...')

  console.log()
  await seed()
}

reset().catch((err) => {
  console.error(err)
  process.exit(1)
})
