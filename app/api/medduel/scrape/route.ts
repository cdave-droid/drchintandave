import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'change-me'

type RedditPost = {
  id: string
  title: string
  selftext: string
  url: string
  subreddit: string
  score: number
}

/** Fetch posts from Reddit JSON API (public, no auth needed) */
async function fetchRedditPosts(subreddit: string, limit = 25): Promise<RedditPost[]> {
  const res = await fetch(
    `https://www.reddit.com/r/${subreddit}/top.json?t=week&limit=${limit}`,
    { headers: { 'User-Agent': 'MedDuel/1.0' } }
  )
  if (!res.ok) return []
  const json = await res.json()
  return (json.data?.children ?? []).map((c: any) => ({
    id: c.data.id,
    title: c.data.title,
    selftext: c.data.selftext,
    url: `https://reddit.com${c.data.permalink}`,
    subreddit: c.data.subreddit,
    score: c.data.score,
  }))
}

/** Filter posts that look like actual medical cases (have enough text) */
function isMedicalCase(post: RedditPost): boolean {
  return (
    post.selftext.length > 200 &&
    !post.selftext.includes('[removed]') &&
    !post.selftext.includes('[deleted]')
  )
}

/** Use Claude to assess if a post is a valid medical case worth including */
async function assessCase(post: RedditPost): Promise<boolean> {
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 64,
      messages: [{
        role: 'user',
        content: `Is this a real medical case with enough clinical detail to create a diagnostic/management question? Reply only "yes" or "no".

Title: ${post.title}
Content: ${post.selftext.slice(0, 500)}`,
      }],
    })
    const text = msg.content[0].type === 'text' ? msg.content[0].text.toLowerCase() : ''
    return text.includes('yes')
  } catch {
    return false
  }
}

/** POST — trigger a scrape run */
export async function POST(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const auth = req.headers.get('x-admin-secret')
  if (auth !== ADMIN_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const subreddits = ['AskDocs', 'medical', 'medicine', 'DiagnoseMe', 'medicaladvice']
  const results = { imported: 0, skipped: 0, errors: 0 }

  for (const sub of subreddits) {
    try {
      const posts = await fetchRedditPosts(sub, 20)
      const candidates = posts.filter(isMedicalCase)

      for (const post of candidates) {
        // Check for duplicates by source_id
        const { data: existing } = await supabaseAdmin
          .from('cases')
          .select('id')
          .eq('source_id', post.id)
          .single()

        if (existing) { results.skipped++; continue }

        // AI-assess quality
        const isGood = await assessCase(post)
        if (!isGood) { results.skipped++; continue }

        // Insert as pending (requires admin approval before going active)
        const { error } = await supabaseAdmin.from('cases').insert({
          title: post.title.slice(0, 200),
          raw_content: post.selftext,
          source: 'reddit',
          source_url: post.url,
          source_id: post.id,
          status: 'pending',
          specialty: null,
          difficulty: 'medium',
        })

        if (error) { results.errors++; continue }
        results.imported++
      }
    } catch (err) {
      console.error(`[Scrape ${sub}]`, err)
      results.errors++
    }
  }

  return NextResponse.json({ ...results, message: 'Scrape complete.' })
}

/** GET — check scrape status / stats */
export async function GET(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const auth = req.headers.get('x-admin-secret')
  if (auth !== ADMIN_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: counts } = await supabaseAdmin
    .from('cases')
    .select('status, source')

  const stats: Record<string, Record<string, number>> = {}
  for (const row of (counts ?? []) as any[]) {
    if (!stats[row.source]) stats[row.source] = {}
    stats[row.source][row.status] = (stats[row.source][row.status] ?? 0) + 1
  }

  return NextResponse.json(stats)
}
