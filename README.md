# SuperNetworkAI

AI-powered networking platform to find cofounders, teammates, and clients based on Ikigai, skills, and intelligent matching.

## Features

- **AI-powered matching** — Scores every profile pair using OpenAI `gpt-4o-mini`, your Ikigai, skills, and collaboration intent
- **Ikigai onboarding** — 4-step flow: import from CV / LinkedIn URL / manual entry → skills & availability → Ikigai questions → review & photo
- **Discover** — Card-stack interface to skip or connect with top-ranked matches
- **My Matches** — Filterable / sortable grid of all AI-computed matches with compatibility explanations
- **Semantic search** — Natural-language search by skills & intent (AI-ranked) plus fuzzy name search
- **Connections** — Send, accept, decline, and cancel connection requests
- **Real-time messaging** — 1-on-1 chat over Supabase Realtime with optimistic UI and read receipts
- **Notifications** — Live badge counts and grouped notification feed (connections, messages, matches)
- **Profile editing** — Completion score (0–100), AI match-criteria regeneration, avatar upload
- **Privacy controls** — Toggle public/private visibility; block and unblock users
- **Error boundaries** — Friendly error pages at root, dashboard, and settings levels
- **Mobile-first UI** — Bottom navigation on mobile, responsive grids, iOS safe-area aware

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, SSR + ISR) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + shadcn/ui (new-york, slate) |
| Database / Auth | Supabase (PostgreSQL, Row-Level Security, Realtime) |
| Storage | Supabase Storage (profile images) |
| AI | OpenAI `gpt-4o-mini` |
| CV parsing | `pdf-parse` + custom URL scraper |
| Icons | `lucide-react` |

## Setup

### 1. Clone and install

```bash
git clone https://github.com/your-org/supernetwork-ai.git
cd supernetwork-ai
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In **Project Settings → API**, copy the **Project URL**, **anon key**, and **service_role key**
3. Enable the **`vector`** extension in **Database → Extensions**
4. Enable **Email** auth provider in **Authentication → Providers**
5. Create an `images` storage bucket in **Storage** and set it to **public**

### 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `OPENAI_API_KEY` | OpenAI API key (`gpt-4o-mini`) |
| `NEXT_PUBLIC_APP_URL` | Deployment URL (e.g. `http://localhost:3000`) |

### 4. Run the database migration

In the Supabase dashboard, open **SQL Editor** and run the contents of:

```
supabase/migrations/001_initial_schema.sql
```

This creates all tables (`profiles`, `matches`, `connections`, `messages`, `notifications`, `blocks`) with Row-Level Security policies.

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database Reset

To drop all tables, recreate them from the migration, and seed demo profiles:

```bash
npm run db:reset
```

Requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

To seed without dropping tables:

```bash
npm run db:seed
```

## Project Structure

```
app/
├── (auth)/           # Login & signup pages
├── auth/callback/    # Supabase OAuth callback
├── onboarding/       # 4-step onboarding (start → social → details → ikigai → review)
├── dashboard/        # Protected pages: discover, matches, search, connections, messages, notifications
├── profile/[id]/     # Public profile page
├── settings/         # Profile editor and privacy controls
└── api/              # Route handlers (connections, matches, search, blocks, messages, profile)

components/           # Shared UI components (dashboard-layout, profile-card, profile-actions, etc.)
lib/                  # Supabase clients, OpenAI client, utils, constants
types/                # TypeScript interfaces (Profile, Match, Connection, Message, Notification, Block)
scripts/              # seed.ts and reset.ts (run with ts-node)
supabase/migrations/  # SQL schema
```
