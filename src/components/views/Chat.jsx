import { useState, useEffect, useRef } from 'react'
import { useGlobal } from '../../context/GlobalContext'
import { calculateCurrentGrade } from '../../lib/utils.js'

export default function Chat() {
  const { activeCourses } = useGlobal()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiStatus, setAiStatus] = useState({ enabled: false, reason: 'Checking AI availability...' })
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_AI_STATUS' }, (response) => {
      if (chrome.runtime.lastError) {
        setAiStatus({ enabled: false, reason: 'Unable to determine AI availability.' })
        return
      }
      setAiStatus({
        enabled: Boolean(response?.enabled),
        reason: response?.reason ?? null,
      })
    })
  }, [])

  function buildContext() {
    if (!activeCourses.length) return null

    const rawContext = activeCourses.map(c => {
      const grade = c.currentGrade ?? calculateCurrentGrade(c.assessments)
      const upcoming = c.assessments
        .filter(a => a.daysUntilDue !== null && a.daysUntilDue >= 0 && a.daysUntilDue <= 14)
        .map(a => `${a.name} (due in ${a.daysUntilDue}d, ${a.pointsPossible}pts)`)
      return [
        `Unit: ${c.code} — ${c.friendlyName}`,
        `Grade: ${grade ?? 'no grades yet'}%`,
        `Upcoming: ${upcoming.length ? upcoming.join(', ') : 'none'}`,
      ].join('\n')
    }).join('\n\n')

    return { rawContext }
  }

  function send() {
    if (!input.trim() || loading) return

    const userMsg = { role: 'user', content: input.trim() }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    chrome.runtime.sendMessage(
      { type: 'CHAT_MESSAGE', messages: nextMessages, context: buildContext() },
      (response) => {
        setLoading(false)
        const reply = response?.success
          ? response.result
          : `Error: ${response?.error ?? 'no response from background'}`
        setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      }
    )
  }

  return (
    <section className="chat-panel">
      <h3 className="section-heading">Chat</h3>
      <p className="chat-meta">
        Context: {activeCourses.length} unit{activeCourses.length !== 1 ? 's' : ''} loaded
      </p>
      {!aiStatus.enabled && (
        <p className="chat-note">
          Built-in chat mode active. {aiStatus.reason}
        </p>
      )}

      <div className="chat-history">
        {messages.length === 0 && (
          <p className="chat-meta">No messages yet. Ask something about your Canvas units.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className="chat-entry">
            <strong className="chat-role">{m.role === 'user' ? 'You' : 'CanvAssist'}</strong>
            <p className="chat-message">{m.content}</p>
          </div>
        ))}
        {loading && <p className="chat-meta">CanvAssist is thinking...</p>}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <input
          type='text'
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder='Ask about your units, assessments, grades...'
          className="chat-input"
          disabled={loading}
          autoFocus
        />
        <button type="button" className="sync-btn sync-btn--inline" onClick={send} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>

      <details className="callout" style={{ padding: 10 }}>
        <summary className="chat-meta" style={{ cursor: 'pointer' }}>Context sent to assistant</summary>
        <p className="assessment-description" style={{ marginTop: 8 }}>
          {buildContext()?.rawContext ?? 'No data - sync Canvas first'}
        </p>
      </details>
    </section>
  )
}
