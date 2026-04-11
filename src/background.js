// background.js
// Service worker — runs in the background of the extension
// Responsible for:
//   1. Syncing Canvas data and storing it locally
//   2. Handling OpenAI API calls (side panel can't call OpenAI directly due to CORS)
// This file has access to chrome APIs but NOT to the DOM

import getActiveCourses from './api/getActiveCourses.js'
import getAssignments from './api/getAssignments.js'
import getModules from './api/getModules.js'
import { saveData, isDataStale, getLastSync, getData } from './lib/storage.js'
import { addUrgencyScores } from './lib/utils.js'

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY

// ─── KEEP ALIVE ───────────────────────────────────────────────────────────────
// Chrome kills service workers after ~30s of inactivity
// Alarms keep it alive so AI calls don't fail mid-enrichment

chrome.runtime.onInstalled.addListener(async () => {
  console.log('CanvAssist installed — starting initial sync...')

  // Set up alarm to keep service worker alive
  chrome.alarms.create('keepAlive', { periodInMinutes: 0.4 })

  await syncCanvasData(true)
})

// Re-create alarm on startup (survives Chrome restarts)
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('keepAlive', { periodInMinutes: 0.4 })
})

// Alarm fires every 24 seconds — just enough to keep service worker alive
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    // Just needs to run something to stay alive
    chrome.storage.local.get('ping', () => {})
  }
})

// ─── LIFECYCLE ────────────────────────────────────────────────────────────────

// Opens side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id })
})

// ─── MESSAGE LISTENER ─────────────────────────────────────────────────────────
// Listens for messages from the side panel
// Side panel can't call Canvas API or OpenAI directly due to CORS
// so it asks background.js to do it instead

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('Message received:', msg.type)

  // Side panel asks for a manual sync — always force it
  if (msg.type === 'SYNC_NOW') {
    syncCanvasData(true)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }))
    return true
  }

  // Side panel asks if data is ready
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

  // Side panel asks for an AI completion
  // All OpenAI calls are routed through here to avoid CORS
  if (msg.type === 'AI_REQUEST') {
    callOpenAI(msg.prompt, msg.maxTokens)
      .then(result => sendResponse({ success: true, result }))
      .catch(err => sendResponse({ success: false, error: err.message }))
    return true
  }
})

// Runs AI enrichment for one unit
// Defined here instead of ai.js to avoid circular import issues
async function enrichUnit(unit) {
  const enrichedAssessments = await Promise.all(
    unit.assessments.map(async (assessment) => {
      if (assessment.aiRubricSummary) return assessment
      if (!assessment.hasRubric) return assessment

      console.log(`Decoding rubric for ${assessment.name}...`)

      const rubricText = assessment.rubric.map(c => {
        const ratings = c.ratings.map(r => `  - ${r.description} (${r.points}pts): ${r.longDescription}`).join('\n')
        return `Criterion: ${c.description} (${c.points}pts)\n${ratings}`
      }).join('\n\n')

      const prompt = `
This is the marking rubric for "${assessment.name}".
${rubricText}
Give the student 4-5 plain language bullet points explaining what markers want and how to get a Distinction.
Write each as one sentence starting with an action verb. No jargon. No numbering. One per line.`

      const aiRubricSummary = await callOpenAI(prompt, 400)
        .then(r => r?.split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(l => l.length > 0))
        .catch(() => null)

      return { ...assessment, aiRubricSummary }
    })
  )

  const enrichedModules = await Promise.all(
    unit.modules.map(async (module) => {
      if (module.aiSummary) return module

      const titles = module.items.map(i => i.title).join(', ')
      const prompt = `Canvas module "${module.fullName}" contains: ${titles}. Write ONE sentence (max 20 words) summarising what topics this week covers. Return only the sentence.`

      const aiSummary = await callOpenAI(prompt, 100).catch(() => null)

      const relevantAssessments = []
      for (const assessment of unit.assessments) {
        const prompt = `Assessment: "${assessment.name}". Module topic: "${module.topic}". Is this module directly relevant to this assessment? Answer only yes or no.`
        const response = await callOpenAI(prompt, 5).catch(() => null)
        if (response?.toLowerCase().includes('yes')) {
          relevantAssessments.push(assessment.name)
        }
      }

      return { ...module, aiSummary, relevantAssessments }
    })
  )

  return { ...unit, assessments: enrichedAssessments, modules: enrichedModules }
}


// ─── OPENAI ───────────────────────────────────────────────────────────────────
// All AI calls go through here — background service worker bypasses CORS

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

// ─── SYNC ─────────────────────────────────────────────────────────────────────
// Main sync function — fetches all Canvas data, saves to storage, then enriches with AI
// force = true skips the staleness check (used for manual syncs)

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

    // Step 1 — get all real semester units
    const courses = await getActiveCourses()
    console.log(`Found ${courses.length} units:`, courses.map(c => c.code))

    if (courses.length === 0) {
      throw new Error('No Canvas units found — make sure you are logged into Canvas')
    }

    // Step 2 — fetch assignments and modules for each unit in parallel
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

    // Step 3 — add urgency scores
    const unitsWithScores = addUrgencyScores(units)

    // Step 4 — save Canvas data immediately so UI can render
    await saveData(unitsWithScores)
    console.log('Canvas sync complete ✅', unitsWithScores.length, 'units saved')
    notifySidePanel({ type: 'SYNC_COMPLETE' })

    // Step 5 — AI enrichment runs after UI is already showing data
    // Intentionally separate so the UI doesn't wait for AI
    console.log('Starting AI enrichment...')
    notifySidePanel({ type: 'AI_STARTED' })

    for (const unit of unitsWithScores) {
      try {
        const enriched = await enrichUnit(unit)

        // Save enriched unit back into storage without overwriting others
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