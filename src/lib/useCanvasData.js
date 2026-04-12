import { useEffect } from 'react'
import { useGlobal } from '../context/GlobalContext'
import { getUnits } from './storage.js'

export function useCanvasData() {
  const { setActiveCourses } = useGlobal()

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        const stored = await getUnits()
        if (!cancelled && stored.length > 0) {
          setActiveCourses(stored)
        }
      } catch (err) {
        console.error('Failed to load data:', err)
      }
    }

    loadData()

    const handleMessage = (msg) => {
      if (['SYNC_COMPLETE', 'AI_UNIT_COMPLETE', 'AI_COMPLETE'].includes(msg.type)) {
        loadData()
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => {
      cancelled = true
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [])
}