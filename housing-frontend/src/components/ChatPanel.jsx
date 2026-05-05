import { useState, useRef, useEffect } from 'react'
import axios from 'axios'

const SUGGESTIONS = [
    "I earn $80K/yr, where can I afford?",
    "Show me homes near the ocean under $300K",
    "Best value areas in California",
    "I have a $500K budget, what are my options?",
]

const ChatPanel = ({ open, onClose, onResult }) => {
    const [query, setQuery]     = useState('')
    const [loading, setLoading] = useState(false)
    const [history, setHistory] = useState([])
    const bottomRef             = useRef(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [history, loading])

    const submit = async (text) => {
        const msg = (text || query).trim()
        if (!msg || loading) return
        setQuery('')
        setHistory(h => [...h, { role: 'user', text: msg }])
        setLoading(true)
        try {
            const res = await axios.post(`${import.meta.env.VITE_FLASK_API_URL}/chat`, { query: msg })
            onResult(res.data)
            setHistory(h => [...h, {
                role: 'ai',
                text: res.data.summary || 'Done! Results are on the map.',
                meta: res.data.affordable_count
                    ? `${res.data.affordable_count.toLocaleString()} properties matched`
                    : null,
            }])
        } catch {
            setHistory(h => [...h, { role: 'error', text: 'Something went wrong. Is the backend running?' }])
        } finally {
            setLoading(false)
        }
    }

    const onKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
    }

    if (!open) return null

    return (
        <div style={{
            width:         320,
            height:        '100%',
            flexShrink:    0,
            background:    '#09121e',
            borderRight:   '1px solid #1e3a5f',
            display:       'flex',
            flexDirection: 'column',
            boxShadow:     '4px 0 16px rgba(0,0,0,0.4)',
        }}>

            {/* ── Panel header ── */}
            <div style={{
                padding:        '12px 16px',
                borderBottom:   '1px solid #1e3a5f',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                flexShrink:     0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15 }}>💬</span>
                    <span style={{ color: '#60a5fa', fontWeight: 600, fontSize: 13 }}>AI Housing Chat</span>
                </div>
                <button
                    onClick={onClose}
                    style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', fontSize: 17, lineHeight: 1, padding: '2px 6px' }}
                    onMouseEnter={e => e.target.style.color = '#e2e8f0'}
                    onMouseLeave={e => e.target.style.color = '#4b5563'}
                >✕</button>
            </div>

            {/* ── Message history ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

                {history.length === 0 && (
                    <div style={{ marginTop: 16 }}>
                        <p style={{ color: '#4b5563', fontSize: 12, margin: '0 0 14px 0', textAlign: 'center' }}>
                            Ask about California housing
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {SUGGESTIONS.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => submit(s)}
                                    style={{
                                        background:   '#0d1f35',
                                        border:       '1px solid #1e3a5f',
                                        borderRadius: 8,
                                        color:        '#93c5fd',
                                        cursor:       'pointer',
                                        fontSize:     11,
                                        padding:      '8px 12px',
                                        textAlign:    'left',
                                        lineHeight:   1.4,
                                        transition:   'border-color 0.15s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = '#1e3a5f'}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {history.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                            maxWidth:     '85%',
                            background:   msg.role === 'user'  ? '#1d4ed8'
                                        : msg.role === 'error' ? 'rgba(239,68,68,0.1)'
                                        : '#0d1f35',
                            border:       msg.role === 'error'
                                        ? '1px solid rgba(239,68,68,0.3)'
                                        : '1px solid #1e3a5f',
                            borderRadius: msg.role === 'user'
                                        ? '12px 12px 2px 12px'
                                        : '12px 12px 12px 2px',
                            padding:      '9px 12px',
                            color:        msg.role === 'error' ? '#f87171' : '#e2e8f0',
                            fontSize:     12,
                            lineHeight:   1.55,
                        }}>
                            {msg.text}
                        </div>
                        {msg.meta && (
                            <div style={{ color: '#34d399', fontSize: 10, marginTop: 4, paddingLeft: 4 }}>
                                {msg.meta}
                            </div>
                        )}
                    </div>
                ))}

                {loading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                            display:      'flex',
                            gap:          4,
                            padding:      '10px 14px',
                            background:   '#0d1f35',
                            border:       '1px solid #1e3a5f',
                            borderRadius: '12px 12px 12px 2px',
                        }}>
                            {[0, 1, 2].map(i => (
                                <div key={i} style={{
                                    width:     6,
                                    height:    6,
                                    borderRadius: '50%',
                                    background: '#3b82f6',
                                    animation: `bounce 1.2s ${i * 0.2}s infinite`,
                                }} />
                            ))}
                        </div>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            {/* ── Input area ── */}
            <div style={{ padding: '12px 14px', borderTop: '1px solid #1e3a5f', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <textarea
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={onKeyDown}
                        disabled={loading}
                        placeholder="Ask about California housing…"
                        rows={2}
                        style={{
                            flex:        1,
                            background:  '#0d1f35',
                            border:      '1px solid #1e3a5f',
                            borderRadius: 8,
                            color:       '#e2e8f0',
                            fontSize:    12,
                            padding:     '8px 10px',
                            resize:      'none',
                            outline:     'none',
                            fontFamily:  'inherit',
                            lineHeight:  1.5,
                        }}
                        onFocus={e  => e.target.style.borderColor = '#3b82f6'}
                        onBlur={e   => e.target.style.borderColor = '#1e3a5f'}
                    />
                    <button
                        onClick={() => submit()}
                        disabled={loading || !query.trim()}
                        style={{
                            background:   loading || !query.trim() ? '#162d4a' : '#1d4ed8',
                            border:       'none',
                            borderRadius: 8,
                            color:        loading || !query.trim() ? '#4b5563' : '#fff',
                            cursor:       loading || !query.trim() ? 'not-allowed' : 'pointer',
                            fontSize:     18,
                            padding:      '8px 13px',
                            flexShrink:   0,
                            lineHeight:   1,
                        }}
                    >↑</button>
                </div>
                <div style={{ color: '#374151', fontSize: 10, marginTop: 5 }}>
                    Enter to send · Shift+Enter for new line
                </div>
            </div>

            <style>{`
                @keyframes bounce {
                    0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
                    40%           { transform: translateY(-5px); opacity: 1; }
                }
            `}</style>
        </div>
    )
}

export default ChatPanel
