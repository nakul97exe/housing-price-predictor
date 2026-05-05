import { useEffect, useRef } from "react";

const Map = ({ filters, onPinClick, selectedPropId }) => {
    const mapRef          = useRef(null);
    const viewRef         = useRef(null);
    const featureLayerRef = useRef(null);
    const gfxLayerRef     = useRef(null);  // GraphicsLayer instance
    const ctorsRef        = useRef(null);  // ArcGIS constructors needed in effects
    const onPinClickRef   = useRef(onPinClick);

    useEffect(() => { onPinClickRef.current = onPinClick }, [onPinClick])

    // ── Init: create map, layers, widgets, click handler ──────────────────
    useEffect(() => {
        const { require } = window;

        require([
            'esri/Map',
            'esri/views/MapView',
            'esri/layers/FeatureLayer',
            'esri/layers/GraphicsLayer',
            'esri/Graphic',
            'esri/geometry/Point',
            'esri/geometry/Extent',
            'esri/renderers/ClassBreaksRenderer',
            'esri/symbols/SimpleMarkerSymbol',
            'esri/symbols/SimpleFillSymbol',
            'esri/symbols/TextSymbol',
            'esri/PopupTemplate',
            'esri/widgets/Home',
            'esri/widgets/BasemapGallery',
            'esri/widgets/Expand',
        ], (
            EsriMap, MapView, FeatureLayer, GraphicsLayer, Graphic,
            Point, Extent, ClassBreaksRenderer, SimpleMarkerSymbol,
            SimpleFillSymbol, TextSymbol, PopupTemplate, Home,
            BasemapGallery, Expand
        ) => {
            // Store constructors for use in other effects
            ctorsRef.current = { Graphic, Point, Extent, SimpleMarkerSymbol, SimpleFillSymbol, TextSymbol }

            const map  = new EsriMap({ basemap: 'streets-night-vector' })
            const view = new MapView({ container: mapRef.current, map, center: [-119.5, 37.5], zoom: 6 })
            viewRef.current = view

            view.ui.add(
                new Expand({
                    view,
                    content:         new BasemapGallery({ view }),
                    expandIconClass: 'esri-icon-basemap',
                }),
                { position: 'top-left', index: 0 }
            )
            view.ui.add(new Home({ view }), 'top-left')

            // GraphicsLayer sits on top — for bounds rect + top-5 pins
            const gfxLayer = new GraphicsLayer({ title: 'overlays' })
            map.add(gfxLayer)
            gfxLayerRef.current = gfxLayer

            // Click handler: hit-test only the graphics layer
            view.on('click', async (event) => {
                const hit = await view.hitTest(event, { include: [gfxLayer] })
                const pinResult = hit.results.find(r => r.graphic?.attributes?.propId != null)
                if (pinResult) {
                    onPinClickRef.current?.(pinResult.graphic.attributes.propId)
                }
            })

            // Housing FeatureLayer (client-side source)
            fetch('/housing.json')
                .then(res  => res.json())
                .then(data => {
                    const graphics = data.map((d, i) => new Graphic({
                        geometry: new Point({ longitude: d.longitude, latitude: d.latitude }),
                        attributes: {
                            ObjectID:            i + 1,
                            median_house_value:  d.median_house_value,
                            median_income:       d.median_income,
                            ocean_proximity:     d.ocean_proximity,
                            housing_median_age:  d.housing_median_age,
                            total_rooms:         d.total_rooms,
                            total_bedrooms:      d.total_bedrooms,
                            population:          d.population,
                            households:          d.households,
                            price_category:      d.price_category,
                        }
                    }))

                    const renderer = new ClassBreaksRenderer({
                        field: 'median_house_value',
                        classBreakInfos: [
                            { minValue: 0,      maxValue: 100000,  symbol: new SimpleMarkerSymbol({ color: [65,  105, 225, 210], size: 6, outline: { color: [255,255,255,40], width: 0.5 } }), label: '< $100K'       },
                            { minValue: 100001, maxValue: 200000,  symbol: new SimpleMarkerSymbol({ color: [50,  205, 50,  210], size: 6, outline: { color: [255,255,255,40], width: 0.5 } }), label: '$100K–$200K'  },
                            { minValue: 200001, maxValue: 300000,  symbol: new SimpleMarkerSymbol({ color: [255, 215, 0,   210], size: 6, outline: { color: [255,255,255,40], width: 0.5 } }), label: '$200K–$300K'  },
                            { minValue: 300001, maxValue: 400000,  symbol: new SimpleMarkerSymbol({ color: [255, 140, 0,   210], size: 6, outline: { color: [255,255,255,40], width: 0.5 } }), label: '$300K–$400K'  },
                            { minValue: 400001, maxValue: 9999999, symbol: new SimpleMarkerSymbol({ color: [220, 20,  60,  210], size: 6, outline: { color: [255,255,255,40], width: 0.5 } }), label: '> $400K'       },
                        ]
                    })

                    const popupTemplate = new PopupTemplate({
                        title:   '📍 {ocean_proximity}',
                        content: [{ type: 'fields', fieldInfos: [
                            { fieldName: 'median_house_value', label: 'House Value',       format: { digitSeparator: true, places: 0 } },
                            { fieldName: 'median_income',      label: 'Median Income',     format: { digitSeparator: true, places: 2 } },
                            { fieldName: 'housing_median_age', label: 'Housing Age (yrs)', format: { places: 0 } },
                            { fieldName: 'ocean_proximity',    label: 'Ocean Proximity' },
                            { fieldName: 'total_rooms',        label: 'Total Rooms',       format: { digitSeparator: true, places: 0 } },
                            { fieldName: 'population',         label: 'Population',        format: { digitSeparator: true, places: 0 } },
                        ]}]
                    })

                    const featureLayer = new FeatureLayer({
                        source: graphics,
                        fields: [
                            { name: 'ObjectID',           type: 'oid'    },
                            { name: 'median_house_value', type: 'double' },
                            { name: 'median_income',      type: 'double' },
                            { name: 'ocean_proximity',    type: 'string' },
                            { name: 'price_category',     type: 'string' },
                            { name: 'housing_median_age', type: 'double' },
                            { name: 'total_rooms',        type: 'double' },
                            { name: 'total_bedrooms',     type: 'double' },
                            { name: 'population',         type: 'double' },
                            { name: 'households',         type: 'double' },
                        ],
                        objectIdField: 'ObjectID',
                        geometryType:  'point',
                        renderer,
                        popupTemplate,
                        title: 'California Housing',
                    })

                    map.add(featureLayer)
                    featureLayerRef.current = featureLayer
                    console.log(`✅ ${graphics.length} housing points loaded`)
                })
                .catch(err => console.error('Error loading housing.json:', err))
        })

        return () => {
            if (viewRef.current) {
                viewRef.current.ui.empty()
                viewRef.current.destroy()
            }
        }
    }, [])

    // ── Filter + overlay effect ────────────────────────────────────────────
    useEffect(() => {
        if (!featureLayerRef.current) {
            const interval = setInterval(() => {
                if (featureLayerRef.current) { clearInterval(interval); applyFilter() }
            }, 100)
            return () => clearInterval(interval)
        }
        applyFilter()

        function applyFilter() {
            const fl   = featureLayerRef.current
            const gfx  = gfxLayerRef.current
            const C    = ctorsRef.current
            if (!fl) return

            gfx?.removeAll()

            if (!filters?.expression) {
                fl.definitionExpression = '1=1'
                return
            }

            fl.definitionExpression = filters.expression

            const props5 = filters.top_5_properties
            if (!gfx || !C || !props5?.length) return

            const PAD = 0.18

            // 1 — One cluster rectangle per zone (group top-5 by ocean_proximity)
            const byZone = {}
            props5.forEach(prop => {
                if (!byZone[prop.ocean_proximity]) byZone[prop.ocean_proximity] = []
                byZone[prop.ocean_proximity].push(prop)
            })
            Object.values(byZone).forEach(zoneProps => {
                const zLats = zoneProps.map(p => p.latitude)
                const zLngs = zoneProps.map(p => p.longitude)
                gfx.add(new C.Graphic({
                    geometry: new C.Extent({
                        xmin: Math.min(...zLngs) - PAD,
                        ymin: Math.min(...zLats) - PAD,
                        xmax: Math.max(...zLngs) + PAD,
                        ymax: Math.max(...zLats) + PAD,
                        spatialReference: { wkid: 4326 },
                    }),
                    symbol: new C.SimpleFillSymbol({
                        color:   [34, 197, 94, 0.5],
                        outline: { color: [22, 163, 74, 180], width: 1.5 },
                    }),
                }))
            })

            // 2 — Zoom to fit all clusters
            const allLats = props5.map(p => p.latitude)
            const allLngs = props5.map(p => p.longitude)
            viewRef.current?.goTo(
                new C.Extent({
                    xmin: Math.min(...allLngs) - PAD,
                    ymin: Math.min(...allLats) - PAD,
                    xmax: Math.max(...allLngs) + PAD,
                    ymax: Math.max(...allLats) + PAD,
                    spatialReference: { wkid: 4326 },
                }),
                { duration: 1000 }
            )

            // 3 — Top-5 amber pins (circle + rank number)
            props5.forEach((prop, i) => {
                const pt = new C.Point({ longitude: prop.longitude, latitude: prop.latitude })
                gfx.add(new C.Graphic({
                    geometry:   pt,
                    symbol:     new C.SimpleMarkerSymbol({ color: [251, 191, 36, 0.5], size: 20, outline: { color: [251, 191, 36, 200], width: 1.5 } }),
                    attributes: { propId: prop.id },
                }))
                gfx.add(new C.Graphic({
                    geometry:   pt,
                    symbol:     new C.TextSymbol({ text: `${i + 1}`, color: [20, 20, 20, 255], font: { size: 10, weight: 'bold' }, yoffset: -4 }),
                    attributes: { propId: prop.id },
                }))
            })
        }
    }, [filters])

    // ── Highlight selected pin ─────────────────────────────────────────────
    useEffect(() => {
        const gfx = gfxLayerRef.current
        const C   = ctorsRef.current
        if (!gfx || !C || !filters?.top_5_properties) return

        gfx.graphics.forEach(g => {
            if (g.attributes?.propId == null) return
            const rank = filters.top_5_properties.findIndex(p => p.id === g.attributes.propId)
            if (rank === -1) return

            const isSelected = g.attributes.propId === selectedPropId
            if (g.symbol.type === 'simple-marker') {
                g.symbol = new C.SimpleMarkerSymbol({
                    color:   isSelected ? [255, 255, 255, 255] : [59, 130, 246, 180],
                    size:    isSelected ? 24 : 20,
                    outline: { color: isSelected ? [74, 222, 128, 255] : [255, 255, 255, 200], width: isSelected ? 2.5 : 1.5 },
                })
            }
        })
    }, [selectedPropId, filters])

    return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
}

export default Map
