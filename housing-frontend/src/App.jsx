import { useState } from 'react'
import Map from './components/Map'
import ResultPanel from './components/ResultPanel'
import ChatPanel from './components/ChatPanel'
import './App.css'

function App() {
  const [filters, setFilters]         = useState(null)
  const [chatOpen, setChatOpen]       = useState(false)
  const [selectedPropId, setSelected] = useState(null)

  const clearFilters = () => { setFilters(null); setSelected(null) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>

      {/* ── Header ── */}
      <div style={{
        background:   '#0d1b2a',
        padding:      '0 16px',
        height:       48,
        borderBottom: '1px solid #1e3a5f',
        display:      'flex',
        alignItems:   'center',
        gap:          12,
        flexShrink:   0,
      }}>

        <span style={{ fontSize: 18 }}>🏠</span>
        <h1 style={{ fontSize: 14, color: '#60a5fa', margin: 0 }}>
          CA Housing Predictor
        </h1>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setChatOpen(o => !o)}
            style={{
              padding:      '5px 14px',
              background:   chatOpen ? '#1e40af' : '#1d4ed8',
              color:        '#fff',
              border:       chatOpen ? '1px solid #3b82f6' : '1px solid transparent',
              borderRadius: 6,
              cursor:       'pointer',
              fontSize:     12,
              display:      'flex',
              alignItems:   'center',
              gap:          6,
            }}
          >
            <span>💬</span> AI Chat
          </button>

          {filters && (
            <button
              onClick={clearFilters}
              style={{
                padding:      '5px 12px',
                background:   'transparent',
                color:        '#9ca3af',
                border:       '1px solid #374151',
                borderRadius: 6,
                cursor:       'pointer',
                fontSize:     12,
              }}
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Map + side panels (flex row — panels push the map) ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <ChatPanel
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          onResult={(data) => { setFilters(data); setSelected(null) }}
        />
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <Map
            filters={filters}
            selectedPropId={selectedPropId}
            onPinClick={setSelected}
          />
        </div>
        <ResultPanel
          filters={filters}
          onClose={clearFilters}
          selectedPropId={selectedPropId}
          onCardClick={setSelected}
        />
      </div>

      {/* ── Legend ── */}
      <div style={{
        background:  '#0d1b2a',
        padding:     '7px 20px',
        borderTop:   '1px solid #1e3a5f',
        display:     'flex',
        gap:         20,
        fontSize:    11,
        flexShrink:  0,
      }}>
        {[
          { color: '#4169E1', label: '< $100K'      },
          { color: '#32CD32', label: '$100K – $200K' },
          { color: '#FFD700', label: '$200K – $300K' },
          { color: '#FF8C00', label: '$300K – $400K' },
          { color: '#DC143C', label: '> $400K'       },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
            <span style={{ color: '#6b7280' }}>{item.label}</span>
          </div>
        ))}
      </div>

    </div>
  )
}

export default App
