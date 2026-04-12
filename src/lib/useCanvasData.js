import { useEffect, useRef } from 'react'
import { useGlobal } from '../context/GlobalContext'
import { getUnits } from './storage.js'

export function useCanvasData() {
  const { setActiveCourses, setSyncPhase, setAiProgress } = useGlobal()
  const totalUnitsRef = useRef(0)

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        const stored = await getUnits()
        if (!cancelled) {
          totalUnitsRef.current = stored.length
          if (stored.length > 0) setActiveCourses(stored)
        }
      } catch (err) {
        console.error('Failed to load data:', err)
      }
    }

    loadData()

    const handleMessage = (msg) => {
      switch (msg.type) {
        case 'SYNC_STARTED':
          setSyncPhase('canvas')
          break

        case 'SYNC_COMPLETE':
          loadData()
          // phase stays 'canvas' until AI_STARTED or AI_SKIPPED
          break

        case 'SYNC_SKIPPED':
          setSyncPhase('idle')
          break

        case 'SYNC_ERROR':
          setSyncPhase('idle')
          break

        case 'AI_STARTED':
          setSyncPhase('ai')
          setAiProgress({ completed: 0, total: totalUnitsRef.current })
          break

        case 'AI_UNIT_COMPLETE':
          setAiProgress(prev => ({ ...prev, completed: prev.completed + 1 }))
          loadData()
          break

        case 'AI_COMPLETE':
          loadData()
          setSyncPhase('done')
          setTimeout(() => setSyncPhase('idle'), 1200)
          break

        case 'AI_SKIPPED':
          setSyncPhase('done')
          setTimeout(() => setSyncPhase('idle'), 800)
          break

        default:
          break
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => {
      cancelled = true
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [])
}
