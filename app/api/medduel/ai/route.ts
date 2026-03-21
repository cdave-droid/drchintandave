import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import type { Question } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const AI_DOCTOR_ELO = 1350 // AI baseline ELO for ELO calculations

const AI_ELO = AI_DOCTOR_ELO

/** Ask the AI doctor to answer all questions for a case */
export async function POST(req: NextRequest) {
  try {
    const { caseContent, questions } = await req.json() as {
      caseContent: string
      questions: Question[]
    }

    if (!caseContent || !questions?.length) {
      return NextResponse.json({ error: 'Missing caseContent or questions' }, { status: 400 })
    }

    const questionsText = questions.map((q, i) => {
      if (q.type === 'mcq' && q.options) {
        const opts = q.options.map(o => `  ${o.label}. ${o.text}`).join('\n')
        return `Q${i + 1} [MCQ]: ${q.question_text}\n${opts}`
      }
      return `Q${i + 1} [Open]: ${q.question_text}`
    }).join('\n\n')

    const prompt = `You are an expert AI physician with broad clinical knowledge. You will review a medical case and answer the questions that follow.

MEDICAL CASE:
${caseContent}

QUESTIONS:
${questionsText}

For each question, provide your answer in this exact JSON format:
{
  "answers": {
    "${questions[0]?.id}": "your answer here",
    ${questions.slice(1).map(q => `"${q.id}": "your answer here"`).join(',\n    ')}
  },
  "reasoning": {
    "${questions[0]?.id}": "brief clinical reasoning",
    ${questions.slice(1).map(q => `"${q.id}": "brief clinical reasoning"`).join(',\n    ')}
  }
}

For MCQ questions, answer with just the option letter (A, B, C, D, or E).
For open questions, provide a concise clinical answer (1-3 sentences).
Be decisive — pick the single best answer.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('AI did not return valid JSON')
    }

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json({ answers: parsed.answers, reasoning: parsed.reasoning })
  } catch (err) {
    console.error('[AI Route Error]', err)
    return NextResponse.json({ error: 'AI failed to respond' }, { status: 500 })
  }
}

/** Ask the AI to grade open-ended answers */
export async function PUT(req: NextRequest) {
  try {
    const { question, correctAnswer, userAnswer } = await req.json() as {
      question: string
      correctAnswer: string
      userAnswer: string
    }

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `You are grading a medical student's open-ended answer.

Question: ${question}
Correct/Expected answer: ${correctAnswer}
Student's answer: ${userAnswer}

Grade this answer on a scale of 0-100 based on clinical accuracy and completeness.
Return ONLY a JSON object: {"score": <0-100>, "feedback": "<1-2 sentence feedback>"}`,
      }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { score: 0, feedback: 'Unable to grade.' }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[Grade Route Error]', err)
    return NextResponse.json({ score: 0, feedback: 'Grading failed.' }, { status: 500 })
  }
}
