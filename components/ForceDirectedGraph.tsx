import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { TripletEdge } from '../types';
import { VectorRecord } from '../services/vectorDbService';

interface ForceDirectedGraphProps {
    tripletEdges: TripletEdge[];
    vectors?: VectorRecord[];
}

interface D3Node extends d3.SimulationNodeDatum {
    id: string;
    degree: number;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
    source: string | D3Node;
    target: string | D3Node;
    relation: string;
}

export const ForceDirectedGraph: React.FC<ForceDirectedGraphProps> = ({ tripletEdges, vectors }) => {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Filter by document source state
    const [activeSourceFilter, setActiveSourceFilter] = useState<string>('all');

    // Dynamic Force Settings
    const [chargeStrength, setChargeStrength] = useState<number>(-220);
    const [linkDistance, setLinkDistance] = useState<number>(100);
    const [collisionRadius, setCollisionRadius] = useState<number>(24);
    const [showLabels, setShowLabels] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Selection & Neighbors Tracking (Knowledge Map Multi-Select Visual Query)
    const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
    const [hoveredNode, setHoveredNode] = useState<{ id: string; degree: number; connections: string[] } | null>(null);

    useEffect(() => {
        if (!svgRef.current || !containerRef.current || tripletEdges.length === 0) return;

        // Resolve source document for each edge and filter dynamically
        const resolveSource = (edge: TripletEdge) => {
            const vec = vectors?.find(v => v.id === edge.sourceId);
            return vec ? vec.source : 'Direct Input / Legacy';
        };

        const filteredTripletEdges = activeSourceFilter === 'all'
            ? tripletEdges
            : tripletEdges.filter(e => resolveSource(e) === activeSourceFilter);

        // Clear previous SVG contents
        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        // Get parent dimensions
        const width = containerRef.current.clientWidth || 800;
        const height = containerRef.current.clientHeight || 500;

        // Transform TripletEdges to D3-compatible Nodes and Links
        const nodesMap = new Map<string, D3Node>();
        const linksList: D3Link[] = [];

        filteredTripletEdges.forEach(edge => {
            const sId = edge.s.trim();
            const oId = edge.o.trim();
            if (!sId || !oId) return;

            if (!nodesMap.has(sId)) {
                nodesMap.set(sId, { id: sId, degree: 0 });
            }
            if (!nodesMap.has(oId)) {
                nodesMap.set(oId, { id: oId, degree: 0 });
            }

            nodesMap.get(sId)!.degree += 1;
            nodesMap.get(oId)!.degree += 1;

            linksList.push({
                source: sId,
                target: oId,
                relation: edge.r || 'related'
            });
        });

        const nodesList = Array.from(nodesMap.values());

        // Create root group for zooming/panning
        const g = svg.append('g').attr('class', 'graph-root-group');

        // Setup D3 Zoom behaviors
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.15, 4])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoom);

        // SVG Markers for Directed Arrows
        svg.append('defs').append('marker')
            .attr('id', 'arrowhead')
            .attr('viewBox', '-0 -5 10 10')
            .attr('refX', 18) // Offset arrow from center node
            .attr('refY', 0)
            .attr('orient', 'auto')
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('xoverflow', 'visible')
            .append('svg:path')
            .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
            .attr('fill', '#3b82f6')
            .style('stroke', 'none');

        // Setup Force Simulation
        const simulation = d3.forceSimulation<D3Node>(nodesList)
            .force('link', d3.forceLink<D3Node, D3Link>(linksList)
                .id(d => d.id)
                .distance(linkDistance)
            )
            .force('charge', d3.forceManyBody().strength(chargeStrength))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collide', d3.forceCollide().radius(collisionRadius))
            .alphaDecay(0.02);

        // Relationship Links Group
        const link = g.append('g')
            .attr('class', 'links-group')
            .selectAll<SVGPathElement, D3Link>('path')
            .data(linksList)
            .enter().append('path')
            .attr('stroke', '#262626')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', 2)
            .attr('fill', 'none')
            .attr('marker-end', 'url(#arrowhead)');

        // Relationship Text Labels
        const linkText = g.append('g')
            .attr('class', 'link-labels-group')
            .selectAll<SVGTextElement, D3Link>('text')
            .data(linksList)
            .enter().append('text')
            .attr('font-size', '8px')
            .attr('font-family', 'monospace')
            .attr('fill', '#a3a3a3')
            .attr('text-anchor', 'middle')
            .attr('dy', -4)
            .style('display', showLabels ? 'block' : 'none')
            .text(d => d.relation);

        // Nodes Group
        const node = g.append('g')
            .attr('class', 'nodes-group')
            .selectAll<SVGGElement, D3Node>('g')
            .data(nodesList)
            .enter().append('g')
            .call(d3.drag<SVGGElement, D3Node>()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended)
            );

        // Node Circle Elements
        node.append('circle')
            .attr('r', d => Math.max(7, Math.min(22, 6 + d.degree * 2.2)))
            .attr('fill', d => {
                // Color node based on degree (hub vs leaf nodes)
                if (d.degree > 6) return '#a855f7'; // Purple (Primary Hubs)
                if (d.degree > 3) return '#3b82f6'; // Blue (Connecting Hubs)
                return '#10b981'; // Green (Leaves / End entities)
            })
            .attr('stroke', '#0a0a0a')
            .attr('stroke-width', 1.5)
            .style('cursor', 'pointer');

        // Node Label Elements
        node.append('text')
            .attr('dy', d => -Math.max(11, 10 + d.degree * 1.5))
            .attr('text-anchor', 'middle')
            .attr('font-size', '9px')
            .attr('font-family', 'monospace')
            .attr('fill', '#f5f5f5')
            .attr('stroke', '#0a0a0a')
            .attr('stroke-width', '2.5px')
            .attr('paint-order', 'stroke fill')
            .style('pointer-events', 'none')
            .text(d => d.id);

        // Highlighting Logic on Search or Click
        function updateHighlights() {
            const query = searchQuery.trim().toLowerCase();

            node.selectAll('circle').attr('fill', (d: any) => {
                if (query && d.id.toLowerCase().includes(query)) return '#f59e0b'; // Amber Highlight
                if (selectedNodeIds.length > 0) {
                    if (selectedNodeIds.includes(d.id)) return '#3b82f6'; // Bright blue for selected
                    // Check if neighbor of any selected node
                    const isNeighbor = linksList.some(l => {
                        const sId = (l.source as D3Node).id;
                        const tId = (l.target as D3Node).id;
                        return (selectedNodeIds.includes(sId) && tId === d.id) ||
                               (selectedNodeIds.includes(tId) && sId === d.id);
                    });
                    if (isNeighbor) return '#a855f7'; // Purple neighbor
                    return '#262626'; // Dimmed
                }
                if (d.degree > 6) return '#a855f7';
                if (d.degree > 3) return '#3b82f6';
                return '#10b981';
            });

            node.selectAll('text').attr('fill', (d: any) => {
                if (selectedNodeIds.length > 0 && !selectedNodeIds.includes(d.id)) {
                    const isNeighbor = linksList.some(l => {
                        const sId = (l.source as D3Node).id;
                        const tId = (l.target as D3Node).id;
                        return (selectedNodeIds.includes(sId) && tId === d.id) ||
                               (selectedNodeIds.includes(tId) && sId === d.id);
                    });
                    return isNeighbor ? '#f5f5f5' : '#525252';
                }
                return '#f5f5f5';
            });

            link.attr('stroke', (l: any) => {
                if (selectedNodeIds.length > 0) {
                    const sId = (l.source as D3Node).id;
                    const tId = (l.target as D3Node).id;
                    if (selectedNodeIds.includes(sId) || selectedNodeIds.includes(tId)) return '#3b82f6';
                    return '#171717';
                }
                return '#262626';
            }).attr('stroke-opacity', (l: any) => {
                if (selectedNodeIds.length > 0) {
                    const sId = (l.source as D3Node).id;
                    const tId = (l.target as D3Node).id;
                    return (selectedNodeIds.includes(sId) || selectedNodeIds.includes(tId)) ? 1.0 : 0.15;
                }
                return 0.6;
            });
        }

        // Click interaction handlers (Multi-selection Visual Query)
        node.on('click', (event, d) => {
            event.stopPropagation();
            setSelectedNodeIds(prev => {
                const isSelected = prev.includes(d.id);
                return isSelected ? prev.filter(id => id !== d.id) : [...prev, d.id];
            });
        });

        // Hover interaction handlers
        node.on('mouseenter', (event, d) => {
            const connections = linksList
                .filter(l => (l.source as D3Node).id === d.id || (l.target as D3Node).id === d.id)
                .map(l => {
                    const otherId = (l.source as D3Node).id === d.id ? (l.target as D3Node).id : (l.source as D3Node).id;
                    return `${l.relation} -> ${otherId}`;
                });
            setHoveredNode({
                id: d.id,
                degree: d.degree,
                connections
            });
        });

        node.on('mouseleave', () => {
            setHoveredNode(null);
        });

        // Background clicks deselect matches
        svg.on('click', () => {
            setSelectedNodeIds([]);
        });

        // Run highlight refresh
        updateHighlights();

        // Update positions on Tick
        simulation.on('tick', () => {
            // Draw straight or curved link paths
            link.attr('d', d => {
                const source = d.source as D3Node;
                const target = d.target as D3Node;
                return `M${source.x},${source.y} L${target.x},${target.y}`;
            });

            // Adjust link text middle points
            linkText
                .attr('x', d => ((d.source as D3Node).x! + (d.target as D3Node).y!) / 2) // Rough middle
                .attr('y', d => ((d.source as D3Node).y! + (d.target as D3Node).y!) / 2)
                .attr('transform', d => {
                    const s = d.source as D3Node;
                    const t = d.target as D3Node;
                    const angle = Math.atan2(t.y! - s.y!, t.x! - s.x!) * (180 / Math.PI);
                    const midX = (s.x! + t.x!) / 2;
                    const midY = (s.y! + t.y!) / 2;
                    return `rotate(${angle > 90 || angle < -90 ? angle + 180 : angle}, ${midX}, ${midY})`;
                });

            // Update node groups placement
            node.attr('transform', d => `translate(${d.x},${d.y})`);
        });

        // Drag helpers
        function dragstarted(event: any, d: any) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event: any, d: any) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event: any, d: any) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }

        return () => {
            simulation.stop();
        };
    }, [tripletEdges, vectors, activeSourceFilter, chargeStrength, linkDistance, collisionRadius, showLabels, searchQuery, selectedNodeIds]);

    // Zoom Controls
    const zoomTo = (factor: number) => {
        if (!svgRef.current) return;
        const svg = d3.select(svgRef.current);
        svg.transition().duration(400).call(
            (d3.zoom() as any).scaleBy, factor
        );
    };

    const resetZoom = () => {
        if (!svgRef.current) return;
        const svg = d3.select(svgRef.current);
        svg.transition().duration(400).call(
            (d3.zoom() as any).transform, d3.zoomIdentity
        );
        setSelectedNodeId(null);
    };

    return (
        <div className="w-full h-full flex flex-col lg:flex-row gap-6 items-stretch">
            {/* CANVAS CONTAINER */}
            <div 
                ref={containerRef} 
                className="flex-grow bg-black/60 rounded-2xl border border-neutral-800 relative overflow-hidden h-[450px] lg:h-[600px]"
            >
                {/* SVG VIEWPORT */}
                <svg 
                    ref={svgRef} 
                    className="w-full h-full select-none" 
                    style={{ background: 'radial-gradient(circle, #0e0e0e 0%, #050505 100%)' }}
                />

                {/* ZOOM CONTROLS OVERLAY */}
                <div className="absolute bottom-5 left-5 bg-neutral-900/90 border border-neutral-800 rounded-xl p-1.5 flex gap-1 shadow-xl">
                    <button 
                        onClick={() => zoomTo(1.3)} 
                        className="w-8 h-8 flex items-center justify-center text-xs font-bold text-neutral-300 hover:text-white bg-black/30 rounded-lg border border-neutral-800 hover:border-neutral-700 transition-all cursor-pointer"
                        title="Zoom In"
                    >
                        ＋
                    </button>
                    <button 
                        onClick={() => zoomTo(0.7)} 
                        className="w-8 h-8 flex items-center justify-center text-xs font-bold text-neutral-300 hover:text-white bg-black/30 rounded-lg border border-neutral-800 hover:border-neutral-700 transition-all cursor-pointer"
                        title="Zoom Out"
                    >
                        －
                    </button>
                    <button 
                        onClick={resetZoom} 
                        className="px-2.5 h-8 flex items-center justify-center text-[10px] font-black uppercase tracking-wider text-neutral-400 hover:text-white bg-black/30 rounded-lg border border-neutral-800 hover:border-neutral-700 transition-all cursor-pointer"
                        title="Reset Camera"
                    >
                        Reset
                    </button>
                </div>

                {/* DYNAMIC HOVER TOOLTIP CARDS */}
                {hoveredNode && (
                    <div className="absolute top-5 left-5 bg-neutral-900/95 border border-neutral-800 p-4 rounded-xl max-w-xs space-y-2.5 shadow-2xl pointer-events-none animate-fade-in font-mono text-[10px] text-neutral-400">
                        <div className="pb-1.5 border-b border-neutral-850">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-purple-400">Entity Node details</span>
                            <h4 className="text-xs font-black text-white mt-0.5 break-all">{hoveredNode.id}</h4>
                        </div>
                        <div className="space-y-1">
                            <div>Connections Degree: <span className="text-white font-bold">{hoveredNode.degree}</span></div>
                            {hoveredNode.connections.length > 0 && (
                                <div className="space-y-1 mt-1.5 pt-1.5 border-t border-neutral-850">
                                    <div className="font-bold text-[9px] uppercase tracking-wider text-neutral-500">Extracted Relations</div>
                                    <div className="max-h-24 overflow-y-auto space-y-1">
                                        {hoveredNode.connections.slice(0, 5).map((c, i) => (
                                            <div key={i} className="truncate text-neutral-300 bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-850/50">{c}</div>
                                        ))}
                                        {hoveredNode.connections.length > 5 && (
                                            <div className="text-[9px] text-neutral-600 font-bold italic">+ {hoveredNode.connections.length - 5} more</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* DYNAMIC SETTINGS PANEL */}
            <div className="w-full lg:w-80 bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl gap-6 flex-shrink-0">
                <div className="space-y-5">
                    <div>
                        <h4 className="text-xs font-black uppercase text-blue-400 tracking-wider">Topology Dashboard</h4>
                        <p className="text-[10px] text-neutral-500 mt-0.5 uppercase tracking-wide font-black">Force-directed physical simulation</p>
                    </div>

                    {/* INTERACTIVE SOURCE FILTER DROPDOWN */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Filter by Source Document</label>
                        <select
                            value={activeSourceFilter}
                            onChange={(e) => {
                                setActiveSourceFilter(e.target.value);
                                setSelectedNodeId(null); // Reset selection when filter changes
                            }}
                            className="w-full bg-black border border-neutral-850 rounded-lg p-2.5 text-xs text-white placeholder-neutral-500 outline-none focus:border-blue-500/50"
                        >
                            <option value="all">All Document Sources</option>
                            {(() => {
                                const uniqueSourcesInGraph = Array.from(new Set(
                                    tripletEdges.map(edge => {
                                        const vec = vectors?.find(v => v.id === edge.sourceId);
                                        return vec ? vec.source : 'Direct Input / Legacy';
                                    }).filter(Boolean)
                                ));
                                return uniqueSourcesInGraph.map(src => (
                                    <option key={src} value={src}>{src}</option>
                                ));
                            })()}
                        </select>
                    </div>

                    {/* SEARCH FILTER BOX */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Find Entity Node</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Type label (e.g. Character)..."
                                className="w-full bg-black border border-neutral-850 rounded-lg p-2.5 pl-3 pr-8 text-xs text-white placeholder-neutral-500 outline-none focus:border-blue-500/50"
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 text-[10px] cursor-pointer"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>

                    {/* CLICKED NODE DETAILS & ASSOCIATED SNIPPETS (Knowledge Map Visual Query Multi-Select) */}
                    {selectedNodeIds.length > 0 ? (
                        <div className="space-y-4 pt-3 border-t border-neutral-850 font-sans">
                            <div>
                                <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">Knowledge Map visual Query</span>
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {selectedNodeIds.map(nodeId => (
                                        <span 
                                            key={nodeId} 
                                            className="bg-blue-950/40 text-blue-300 px-2 py-0.5 rounded border border-blue-900/35 text-[9px] font-mono flex items-center gap-1.5 font-bold"
                                        >
                                            {nodeId}
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedNodeIds(prev => prev.filter(id => id !== nodeId));
                                                }}
                                                className="text-neutral-500 hover:text-white cursor-pointer font-sans text-[8px]"
                                            >
                                                ✕
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {(() => {
                                const uniqueDocuments = Array.from(new Set(vectors?.map(v => v.source).filter(Boolean) || []));
                                const matchingDocuments = uniqueDocuments.filter(docName => {
                                    const docChunks = vectors?.filter(v => v.source === docName) || [];
                                    const combinedText = docChunks.map(v => v.text.toLowerCase()).join(' ');
                                    return selectedNodeIds.every(nodeId => combinedText.includes(nodeId.toLowerCase()));
                                });

                                return (
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest block font-mono">
                                                Intersecting Docs ({matchingDocuments.length})
                                            </span>
                                            <button 
                                                onClick={() => setSelectedNodeIds([])} 
                                                className="text-[9px] text-red-400 hover:underline font-bold uppercase tracking-wider font-mono cursor-pointer"
                                            >
                                                Clear All
                                            </button>
                                        </div>
                                        
                                        <div className="space-y-2.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                                            {matchingDocuments.map((docName, idx) => {
                                                const docChunks = vectors?.filter(v => v.source === docName) || [];
                                                return (
                                                    <div 
                                                        key={idx}
                                                        className="bg-black/40 border border-neutral-850 hover:border-neutral-750 p-2.5 rounded-lg text-[10px] text-neutral-300 leading-normal space-y-1.5"
                                                    >
                                                        <div className="flex justify-between items-center text-[8px] font-mono text-neutral-500 border-b border-neutral-850/60 pb-1">
                                                            <span className="truncate text-white font-bold">📄 {docName}</span>
                                                            <span className="text-[8px] text-blue-400 font-bold bg-blue-950/20 px-1.5 rounded">Intersection</span>
                                                        </div>
                                                        
                                                        <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar">
                                                            {selectedNodeIds.map(nodeId => {
                                                                const snippet = docChunks.find(v => v.text.toLowerCase().includes(nodeId.toLowerCase()));
                                                                if (!snippet) return null;
                                                                return (
                                                                    <div key={nodeId} className="text-[9px] text-neutral-400 bg-black/20 p-1 rounded border border-neutral-900 font-sans italic line-clamp-1">
                                                                        <strong className="text-blue-400 font-mono not-italic">{nodeId}:</strong> {snippet.text.substring(0, 100)}...
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {matchingDocuments.length === 0 && (
                                                <p className="text-[9px] text-neutral-500 italic">No documents contain all selected entities.</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    ) : (
                        <div className="p-4 rounded-xl border border-neutral-850 bg-black/20 text-center font-sans text-[10px] text-neutral-500 leading-relaxed">
                            💡 <strong className="text-neutral-400 font-bold">Knowledge Map visual Query:</strong> Click multiple nodes in the graph to toggle selections and discover document sources containing their factual intersection.
                        </div>
                    )}

                    {/* SLIDERS FOR SIMULATOR CONSTANTS */}
                    <div className="space-y-4 pt-2 border-t border-neutral-850">
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-mono text-neutral-400 uppercase">
                                <span>Gravity Strength</span>
                                <span className="text-white font-bold">{chargeStrength}</span>
                            </div>
                            <input
                                type="range"
                                min="-600"
                                max="-50"
                                step="10"
                                value={chargeStrength}
                                onChange={e => setChargeStrength(Number(e.target.value))}
                                className="w-full accent-blue-500 cursor-pointer"
                            />
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-mono text-neutral-400 uppercase">
                                <span>Link Distance</span>
                                <span className="text-white font-bold">{linkDistance}px</span>
                            </div>
                            <input
                                type="range"
                                min="40"
                                max="300"
                                step="5"
                                value={linkDistance}
                                onChange={e => setLinkDistance(Number(e.target.value))}
                                className="w-full accent-blue-500 cursor-pointer"
                            />
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-mono text-neutral-400 uppercase">
                                <span>Collision Radius</span>
                                <span className="text-white font-bold">{collisionRadius}px</span>
                            </div>
                            <input
                                type="range"
                                min="10"
                                max="60"
                                step="2"
                                value={collisionRadius}
                                onChange={e => setCollisionRadius(Number(e.target.value))}
                                className="w-full accent-blue-500 cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* VIEW TOGGLES */}
                    <div className="flex items-center justify-between pt-3 border-t border-neutral-850">
                        <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Display Link Labels</span>
                        <button
                            onClick={() => setShowLabels(!showLabels)}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                showLabels 
                                    ? 'bg-blue-600 text-white' 
                                    : 'bg-neutral-800 text-neutral-500 hover:bg-neutral-750'
                            }`}
                        >
                            {showLabels ? 'Show' : 'Hide'}
                        </button>
                    </div>
                </div>

                <div className="pt-3 border-t border-neutral-850 text-[9px] text-neutral-500 font-mono uppercase space-y-1.5 leading-relaxed bg-black/25 p-3 rounded-xl border border-neutral-850/60">
                    <div className="flex gap-1.5 items-center">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#a855f7]" />
                        <span>Major entity hubs (degree &gt; 6)</span>
                    </div>
                    <div className="flex gap-1.5 items-center">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />
                        <span>Connector entities (degree &gt; 3)</span>
                    </div>
                    <div className="flex gap-1.5 items-center">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                        <span>Leaf entities / branches</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
