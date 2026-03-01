import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

export async function seed() {
  console.log('Seeding database...')

  // Placeholder: add seed data here as the app grows.
  // Example:
  // const { error } = await supabase.from('profiles').insert([...])
  // if (error) throw error

  console.log('Seed complete.')
}

// Allow running directly: npx ts-node scripts/seed.ts
if (require.main === module) {
  seed().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
