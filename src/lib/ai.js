// lib/ai.js
// Prompt builders for CanvAssist AI features
//
// IMPORTANT: This file does NOT call OpenAI directly — that would cause CORS errors
// All OpenAI calls are routed through background.js via chrome.runtime.sendMessage
//
// What lives here:   prompt builders + message sender
// What lives in background.js: callOpenAI() + enrichUnit()

// ─── BASE CALL ────────────────────────────────────────────────────────────────
// Sends prompt to background.js which calls OpenAI and returns the result

async function callOpenAI(prompt, maxTokens = 500) {
  return new Promise((resolve) => {

    function sendRequest(retries = 3) {
      chrome.runtime.sendMessage(
        { type: 'AI_REQUEST', prompt, maxTokens },
        (response) => {
          if (chrome.runtime.lastError) {
            const error = chrome.runtime.lastError.message
            if (retries > 0) {
              console.log(`Background not ready, retrying... (${retries} left)`)
              setTimeout(() => sendRequest(retries - 1), 500)
              return
            }
            console.error('Background not responding:', error)
            resolve(null)
            return
          }
          if (response?.success) resolve(response.result)
          else {
            console.error('AI request failed:', response?.error)
            resolve(null)
          }
        }
      )
    }

    sendRequest()
  })
}

// ─── 1. RUBRIC DECODER ────────────────────────────────────────────────────────
// Takes raw Canvas rubric criteria and returns plain language bullets
// Tells the student exactly what they need to do to get a Distinction

export async function decodeRubric(assignmentName, rubric) {
  if (!rubric || rubric.length === 0) return null

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