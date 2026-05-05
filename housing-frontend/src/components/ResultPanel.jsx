const ResultPanel = ({ filters, onClose, selectedPropId, onCardClick }) => {
    if (!filters) return null

    const fmt  = (n) => `$${Number(n).toLocaleString()}`
    const fmtK = (n) => `$${(n / 1000).toFixed(0)}K`

    const {
        query_type, annual_income, max_budget, threshold,
        ocean_predictions, price_range, affordable_count,
        affordable_zones, best_zone, top_5_properties, summary,
    } = filters

    const isIncome = !query_type || query_type === 'income'

    // Sort zones: for income sort by predicted_price; for budget sort by avg_price
    const sortedZones = ocean_predictions
        ? Object.entries(ocean_predictions).sort((a, b) => {
            const aVal = isIncome ? (a[1].predicted_price ?? 0) : (a[1].avg_price ?? 0)
            const bVal = isIncome ? (b[1].predicted_price ?? 0) : (b[1].avg_price ?? 0)
            return aVal - bVal
          })
        : []

    return (
        <div style={{
            width:         320,
            height:        '100%',
            flexShrink:    0,
            background:    '#09121e',
            borderLeft:    '1px solid #1e3a5f',
            display:       'flex',
            flexDirection: 'column',
            boxShadow:     '-4px 0 16px rgba(0,0,0,0.4)',
        }}>

            {/* ── Header ── */}
            <div style={{
                padding:        '12px 16px',
                borderBottom:   '1px solid #1e3a5f',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                flexShrink:     0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>🏠</span>
                    <span style={{ color: '#60a5fa', fontWeight: 600, fontSize: 13 }}>Results</span>
                    {query_type && (
                        <span style={{
                            background:   isIncome ? '#1e3a5f' : '#1c1917',
                            color:        isIncome ? '#93c5fd' : '#fb923c',
                            fontSize:     9,
                            padding:      '2px 7px',
                            borderRadius: 10,
                            fontWeight:   600,
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                        }}>
                            {isIncome ? 'Income' : 'Budget'}
                        </span>
                    )}
                </div>
                <button
                    onClick={onClose}
                    style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', fontSize: 17, lineHeight: 1 }}
                    onMouseEnter={e => e.target.style.color = '#e2e8f0'}
                    onMouseLeave={e => e.target.style.color = '#4b5563'}
                >✕</button>
            </div>

            {/* ── Scrollable body ── */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* 1 — Summary */}
                {summary && (
                    <p style={{ margin: 0, color: '#93c5fd', fontSize: 12, lineHeight: 1.6,
                        background: '#0d1f35', border: '1px solid #1e3a5f', borderRadius: 8, padding: '10px 12px' }}>
                        {summary}
                    </p>
                )}

                {/* 2 — Budget card (shape differs by query type) */}
                <div style={{ background: '#0d1f35', borderRadius: 10, padding: '12px 14px', border: '1px solid #1e3a5f' }}>
                    <Label>Your Budget</Label>
                    {isIncome ? (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                                <Stat label="Annual Income" value={fmtK(annual_income)} color="#60a5fa" />
                                <div style={{ color: '#1e3a5f', fontSize: 18, alignSelf: 'center' }}>→</div>
                                <Stat label="Max Budget"    value={fmtK(threshold)}     color="#4ade80" />
                            </div>
                            <div style={{ color: '#374151', fontSize: 10, marginTop: 10, borderTop: '1px solid #1a304d', paddingTop: 8 }}>
                                3.5× income rule · {affordable_count?.toLocaleString()} properties on map
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                                <Stat label="Max Budget"    value={fmt(max_budget)}      color="#4ade80" />
                                <Stat label="Properties"    value={affordable_count?.toLocaleString()} color="#60a5fa" />
                            </div>
                            <div style={{ color: '#374151', fontSize: 10, marginTop: 10, borderTop: '1px solid #1a304d', paddingTop: 8 }}>
                                Direct budget filter · all zones under {fmtK(threshold)}
                            </div>
                        </>
                    )}
                </div>

                {/* 3 — Best Zone */}
                {best_zone && (
                    <div style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <span style={{ fontSize: 12 }}>🏆</span>
                            <Label>Best Match Zone</Label>
                        </div>
                        <div style={{ color: '#4ade80', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                            {best_zone.label}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Stat label="Under Budget"  value={best_zone.properties_under_budget?.toLocaleString()} color="#e2e8f0" />
                            <Stat label="Avg Price"     value={fmtK(best_zone.avg_price)}     color="#60a5fa" />
                            <Stat label="Range"         value={`${fmtK(best_zone.price_range?.min)}–${fmtK(best_zone.price_range?.max)}`} color="#fb923c" />
                        </div>
                    </div>
                )}

                {/* 4 — Zone Predictions */}
                {sortedZones.length > 0 && (
                    <div>
                        <Label>All Zones</Label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
                            {sortedZones.map(([zone, data]) => (
                                <div key={zone} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    background: data.affordable ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.05)',
                                    border:     `1px solid ${data.affordable ? 'rgba(34,197,94,0.22)' : 'rgba(239,68,68,0.15)'}`,
                                    borderRadius: 7, padding: '8px 11px',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 12 }}>{data.affordable ? '✅' : '❌'}</span>
                                        <div>
                                            <div style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 500 }}>{zone}</div>
                                            <div style={{ color: '#6b7280', fontSize: 10 }}>
                                                {data.affordable ? 'Within budget' : 'Above budget'}
                                            </div>
                                        </div>
                                    </div>
                                    {/* Right side differs by query type */}
                                    {isIncome ? (
                                        <div style={{ color: data.affordable ? '#4ade80' : '#f87171', fontSize: 12, fontWeight: 700 }}>
                                            {fmt(data.predicted_price)}
                                        </div>
                                    ) : (
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ color: data.affordable ? '#4ade80' : '#f87171', fontSize: 11, fontWeight: 700 }}>
                                                {data.affordable ? `${data.properties_count?.toLocaleString()} props` : '—'}
                                            </div>
                                            {data.affordable && (
                                                <div style={{ color: '#6b7280', fontSize: 10 }}>
                                                    avg {fmtK(data.avg_price)}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 5 — Top 5 Properties */}
                {top_5_properties?.length > 0 && (
                    <div>
                        <Label>Top 5 Best-Value Properties</Label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                            {top_5_properties.map((prop, i) => {
                                const isSelected = prop.id === selectedPropId
                                return (
                                    <div
                                        key={prop.id}
                                        style={{
                                            background:   isSelected ? 'rgba(251,191,36,0.07)' : '#0d1f35',
                                            border:       isSelected ? '1px solid rgba(251,191,36,0.4)' : '1px solid #1e3a5f',
                                            borderRadius: 9,
                                            overflow:     'hidden',
                                            transition:   'border-color 0.15s',
                                        }}
                                    >
                                        {/* Card summary row */}
                                        <div
                                            onClick={() => onCardClick?.(isSelected ? null : prop.id)}
                                            style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start' }}
                                            onMouseEnter={e => { if (!isSelected) e.currentTarget.parentElement.style.borderColor = '#3b82f6' }}
                                            onMouseLeave={e => { if (!isSelected) e.currentTarget.parentElement.style.borderColor = '#1e3a5f' }}
                                        >
                                            <div style={{
                                                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                                                background: isSelected ? '#fbbf24' : i === 0 ? '#854d0e' : '#1e3a5f',
                                                border:     isSelected ? 'none' : i === 0 ? '1px solid #ca8a04' : '1px solid #2a4a6b',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color:   isSelected ? '#1c1917' : i === 0 ? '#fbbf24' : '#60a5fa',
                                                fontSize: 10, fontWeight: 700,
                                            }}>
                                                {i + 1}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ color: isSelected ? '#fbbf24' : '#e2e8f0', fontSize: 13, fontWeight: 700 }}>
                                                    {fmt(prop.median_house_value)}
                                                </div>
                                                <div style={{ color: '#6b7280', fontSize: 10, marginTop: 2 }}>
                                                    {prop.ocean_proximity} · Age {prop.housing_median_age} yrs
                                                </div>
                                            </div>
                                            <div style={{ color: '#374151', fontSize: 10, alignSelf: 'center' }}>
                                                {isSelected ? '▲' : '▼'}
                                            </div>
                                        </div>

                                        {/* Expanded detail drawer */}
                                        {isSelected && (
                                            <div style={{
                                                borderTop: '1px solid rgba(251,191,36,0.2)',
                                                padding:   '10px 12px',
                                                display:   'grid',
                                                gridTemplateColumns: '1fr 1fr',
                                                gap:       '7px 12px',
                                            }}>
                                                {[
                                                    { label: 'House Value',   value: fmt(prop.median_house_value) },
                                                    { label: 'Median Income', value: `${fmt(Math.round(prop.median_income * 10000))}/yr` },
                                                    { label: 'Housing Age',   value: `${prop.housing_median_age} yrs` },
                                                    { label: 'Value Score',   value: prop.value_score?.toFixed(2) },
                                                    { label: 'Total Rooms',   value: Number(prop.total_rooms).toLocaleString() },
                                                    { label: 'Bedrooms',      value: Number(prop.total_bedrooms).toLocaleString() },
                                                    { label: 'Population',    value: Number(prop.population).toLocaleString() },
                                                    { label: 'Households',    value: Number(prop.households).toLocaleString() },
                                                    { label: 'Latitude',      value: `${prop.latitude.toFixed(4)}°N` },
                                                    { label: 'Longitude',     value: `${Math.abs(prop.longitude).toFixed(4)}°W` },
                                                ].map(({ label, value }) => (
                                                    <div key={label}>
                                                        <div style={{ color: '#4b5563', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                                                        <div style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 500, marginTop: 1 }}>{value}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* 6 — Price range footer */}
                {price_range && affordable_zones?.length > 0 && (
                    <div style={{ background: '#0d1f35', borderRadius: 10, padding: '12px 14px', border: '1px solid #1e3a5f' }}>
                        <Label>Price Range · {affordable_zones.join(', ')}</Label>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                            <Stat label="Min" value={fmtK(price_range.min)} color="#4ade80" />
                            <Stat label="Avg" value={fmtK(price_range.avg)} color="#60a5fa" />
                            <Stat label="Max" value={fmtK(price_range.max)} color="#fb923c" />
                        </div>
                    </div>
                )}

                <div style={{ height: 8 }} />
            </div>
        </div>
    )
}

const Label = ({ children }) => (
    <div style={{ color: '#4b5563', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {children}
    </div>
)

const Stat = ({ label, value, color }) => (
    <div style={{ textAlign: 'center', flex: 1 }}>
        <div style={{ color, fontSize: 13, fontWeight: 700 }}>{value}</div>
        <div style={{ color: '#6b7280', fontSize: 10, marginTop: 2 }}>{label}</div>
    </div>
)

export default ResultPanel
