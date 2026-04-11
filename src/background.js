// background.js
// Service worker — runs in the background of the extension
// Responsible for syncing Canvas data and storing it locally
// This file has access to chrome APIs but NOT to the DOM

import getActiveCourses from './api/getActiveCourses.js'
import getAssignments from './api/getAssignments.js'
import getModules from './api/getModules.js'
import { saveData, isDataStale, getLastSync } from './lib/storage.js'
import { addUrgencyScores } from './lib/utils.js'

// ─── LIFECYCLE ────────────────────────────────────────────────────────────────

// Runs once when extension is first installed or updated
chrome.runtime.onInstalled.addListener(async () => {
  console.log('CanvAssist installed — starting initial sync...')
  await syncCanvasData(true) // force sync on install
})

// Opens side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id })
})

// ─── MESSAGE LISTENER ─────────────────────────────────────────────────────────
// Listens for messages from the side panel
// Side panel can't call Canvas API directly due to CORS
// so it asks background.js to do it instead

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('Message received:', msg.type)

  // Side panel asks for a manual sync — always force it
  if (msg.type === 'SYNC_NOW') {
    syncCanvasData(true)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }))
    return true // return true to keep message channel open for async response
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
})

// ─── SYNC ─────────────────────────────────────────────────────────────────────
// Main sync function — fetches all Canvas data and saves to storage
// force = true skips the staleness check (used for manual syncs)

async function syncCanvasData(force = false) {
  try {
    // Check if data is still fresh — skip if less than 2 hours old
    // Always runs if force = true (manual sync button or on install)
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

    // Step 2 — for each unit, fetch assignments and modules in parallel
    const units = await Promise.all(
      courses.map(async (course) => {
        try {
          const [assessments, modules] = await Promise.all([
            getAssignments(course.id),
            getModules(course.id),
          ])

          console.log(`${course.code}: ${assessments.length} assessments, ${modules.length} modules`)

          return {
            ...course,
            assessments,
            modules,
          }
        } catch (err) {
          // If one unit fails, don't kill the whole sync
          // Return the unit with empty arrays so the UI still shows it
          console.error(`Failed to fetch data for ${course.code}:`, err.message)
          return {
            ...course,
            assessments: [],
            modules: [],
          }
        }
      })
    )

    // Step 3 — add urgency scores before saving
    const unitsWithScores = addUrgencyScores(units)

    // Step 4 — save everything to chrome.storage.local
    await saveData(unitsWithScores)
    console.log('Sync complete ✅', unitsWithScores.length, 'units saved')

    // Step 5 — tell the side panel data is ready
    notifySidePanel({ type: 'SYNC_COMPLETE' })

  } catch (err) {
    console.error('Sync failed ❌:', err.message)
    notifySidePanel({ type: 'SYNC_ERROR', error: err.message })
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

// Sends a message to the side panel
// Wrapped in try/catch because the panel might not be open
function notifySidePanel(message) {
  chrome.runtime.sendMessage(message).catch(() => {
    // Side panel isn't open — that's fine, ignore the error
  })
}