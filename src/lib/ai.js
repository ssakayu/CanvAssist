// lib/ai.js
// AI layer for CanvAssist using OpenAI API
// Three jobs:
//   1. Decode rubric criteria into plain language
//   2. Summarise what a weekly module covers
//   3. Flag which modules are relevant to an assessment
//
// IMPORTANT: OpenAI calls are routed through background.js to avoid CORS
// The side panel cannot call external APIs directly — background.js can
// All functions return null if AI fails — UI falls back to raw data gracefully

// ─── BASE CALL ────────────────────────────────────────────────────────────────
// Sends prompt to background.js which calls OpenAI and returns the result
// This avoids the CORS error that happens when calling OpenAI from the side panel

async function callOpenAI(prompt, maxTokens = 500) {
  return new Promise((resolve) => {

    // First wake up the service worker, then send the real request
    function wakeAndSend(retries = 5) {
      // Ping with GET_STATUS to wake the service worker
      chrome.runtime.sendMessage({ type: 'GET_STATUS' }, () => {
        // Ignore the response — just needed to wake it up
        if (chrome.runtime.lastError) {
          // Service worker waking up — wait a bit then try AI request
          if (retries > 0) {
            console.log(`Waking service worker... (${retries} left)`)
            setTimeout(() => wakeAndSend(retries - 1), 1000)
          } else {
            console.error('Could not wake service worker')
            resolve(null)
          }
          return
        }

        // Service worker is awake — send the real AI request
        chrome.runtime.sendMessage(
          { type: 'AI_REQUEST', prompt, maxTokens },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('AI request failed:', chrome.runtime.lastError.message)
              resolve(null)
              return
            }
            if (response?.success) resolve(response.result)
            else {
              console.error('AI error:', response?.error)
              resolve(null)
            }
          }
        )
      })
    }

    wakeAndSend()
  })
}

// ─── 1. RUBRIC DECODER ────────────────────────────────────────────────────────
// Takes raw Canvas rubric criteria and returns plain language bullets
// Tells the student exactly what they need to do to get a Distinction

export async function decodeRubric(assignmentName, rubric) {
  if (!rubric || rubric.length === 0) return null

  // Format rubric criteria into readable text for the prompt
  const rubricText = rubric.map(criterion => {
    const ratingsText = criterion.ratings
      .map(r => `  - ${r.description} (${r.points}pts): ${r.longDescription}`)
      .join('\n')

    return `Criterion: ${criterion.description} (${criterion.points} total points)
${criterion.longDescription ? `Overview: ${criterion.longDescription}` : ''}
Ratings:
${ratingsText}`
  }).join('\n\n')

  const prompt = `
This is the marking rubric for a university assignment called "${assignmentName}".

${rubricText}

Based on this rubric, give the student 4-5 plain language bullet points explaining:
- What markers are actually looking for
- What specifically separates a Distinction from a Pass
- What's the easiest way to lose marks

Write each bullet point as one clear sentence starting with an action verb.
Do not use academic jargon. Write like you're explaining to a friend.
Return only the bullet points, one per line, no numbering, no extra commentary.
`

  const response = await callOpenAI(prompt, 400)
  if (!response) return null

  // Split response into array of bullet points
  return response
    .split('\n')
    .map(line => line.replace(/^[-•*]\s*/, '').trim())
    .filter(line => line.length > 0)
}

// ─── 2. WEEK SUMMARISER ───────────────────────────────────────────────────────
// Takes a module name and its item titles and returns a one-sentence summary
// Tells the student what that week actually covers without clicking into it

export async function summariseWeek(moduleName, itemTitles) {
  if (!itemTitles || itemTitles.length === 0) return null

  const prompt = `
A university Canvas module called "${moduleName}" contains these items:
${itemTitles.map(t => `- ${t}`).join('\n')}

Write ONE sentence (max 20 words) summarising what topics this week covers.
Be specific about the actual content — not just "this week covers the lecture material".
Return only the sentence, nothing else.
`

  return await callOpenAI(prompt, 100)
}

// ─── 3. MATERIAL RELEVANCE ────────────────────────────────────────────────────
// Cross-references module topics with an assessment description
// Returns true if the module is relevant to the assessment, false if not

export async function isModuleRelevant(moduleTopic, assessmentName, assessmentDescription) {
  if (!moduleTopic || !assessmentName) return false

  const prompt = `
Assessment: "${assessmentName}"
${assessmentDescription ? `Description: ${assessmentDescription.slice(0, 300)}` : ''}

Module topic: "${moduleTopic}"

Is this module topic directly relevant to completing this assessment?
Answer with only "yes" or "no".
`

  const response = await callOpenAI(prompt, 10)
  return response?.toLowerCase().includes('yes') ?? false
}

// ─── 4. FULL ENRICHMENT ───────────────────────────────────────────────────────
// Runs all AI enrichment for a unit after Canvas data is synced
// Called from background.js after saveData()
// Returns enriched unit with AI summaries filled in

export async function enrichUnit(unit) {
  const enrichedAssessments = await Promise.all(
    unit.assessments.map(async (assessment) => {
      // Skip if already has AI summary — no need to call API again
      if (assessment.aiRubricSummary) return assessment

      // Only decode if rubric exists
      if (!assessment.hasRubric) return assessment

      console.log(`Decoding rubric for ${assessment.name}...`)
      const aiRubricSummary = await decodeRubric(assessment.name, assessment.rubric)

      return { ...assessment, aiRubricSummary }
    })
  )

  const enrichedModules = await Promise.all(
    unit.modules.map(async (module) => {
      // Skip if already has AI summary
      if (module.aiSummary) return module

      const itemTitles = module.items.map(i => i.title)
      console.log(`Summarising ${module.fullName}...`)
      const aiSummary = await summariseWeek(module.fullName, itemTitles)

      // Check relevance against each assessment
      const relevantAssessments = []
      for (const assessment of unit.assessments) {
        const relevant = await isModuleRelevant(
          module.topic,
          assessment.name,
          assessment.description
        )
        if (relevant) relevantAssessments.push(assessment.name)
      }

      return { ...module, aiSummary, relevantAssessments }
    })
  )

  return {
    ...unit,
    assessments: enrichedAssessments,
    modules: enrichedModules,
  }
}