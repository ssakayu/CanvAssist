import { buildStudyLensSnapshot } from './scrapeQut'

const MESSAGE_TYPES = {
  SCRAPE: 'STUDYLENS_SCRAPE',
}

function isCanvasPage() {
  const isQutCanvas = location.hostname === 'canvas.qut.edu.au'
  const isAllowedPath = location.pathname === '/' || location.pathname.startsWith('/courses')
  return isQutCanvas && isAllowedPath
}

function runScrape() {
  return buildStudyLensSnapshot()
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== MESSAGE_TYPES.SCRAPE) {
    return false
  }

  runScrape()
    .then((snapshot) => {
      sendResponse({ ok: true, snapshot })
    })
    .catch((error) => {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Unknown scrape error' })
    })

  return true
})

if (isCanvasPage()) {
  runScrape()
    .then((snapshot) => chrome.storage.local.set({ studylensSnapshot: snapshot }))
    .catch(() => {})
}
