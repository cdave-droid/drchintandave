import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'change-me'

function checkAuth(req: NextRequest) {
  const auth = req.headers.get('x-admin-secret')
  return auth === ADMIN_SECRET
}

/** GET — list pending submissions or cases */
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const type = req.nextUrl.searchParams.get('type') ?? 'submissions'

  if (type === 'submissions') {
    const { data } = await supabaseAdmin
      .from('submitted_cases')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    return NextResponse.json(data ?? [])
  }

  // Pending cases awaiting activation
  const { data } = await supabaseAdmin
    .from('cases')
    .select('id, title, source, specialty, difficulty, status, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  return NextResponse.json(data ?? [])
}

/** POST — approve a submission: AI generates questions, then activates the case */
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { submissionId, difficulty, specialty } = await req.json()

  const { data: submission, error } = await supabaseAdmin
    .from('submitted_cases')
    .select('*')
    .eq('id', submissionId)
    .single()

  if (error || !submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
  }

  // Ask AI to generate structured vignette + questions
  const aiPrompt = `You are a medical educator. Convert the following raw medical case into a structured case with questions.

RAW CASE:
${submission.raw_content}

Generate a JSON response with this structure:
{
  "structured_vignette": {
    "patient": "age, sex",
    "chief_complaint": "main presenting complaint",
    "history": "HPI and relevant history",
    "vitals": "if mentioned",
    "labs_imaging": "if mentioned",
    "physical_exam": "if mentioned"
  },
  "questions": [
    {
      "question_text": "What is the most likely diagnosis?",
      "type": "mcq",
      "options": [
        {"label": "A", "text": "Option A", "is_correct": false},
        {"label": "B", "text": "Option B", "is_correct": true},
        {"label": "C", "text": "Option C", "is_correct": false},
        {"label": "D", "text": "Option D", "is_correct": false}
      ],
      "correct_answer": "B",
      "explanation": "Explanation of the correct answer"
    },
    {
      "question_text": "What is the initial management?",
      "type": "open",
      "correct_answer": "Expected answer for grading",
      "explanation": "Detailed explanation"
    }
  ]
}

Generate 2-4 questions. Mix MCQ and open-ended. Make questions clinically relevant.`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: aiPrompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
  const jsonMatch = text.match(/\{[\s\S]*\}/)

  if (!jsonMatch) {
    return NextResponse.json({ error: 'AI failed to generate questions' }, { status: 500 })
  }

  const generated = JSON.parse(jsonMatch[0])

  // Insert case
  const { data: newCase } = await supabaseAdmin
    .from('cases')
    .insert({
      title: submission.title,
      raw_content: submission.raw_content,
      structured_vignette: generated.structured_vignette,
      source: 'community',
      source_url: submission.source_url,
      difficulty: difficulty ?? 'medium',
      specialty: specialty ?? submission.specialty,
      status: 'active',
      approved_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (!newCase) return NextResponse.json({ error: 'Failed to create case' }, { status: 500 })

  // Insert questions
  const questionsToInsert = generated.questions.map((q: any, i: number) => ({
    case_id: newCase.id,
    question_text: q.question_text,
    type: q.type ?? 'mcq',
    options: q.options ?? null,
    correct_answer: q.correct_answer ?? null,
    explanation: q.explanation ?? null,
    order_index: i,
  }))

  await supabaseAdmin.from('questions').insert(questionsToInsert)

  // Mark submission approved
  await supabaseAdmin
    .from('submitted_cases')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', submissionId)

  return NextResponse.json({ caseId: newCase.id, message: 'Case approved and activated.' })
}

/** DELETE — reject a submission */
export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { submissionId, reason } = await req.json()

  await supabaseAdmin
    .from('submitted_cases')
    .update({
      status: 'rejected',
      rejection_reason: reason ?? 'Does not meet quality standards.',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', submissionId)

  return NextResponse.json({ message: 'Submission rejected.' })
}
