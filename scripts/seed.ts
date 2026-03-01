import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchCriteria {
  required_skills: string[]
  preferred_domains: string[]
  collaboration_style: string
  ideal_intent: string[]
  deal_breakers: string
  summary: string
}

interface ProfileRow {
  id: string
  user_id: string | null
  name: string
  image_url: string
  bio: string
  ikigai_love: string
  ikigai_good_at: string
  ikigai_world_needs: string
  ikigai_paid_for: string
  ikigai_mission: string
  skills: string[]
  interests: string[]
  availability: 'full_time' | 'part_time' | 'weekends'
  working_style: 'async' | 'sync' | 'hybrid'
  intent: string[]
  portfolio_url: string | null
  linkedin_url: string | null
  github_url: string | null
  twitter_url: string | null
  cv_url: string | null
  is_public: boolean
  profile_completion_score: number
  match_criteria: MatchCriteria | null
  created_at: string
  updated_at: string
}

interface ConnectionRow {
  id: string
  requester_id: string
  receiver_id: string
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
}

interface MessageRow {
  id: string
  connection_id: string
  sender_id: string
  content: string
  created_at: string
  read_at: string | null
}

interface MatchRow {
  id: string
  user_id: string
  matched_profile_id: string
  score: number
  one_liner: string
  explanation: string | null
  computed_at: string
}

interface SeedData {
  profiles: ProfileRow[]
  connections: ConnectionRow[]
  messages: MessageRow[]
  matches: MatchRow[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

async function insertChunked(table: string, rows: object[], chunkSize = 50): Promise<void> {
  const chunks = chunk(rows, chunkSize)
  for (let i = 0; i < chunks.length; i++) {
    const { error } = await supabase.from(table).insert(chunks[i])
    if (error) {
      throw new Error(`Insert into '${table}' (chunk ${i + 1}/${chunks.length}) failed: ${error.message}`)
    }
  }
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

export async function seed(): Promise<void> {
  const dataPath = path.join(__dirname, 'seed-data.json')

  if (!fs.existsSync(dataPath)) {
    throw new Error(`seed-data.json not found at ${dataPath}`)
  }

  const data: SeedData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))

  console.log('Seeding database...')
  console.log()

  // 1. Profiles — no FK deps within our seed tables
  process.stdout.write(`  profiles     ${data.profiles.length} rows... `)
  await insertChunked('profiles', data.profiles)
  console.log('done')

  // 2. Matches — FK → profiles(id)
  process.stdout.write(`  matches      ${data.matches.length} rows... `)
  await insertChunked('matches', data.matches)
  console.log('done')

  // 3. Connections — FK → profiles(id)
  process.stdout.write(`  connections  ${data.connections.length} rows... `)
  await insertChunked('connections', data.connections)
  console.log('done')

  // 4. Messages — FK → connections(id) + profiles(id)
  process.stdout.write(`  messages     ${data.messages.length} rows... `)
  await insertChunked('messages', data.messages)
  console.log('done')

  console.log()
  console.log('Seed complete.')
}

// Allow running directly: npm run db:seed
if (require.main === module) {
  seed().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
