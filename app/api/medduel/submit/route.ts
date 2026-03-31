import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

/** POST — community submits a new case for admin review */
export async function POST(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  try {
    const { title, rawContent, specialty, sourceUrl, submitterName, submitterEmail, notes } =
      await req.json()

    if (!title?.trim() || !rawContent?.trim()) {
      return NextResponse.json({ error: 'Title and case content are required.' }, { status: 400 })
    }

    if (rawContent.length < 100) {
      return NextResponse.json(
        { error: 'Case content is too short. Please provide a detailed case.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('submitted_cases')
      .insert({
        title: title.slice(0, 200),
        raw_content: rawContent.slice(0, 10000),
        specialty: specialty || null,
        source_url: sourceUrl || null,
        submitter_name: submitterName || null,
        submitter_email: submitterEmail || null,
        notes: notes || null,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ id: data.id, message: 'Case submitted for review.' })
  } catch (err) {
    console.error('[Submit Error]', err)
    return NextResponse.json({ error: 'Submission failed.' }, { status: 500 })
  }
}
