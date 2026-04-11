// background.js
// Service worker — runs in the background of the extension
// Responsible for:
//   1. Syncing Canvas data and storing it locally
//   2. Handling OpenAI API calls (side panel can't call OpenAI directly due to CORS)
//   3. AI enrichment — rubric decoding and week summaries
// This file has access to chrome APIs but NOT to the DOM

import getActiveCourses from './api/getActiveCourses.js'
import getAssignments from './api/getAssignments.js'
import getModules from './api/getModules.js'
import { saveData, isDataStale, getLastSync, getData } from './lib/storage.js'
import { addUrgencyScores } from './lib/utils.js'
// enrichUnit is defined directly here to avoid circular import with ai.js

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY

// ─── KEEP ALIVE ───────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  console.log('CanvAssist installed — starting initial sync...')
  chrome.alarms.create('keepAlive', { periodInMinutes: 0.4 })
  await syncCanvasData(true)
})

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('keepAlive', { periodInMinutes: 0.4 })
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    chrome.storage.local.get('ping', () => {})
  }
})

// ─── LIFECYCLE ────────────────────────────────────────────────────────────────

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id })
})

// ─── MESSAGE LISTENER ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('Message received:', msg.type)

  if (msg.type === 'SYNC_NOW') {
    syncCanvasData(true)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }))
    return true
  }

  if (msg.type === 'GET_STATUS') {
    getLastSync().then(lastSync => {
      sendResponse({
        hasSynced: lastSync !== null,
        lastSync,
        isStale: isDataStale(lastSync),
      })
    })
    return true
  }

  if (msg.type === 'AI_REQUEST') {
    callOpenAI(msg.prompt, msg.maxTokens)
      .then(result => sendResponse({ success: true, result }))
      .catch(err => sendResponse({ success: false, error: err.message }))
    return true
  }
})

// ─── OPENAI ───────────────────────────────────────────────────────────────────

async function callOpenAI(prompt, maxTokens = 500) {
  if (!OPENAI_API_KEY) {
    throw new Error('No OpenAI API key set — add VITE_OPENAI_API_KEY to .env')
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: maxTokens,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful study assistant for university students. Be concise, direct, and practical. Never use filler phrases. Get straight to the point.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `OpenAI error: ${res.status}`)
  }

  const data = await res.json()
  return data.choices[0].message.content.trim()
}

// ─── AI ENRICHMENT ────────────────────────────────────────────────────────────
// Two jobs:
//   1. Decode rubric criteria into plain language bullets (per assessment)
//   2. Summarise what each weekly module covers (per module)

async function enrichUnit(unit) {

  // ── Step 1: Decode rubrics ─────────────────────────────────────────────────
  const enrichedAssessments = await Promise.all(
    unit.assessments.map(async (assessment) => {
      // Skip if already decoded or no rubric
      if (assessment.aiRubricSummary) return assessment
      if (!assessment.hasRubric) return assessment

      console.log(`Decoding rubric for ${assessment.name}...`)

      const rubricText = assessment.rubric.map(c => {
        const ratings = c.ratings
          .map(r => `  - ${r.description} (${r.points}pts): ${r.longDescription}`)
          .join('\n')
        return `Criterion: ${c.description} (${c.points}pts)\n${ratings}`
      }).join('\n\n')

      const rubricPrompt = `
This is the marking rubric for a university assignment called "${assessment.name}".

${rubricText}

Give the student 4-5 plain language bullet points explaining:
- What markers are actually looking for
- What specifically separates a Distinction from a Pass
- What's the easiest way to lose marks

Write each bullet point as one clear sentence starting with an action verb.
Do not use academic jargon. Write like you're explaining to a friend.
Return only the bullet points, one per line, no numbering, no extra commentary.
`

      const aiRubricSummary = await callOpenAI(rubricPrompt, 400)
        .then(r => r
          ?.split('\n')
          .map(l => l.replace(/^[-•*]\s*/, '').trim())
          .filter(l => l.length > 0)
        )
        .catch(() => null)

      return { ...assessment, aiRubricSummary }
    })
  )

  // ── Step 2: Summarise weekly modules ──────────────────────────────────────
  const enrichedModules = await Promise.all(
    unit.modules.map(async (module) => {
      // Skip if already summarised
      if (module.aiSummary) return module

      const titles = module.items.map(i => i.title).join(', ')
      const summaryPrompt = `
Canvas module "${module.fullName}" contains: ${titles}.
Write ONE sentence (max 20 words) summarising what specific topics this week covers.
Be precise — not just "this week covers the lecture material".
Return only the sentence, nothing else.
`

      const aiSummary = await callOpenAI(summaryPrompt, 100).catch(() => null)
      return { ...module, aiSummary }
    })
  )

  return {
    ...unit,
    assessments: enrichedAssessments,
    modules: enrichedModules,
  }
}

// ─── SYNC ─────────────────────────────────────────────────────────────────────

async function syncCanvasData(force = false) {
  try {
    const lastSync = await getLastSync()
    if (!force && !isDataStale(lastSync)) {
      console.log('Data is fresh, skipping sync')
      notifySidePanel({ type: 'SYNC_SKIPPED' })
      return
    }

    console.log('Starting Canvas sync...')
    notifySidePanel({ type: 'SYNC_STARTED' })

    const courses = await getActiveCourses()
    console.log(`Found ${courses.length} units:`, courses.map(c => c.code))

    if (courses.length === 0) {
      throw new Error('No Canvas units found — make sure you are logged into Canvas')
    }

    const units = await Promise.all(
      courses.map(async (course) => {
        try {
          const [assessments, modules] = await Promise.all([
            getAssignments(course.id),
            getModules(course.id),
          ])
          console.log(`${course.code}: ${assessments.length} assessments, ${modules.length} modules`)
          return { ...course, assessments, modules }
        } catch (err) {
          console.error(`Failed to fetch data for ${course.code}:`, err.message)
          return { ...course, assessments: [], modules: [] }
        }
      })
    )

    const unitsWithScores = addUrgencyScores(units)

    await saveData(unitsWithScores)
    console.log('Canvas sync complete ✅', unitsWithScores.length, 'units saved')
    notifySidePanel({ type: 'SYNC_COMPLETE' })

    console.log('Starting AI enrichment...')
    notifySidePanel({ type: 'AI_STARTED' })

    for (const unit of unitsWithScores) {
      try {
        const enriched = await enrichUnit(unit)

        const currentData = await getData()
        const updatedUnits = currentData.units.map(u =>
          u.id === enriched.id ? enriched : u
        )
        await saveData(updatedUnits)

        console.log(`${unit.code} AI enrichment complete ✅`)
        notifySidePanel({ type: 'AI_UNIT_COMPLETE', unitId: unit.id })

      } catch (err) {
        console.error(`AI enrichment failed for ${unit.code}:`, err.message)
      }
    }

    console.log('All AI enrichment complete ✅')
    notifySidePanel({ type: 'AI_COMPLETE' })

  } catch (err) {
    console.error('Sync failed ❌:', err.message)
    notifySidePanel({ type: 'SYNC_ERROR', error: err.message })
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function notifySidePanel(message) {
  chrome.runtime.sendMessage(message).catch(() => {
    // Side panel isn't open — fine, ignore
  })
}