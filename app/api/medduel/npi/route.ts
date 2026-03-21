import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { npi } = await req.json()

  if (!npi || !/^\d{10}$/.test(npi)) {
    return NextResponse.json({ error: 'NPI must be exactly 10 digits' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `https://npiregistry.cms.hhs.gov/api/?number=${npi}&enumeration_type=&taxonomy_description=&name_purpose=&first_name=&use_first_name_alias=&last_name=&organization_name=&address_purpose=&city=&state=&postal_code=&country_code=&limit=1&skip=0&pretty=&version=2.1`,
      { next: { revalidate: 3600 } }
    )

    if (!res.ok) {
      return NextResponse.json({ error: 'NPI registry unavailable' }, { status: 502 })
    }

    const data = await res.json()

    if (!data.results || data.results.length === 0) {
      return NextResponse.json({ valid: false, error: 'NPI number not found in registry' }, { status: 404 })
    }

    const provider = data.results[0]
    const basic = provider.basic || {}
    const taxonomies: { desc?: string; primary?: boolean; license?: string }[] = provider.taxonomies || []
    const primaryTaxonomy = taxonomies.find(t => t.primary) || taxonomies[0] || {}

    // Individual provider
    const isIndividual = provider.enumeration_type === 'NPI-1'

    const name = isIndividual
      ? [basic.first_name, basic.last_name].filter(Boolean).join(' ')
      : basic.organization_name || 'Unknown'

    const credentials = basic.credential || ''
    const specialty = primaryTaxonomy.desc || ''
    const status = basic.status || 'A'

    if (status !== 'A') {
      return NextResponse.json({ valid: false, error: 'NPI is not active' }, { status: 400 })
    }

    return NextResponse.json({
      valid: true,
      npi,
      name,
      credentials,
      specialty,
      enumeration_type: provider.enumeration_type,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to verify NPI' }, { status: 500 })
  }
}
