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
  const [view, setViewState] = useState({ page: 'overview', params: {} })
  const [previousView, setPreviousView] = useState({ page: '', params: {} })
  const [activeCourses, setActiveCourses] = useState([])

  const setView = useCallback((newView) => {
    setViewState((current) => {
      if (!viewsEqual(current, newView)) {
        setPreviousView(current);
      }
      return newView;
    })
  }, [])

  const value = useMemo(
    () => ({
      view,
      setView,
      activeCourses,
      setActiveCourses,
      previousView,
      setPreviousView,
    }),
    [
      view,
      setView,
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