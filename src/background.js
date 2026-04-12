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

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY
const AI_FEATURE_ENABLED = import.meta.env.VITE_ENABLE_AI === 'true'

function getAIDisabledReason() {
  if (!AI_FEATURE_ENABLED) {
    return 'AI is disabled in this public build.'
  }
  if (!hasConfiguredOpenAIKey()) {
    return 'AI key is missing or placeholder. Configure VITE_OPENAI_API_KEY and rebuild.'
  }
  return null
}

function isAIAvailable() {
  return getAIDisabledReason() === null
}

function hasConfiguredOpenAIKey() {
  const key = OPENAI_API_KEY?.trim()
  if (!key) return false
  if (key === 'YOUR_OPENAI_API_KEY_HERE') return false
  if (key.startsWith('YOUR_OPE')) return false
  return true
}

function buildOfflineChatReply(messages, context) {
  const lastUser = messages?.filter((m) => m?.role === 'user').slice(-1)[0]?.content?.trim() || ''
  const prompt = lastUser.toLowerCase()
  const contextText = buildChatContext(context)

  const upcomingMatches = [...contextText.matchAll(/Upcoming:\s*(.*)/g)]
    .map((m) => m[1])
    .filter((text) => text && text !== 'none')

  const units = [...contextText.matchAll(/Unit:\s*(.*)/g)].map((m) => m[1]).filter(Boolean)

  if (prompt.includes('due') || prompt.includes('urgent') || prompt.includes('deadline')) {
    if (upcomingMatches.length > 0) {
      return `OpenAI is not configured, but here is your built-in study summary.\n\nMost urgent upcoming items:\n- ${upcomingMatches.slice(0, 3).join('\n- ')}\n\nFocus on the first item today, then schedule the next two in your calendar.`
    }
    return 'OpenAI is not configured. I cannot rank deadlines from this context yet, but you can sync and check the Overview urgent cards for due-soon items.'
  }

  if (prompt.includes('grade') || prompt.includes('pass') || prompt.includes('score')) {
    const gradeMatches = [...contextText.matchAll(/Grade:\s*(.*)/g)].map((m) => m[1]).filter(Boolean)
    return `OpenAI is not configured, but here is your built-in grade snapshot.\n\n${gradeMatches.length ? gradeMatches.map((g, i) => `Unit ${i + 1}: ${g}`).join('\n') : 'No grade data found in current context.'}\n\nUse the Unit page to check what is needed on remaining assessments to pass.`
  }

  if (prompt.includes('module') || prompt.includes('material') || prompt.includes('study')) {
    return 'OpenAI is not configured. Use the Unit -> Modules tab and start with the first unchecked week. Then revise linked assessments shown on each module card.'
  }

  const unitText = units.length ? units.slice(0, 4).map((u) => `- ${u}`).join('\n') : '- No synced units found yet.'
  return `OpenAI is not configured, so you are using built-in chat mode.\n\nCurrent units:\n${unitText}\n\nAsk me things like:\n- What is due soon?\n- What should I study this week?\n- Which unit is at risk?`
}

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

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
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

  if (msg.type === 'GET_AI_STATUS') {
    const reason = getAIDisabledReason()
    sendResponse({
      enabled: reason === null,
      reason: reason ?? null,
    })
    return true
  }

  if (msg.type === 'CHAT_MESSAGE') {
    if (!isAIAvailable()) {
      sendResponse({ success: true, result: buildOfflineChatReply(msg.messages, msg.context) })
      return true
    }
    callOpenAIChat(msg.messages, msg.context)
      .then(result => sendResponse({ success: true, result }))
      .catch(err => sendResponse({ success: false, error: err.message }))
    return true
  }

})

// ─── OPENAI ───────────────────────────────────────────────────────────────────

async function callOpenAI(prompt, maxTokens = 500) {
  if (!isAIAvailable()) {
    throw new Error(getAIDisabledReason())
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

// ─── CHATBOT ──────────────────────────────────────────────────────────────────

const CHAT_SYSTEM_PROMPT = `You are CanvAssist, a study assistant built into a student's Canvas LMS browser extension at QUT.

Your only job is to help students understand and manage their Canvas coursework based on the data provided.

You can help with:
- Understanding assessment requirements, rubrics, and marking criteria
- Explaining due dates, submission status, and what grades mean
- Clarifying what weekly modules cover and which are relevant to an assessment
- Study tips and strategies grounded in the student's actual units and deadlines
- Explaining what a student needs to score to pass or reach a grade threshold

You must not:
- Write assignment content, essays, code submissions, or exam answers for the student — offer guidance instead
- Answer questions unrelated to the student's Canvas units or academic study
- Speculate beyond the data provided (e.g. don't invent marking criteria not in the rubric)
- Give advice on academic misconduct or plagiarism

If asked something outside your scope, say so in one sentence and redirect to what you can help with.
Be concise, direct, and practical. No filler phrases.`

async function callOpenAIChat(messages, context) {
  if (!isAIAvailable()) {
    return getAIDisabledReason()
  }

  const contextText = buildChatContext(context)
  const systemContent = `${CHAT_SYSTEM_PROMPT}\n\n[STUDENT CONTEXT]\n${contextText}`

  // Cap history to last 10 messages to keep token usage bounded
  const recentMessages = messages.slice(-10)

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemContent },
        ...recentMessages,
      ],
    })
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `OpenAI error: ${res.status}`)
  }

  const data = await res.json()
  return data.choices[0].message.content.trim()
}

