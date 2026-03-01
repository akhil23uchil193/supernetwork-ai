import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import readline from 'readline'
import { createClient } from '@supabase/supabase-js'
import { seed } from './seed'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function prompt(question: string): Promise<void> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, () => {
      rl.close()
      resolve()
    })
  })
}

// Deletes all rows from a table. Service role bypasses RLS.
// The .neq filter is required by PostgREST for safety — no real row has the nil UUID.
async function clearTable(table: string): Promise<number> {
  const { error, count } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (error) {
    // Table may not exist yet if migration hasn't been run
    if (error.message.includes('does not exist') || error.code === '42P01') {
      console.log(`  ${table.padEnd(14)} not found — run migration SQL first`)
      return 0
    }
    throw new Error(`Failed to clear '${table}': ${error.message}`)
  }

  return count ?? 0
}

// ─── Reset ────────────────────────────────────────────────────────────────────

async function reset(): Promise<void> {
  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_initial_schema.sql')

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Database Reset + Seed')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log()
  console.log('Step 1 — Schema migration (if tables do not exist)')
  console.log()
  console.log('  Run the migration SQL in the Supabase SQL editor:')
  console.log(`  File: ${sqlPath}`)
  console.log()
  console.log('  1. Open https://supabase.com/dashboard → your project → SQL Editor')
  console.log('  2. Paste the contents of the file above and click Run')
  console.log('  3. Return here and press Enter')
  console.log()
  console.log('  (Skip if the schema is already up to date.)')
  console.log()

  await prompt('Press Enter to continue...')

  console.log()
  console.log('Step 2 — Clearing existing data')
  console.log()

  // Clear in reverse FK dependency order so constraints are never violated.
  // profiles → (matches, connections → messages, blocks, notifications)
  const tables = [
    'notifications',
    'blocks',
    'messages',
    'connections',
    'matches',
    'profiles',
  ]

  for (const table of tables) {
    const deleted = await clearTable(table)
    console.log(`  ${table.padEnd(14)} ${deleted} rows deleted`)
  }

  console.log()
  console.log('Step 3 — Seeding')
  console.log()

  await seed()
}

reset().catch((err) => {
  console.error(err)
  process.exit(1)
})
