/**
 * Prompt builders for the two narrow LLM jobs. Both ask for JSON-only replies
 * so the routes can parse deterministically; both have rule-based fallbacks.
 */

export function extractRfpPrompt(rawText: string): string {
  return [
    "Extract these fields from the following construction RFP listing.",
    "Reply with JSON only, no prose. Use null for any field you can't determine confidently.",
    'Shape: { "title": string, "description": string, "ownerCompany": string|null, "location": string|null, "estimatedValueUSD": number|null, "postedDate": string|null }',
    "",
    rawText.slice(0, 6000),
  ].join("\n");
}

export function extractContactsPrompt(rawText: string): string {
  return [
    "Extract every named person and their role from this construction RFP or bid listing.",
    "Only real people with a first and last name. Skip organizations, bill titles, page headings, and legislation.",
    "Focus on people who would influence awarding the contract — owners, developers, directors of construction, real estate, facilities.",
    "Reply with JSON array only. If none found, return [].",
    'Shape: [{ "name": string, "title": string|null, "company": string|null }]',
    "",
    rawText.slice(0, 6000),
  ].join("\n");
}

export function extractOrgPeoplePrompt(rawText: string, org: string): string {
  return [
    `From the web page text below, extract real individual people (first + last name) who work at or are affiliated with "${org}".`,
    "Only include people in roles relevant to planning, awarding, or managing construction, facilities, real estate, capital projects, development, public works, or procurement.",
    "Include directors, VPs, chiefs, and managers in those areas. Exclude general contractors, architects, engineering vendors, journalists, and anyone not at this organization.",
    "Do NOT return organization names, page headings, list titles, or generic phrases.",
    "Reply with JSON array only. If none found, return [].",
    'Shape: [{ "name": string, "title": string|null, "company": string|null, "relevanceNote": string }]',
    `relevanceNote must be one complete sentence on why this person is relevant to outreach about ${org}'s construction projects.`,
    "",
    rawText.slice(0, 6000),
  ].join("\n");
}

export function extractArticleContactsPrompt(rawText: string): string {
  return [
    "Extract ONLY real individual people (first + last name) from this construction industry news article.",
    "Do NOT return organization names, page headings, ranking list titles, legislation, or generic phrases.",
    "Include only owner-side decision-makers: developers, agency officials, directors of construction/real estate/facilities who awarded or announced a project.",
    "Skip general contractors, architects, and subcontractors.",
    "Reply with JSON array only. If none found, return [].",
    'Shape: [{ "name": string, "title": string|null, "company": string|null, "relevanceNote": string }]',
    "relevanceNote must be one complete sentence explaining why this person is relevant to outreach on similar projects.",
    "",
    rawText.slice(0, 6000),
  ].join("\n");
}