// Formats whatever context the UI passes into a plain text block for the system prompt.
// The UI decides what's relevant (current unit, open assessment, etc.) — this just renders it.
function buildChatContext(context) {
  if (!context) return 'No unit or assessment context provided.'

  // Pre-formatted context string (e.g. multi-unit overview summary)
  if (context.rawContext) return context.rawContext

  const parts = []

  if (context.unitCode) {
    const name = context.unitName ? ` — ${context.unitName}` : ''
    parts.push(`Unit: ${context.unitCode}${name}`)
  }
  if (context.currentGrade !== null && context.currentGrade !== undefined) {
    parts.push(`Current grade: ${context.currentGrade}%`)
  }
  if (context.assessmentName) {
    const pts = context.pointsPossible ? ` (${context.pointsPossible}pts)` : ''
    const due = context.dueDate ? `, due ${context.dueDate}` : ''
    parts.push(`Assessment: ${context.assessmentName}${pts}${due}`)
  }
  if (context.assessmentDescription) {
    parts.push(`Assessment description: ${context.assessmentDescription.slice(0, 300)}`)
  }
  if (context.rubricSummary?.length > 0) {
    parts.push(`Rubric guidance:\n${context.rubricSummary.map(b => `- ${b}`).join('\n')}`)
  }
  if (context.relevantModules?.length > 0) {
    const weeks = context.relevantModules.map(m => `Week ${m.weekNumber} (${m.topic})`).join(', ')
    parts.push(`Relevant weeks: ${weeks}`)
  }

  return parts.length > 0 ? parts.join('\n') : 'No specific context provided.'
}

// ─── AI ENRICHMENT ────────────────────────────────────────────────────────────
// Two jobs:
//   1. Decode rubric criteria into plain language bullets (per assessment)
//   2. Summarise what each weekly module covers (per module)

async function enrichUnit(unit) {

  // ── Step 1: Decode rubrics ─────────────────────────────────────────────────
  let enrichedAssessments = await Promise.all(
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
  let enrichedModules = await Promise.all(
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

  // ── Step 3: Link modules to assessments ───────────────────────────────────
  // One call per unit — returns a mapping of assessmentId → relevant week numbers
  // Skip if already linked (unit.relevantModulesLinked set on previous sync)
  if (!unit.relevantModulesLinked && enrichedAssessments.length > 0 && enrichedModules.length > 0) {
    console.log(`Linking modules to assessments for ${unit.code}...`)

    const assessmentList = enrichedAssessments
      .map(a => `- [id:${a.id}] "${a.name}"${a.description ? ': ' + a.description.slice(0, 150) : ''}`)
      .join('\n')

    const moduleList = enrichedModules
      .map(m => `- Week ${m.weekNumber}: ${m.topic}`)
      .join('\n')

    const linkPrompt = `
A university unit has these assessments:
${assessmentList}

And these weekly study modules:
${moduleList}

For each assessment, list the week numbers most relevant for studying and preparing for it.
Return ONLY a JSON object like: { "assessmentId": [weekNumbers] }
Only include weeks that are clearly relevant. Use the numeric assessment IDs as keys.
`

    try {
      const raw = await callOpenAI(linkPrompt, 400)
      const cleaned = raw?.replace(/```json\n?/g, '').replace(/```/g, '').trim()
      const mapping = JSON.parse(cleaned)

      // Populate relevantModules on each assessment
      enrichedAssessments = enrichedAssessments.map(a => {
        const weekNums = mapping[String(a.id)] || []
        const relevantModules = enrichedModules
          .filter(m => weekNums.includes(m.weekNumber))
          .map(m => ({ weekNumber: m.weekNumber, topic: m.topic }))
        return { ...a, relevantModules }
      })

      // Invert: populate relevantAssessments on each module
      enrichedModules = enrichedModules.map(m => {
        const relevantAssessments = enrichedAssessments
          .filter(a => a.relevantModules.some(rm => rm.weekNumber === m.weekNumber))
          .map(a => a.name)
        return { ...m, relevantAssessments }
      })

      console.log(`${unit.code} module linking complete ✅`)
    } catch (err) {
      console.error(`Failed to link modules for ${unit.code}:`, err.message)
    }
  }

  return {
    ...unit,
    assessments: enrichedAssessments,
    modules: enrichedModules,
    relevantModulesLinked: true,
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

    if (!isAIAvailable()) {
      const reason = getAIDisabledReason()
      console.warn('Skipping AI enrichment:', reason)
      notifySidePanel({
        type: 'AI_SKIPPED',
        reason,
      })
      return
    }

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