import { useState, useEffect, useRef } from 'react'
import { useGlobal } from '../../context/GlobalContext'
import { calculateCurrentGrade } from '../../lib/utils.js'

export default function Chat() {
  const { activeCourses } = useGlobal()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

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
    <div>
      <strong>CHAT</strong>
      <p style={{ color: '#666', fontSize: 11, marginTop: 2 }}>
        Context: {activeCourses.length} unit{activeCourses.length !== 1 ? 's' : ''} loaded
      </p>

      {/* Message history */}
      <div style={{ border: '1px solid #ccc', padding: 8, marginTop: 6, minHeight: 200, maxHeight: 380, overflowY: 'auto' }}>
        {messages.length === 0 && (
          <p style={{ color: '#999' }}>No messages yet. Ask something about your Canvas units.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <strong>{m.role === 'user' ? 'You' : 'CanvAssist'}:</strong>
            <p style={{ margin: '2px 0 0 8px', whiteSpace: 'pre-wrap' }}>{m.content}</p>
          </div>
        ))}
        {loading && <p style={{ color: '#999' }}>CanvAssist is thinking...</p>}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        <input
          type='text'
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder='Ask about your units, assessments, grades...'
          style={{ flex: 1, padding: 4, fontFamily: 'monospace', fontSize: 12 }}
          disabled={loading}
          autoFocus
        />
        <button onClick={send} disabled={loading || !input.trim()}>send</button>
      </div>

      {/* Context debug panel */}
      <details style={{ marginTop: 8, fontSize: 11 }}>
        <summary style={{ cursor: 'pointer', color: '#666' }}>context sent to AI</summary>
        <pre style={{ marginTop: 4, padding: 6, border: '1px solid #eee', whiteSpace: 'pre-wrap', color: '#444' }}>
          {buildContext()?.rawContext ?? 'no data — sync Canvas first'}
        </pre>
      </details>
    </div>
  )
}
