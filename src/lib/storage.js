// lib/storage.js
// Handles all chrome.storage.local reads and writes
// Single source of truth for persisted data in the extension
//
// Data shape stored:
// {
//   canvassist_data: {
//     lastSync: timestamp,
//     units: [{ id, code, friendlyName, assessments, modules, ... }]
//   },
//   canvassist_completed: {
//     [moduleId]: true | false   ← student tick state per module
//   }
// }

const STORAGE_KEY = 'canvassist_data'
const COMPLETED_KEY = 'canvassist_completed'

// ─── READ ─────────────────────────────────────────────────────────────────────

// Gets the full synced data object
// Returns null if nothing has been synced yet
async function getData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      resolve(result[STORAGE_KEY] ?? null)
    })
  })
}

// Gets all units
// Returns empty array if no data yet
async function getUnits() {
  const data = await getData()
  return data?.units ?? []
}

// Gets a single unit by courseId
async function getUnit(courseId) {
  const units = await getUnits()
  return units.find(u => u.id === courseId) ?? null
}

// Gets the last sync timestamp
// Returns null if never synced
async function getLastSync() {
  const data = await getData()
  return data?.lastSync ?? null
}

// Gets completed module state — which weeks the student has ticked
// Returns object like { '12345': true, '67890': false }
async function getCompletedModules() {
  return new Promise((resolve) => {
    chrome.storage.local.get(COMPLETED_KEY, (result) => {
      resolve(result[COMPLETED_KEY] ?? {})
    })
  })
}

// Gets completed state for a single module
async function isModuleCompleted(moduleId) {
  const completed = await getCompletedModules()
  return completed[moduleId] ?? false
}

// ─── WRITE ────────────────────────────────────────────────────────────────────

// Saves the full data object after a sync
// Called by background.js after fetching all Canvas data
async function saveData(units) {
  const data = {
    lastSync: Date.now(),
    units,
  }

  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
      resolve(data)
    })
  })
}

// Toggles a module's completed state when student ticks/unticks it
// moduleId is the Canvas module id
async function toggleModuleCompleted(moduleId) {
  const completed = await getCompletedModules()
  const current = completed[moduleId] ?? false
  const updated = { ...completed, [moduleId]: !current }

  return new Promise((resolve) => {
    chrome.storage.local.set({ [COMPLETED_KEY]: updated }, () => {
      resolve(!current) // returns new state
    })
  })
}

// Sets a module as completed — used for bulk operations
async function setModuleCompleted(moduleId, isCompleted) {
  const completed = await getCompletedModules()
  const updated = { ...completed, [moduleId]: isCompleted }

  return new Promise((resolve) => {
    chrome.storage.local.set({ [COMPLETED_KEY]: updated }, () => {
      resolve(isCompleted)
    })
  })
}

// Saves AI generated summary for a module
// Called by ai.js after generating a week summary
async function saveModuleSummary(courseId, moduleId, summary) {
  const data = await getData()
  if (!data) return

  const updatedUnits = data.units.map(unit => {
    if (unit.id !== courseId) return unit
    return {
      ...unit,
      modules: unit.modules.map(module => {
        if (module.id !== moduleId) return module
        return { ...module, aiSummary: summary }
      })
    }
  })

  return saveData(updatedUnits)
}

// Saves AI generated rubric summary for an assessment
// Called by ai.js after decoding a rubric
async function saveRubricSummary(courseId, assessmentId, summary) {
  const data = await getData()
  if (!data) return

  const updatedUnits = data.units.map(unit => {
    if (unit.id !== courseId) return unit
    return {
      ...unit,
      assessments: unit.assessments.map(assessment => {
        if (assessment.id !== assessmentId) return assessment
        return { ...assessment, aiRubricSummary: summary }
      })
    }
  })

  return saveData(updatedUnits)
}

// ─── CLEAR ────────────────────────────────────────────────────────────────────

// Clears all stored data — useful for testing or re-syncing from scratch
async function clearAll() {
  return new Promise((resolve) => {
    chrome.storage.local.remove([STORAGE_KEY, COMPLETED_KEY], resolve)
  })
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

// Checks if data is stale and needs a refresh
// Returns true if last sync was more than 2 hours ago
function isDataStale(lastSync) {
  if (!lastSync) return true
  const twoHoursMs = 2 * 60 * 60 * 1000
  return Date.now() - lastSync > twoHoursMs
}

export {
  // Read
  getData,
  getUnits,
  getUnit,
  getLastSync,
  getCompletedModules,
  isModuleCompleted,

  // Write
  saveData,
  toggleModuleCompleted,
  setModuleCompleted,
  saveModuleSummary,
  saveRubricSummary,

  // Clear
  clearAll,

  // Helpers
  isDataStale,
}