import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/medduel/auth — register or login clinician
export async function POST(req: NextRequest) {
  const { email, display_name } = await req.json()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  // Upsert user
  const { data: existing } = await supabase
    .from('game_users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single()

  if (existing) {
    await supabase
      .from('game_users')
      .update({ last_active: new Date().toISOString() })
      .eq('id', existing.id)

    return NextResponse.json({ user: existing, created: false })
  }

  const { data: newUser, error } = await supabase
    .from('game_users')
    .insert({ email: email.toLowerCase(), display_name: display_name || null })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ user: newUser, created: true })
}

// PATCH /api/medduel/auth — verify NPI for existing user
export async function PATCH(req: NextRequest) {
  const { user_id, npi_number } = await req.json()

  if (!user_id || !npi_number) {
    return NextResponse.json({ error: 'user_id and npi_number required' }, { status: 400 })
  }

  if (!/^\d{10}$/.test(npi_number)) {
    return NextResponse.json({ error: 'NPI must be 10 digits' }, { status: 400 })
  }

  // Verify NPI via our own NPI route logic
  const npiRes = await fetch(
    `https://npiregistry.cms.hhs.gov/api/?number=${npi_number}&version=2.1&limit=1`
  )
  const npiData = await npiRes.json()

  if (!npiData.results || npiData.results.length === 0) {
    return NextResponse.json({ error: 'NPI not found in registry' }, { status: 400 })
  }

  const provider = npiData.results[0]
  const basic = provider.basic || {}
  const taxonomies: { desc?: string; primary?: boolean }[] = provider.taxonomies || []
  const primaryTax = taxonomies.find(t => t.primary) || taxonomies[0] || {}

  if (basic.status !== 'A') {
    return NextResponse.json({ error: 'NPI is not active' }, { status: 400 })
  }

  const isIndividual = provider.enumeration_type === 'NPI-1'
  const name = isIndividual
    ? [basic.first_name, basic.last_name].filter(Boolean).join(' ')
    : basic.organization_name || 'Unknown'

  const { data, error } = await supabase
    .from('game_users')
    .update({
      npi_number,
      npi_verified: true,
      npi_name: name,
      npi_credentials: basic.credential || '',
      npi_specialty: primaryTax.desc || '',
    })
    .eq('id', user_id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ user: data, verified: true })
}
