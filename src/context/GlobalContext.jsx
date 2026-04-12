import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const GlobalContext = createContext(null)

function viewsEqual(a, b) {
  if (a.page !== b.page)
    return false
  return JSON.stringify(a.params ?? {}) === JSON.stringify(b.params ?? {})
}

/**
 * Holds global context, variable and states for the extension.
 */
export function GlobalProvider({ children }) {
  const [history, setHistory] = useState([{ page: 'overview', params: {} }])
  const [activeCourses, setActiveCourses] = useState([])

  const view = history[history.length - 1] ?? { page: 'overview', params: {} }
  const previousView = history.length > 1 ? history[history.length - 2] : { page: '', params: {} }

  const setView = useCallback((newView, options = {}) => {
    const { replace = false } = options
    setHistory((currentHistory) => {
      const current = currentHistory[currentHistory.length - 1]
      if (viewsEqual(current, newView)) {
        return currentHistory
      }

      if (replace && currentHistory.length > 0) {
        return [...currentHistory.slice(0, -1), newView]
      }

      return [...currentHistory, newView]
    })
  }, [])

  const goBack = useCallback(() => {
    setHistory((currentHistory) => {
      if (currentHistory.length <= 1) {
        return currentHistory
      }
      return currentHistory.slice(0, -1)
    })
  }, [])

  const setPreviousView = useCallback(() => {}, [])

  const value = useMemo(
    () => ({
      view,
      setView,
      goBack,
      activeCourses,
      setActiveCourses,
      previousView,
      setPreviousView,
    }),
    [
      view,
      setView,
      goBack,
      activeCourses,
      previousView,
    ],
  );

  return (
    <GlobalContext.Provider value={value}>
      {children}
    </GlobalContext.Provider>
  )
}

/**
 * Utility hook to access the global context.
 * @returns {Object} Global context, variable and states for the extension.
 */
export function useGlobal() {
  const ctx = useContext(GlobalContext);

  if (ctx == null) {
    throw new Error('useGlobal must be used within a GlobalProvider');
  }

  return ctx;
}
