
import React, { useState, useEffect, useRef } from 'react';
import { vectorDb, VectorRecord } from '../services/vectorDbService';
import { Agent } from '../services/agentService';
import { UploadIcon } from './icons/UploadIcon';
import { TrashIcon } from './icons/TrashIcon';
import { DatabaseIcon, LoadingSpinner, PlusIcon } from './icons.tsx';
import { factoryService as lorepackService } from '../services/lorepack';
import { GraphNode, GraphEdge, TripletEdge, LoreHypothesis } from '../types.ts';
import { ForceDirectedGraph } from './ForceDirectedGraph';
import { generateLoreHypothesesService, parseImageAssetService, extractMetadataService, detectContradictionsService } from '../services/geminiService';

// Firebase Firestore Imports
import { db, auth } from '../services/firebase';
import { collection, query, where, onSnapshot, setDoc, deleteDoc, doc } from 'firebase/firestore';

interface KnowledgeViewProps {
    agents: Agent[];
    onUpdateAgent: (id: string, updates: Partial<Agent>) => void;
    onCallAgent?: (agent: Agent) => void;
    projectLore?: any[];
    projectCharacters?: any[];
    onAddLore?: (title: string, content: string) => void;
}

type StudioTab = 'overview' | 'vectors' | 'graph' | 'forge';

export const KnowledgeView: React.FC<KnowledgeViewProps> = ({ agents, projectLore = [], projectCharacters = [], onAddLore }) => {
    const [selectedAgentId, setSelectedAgentId] = useState<string>(agents.length > 0 ? agents[0].id : '');
    const selectedAgent = agents.find(a => a.id === selectedAgentId) || agents[0];
    const [activeTab, setActiveTab] = useState<StudioTab>('overview');

    // Stats / Data
    const [vectorCount, setVectorCount] = useState<number>(0);
    const [graphEdgeCount, setGraphEdgeCount] = useState<number>(0);
    const [graphNodeCount, setGraphNodeCount] = useState<number>(0); // Legacy graph nodes
    
    const [vectors, setVectors] = useState<VectorRecord[]>([]);
    const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]); // Legacy
    const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]); // Legacy
    const [tripletEdges, setTripletEdges] = useState<TripletEdge[]>([]);

    const [sources, setSources] = useState<string[]>([]);
    const [fileQueue, setFileQueue] = useState<File[]>([]);
    
    // NEW: Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [isDragging, setIsDragging] = useState(false);

    // Modal Preview State
    const [previewDoc, setPreviewDoc] = useState<{ title: string; content: string; isLoding?: boolean; highlightText?: string; imageUrl?: string } | null>(null);

    // Semantic Vector Similarity Search State
    const [semanticQuery, setSemanticQuery] = useState('');
    const [semanticResults, setSemanticResults] = useState<{ text: string, source: string, score: number }[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [similarityLimit, setSimilarityLimit] = useState(5);

    // Document Collection & Folder Management State
    const [activeCollection, setActiveCollection] = useState<string>('all');
    const [newCollectionName, setNewCollectionName] = useState('');
    const [movingSource, setMovingSource] = useState<string | null>(null);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [showCreateCollectionModal, setShowCreateCollectionModal] = useState(false);
    const [customCollections, setCustomCollections] = useState<string[]>([]);

    // Multi-Select & Bulk Actions State
    const [selectedSources, setSelectedSources] = useState<string[]>([]);
    const [showBulkMoveModal, setShowBulkMoveModal] = useState<boolean>(false);
    const [showBulkTagModal, setShowBulkTagModal] = useState<boolean>(false);
    const [bulkTagsInput, setBulkTagsInput] = useState<string>('');

    // Collaborative Annotation & Mentions State
    const [selectedText, setSelectedText] = useState<string>('');
    const [newComment, setNewComment] = useState<string>('');
    const [mentionTargets, setMentionTargets] = useState<string[]>([]);
    const [documentAnnotations, setDocumentAnnotations] = useState<any[]>([]);
    const [modalSidebarTab, setModalSidebarTab] = useState<'annotations' | 'citations' | 'versions'>('annotations');

    // Document Version Control snapshop states
    const [docVersions, setDocVersions] = useState<any[]>([]);
    const [isEditingDoc, setIsEditingDoc] = useState<boolean>(false);
    const [editedContent, setEditedContent] = useState<string>('');
    const [versionComment, setVersionComment] = useState<string>('');

    // Knowledge Gap Heatmap dashboard states
    const [activeHeatmapFilter, setActiveHeatmapFilter] = useState<'all' | 'gaps' | 'overlaps'>('all');
    const [selectedHeatmapItem, setSelectedHeatmapItem] = useState<any | null>(null);

    // Global Semantic Vector Search State
    const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
    const [isGlobalSearching, setIsGlobalSearching] = useState<boolean>(false);
    const [globalSemanticSearchResults, setGlobalSemanticSearchResults] = useState<any[]>([]);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);

    // Load recent searches on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem('mythos_recent_searches');
            if (saved) {
                setRecentSearches(JSON.parse(saved));
            }
        } catch (e) {
            console.error("Failed to load recent searches:", e);
        }
    }, []);

    // Lore Hypothesis Generator & Thematic Cluster Bridge State
    const [loreHypotheses, setLoreHypotheses] = useState<LoreHypothesis[]>([]);
    const [isGeneratingHypotheses, setIsGeneratingHypotheses] = useState<boolean>(false);
    const [hypothesisFilter, setHypothesisFilter] = useState<'all' | 'suggested' | 'accepted'>('all');
    const [expandedHypothesisId, setExpandedHypothesisId] = useState<string | null>(null);

    // Load hypotheses from localStorage on agent change
    useEffect(() => {
        try {
            const saved = localStorage.getItem(`mythos_lore_hypotheses_${selectedAgentId || 'global'}`);
            if (saved) {
                setLoreHypotheses(JSON.parse(saved));
            } else {
                setLoreHypotheses([]);
            }
        } catch (e) {
            console.error("Failed to load hypotheses:", e);
        }
    }, [selectedAgentId]);

    const saveHypotheses = (newHypotheses: LoreHypothesis[]) => {
        setLoreHypotheses(newHypotheses);
        try {
            localStorage.setItem(`mythos_lore_hypotheses_${selectedAgentId || 'global'}`, JSON.stringify(newHypotheses));
        } catch (e) {
            console.error("Failed to save hypotheses:", e);
        }
    };

    const handleGenerateLoreHypotheses = async () => {
        setIsGeneratingHypotheses(true);
        try {
            const docMap = new Map<string, { source: string; category?: string; summary?: string; tags?: string[]; sampleText?: string }>();
            sources.forEach(src => {
                const matched = vectors.filter(vec => vec.source === src);
                const first = matched[0];
                const textContent = matched.map(m => m.text).join('\n').substring(0, 3000);
                docMap.set(src, {
                    source: src,
                    category: first?.metadata?.collection || 'Root Documents',
                    summary: first?.metadata?.summary,
                    tags: first?.metadata?.tags,
                    sampleText: textContent
                });
            });

            const newHypotheses = await generateLoreHypothesesService(
                Array.from(docMap.values()),
                customCollections,
                projectLore,
                projectCharacters
            );

            if (newHypotheses && Array.isArray(newHypotheses)) {
                // Merge without duplicates
                const existingIds = new Set(loreHypotheses.map(h => h.id));
                const uniqueNew = newHypotheses.filter((h: any) => !existingIds.has(h.id));
                const combined = [...uniqueNew, ...loreHypotheses];
                saveHypotheses(combined);
                if (newHypotheses.length > 0) {
                    setExpandedHypothesisId(newHypotheses[0].id);
                }
            }
        } catch (err) {
            console.error("Failed to generate lore hypotheses:", err);
        } finally {
            setIsGeneratingHypotheses(false);
        }
    };

    const handleAcceptHypothesis = (id: string) => {
        const hyp = loreHypotheses.find(h => h.id === id);
        const updated = loreHypotheses.map(h => h.id === id ? { ...h, status: 'accepted' as const } : h);
        saveHypotheses(updated);
        if (hyp && onAddLore) {
            onAddLore(`Hypothesis Canon: ${hyp.title}`, `${hyp.hypothesis}\n\nEvidence: ${hyp.evidence}\n\nThematic Cluster: ${hyp.thematicCluster}\nConnected Documents: ${hyp.connectedSources.join(', ')}`);
        }
    };

    const handleDismissHypothesis = (id: string) => {
        const updated = loreHypotheses.filter(h => h.id !== id);
        saveHypotheses(updated);
    };

    const handlePreviewOrFilterDoc = (sourceName: string) => {
        const matchedVectors = vectors.filter(v => v.source === sourceName);
        if (matchedVectors.length > 0) {
            const combinedContent = matchedVectors.map(v => v.text).join('\n\n---\n\n');
            setPreviewDoc({
                title: sourceName,
                content: combinedContent
            });
        } else {
            setGlobalSearchQuery(sourceName);
        }
    };

    // Subscribe to collaborative annotations in real-time
    useEffect(() => {
        if (!previewDoc || !previewDoc.title) {
            setDocumentAnnotations([]);
            return;
        }

        const q = query(
            collection(db, 'annotations'),
            where('documentSource', '==', previewDoc.title),
            where('agentId', '==', selectedAgentId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: any[] = [];
            snapshot.forEach((doc) => {
                list.push({ id: doc.id, ...doc.data() });
            });
            // Sort by createdAt ISO string ascending
            list.sort((a, b) => {
                const timeA = new Date(a.createdAt || 0).getTime();
                const timeB = new Date(b.createdAt || 0).getTime();
                return timeA - timeB;
            });
            setDocumentAnnotations(list);
        }, (error) => {
            console.error("Real-time annotations sync failed:", error);
        });

        return () => unsubscribe();
    }, [previewDoc, selectedAgentId]);

    // Fetch document versions when previewing a document
    useEffect(() => {
        if (!previewDoc || !previewDoc.title || !selectedAgentId) {
            setDocVersions([]);
            setIsEditingDoc(false);
            return;
        }

        setEditedContent(previewDoc.content || '');

        const q = query(
            collection(db, 'doc_versions'),
            where('agentId', '==', selectedAgentId),
            where('source', '==', previewDoc.title)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: any[] = [];
            snapshot.forEach((doc) => {
                list.push({ id: doc.id, ...doc.data() });
            });
            // Sort by version descending (newest version first)
            list.sort((a, b) => (b.version || 0) - (a.version || 0));
            setDocVersions(list);
        }, (error) => {
            console.error("Real-time doc_versions sync failed:", error);
        });

        return () => unsubscribe();
    }, [previewDoc, selectedAgentId]);

    // Factual Discrepancies Alerting State
    const [discrepancies, setDiscrepancies] = useState<any[]>([]);

    // Subscribe to factual discrepancies in real-time
    useEffect(() => {
        if (!selectedAgentId) {
            setDiscrepancies([]);
            return;
        }

        const q = query(
            collection(db, 'discrepancies'),
            where('agentId', '==', selectedAgentId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: any[] = [];
            snapshot.forEach((doc) => {
                list.push({ id: doc.id, ...doc.data() });
            });
            // Sort by createdAt descending (newest first)
            list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
            setDiscrepancies(list);
        }, (error) => {
            console.error("Real-time discrepancies sync failed:", error);
        });

        return () => unsubscribe();
    }, [selectedAgentId]);

    // Dynamic browser PDF loader and parsing engine
    const loadPdfJs = async () => {
        if ((window as any).pdfjsLib) return (window as any).pdfjsLib;
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
            script.onload = () => {
                (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
                resolve((window as any).pdfjsLib);
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    const extractTextFromPdf = async (file: File): Promise<string> => {
        const pdfjsLib = await loadPdfJs();
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');
            fullText += pageText + '\n';
        }
        return fullText;
    };


    // Operation State
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');
    
    // Forge State
    const [newNodeLabel, setNewNodeLabel] = useState('');
    const [newNodeDesc, setNewNodeDesc] = useState('');
    const [newEdgeSource, setNewEdgeSource] = useState('');
    const [newEdgeTarget, setNewEdgeTarget] = useState('');
    const [newEdgeLabel, setNewEdgeLabel] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const importFileInputRef = useRef<HTMLInputElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (selectedAgentId) {
            setCurrentPage(1); // Reset page on agent change
            refreshData(selectedAgentId);
        }
    }, [selectedAgentId]);

    const refreshData = async (agentId: string) => {
        if (!agentId) return;
        try {
            const stats = await lorepackService.getStats(agentId);
            const v = await vectorDb.getVectorsByAgent(agentId);
            const n = await vectorDb.getGraphNodesByAgent(agentId);
            const e = await vectorDb.getTripletEdgesByAgent(agentId);

            setVectors(v);
            setGraphNodes(n);
            setTripletEdges(e);
            
            setVectorCount(stats.totalNodes);
            setGraphEdgeCount(stats.totalEdges);
            setGraphNodeCount(n.length);

            const uniqueSources = Array.from(new Set(v.map(item => item.source)));
            setSources(uniqueSources);
        } catch (e) {
            console.error("Failed to load LorePack data", e);
        }
    };

    const stageFiles = (files: FileList | null) => {
      const list = Array.from(files || []);
      if (!list.length) return;
      const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif', 'bmp'];
      const docExts = ['pdf', 'txt', 'md', 'json', 'jsonl'];
      const supportedList = list.filter(f => {
          const ext = f.name.split('.').pop()?.toLowerCase();
          return ext && [...docExts, ...imageExts].includes(ext);
      });
      if (supportedList.length === 0) {
          alert("No supported files found. Supported formats: Images (PNG, JPG, WEBP, GIF, SVG) and Documents (PDF, TXT, MD, JSON).");
          return;
      }
      setFileQueue(prev => [...prev, ...supportedList]);
    };

    const handlePreviewStagedFile = async (file: File) => {
        setPreviewDoc({ title: file.name, content: '', isLoding: true });
        try {
            const ext = file.name.split('.').pop()?.toLowerCase() || '';
            const isImage = file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif', 'bmp'].includes(ext);
            
            if (isImage) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const dataUrl = e.target?.result as string;
                    setPreviewDoc({
                        title: file.name,
                        content: `🖼️ Image Asset: ${file.name}\nSize: ${(file.size / 1024).toFixed(1)} KB\nFormat: ${file.type || ext.toUpperCase()}\n\nReady for ingestion. Gemini multimodal engine will analyze visual elements, setting, and characters upon indexing.`,
                        imageUrl: dataUrl,
                        isLoding: false
                    });
                };
                reader.readAsDataURL(file);
                return;
            }

            let content = '';
            if (file.name.endsWith('.pdf')) {
                content = await extractTextFromPdf(file);
            } else {
                content = await file.text();
            }
            setPreviewDoc({ title: file.name, content, isLoding: false });
        } catch (error: any) {
            console.error("Staged preview failed:", error);
            setPreviewDoc({ title: file.name, content: `Error reading file: ${error.message}`, isLoding: false });
        }
    };

    const handlePreviewIndexedSource = (sourceName: string) => {
        const matchedChunks = vectors.filter(v => v.source === sourceName);
        const combinedContent = matchedChunks.map(v => v.text).join('\n\n---\n\n');
        const imgThumb = matchedChunks.find(v => v.metadata?.thumbnail)?.metadata?.thumbnail ||
                         matchedChunks.find(v => v.metadata?.imageUrl)?.metadata?.imageUrl;
        setPreviewDoc({
            title: sourceName,
            content: combinedContent || 'No index text found for this source.',
            imageUrl: imgThumb ? (imgThumb.startsWith('data:') ? imgThumb : `data:${matchedChunks[0]?.metadata?.mimeType || 'image/jpeg'};base64,${imgThumb}`) : undefined,
            isLoding: false
        });
    };

    const handleSemanticSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!semanticQuery.trim()) return;
        setIsSearching(true);
        try {
            const res = await fetch('/api/rag', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: semanticQuery,
                    limit: similarityLimit,
                    agentId: selectedAgentId
                })
            });
            if (!res.ok) throw new Error("Semantic query returned error");
            const data = await res.json();
            
            const formatted = (data.results || []).map((text: string, idx: number) => {
                const meta = data.metadata?.[idx] || { source: 'Unknown', score: 0 };
                return {
                    text,
                    source: meta.source,
                    score: meta.score
                };
            });
            setSemanticResults(formatted);
        } catch (err) {
            console.error("Semantic search failed:", err);
            alert("Semantic search failed. Ensure the server is online and the API key is configured.");
        } finally {
            setIsSearching(false);
        }
    };

    const renderHighlightedContent = (content: string, highlight: string) => {
        if (!highlight) return content;
        
        const normalizedContent = content.toLowerCase();
        const normalizedHighlight = highlight.toLowerCase().trim();
        
        const index = normalizedContent.indexOf(normalizedHighlight);
        if (index === -1) {
            return content;
        }
        
        const before = content.substring(0, index);
        const match = content.substring(index, index + normalizedHighlight.length);
        const after = content.substring(index + normalizedHighlight.length);
        
        return (
            <>
                {before}
                <mark className="bg-yellow-500/30 text-yellow-200 border-b-2 border-yellow-500/60 p-1 px-1.5 rounded-md font-black mx-0.5 animate-pulse shadow-md select-text">
                    {match}
                </mark>
                {after}
            </>
        );
    };

    const handleExportTagsCSV = () => {
        if (sources.length === 0) {
            alert("No indexed documents found to export tags.");
            return;
        }

        const csvRows = [
            ["Source Document", "Agent Owner", "Chunk Count", "Total Characters", "Auto-Generated Tags / Graph Entities"]
        ];

        sources.forEach(source => {
            const documentVectors = vectors.filter(v => v.source === source);
            const chunkCount = documentVectors.length;
            const totalChars = documentVectors.reduce((sum, v) => sum + v.text.length, 0);
            
            const documentVectorIds = new Set(documentVectors.map(v => v.id));
            const matchedEdges = tripletEdges.filter(edge => documentVectorIds.has(edge.sourceId));
            
            const tagsSet = new Set<string>();
            matchedEdges.forEach(edge => {
                if (edge.s) tagsSet.add(edge.s);
                if (edge.o) tagsSet.add(edge.o);
            });
            
            if (tagsSet.size === 0 && documentVectors.length > 0) {
                const fullText = documentVectors.map(v => v.text).join(' ');
                const words = fullText
                    .toLowerCase()
                    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
                    .split(/\s+/)
                    .filter(w => w.length > 4 && !['about', 'their', 'there', 'would', 'could', 'should', 'other', 'which', 'these', 'those', 'under', 'after', 'before'].includes(w));
                
                const wordFreq: Record<string, number> = {};
                words.forEach(w => {
                    wordFreq[w] = (wordFreq[w] || 0) + 1;
                });
                
                const topKeywords = Object.entries(wordFreq)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(entry => entry[0]);
                
                topKeywords.forEach(k => tagsSet.add(k));
            }

            const tagsString = Array.from(tagsSet).join('; ');
            const agentName = selectedAgent?.name || "Unknown";

            const escapedSource = `"${source.replace(/"/g, '""')}"`;
            const escapedAgent = `"${agentName.replace(/"/g, '""')}"`;
            const escapedTags = `"${tagsString.replace(/"/g, '""')}"`;

            csvRows.push([escapedSource, escapedAgent, String(chunkCount), String(totalChars), escapedTags]);
        });

        const csvContent = "data:text/csv;charset=utf-8," 
            + csvRows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${selectedAgent?.name || "agent"}_document_tags.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleMoveSourceToCollection = async (sourceName: string, collectionName: string) => {
        try {
            await vectorDb.updateVectorsCollection(sourceName, collectionName === 'Root Documents' ? '' : collectionName, selectedAgentId);
            const updatedVectors = await vectorDb.getVectorsByAgent(selectedAgentId);
            setVectors(updatedVectors);
            
            const uniqueSources = Array.from(new Set(updatedVectors.map(item => item.source)));
            setSources(uniqueSources);
            
            setShowMoveModal(false);
            setMovingSource(null);
        } catch (error) {
            console.error("Failed to move source document:", error);
            alert("Failed to assign document to folder.");
        }
    };

    const toggleSelectSource = (sourceName: string) => {
        setSelectedSources(prev => 
            prev.includes(sourceName) 
                ? prev.filter(s => s !== sourceName) 
                : [...prev, sourceName]
        );
    };

    const handleBulkMove = async (targetCollectionName: string) => {
        if (selectedSources.length === 0) return;
        try {
            const collectionParam = targetCollectionName === 'Root Documents' ? '' : targetCollectionName;
            await vectorDb.bulkUpdateVectorsMetadata(selectedSources, collectionParam, undefined, selectedAgentId);
            
            const updatedVectors = await vectorDb.getVectorsByAgent(selectedAgentId);
            setVectors(updatedVectors);
            const uniqueSources = Array.from(new Set(updatedVectors.map(item => item.source)));
            setSources(uniqueSources);
            
            setSelectedSources([]);
            setShowBulkMoveModal(false);
        } catch (error) {
            console.error("Bulk move failed:", error);
            alert("Bulk move failed.");
        }
    };

    const handleBulkTag = async () => {
        if (selectedSources.length === 0 || !bulkTagsInput.trim()) return;
        try {
            const tags = bulkTagsInput.split(',').map(t => t.trim()).filter(Boolean);
            await vectorDb.bulkUpdateVectorsMetadata(selectedSources, undefined, tags, selectedAgentId);
            
            const updatedVectors = await vectorDb.getVectorsByAgent(selectedAgentId);
            setVectors(updatedVectors);
            
            setBulkTagsInput('');
            setSelectedSources([]);
            setShowBulkTagModal(false);
        } catch (error) {
            console.error("Bulk tagging failed:", error);
            alert("Bulk tagging failed.");
        }
    };

    const handleTextSelection = () => {
        const selection = window.getSelection();
        if (selection) {
            const text = selection.toString().trim();
            // Restrict text selection to a reasonable character range (e.g. 1-2000 characters)
            if (text.length > 0 && text.length < 2000) {
                setSelectedText(text);
            }
        }
    };

    const handleAddAnnotation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!previewDoc || !selectedText.trim() || !newComment.trim()) {
            alert("Please select some text and enter a comment.");
            return;
        }

        try {
            const annotationsCol = collection(db, 'annotations');
            const newId = crypto.randomUUID();
            
            const payload = {
                id: newId,
                agentId: selectedAgentId,
                documentSource: previewDoc.title,
                highlightedText: selectedText,
                comment: newComment,
                authorName: auth.currentUser?.displayName || auth.currentUser?.email || 'Production Specialist',
                authorUid: auth.currentUser?.uid || 'anonymous_user',
                mentions: mentionTargets,
                createdAt: new Date().toISOString()
            };

            await setDoc(doc(db, 'annotations', newId), payload);

            // Clear inputs
            setNewComment('');
            setSelectedText('');
            setMentionTargets([]);
        } catch (error) {
            console.error("Failed to add annotation:", error);
            alert("Failed to submit annotation. Access denied or offline.");
        }
    };

    const handleDeleteAnnotation = async (annotationId: string) => {
        if (!confirm("Are you sure you want to delete this annotation?")) return;
        try {
            await deleteDoc(doc(db, 'annotations', annotationId));
        } catch (error) {
            console.error("Delete failed:", error);
            alert("You are not authorized to delete this annotation (only its author can delete it).");
        }
    };

    const saveRecentSearch = (queryText: string) => {
        const trimmed = queryText.trim();
        if (!trimmed) return;
        setRecentSearches(prev => {
            const filtered = prev.filter(q => q !== trimmed);
            const updated = [trimmed, ...filtered].slice(0, 10);
            localStorage.setItem('mythos_recent_searches', JSON.stringify(updated));
            return updated;
        });
    };

    const handleGlobalSemanticSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!globalSearchQuery.trim() || !selectedAgentId) return;

        setIsGlobalSearching(true);
        try {
            const embedRes = await fetch('/api/embed-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texts: [globalSearchQuery] })
            });

            if (!embedRes.ok) throw new Error("Failed to embed query.");
            const embedData = await embedRes.json();
            const queryVector = embedData.embeddings[0];

            if (!queryVector) throw new Error("Empty embedding returned.");

            const allChunks = await vectorDb.getVectorsByAgent(selectedAgentId);

            const cosineSimilarity = (vecA: number[], vecB: number[]) => {
                let dotProduct = 0, normA = 0, normB = 0;
                for (let i = 0; i < vecA.length; i++) {
                    dotProduct += vecA[i] * vecB[i];
                    normA += vecA[i] * vecA[i];
                    normB += vecB[i] * vecB[i];
                }
                if (normA === 0 || normB === 0) return 0;
                return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
            };

            const scoredResults = allChunks.map(chunk => {
                const score = cosineSimilarity(queryVector, chunk.vector);
                return {
                    text: chunk.text,
                    source: chunk.source,
                    collection: chunk.metadata?.collection || '',
                    score,
                    fullContent: allChunks.filter(c => c.source === chunk.source).map(c => c.text).join('\n\n')
                };
            })
            .filter(r => r.score > 0.35)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

            setGlobalSemanticSearchResults(scoredResults);
            saveRecentSearch(globalSearchQuery);
        } catch (error) {
            console.error("Semantic search failed:", error);
            alert("Semantic search failed. Please verify server connection.");
        } finally {
            setIsGlobalSearching(false);
        }
    };

    const handleReRunRecentSearch = async (queryText: string) => {
        setGlobalSearchQuery(queryText);
        if (!selectedAgentId) return;

        setIsGlobalSearching(true);
        try {
            const embedRes = await fetch('/api/embed-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texts: [queryText] })
            });

            if (!embedRes.ok) throw new Error("Failed to embed query.");
            const embedData = await embedRes.json();
            const queryVector = embedData.embeddings[0];

            if (!queryVector) throw new Error("Empty embedding returned.");

            const allChunks = await vectorDb.getVectorsByAgent(selectedAgentId);

            const cosineSimilarity = (vecA: number[], vecB: number[]) => {
                let dotProduct = 0, normA = 0, normB = 0;
                for (let i = 0; i < vecA.length; i++) {
                    dotProduct += vecA[i] * vecB[i];
                    normA += vecA[i] * vecA[i];
                    normB += vecB[i] * vecB[i];
                }
                if (normA === 0 || normB === 0) return 0;
                return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
            };

            const scoredResults = allChunks.map(chunk => {
                const score = cosineSimilarity(queryVector, chunk.vector);
                return {
                    text: chunk.text,
                    source: chunk.source,
                    collection: chunk.metadata?.collection || '',
                    score,
                    fullContent: allChunks.filter(c => c.source === chunk.source).map(c => c.text).join('\n\n')
                };
            })
            .filter(r => r.score > 0.35)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

            setGlobalSemanticSearchResults(scoredResults);
            saveRecentSearch(queryText);
        } catch (error) {
            console.error("Semantic search failed:", error);
            alert("Semantic search failed. Please verify server connection.");
        } finally {
            setIsGlobalSearching(false);
        }
    };

    const handleSaveNewDocVersion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!previewDoc || !previewDoc.title || !selectedAgentId || !editedContent.trim()) return;

        setIsProcessing(true);
        setStatusMessage('Saving document snapshot...');
        setProgress(30);

        try {
            // Find highest version
            const currentHighestVersion = docVersions.reduce((max, v) => Math.max(max, v.version || 1), 1);
            const newVersionNum = currentHighestVersion + 1;

            const versionId = crypto.randomUUID();
            await setDoc(doc(db, 'doc_versions', versionId), {
                id: versionId,
                agentId: selectedAgentId,
                source: previewDoc.title,
                version: newVersionNum,
                content: editedContent,
                comment: versionComment.trim() || `Version ${newVersionNum} Update`,
                timestamp: new Date().toISOString()
            });

            setStatusMessage('Re-indexing and re-chunking vector embeddings...');
            setProgress(60);

            // Re-embed and replace document vectors in IndexedDB
            await vectorDb.deleteVectorsBySource(previewDoc.title, selectedAgentId);
            const chunks = lorepackService.chunk(editedContent);
            
            // Find current tags and collection for this document
            const matchingVectors = vectors.filter(v => v.source === previewDoc.title);
            const docSummary = matchingVectors[0]?.metadata?.summary || 'Edited document content';
            const docTags = matchingVectors[0]?.metadata?.tags || [];
            const docCategory = matchingVectors[0]?.metadata?.collection || (activeCollection === 'all' ? 'Root Documents' : activeCollection);

            const tasks = chunks.map(c => ({
                text: c,
                source: previewDoc.title,
                metadata: {
                    summary: docSummary,
                    tags: docTags,
                    collection: docCategory
                }
            }));

            await lorepackService.ingestBatches(tasks, {
                agentId: selectedAgentId,
                onProgress: ({ processed, total }) => {
                    setProgress(Math.round(60 + (processed / total) * 35));
                }
            });

            // Update local state previewDoc content
            setPreviewDoc(prev => prev ? { ...prev, content: editedContent } : null);
            setIsEditingDoc(false);
            setVersionComment('');
            setStatusMessage('Version saved successfully!');
            await refreshData(selectedAgentId);
        } catch (error) {
            console.error("Failed to save doc version:", error);
            alert("Failed to save new document version.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRestoreDocVersion = async (vRecord: any) => {
        if (!confirm(`Are you sure you want to revert to Version ${vRecord.version}?`)) return;

        setIsProcessing(true);
        setStatusMessage(`Restoring Version ${vRecord.version}...`);
        setProgress(30);

        try {
            const currentHighestVersion = docVersions.reduce((max, v) => Math.max(max, v.version || 1), 1);
            const nextVersionNum = currentHighestVersion + 1;

            // Save the restored text as the next version number
            const versionId = crypto.randomUUID();
            await setDoc(doc(db, 'doc_versions', versionId), {
                id: versionId,
                agentId: selectedAgentId,
                source: vRecord.source,
                version: nextVersionNum,
                content: vRecord.content,
                comment: `Reverted to Version ${vRecord.version}`,
                timestamp: new Date().toISOString()
            });

            setStatusMessage('Re-indexing and re-chunking restored text...');
            setProgress(60);

            // Re-embed and replace document vectors in IndexedDB
            await vectorDb.deleteVectorsBySource(vRecord.source, selectedAgentId);
            const chunks = lorepackService.chunk(vRecord.content);
            const tasks = chunks.map(c => ({
                text: c,
                source: vRecord.source,
                metadata: {
                    summary: 'Restored document content',
                    tags: [],
                    collection: activeCollection === 'all' ? 'Root Documents' : activeCollection
                }
            }));

            await lorepackService.ingestBatches(tasks, {
                agentId: selectedAgentId,
                onProgress: ({ processed, total }) => {
                    setProgress(Math.round(60 + (processed / total) * 35));
                }
            });

            // Update previewDoc content
            setPreviewDoc(prev => prev ? { ...prev, content: vRecord.content } : null);
            setEditedContent(vRecord.content);
            setStatusMessage(`Reverted successfully! Now running Version ${nextVersionNum}.`);
            await refreshData(selectedAgentId);
        } catch (error) {
            console.error("Failed to restore document version:", error);
            alert("Failed to restore document version.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleClearRecentSearches = () => {
        setRecentSearches([]);
        localStorage.removeItem('mythos_recent_searches');
    };

    const handleClearGlobalSearch = () => {
        setGlobalSearchQuery('');
        setGlobalSemanticSearchResults([]);
    };

    const handleResolveDiscrepancy = async (id: string) => {
        try {
            await setDoc(doc(db, 'discrepancies', id), {
                status: 'resolved',
                resolvedAt: new Date().toISOString()
            }, { merge: true });
        } catch (error) {
            console.error("Failed to resolve discrepancy:", error);
            alert("Failed to dismiss discrepancy alert.");
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            stageFiles(e.dataTransfer.files);
        }
    };

    const runIngest = async () => {
        if (!selectedAgentId || fileQueue.length === 0) {
            alert("Agent ID required and files must be staged.");
            return;
        }

        abortControllerRef.current = new AbortController();
        setIsProcessing(true);
        setProgress(0);
        setStatusMessage('Initializing Ingestion...');

        try {
            const tasks = [];
            for (const f of fileQueue) {
                let text = '';
                let imageThumbnail = '';
                const ext = f.name.split('.').pop()?.toLowerCase() || '';
                const isImage = f.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif', 'bmp'].includes(ext);

                let docSummary = '';
                let docTags: string[] = [];
                let docCategory = 'Root Documents';

                if (isImage) {
                    setStatusMessage(`Analyzing visual asset with Gemini Vision: ${f.name}...`);
                    const base64Data = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(f);
                    });
                    imageThumbnail = base64Data;

                    try {
                        const parsedImage = await parseImageAssetService({
                            base64: base64Data,
                            mimeType: f.type || 'image/jpeg',
                            filename: f.name
                        });
                        text = `[VISUAL ASSET: ${f.name}]\nDescription: ${parsedImage.visualDescription}\nSetting: ${parsedImage.setting}\nCharacters: ${parsedImage.characters?.join(', ') || 'None'}\nLore Significance: ${parsedImage.loreSignificance}\nAesthetic Style: ${parsedImage.aestheticStyle || 'Cinematic Concept'}`;
                        docSummary = parsedImage.summary || parsedImage.visualDescription.slice(0, 180);
                        docTags = [...(parsedImage.tags || []), 'image_asset', 'visual_lore'];
                        docCategory = 'Visual Lore Assets';
                    } catch (pErr) {
                        console.error("Image parsing failed, using fallback:", pErr);
                        text = `[VISUAL ASSET: ${f.name}]\nFile: ${f.name}\nSize: ${(f.size / 1024).toFixed(1)} KB\nType: ${f.type || 'image'}`;
                        docSummary = `Visual asset: ${f.name}`;
                        docTags = ['image_asset', 'visual_lore'];
                        docCategory = 'Visual Lore Assets';
                    }
                } else if (f.name.endsWith('.pdf')) {
                    setStatusMessage(`Extracting text from PDF: ${f.name}...`);
                    text = await extractTextFromPdf(f);
                } else {
                    text = await f.text();
                }
                
                if (!isImage) {
                    setStatusMessage(`Categorizing & extracting summary via Gemini: ${f.name}...`);
                    try {
                        const metaRes = await fetch('/api/extract-metadata', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ text, filename: f.name })
                        });
                        if (metaRes.ok) {
                            const metaData = await metaRes.json();
                            docSummary = metaData.summary;
                            docTags = metaData.tags || [];
                            docCategory = metaData.category || 'Root Documents';
                        } else {
                            throw new Error("Backend offline");
                        }
                    } catch (metaErr) {
                        try {
                            const fallbackMeta = await extractMetadataService(text, f.name);
                            docSummary = fallbackMeta.summary;
                            docTags = fallbackMeta.tags;
                            docCategory = fallbackMeta.category;
                        } catch {
                            docSummary = text.slice(0, 150);
                            docTags = ['document'];
                        }
                    }
                }

                // Scan for factual contradictions against existing world context and character profiles
                try {
                    setStatusMessage(`Analyzing continuity contradictions in: ${f.name}...`);
                    const existingTriplets = await vectorDb.getTripletEdgesByAgent(selectedAgentId);
                    const existingAgents = agents.map(a => ({ name: a.name, bio: a.systemPrompt }));
                    const existingContext = {
                        characterProfiles: existingAgents,
                        semanticLoreTriplets: existingTriplets.map(t => ({ s: t.s, p: t.p, o: t.o }))
                    };

                    let contraData: any = null;
                    try {
                        const contraRes = await fetch('/api/detect-contradictions', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ text, filename: f.name, existingContext })
                        });
                        if (contraRes.ok) {
                            contraData = await contraRes.json();
                        }
                    } catch {
                        // Offline fallback
                    }

                    if (!contraData) {
                        try {
                            contraData = await detectContradictionsService(text, f.name, existingContext);
                        } catch {
                            contraData = { discrepancies: [] };
                        }
                    }

                    if (contraData && contraData.discrepancies && contraData.discrepancies.length > 0) {
                        for (const disc of contraData.discrepancies) {
                            const discId = crypto.randomUUID();
                            await setDoc(doc(db, 'discrepancies', discId), {
                                id: discId,
                                agentId: selectedAgentId,
                                source: f.name,
                                severity: disc.severity || 'medium',
                                context: disc.context || 'New text ingest',
                                explanation: disc.explanation || 'Contradiction reported',
                                createdAt: new Date().toISOString()
                            });
                        }
                    }
                } catch (contraErr) {
                    console.error("Factual contradiction detection failed:", contraErr);
                }

                // Save Initial Version for Document Version Control
                try {
                    const versionId = crypto.randomUUID();
                    await setDoc(doc(db, 'doc_versions', versionId), {
                        id: versionId,
                        agentId: selectedAgentId,
                        source: f.name,
                        version: 1,
                        content: text,
                        comment: 'Initial Upload',
                        timestamp: new Date().toISOString()
                    });
                } catch (vErr) {
                    console.error("Failed to save initial document version:", vErr);
                }

                const chunks = lorepackService.chunk(text);
                for (const c of chunks) {
                    tasks.push({ 
                        text: c, 
                        source: f.name,
                        metadata: {
                            summary: docSummary,
                            tags: docTags,
                            collection: docCategory,
                            type: isImage ? 'image_asset' : 'document',
                            thumbnail: imageThumbnail || undefined,
                            mimeType: isImage ? f.type : undefined
                        }
                    });
                }
            }
            
            await lorepackService.ingestBatches(tasks, {
                agentId: selectedAgentId,
                signal: abortControllerRef.current.signal,
                onProgress: ({ processed, total }) => {
                    setProgress(Math.round((processed / total) * 100));
                    setStatusMessage(`Ingesting ${processed}/${total} chunks...`);
                }
            });
            
            setStatusMessage('Ingestion complete!');
            setFileQueue([]);
            await refreshData(selectedAgentId);
        } catch (error: any) {
            console.error(error);
            setStatusMessage(`Error: ${error.message}`);
        } finally {
            setTimeout(() => setIsProcessing(false), 2000);
        }
    };
    
    const runImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];

        setIsProcessing(true);
        setProgress(0);
        setStatusMessage(`Importing ${file.name}...`);
        
        // Fetch initial counts to provide a baseline for the dynamic update.
        const initialStats = await lorepackService.getStats(selectedAgentId);

        try {
            const summary = await lorepackService.importLorepack(file, selectedAgentId, ({ processed, vectors, edges }) => {
                setStatusMessage(`Processed ${processed} items...`);
                // Dynamically update the stat cards in real-time during the import.
                setVectorCount(initialStats.totalNodes + vectors);
                setGraphEdgeCount(initialStats.totalEdges + edges);
            });
            setStatusMessage(`Import complete! Ingested ${summary.importedVectors} nodes & ${summary.importedEdges} edges.`);
            
            // Perform a final, full refresh to ensure all data (for all tabs) is consistent.
            await refreshData(selectedAgentId);
            setFileQueue([]); // Clear the file staging queue after successful import.
        } catch (error: any) {
            console.error(error);
            setStatusMessage(`Error: ${error.message}`);
            // In case of error, roll back the stats to their pre-import state.
            setVectorCount(initialStats.totalNodes);
            setGraphEdgeCount(initialStats.totalEdges);
        } finally {
            setTimeout(() => setIsProcessing(false), 3000);
            if (e.target) e.target.value = '';
        }
    };

    const handleExport = async () => {
        if (!selectedAgentId) return alert("Agent ID required.");
        
        setIsProcessing(true);
        setStatusMessage('Exporting LorePack...');
        setProgress(0);
        try {
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                async start(controller) {
                    let count = 0;
                    for await (const batch of lorepackService.yieldExportBatches(selectedAgentId, 500)) {
                        const lines = batch.map(obj => JSON.stringify(obj)).join('\n') + '\n';
                        controller.enqueue(encoder.encode(lines));
                        count += batch.length;
                        setStatusMessage(`Exported ${count} items...`);
                    }
                    controller.close();
                }
            });
            const gz = stream.pipeThrough(new CompressionStream('gzip'));
            const blob = await new Response(gz).blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `LOREPACK_${selectedAgent.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.jsonl.gz`;
            a.click();
            URL.revokeObjectURL(a.href);
            setStatusMessage('Export complete.');
        } catch (e: any) {
             setStatusMessage(`Error: ${e.message}`);
        } finally {
            setTimeout(() => setIsProcessing(false), 2000);
        }
    };
    
    const buildGraph = async () => {
        if (!selectedAgentId) return alert("Agent ID required.");
        setIsProcessing(true);
        setStatusMessage('Building graph...');
        setProgress(0);
        try {
            await lorepackService.buildGraphLite(selectedAgentId, (curr, total, created) => {
                setProgress(Math.round((curr / total) * 100));
                setStatusMessage(`Analyzed ${curr}/${total} nodes | ${created} edges found`);
            });
            setStatusMessage('Graph build complete.');
            await refreshData(selectedAgentId);
        } catch (e: any) {
            setStatusMessage(`Error: ${e.message}`);
        } finally {
            setTimeout(() => setIsProcessing(false), 2000);
        }
    };

    const handleAddNode = async () => {
        if (!newNodeLabel.trim() || !selectedAgentId) return;
        const node: GraphNode = {
            id: crypto.randomUUID(),
            label: newNodeLabel,
            description: newNodeDesc,
            agentId: selectedAgentId,
            name: newNodeLabel
        };
        await vectorDb.addGraphNodes([node]);
        setNewNodeLabel('');
        setNewNodeDesc('');
        await refreshData(selectedAgentId);
    };

    const handleAddEdge = async () => {
        if (!newEdgeSource || !newEdgeTarget || !newEdgeLabel.trim() || !selectedAgentId) return;
        const edge: GraphEdge = {
            source: newEdgeSource,
            target: newEdgeTarget,
            label: newEdgeLabel,
            agentId: selectedAgentId
        };
        await vectorDb.addGraphEdges([edge]);
        setNewEdgeSource('');
        setNewEdgeTarget('');
        setNewEdgeLabel('');
        await refreshData(selectedAgentId);
    };

    const handlePurge = async () => {
        if(!selectedAgentId) return alert("Select an agent first.");
        if(confirm(`DANGER: Vaporize entire memory vault and graph for ${selectedAgent.name}? This cannot be undone.`)) { 
            await vectorDb.clearVectors(selectedAgentId); 
            await vectorDb.deleteGraphForAgent(selectedAgentId); 
            await refreshData(selectedAgentId);
        }
    };
    
    const fileQueueSize = fileQueue.reduce((acc, f) => acc + f.size, 0);

    return (
        <div className="flex flex-col h-full bg-primary overflow-hidden">
            {/* STUDIO HEADER */}
            <div className="flex-shrink-0 p-6 border-b border-accent bg-neutral-900/90 backdrop-blur-md z-10">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                            <DatabaseIcon className="w-8 h-8 text-blue-500" />
                            LorePack Factory
                        </h1>
                        <p className="text-neutral-500 text-xs font-mono mt-1">
                           SOVEREIGN KERNEL & GRAPH MAGRAG • {selectedAgent?.name?.toUpperCase() || "NO AGENT"}
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <select 
                            value={selectedAgentId} 
                            onChange={(e) => setSelectedAgentId(e.target.value)}
                            className="bg-black text-white font-bold border border-accent rounded-lg px-4 py-2 outline-none text-sm hover:border-blue-500 transition-colors"
                        >
                            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                        <button onClick={handleExport} className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border border-neutral-700">
                            Export (GZIP)
                        </button>
                         <button onClick={() => importFileInputRef.current?.click()} className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border border-neutral-700">
                            Import (GZIP)
                        </button>
                        <input type="file" ref={importFileInputRef} accept=".gz,.jsonl,.json" className="hidden" onChange={runImport} />
                    </div>
                </div>

                {/* TABS */}
                <div className="flex gap-1 bg-black/40 p-1 rounded-xl border border-neutral-800 w-fit">
                    {[
                        { id: 'overview', label: 'Factory' },
                        { id: 'vectors', label: 'Sacred Archive' },
                        { id: 'graph', label: 'Neural Graph' },
                        { id: 'forge', label: 'Graph Forge' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as StudioTab)}
                            className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                                activeTab === tab.id 
                                    ? 'bg-blue-600 text-white shadow-lg' 
                                    : 'text-neutral-500 hover:text-white hover:bg-neutral-800'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="flex-grow overflow-y-auto p-8 custom-scrollbar bg-[url('https://transparenttextures.com/patterns/cubes.png')] bg-fixed">
                
                {activeTab === 'overview' && (
                    <div className="space-y-8 max-w-5xl mx-auto">
                        {/* KNOWLEDGE DELTA RED-FLAG SYSTEM BANNER */}
                        {(() => {
                            const highSeverityDiscrepancies = discrepancies.filter(d => d.severity === 'high' && d.status !== 'resolved');
                            if (highSeverityDiscrepancies.length === 0) return null;
                            return (
                                <div className="bg-gradient-to-r from-red-950/90 via-black/90 to-red-950/90 border border-red-500 rounded-2xl p-6 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse space-y-4">
                                    <div className="flex justify-between items-center pb-2 border-b border-red-900/40">
                                        <div className="flex items-center gap-3">
                                            <span className="w-3.5 h-3.5 rounded-full bg-red-500 animate-ping shrink-0" />
                                            <h3 className="text-xs font-black uppercase text-red-400 tracking-widest font-mono">
                                                🚨 HIGH SEVERITY KNOWLEDGE DELTA DETECTED
                                            </h3>
                                        </div>
                                        <span className="text-[10px] bg-red-950/80 border border-red-800 text-red-300 font-mono font-bold px-2 py-0.5 rounded animate-pulse">
                                            {highSeverityDiscrepancies.length} Collision Alert(s)
                                        </span>
                                    </div>
                                    <div className="space-y-3 font-sans text-neutral-300 text-xs">
                                        <p className="leading-relaxed">
                                            Factual integrity checks have identified <strong className="text-white">significant continuity contradictions</strong> during new lore uploads. The following elements conflict directly with your registered agent profiles or relational neural network:
                                        </p>
                                        <div className="space-y-2">
                                            {highSeverityDiscrepancies.map((disc, idx) => (
                                                <div key={disc.id} className="bg-black/50 border border-red-950 p-3 rounded-xl space-y-2 text-left">
                                                    <div className="flex justify-between items-center text-[10px] font-mono">
                                                        <span className="text-red-400 font-black">COLLISION ASPECT #{idx + 1}</span>
                                                        <span className="text-neutral-500 truncate max-w-xs">File: {disc.source}</span>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs leading-normal">
                                                        <div className="bg-red-950/10 p-2.5 rounded border border-red-900/20">
                                                            <strong className="text-[9px] text-red-400 block uppercase font-mono mb-1">Conflicting Passage Text:</strong>
                                                            <span className="italic font-mono text-neutral-300">"{disc.context}"</span>
                                                        </div>
                                                        <div className="bg-neutral-900/60 p-2.5 rounded border border-neutral-800">
                                                            <strong className="text-[9px] text-neutral-400 block uppercase font-mono mb-1">Discrepancy Resolution Report:</strong>
                                                            <span className="text-neutral-300">{disc.explanation}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-end gap-2 pt-1.5 border-t border-red-950/30">
                                                        <button
                                                            onClick={() => handleResolveDiscrepancy(disc.id)}
                                                            className="px-3 py-1 bg-red-900/20 hover:bg-red-600 border border-red-800 text-[10px] font-bold uppercase tracking-wider text-red-200 hover:text-white rounded-lg transition-colors cursor-pointer"
                                                        >
                                                            Force Match / Resolve Contradiction
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* CONTINUITY MONITOR */}
                        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-6 backdrop-blur-md space-y-4">
                            <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
                                <div>
                                    <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                                        <span>🛡️</span> Continuity & Factual Integrity Monitor
                                    </h2>
                                    <p className="text-[10px] text-neutral-500 uppercase mt-0.5 font-bold tracking-wider">
                                        Automated background scans detect factual mismatches during document ingestion
                                    </p>
                                </div>
                                <span className={`text-[10px] font-mono px-2.5 py-1 rounded border font-black uppercase tracking-wider ${
                                    discrepancies.filter(d => d.status !== 'resolved').length > 0 
                                        ? 'bg-rose-950/40 border-rose-900/40 text-rose-400 animate-pulse' 
                                        : 'bg-green-950/40 border-green-900/40 text-green-400'
                                }`}>
                                    {discrepancies.filter(d => d.status !== 'resolved').length > 0 ? `${discrepancies.filter(d => d.status !== 'resolved').length} Conflicts Pending` : '✓ 100% Continuity Verified'}
                                </span>
                            </div>

                            {discrepancies.filter(d => d.status !== 'resolved').length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
                                    {discrepancies.filter(d => d.status !== 'resolved').map((disc) => (
                                        <div key={disc.id} className="bg-black/30 border border-neutral-850 p-4 rounded-xl flex flex-col justify-between gap-3 hover:border-neutral-755 transition-all font-sans relative group">
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${
                                                        disc.severity === 'high' 
                                                            ? 'bg-red-950/60 border-red-900/40 text-red-400' 
                                                            : disc.severity === 'medium'
                                                                ? 'bg-amber-950/60 border-amber-900/40 text-amber-400'
                                                                : 'bg-yellow-950/60 border-yellow-900/40 text-yellow-300'
                                                    }`}>
                                                        {disc.severity === 'high' ? '🚨 High Contradiction' : disc.severity === 'medium' ? '⚠️ Medium Discrepancy' : '📝 Low continuity'}
                                                    </span>
                                                    <span className="text-[9px] font-mono text-neutral-500 truncate max-w-[150px]" title={disc.source}>
                                                        📄 {disc.source}
                                                    </span>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest block">Conflicting Passage:</span>
                                                    <p className="text-[10px] font-mono text-neutral-300 bg-black/40 p-2 rounded border border-neutral-850/50 italic">
                                                        "{disc.context}"
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest block">Continuity Report:</span>
                                                    <p className="text-xs text-neutral-400 leading-relaxed font-sans">{disc.explanation}</p>
                                                </div>
                                            </div>
                                            <div className="pt-2 border-t border-neutral-850/50 flex justify-end">
                                                <button
                                                    onClick={() => handleResolveDiscrepancy(disc.id)}
                                                    className="px-3 py-1 bg-green-950/40 hover:bg-green-600 text-green-400 hover:text-white border border-green-900/30 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer font-bold"
                                                >
                                                    Dismiss / Resolve Alert
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-black/10 border border-neutral-850 p-6 rounded-xl text-center text-xs text-neutral-500 italic font-sans flex flex-col items-center justify-center gap-2">
                                    <span className="text-2xl">🛡️</span>
                                    <span>All system documents are structurally consistent with characters and existing world lore. No conflicts pending.</span>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                           <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl flex flex-col justify-center text-center group transition-all col-span-1 shadow-md">
                                <span className="text-4xl font-black text-white mb-2">{vectorCount}</span>
                                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Vector Nodes</span>
                            </div>
                             <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl flex flex-col justify-center text-center group transition-all col-span-1 shadow-md">
                                <span className="text-4xl font-black text-white mb-2">{graphEdgeCount}</span>
                                <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">Triplet Edges</span>
                            </div>
                             <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl flex flex-col justify-center text-center group transition-all col-span-1 shadow-md">
                                <span className="text-4xl font-black text-white mb-2">{fileQueue.length} <span className="text-sm">files</span></span>
                                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest">Files Staged</span>
                            </div>
                            {/* LORE INTEGRITY DASHBOARD WIDGET */}
                            {(() => {
                                const totalContradictions = discrepancies.length;
                                const resolvedContradictions = discrepancies.filter(d => d.status === 'resolved').length;
                                const flaggedContradictions = discrepancies.filter(d => d.status !== 'resolved').length;
                                const score = totalContradictions === 0 ? 100 : Math.round((resolvedContradictions / totalContradictions) * 100);

                                return (
                                    <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl flex flex-col justify-center group transition-all col-span-1 text-center shadow-md">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Lore Consistency</span>
                                            <span className="text-2xl font-black text-white font-mono">{score}%</span>
                                        </div>
                                        <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden my-2 border border-neutral-750/30">
                                            <div 
                                                className={`h-full transition-all duration-500 rounded-full ${
                                                    score > 85 ? 'bg-emerald-500' : score > 50 ? 'bg-amber-500' : 'bg-red-500'
                                                }`} 
                                                style={{ width: `${score}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[9px] text-neutral-500 font-mono">
                                            <span>Resolved: {resolvedContradictions}</span>
                                            <span>Flagged: {flaggedContradictions}</span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* KNOWLEDGE GAP & DENSE OVERLAPS HEATMAP */}
                        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-6 backdrop-blur-md space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-neutral-800 pb-3">
                                <div>
                                    <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                                        <span>🗺️</span> Thematic Overlaps & Knowledge Gaps Heatmap
                                    </h2>
                                    <p className="text-[10px] text-neutral-500 uppercase mt-0.5 font-bold tracking-wider">
                                        Visualizes density clusters of project entities, flagging under-referenced items (Gaps) or dense overlays
                                    </p>
                                </div>
                                <div className="flex gap-1.5 bg-black/40 p-1 rounded-xl border border-neutral-800 shrink-0">
                                    {(['all', 'gaps', 'overlaps'] as const).map(f => (
                                        <button
                                            key={f}
                                            type="button"
                                            onClick={() => { setActiveHeatmapFilter(f); setSelectedHeatmapItem(null); }}
                                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                                                activeHeatmapFilter === f
                                                    ? 'bg-blue-600 text-white shadow-md'
                                                    : 'text-neutral-500 hover:text-white'
                                            }`}
                                        >
                                            {f === 'all' ? 'All Entities' : f === 'gaps' ? '⚠️ Gaps Only' : '🔥 Dense Overlaps'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {(() => {
                                if (!tripletEdges || tripletEdges.length === 0) {
                                    return (
                                        <div className="bg-black/10 border border-neutral-850 p-6 rounded-xl text-center text-xs text-neutral-500 italic font-sans">
                                            No entities mapped. Build or link node triplets inside the Neural Graph or Graph Forge tabs to generate the map.
                                        </div>
                                    );
                                }

                                const entities = Array.from(new Set(
                                    tripletEdges.flatMap(e => [e.s.trim(), e.o.trim()]).filter(s => s && s.length > 2)
                                ));

                                const rawItems = entities.map(name => {
                                    const mentionsCount = vectors.filter(v => v.text.toLowerCase().includes(name.toLowerCase())).length;
                                    const relationsCount = tripletEdges.filter(e => e.s.trim() === name || e.o.trim() === name).length;
                                    const score = mentionsCount + relationsCount * 1.5;

                                    let status: 'gap' | 'balanced' | 'overlap' = 'balanced';
                                    if (score <= 2.5) {
                                        status = 'gap';
                                    } else if (score >= 9) {
                                        status = 'overlap';
                                    }

                                    return { name, mentionsCount, relationsCount, score, status };
                                }).sort((a, b) => b.score - a.score);

                                const filteredItems = rawItems.filter(item => {
                                    if (activeHeatmapFilter === 'gaps') return item.status === 'gap';
                                    if (activeHeatmapFilter === 'overlaps') return item.status === 'overlap';
                                    return true;
                                });

                                return (
                                    <div className="space-y-4">
                                        {filteredItems.length > 0 ? (
                                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                                                {filteredItems.map((item, idx) => {
                                                    const isSelected = selectedHeatmapItem?.name === item.name;
                                                    return (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            onClick={() => setSelectedHeatmapItem(item)}
                                                            className={`p-3 rounded-xl border transition-all text-left flex flex-col justify-between h-20 relative cursor-pointer ${
                                                                isSelected 
                                                                    ? 'ring-2 ring-blue-500 border-blue-500 shadow-lg scale-[1.03]' 
                                                                    : item.status === 'gap'
                                                                        ? 'bg-rose-950/20 border-rose-900/30 hover:border-rose-700/60'
                                                                        : item.status === 'overlap'
                                                                            ? 'bg-purple-950/20 border-purple-900/30 hover:border-purple-700/60'
                                                                            : 'bg-black/20 border-neutral-800 hover:border-neutral-700'
                                                            }`}
                                                        >
                                                            <div className="w-full">
                                                                <div className="flex justify-between items-center w-full">
                                                                    <span className={`text-[7px] font-black uppercase px-1 rounded border font-mono ${
                                                                        item.status === 'gap'
                                                                            ? 'bg-red-950 text-red-400 border-red-900/20 animate-pulse'
                                                                            : item.status === 'overlap'
                                                                                ? 'bg-purple-950 text-purple-400 border-purple-900/20 font-black'
                                                                                : 'bg-neutral-850 text-neutral-400 border-neutral-700/40'
                                                                    }`}>
                                                                        {item.status === 'gap' ? 'Gap' : item.status === 'overlap' ? 'Hub' : 'Core'}
                                                                    </span>
                                                                    <span className="text-[9px] font-bold text-neutral-400 font-mono">
                                                                        {item.score.toFixed(1)}
                                                                    </span>
                                                                </div>
                                                                <h4 className="text-[10px] font-black text-neutral-200 mt-1 truncate w-full font-mono" title={item.name}>
                                                                    {item.name}
                                                                </h4>
                                                            </div>
                                                            <span className="text-[8px] text-neutral-500 font-mono truncate block w-full">
                                                                {item.mentionsCount} mentions • {item.relationsCount} rels
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-neutral-500 italic text-center py-4 font-sans">
                                                No entities matched this filter.
                                            </p>
                                        )}

                                        {/* HEATMAP DETAILED INSPECTOR CARD */}
                                        {selectedHeatmapItem && (
                                            <div className="bg-black/35 border border-neutral-800 rounded-xl p-4 space-y-2 animate-scale-up font-sans">
                                                <div className="flex justify-between items-start pb-2 border-b border-neutral-850">
                                                    <div>
                                                        <span className="text-[8px] font-black uppercase text-blue-400 tracking-wider font-mono">Integrative Heatmap Analysis</span>
                                                        <h4 className="text-xs font-black text-white mt-0.5 font-mono">{selectedHeatmapItem.name}</h4>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedHeatmapItem(null)}
                                                        className="text-neutral-500 hover:text-white text-xs cursor-pointer font-sans"
                                                    >
                                                        ✕ Close Inspector
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono pt-1 text-neutral-400">
                                                    <div>
                                                        Mentions In Documents: <span className="text-white font-bold">{selectedHeatmapItem.mentionsCount} times</span>
                                                    </div>
                                                    <div>
                                                        Relationships Defined: <span className="text-white font-bold">{selectedHeatmapItem.relationsCount} links</span>
                                                    </div>
                                                    <div>
                                                        Thematic Integration Index: <span className="text-white font-bold">{selectedHeatmapItem.score.toFixed(1)} pts</span>
                                                    </div>
                                                </div>
                                                <div className="pt-2 border-t border-neutral-850/50 flex gap-2 items-center text-xs">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500 font-mono">Integration Status:</span>
                                                    <p className="text-neutral-300 leading-normal text-xs font-sans">
                                                        {selectedHeatmapItem.status === 'gap' ? (
                                                            <span className="text-rose-400 font-bold">⚠️ Critical Gap: This entity is under-referenced and barely linked. Create more lore documents or scripts containing "{selectedHeatmapItem.name}" to balance the project.</span>
                                                        ) : selectedHeatmapItem.status === 'overlap' ? (
                                                            <span className="text-purple-400 font-bold">🔥 Highly Connected: Dense overlapping hub. This entity is central to multiple thematic files and relationships.</span>
                                                        ) : (
                                                            <span className="text-green-400 font-bold">✓ Perfectly Balanced: Structurally integrated with stable mentions and connections.</span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                        
                        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-8 backdrop-blur-md">
                            <h2 className="text-sm font-black text-white uppercase tracking-widest mb-6 border-b border-neutral-800 pb-4">Factory Pipeline</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div 
                                    onClick={() => !isProcessing && fileInputRef.current?.click()}
                                    onDragOver={handleDragOver}
                                    onDragEnter={handleDragEnter}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer group ${
                                        isProcessing 
                                            ? 'border-neutral-700 opacity-50' 
                                            : isDragging 
                                                ? 'border-blue-500 bg-blue-950/20 shadow-[0_0_15px_rgba(59,130,246,0.3)] scale-[1.02]' 
                                                : 'bg-black/20 border-neutral-700 hover:border-blue-500 hover:bg-neutral-800'
                                    }`}
                                >
                                    <input type="file" ref={fileInputRef} accept=".txt,.md,.pdf,.json,.jsonl" multiple className="hidden" onChange={(e) => stageFiles(e.target.files)} />
                                    <UploadIcon className={`w-8 h-8 mb-4 transition-colors ${isDragging ? 'text-blue-400 animate-bounce' : 'text-neutral-500 group-hover:text-blue-400'}`} />
                                    <span className="font-bold text-neutral-300 group-hover:text-white uppercase text-xs tracking-widest">
                                        {isDragging ? "Drop Files Here" : "1. Stage Files / Drop Here"}
                                    </span>
                                    <p className="text-[10px] text-neutral-500 mt-2 uppercase font-bold">PDF, TXT, MD, JSON, JSONL</p>
                                </div>
 
                                 <button
                                    onClick={runIngest} disabled={isProcessing || fileQueue.length === 0}
                                    className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer group bg-black/20 border-neutral-700 hover:border-blue-500 hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <DatabaseIcon className="w-8 h-8 text-neutral-500 group-hover:text-blue-400 mb-4 transition-colors" />
                                    <span className="font-bold text-neutral-300 group-hover:text-white uppercase text-xs tracking-widest">2. Ingest Lore</span>
                                     <p className="text-[10px] text-neutral-500 mt-2 uppercase font-bold">Chunks & Embeds</p>
                                </button>
                            </div>
 
                            <div className="mt-6">
                                <button onClick={buildGraph} disabled={isProcessing || vectorCount === 0} className="w-full border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer group bg-black/20 border-neutral-700 hover:border-purple-500 hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <DatabaseIcon className="w-8 h-8 text-neutral-500 group-hover:text-purple-400 mb-4 transition-colors" />
                                    <span className="font-bold text-neutral-300 group-hover:text-white uppercase text-xs tracking-widest">3. Build Graph Lite (MAGRAG)</span>
                                    <p className="text-[10px] text-neutral-500 mt-2 uppercase font-bold">Extracts Semantic Triplets (S-R-O)</p>
                                </button>
                            </div>

                            {fileQueue.length > 0 && (
                                <div className="mt-6 bg-black/40 border border-neutral-800 p-4 rounded-xl space-y-3">
                                    <div className="flex justify-between items-center border-b border-neutral-800 pb-2">
                                        <span className="text-xs font-black uppercase text-neutral-400 tracking-wider">Staging Queue ({fileQueue.length} files)</span>
                                        <button
                                            onClick={() => setFileQueue([])}
                                            className="text-[10px] font-bold text-red-500 hover:text-red-400 uppercase tracking-widest hover:underline"
                                        >
                                            Clear All
                                        </button>
                                    </div>
                                    <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                                        {fileQueue.map((f, idx) => (
                                            <div 
                                                key={idx} 
                                                onClick={() => handlePreviewStagedFile(f)}
                                                className="flex justify-between items-center text-xs bg-neutral-900/60 px-3 py-2 rounded border border-neutral-800 hover:border-blue-500/35 hover:bg-neutral-850/50 cursor-pointer transition-all group"
                                                title="Click to preview file content"
                                            >
                                                <div className="flex items-center gap-2 truncate">
                                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${f.name.endsWith('.pdf') ? 'bg-red-950 text-red-400 border border-red-900/30' : 'bg-blue-950 text-blue-400 border border-blue-900/30'}`}>
                                                        {f.name.split('.').pop() || 'file'}
                                                    </span>
                                                    <span className="text-neutral-200 truncate font-mono">{f.name}</span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-[10px] text-neutral-500 font-mono">{(f.size / 1024).toFixed(1)} KB</span>
                                                    <span className="text-[9px] font-bold text-blue-400 opacity-60 group-hover:opacity-100 transition-opacity">Preview 👁</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {isProcessing && (
                             <div className="fixed bottom-10 right-10 z-50 bg-neutral-900 border border-accent rounded-xl p-4 w-96 shadow-2xl">
                                <div className="flex items-center gap-3">
                                    <LoadingSpinner className="w-6 h-6 text-blue-500" />
                                    <p className="text-blue-400 font-bold uppercase text-xs animate-pulse tracking-widest">{statusMessage}</p>
                                </div>
                                <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden mt-3">
                                    <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end mt-8">
                            <button onClick={handlePurge} className="flex items-center gap-2 text-xs font-bold text-red-500 hover:text-red-400 uppercase tracking-widest px-4 py-2 hover:bg-red-900/20 rounded-lg transition-colors border border-red-900/30">
                                <TrashIcon className="w-4 h-4" /> Purge Agent Memory
                            </button>
                        </div>
                    </div>
                )}
                
                {activeTab === 'vectors' && (() => {
                    const ITEMS_PER_PAGE = 20;
                    
                    const derivedCollections = Array.from(new Set([
                        'Scripts',
                        'Character Profiles',
                        'World Building',
                        'Reference Documents',
                        ...customCollections,
                        ...vectors.map(v => v.metadata?.collection).filter(Boolean) as string[]
                    ]));
                    const collectionsList = ['all', 'Root Documents', ...derivedCollections];
                    
                    const filteredSourcesByCol = sources.filter(s => {
                        if (activeCollection === 'all') return true;
                        const firstVector = vectors.find(v => v.source === s);
                        const col = firstVector?.metadata?.collection || 'Root Documents';
                        return col === activeCollection;
                    });

                    const filteredVectorsByCol = vectors.filter(v => {
                        if (activeCollection === 'all') return true;
                        const col = v.metadata?.collection || 'Root Documents';
                        return col === activeCollection;
                    });

                    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
                    const paginatedVectors = filteredVectorsByCol.slice(startIndex, startIndex + ITEMS_PER_PAGE);
                    const totalPages = Math.ceil(filteredVectorsByCol.length / ITEMS_PER_PAGE);

                    const filteredSemanticResults = semanticResults.filter(r => {
                        if (activeCollection === 'all') return true;
                        const matchedVector = vectors.find(v => v.source === r.source);
                        const col = matchedVector?.metadata?.collection || 'Root Documents';
                        return col === activeCollection;
                    });

                    return (
                        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                            {/* SIDEBAR: COLLECTION / FOLDER DIRECTORY */}
                            <div className="lg:col-span-3 bg-neutral-900/90 border border-neutral-800 p-5 rounded-2xl space-y-5 flex-shrink-0 shadow-lg">
                                <div className="flex justify-between items-center pb-2 border-b border-neutral-800">
                                    <h4 className="text-[11px] font-black uppercase text-neutral-400 tracking-wider">Document Collections</h4>
                                    <button
                                        onClick={() => setShowCreateCollectionModal(true)}
                                        className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-wider"
                                        title="Create custom folder"
                                    >
                                        + New Folder
                                    </button>
                                </div>
                                <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
                                    {collectionsList.map(col => {
                                        const isSelected = activeCollection === col;
                                        const docCount = sources.filter(s => {
                                            const firstVec = vectors.find(v => v.source === s);
                                            const c = firstVec?.metadata?.collection || 'Root Documents';
                                            return col === 'all' || c === col;
                                        }).length;

                                        return (
                                            <button
                                                key={col}
                                                onClick={() => { setActiveCollection(col); setCurrentPage(1); }}
                                                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all text-xs font-mono group ${
                                                    isSelected 
                                                        ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-900/10' 
                                                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850/50'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 truncate">
                                                    <span className="text-base select-none shrink-0">
                                                        {col === 'all' ? '🗂' : col === 'Root Documents' ? '📁' : '📁'}
                                                    </span>
                                                    <span className="truncate">{col === 'all' ? 'All Collections' : col}</span>
                                                </div>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                                    isSelected ? 'bg-blue-700/80 text-white' : 'bg-neutral-800 text-neutral-500 group-hover:text-neutral-300'
                                                }`}>
                                                    {docCount}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* LORE HYPOTHESIS GENERATOR & CARDS SECTION */}
                                <div className="pt-4 border-t border-neutral-800 space-y-3 font-sans">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-amber-400 text-xs">⚡</span>
                                            <h4 className="text-[11px] font-black uppercase text-neutral-300 tracking-wider">
                                                Lore Hypotheses
                                            </h4>
                                            {loreHypotheses.length > 0 && (
                                                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/60 font-bold">
                                                    {loreHypotheses.length}
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            onClick={handleGenerateLoreHypotheses}
                                            disabled={isGeneratingHypotheses}
                                            className="text-[10px] text-amber-400 hover:text-amber-300 font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                            title="Use Gemini to suggest new narrative connections between disparate lore documents"
                                        >
                                            {isGeneratingHypotheses ? (
                                                <>
                                                    <span className="w-2.5 h-2.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                                                    <span>Analyzing...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>✨ Generate</span>
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Filter Pills */}
                                    {loreHypotheses.length > 0 && (
                                        <div className="flex gap-1 bg-black/40 p-1 rounded-lg border border-neutral-850 text-[9px] font-bold uppercase">
                                            <button
                                                onClick={() => setHypothesisFilter('all')}
                                                className={`flex-1 py-1 rounded text-center transition-all ${
                                                    hypothesisFilter === 'all' ? 'bg-neutral-800 text-white font-black' : 'text-neutral-400 hover:text-neutral-200'
                                                }`}
                                            >
                                                All ({loreHypotheses.length})
                                            </button>
                                            <button
                                                onClick={() => setHypothesisFilter('suggested')}
                                                className={`flex-1 py-1 rounded text-center transition-all ${
                                                    hypothesisFilter === 'suggested' ? 'bg-amber-950 text-amber-300 font-black' : 'text-neutral-400 hover:text-neutral-200'
                                                }`}
                                            >
                                                Pending ({loreHypotheses.filter(h => h.status === 'suggested').length})
                                            </button>
                                            <button
                                                onClick={() => setHypothesisFilter('accepted')}
                                                className={`flex-1 py-1 rounded text-center transition-all ${
                                                    hypothesisFilter === 'accepted' ? 'bg-emerald-950 text-emerald-300 font-black' : 'text-neutral-400 hover:text-neutral-200'
                                                }`}
                                            >
                                                Accepted ({loreHypotheses.filter(h => h.status === 'accepted').length})
                                            </button>
                                        </div>
                                    )}

                                    {/* Hypotheses Cards List */}
                                    <div className="space-y-3 max-h-[460px] overflow-y-auto custom-scrollbar pr-1">
                                        {(() => {
                                            const filteredHypotheses = loreHypotheses.filter(h => {
                                                if (hypothesisFilter === 'all') return true;
                                                return h.status === hypothesisFilter;
                                            });

                                            if (filteredHypotheses.length === 0) {
                                                return (
                                                    <div className="p-4 bg-neutral-950/40 border border-dashed border-neutral-850 rounded-xl text-center space-y-2">
                                                        <span className="text-xl opacity-40">🔮</span>
                                                        <p className="text-[10px] text-neutral-400 leading-relaxed">
                                                            {loreHypotheses.length === 0
                                                                ? "Discover narrative connections bridging disparate documents based on thematic clusters."
                                                                : "No hypotheses match this filter."}
                                                        </p>
                                                        {loreHypotheses.length === 0 && (
                                                            <button
                                                                onClick={handleGenerateLoreHypotheses}
                                                                disabled={isGeneratingHypotheses}
                                                                className="px-3 py-1.5 bg-amber-600/90 hover:bg-amber-500 text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-all shadow cursor-pointer disabled:opacity-40"
                                                            >
                                                                {isGeneratingHypotheses ? "Analyzing Clusters..." : "⚡ Generate Hypotheses"}
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            }

                                            return filteredHypotheses.map(hyp => {
                                                const isExpanded = expandedHypothesisId === hyp.id;
                                                return (
                                                    <div
                                                        key={hyp.id}
                                                        className={`p-3 rounded-xl border transition-all text-xs space-y-2.5 ${
                                                            hyp.status === 'accepted'
                                                                ? 'bg-emerald-950/20 border-emerald-800/40 text-neutral-200'
                                                                : 'bg-neutral-950/60 border-neutral-850 hover:border-amber-500/30 text-neutral-300'
                                                        }`}
                                                    >
                                                        {/* Header: Cluster Badge & Confidence */}
                                                        <div className="flex justify-between items-start gap-1">
                                                            <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-amber-400 tracking-wider">
                                                                {hyp.thematicCluster}
                                                            </span>
                                                            <span className="text-[8px] font-mono font-bold text-neutral-400 bg-black/60 px-1.5 py-0.5 rounded">
                                                                {hyp.confidenceScore}% match
                                                            </span>
                                                        </div>

                                                        {/* Title */}
                                                        <h5 className="font-black text-white text-xs leading-snug">
                                                            {hyp.title}
                                                        </h5>

                                                        {/* Connected Documents tags */}
                                                        <div className="flex flex-wrap items-center gap-1 text-[9px] font-mono">
                                                            <span className="text-neutral-500 font-sans">Bridges:</span>
                                                            {hyp.connectedSources.map((src, i) => (
                                                                <button
                                                                    key={i}
                                                                    type="button"
                                                                    onClick={() => handlePreviewOrFilterDoc(src)}
                                                                    className="px-1.5 py-0.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-blue-400 hover:text-blue-300 rounded truncate max-w-[130px] transition-all cursor-pointer"
                                                                    title={`Click to preview "${src}"`}
                                                                >
                                                                    📄 {src}
                                                                </button>
                                                            ))}
                                                        </div>

                                                        {/* Core narrative hypothesis */}
                                                        <p className="text-[11px] text-neutral-300 leading-relaxed font-sans">
                                                            {hyp.hypothesis}
                                                        </p>

                                                        {/* Expandable Evidence & Screenwriter Beat */}
                                                        {isExpanded && (
                                                            <div className="space-y-2 pt-2 border-t border-neutral-850 animate-fade-in text-[10px]">
                                                                <div className="space-y-0.5">
                                                                    <span className="text-[8px] font-black uppercase text-neutral-500 tracking-wider block">
                                                                        Connecting Evidence
                                                                    </span>
                                                                    <p className="text-neutral-400 italic leading-snug">
                                                                        {hyp.evidence}
                                                                    </p>
                                                                </div>
                                                                <div className="space-y-0.5">
                                                                    <span className="text-[8px] font-black uppercase text-amber-400/90 tracking-wider block">
                                                                        Screenwriter Scene Hook
                                                                    </span>
                                                                    <p className="text-amber-200/90 bg-amber-950/30 p-2 rounded-lg border border-amber-900/30 leading-snug">
                                                                        💡 {hyp.creativePrompt}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Card Controls */}
                                                        <div className="flex justify-between items-center pt-1 border-t border-neutral-850/60">
                                                            <button
                                                                type="button"
                                                                onClick={() => setExpandedHypothesisId(isExpanded ? null : hyp.id)}
                                                                className="text-[9px] font-bold text-neutral-400 hover:text-neutral-200 transition-colors"
                                                            >
                                                                {isExpanded ? '▲ Hide details' : '▼ Details & Beat'}
                                                            </button>

                                                            <div className="flex items-center gap-1.5">
                                                                {hyp.status !== 'accepted' ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleAcceptHypothesis(hyp.id)}
                                                                        className="px-2 py-1 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-400 hover:text-emerald-300 border border-emerald-800/60 rounded text-[9px] font-black uppercase tracking-wider transition-all"
                                                                        title="Accept this hypothesis as canon lore connection"
                                                                    >
                                                                        ✓ Accept
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1">
                                                                        ✓ Canonized
                                                                    </span>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDismissHypothesis(hyp.id)}
                                                                    className="p-1 text-neutral-500 hover:text-rose-400 hover:bg-rose-950/30 rounded transition-all"
                                                                    title="Dismiss this hypothesis"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* MAIN FOLDER BROWSER PANEL */}
                            <div className="lg:col-span-9 space-y-6">
                                {/* GLOBAL SEMANTIC SEARCH BAR */}
                                <div className="bg-neutral-900/90 border border-neutral-800 p-5 rounded-2xl shadow-lg space-y-4 font-sans">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                        <div>
                                            <h4 className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-2">
                                                <span>🔍</span> Neural Semantic Search
                                            </h4>
                                            <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">
                                                Queries 3072-dimensional embeddings via Gemini to discover conceptual matches
                                            </p>
                                        </div>
                                    </div>
                                    <form onSubmit={handleGlobalSemanticSearch} className="flex gap-2">
                                        <input
                                            type="text"
                                            value={globalSearchQuery}
                                            onChange={e => setGlobalSearchQuery(e.target.value)}
                                            placeholder="Ask a question or enter a concept (e.g. 'factions opposed to the king', 'magic crystal properties')..."
                                            className="flex-grow bg-black border border-neutral-750 rounded-xl px-4 py-3 text-xs text-white placeholder-neutral-500 outline-none focus:border-blue-500 font-sans"
                                        />
                                        <button
                                            type="submit"
                                            disabled={isGlobalSearching || !globalSearchQuery.trim()}
                                            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all shadow-md cursor-pointer shrink-0"
                                        >
                                            {isGlobalSearching ? 'Searching...' : 'Search'}
                                        </button>
                                        {globalSearchQuery && (
                                            <button
                                                type="button"
                                                onClick={handleClearGlobalSearch}
                                                className="px-4 py-3 bg-neutral-800 hover:bg-neutral-750 text-neutral-400 hover:text-white text-xs font-bold uppercase tracking-wider rounded-xl border border-neutral-700 cursor-pointer"
                                            >
                                                Clear
                                            </button>
                                        )}
                                    </form>

                                    {/* RECENT SEARCHES CHIPS */}
                                    {recentSearches.length > 0 && (
                                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-neutral-400 font-sans pt-1">
                                            <span className="font-bold uppercase tracking-wider text-neutral-500">Recent:</span>
                                            <div className="flex flex-wrap gap-1.5 flex-grow">
                                                {recentSearches.map((search, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => handleReRunRecentSearch(search)}
                                                        className="px-2.5 py-1 bg-neutral-850 hover:bg-blue-950/40 text-neutral-300 hover:text-blue-400 rounded-lg border border-neutral-800 hover:border-blue-900/30 transition-all cursor-pointer truncate max-w-[180px] font-mono"
                                                        title={`Click to re-run search for "${search}"`}
                                                    >
                                                        {search}
                                                    </button>
                                                ))}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleClearRecentSearches}
                                                className="text-[9px] text-red-500 hover:text-red-400 font-bold uppercase tracking-wider border-l border-neutral-800 pl-2 hover:underline cursor-pointer shrink-0"
                                            >
                                                Clear History
                                            </button>
                                        </div>
                                    )}

                                    {/* SEARCH RESULTS FEED */}
                                    {globalSemanticSearchResults.length > 0 && (
                                        <div className="space-y-3 pt-2 border-t border-neutral-850">
                                            <div className="flex justify-between items-center text-[10px] uppercase font-mono text-neutral-500 tracking-wider">
                                                <span>Matches Discovered ({globalSemanticSearchResults.length})</span>
                                                <span>Sorted by Vector Proximity</span>
                                            </div>
                                            <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                                                {globalSemanticSearchResults.map((res, sIdx) => (
                                                    <div 
                                                        key={sIdx} 
                                                        onClick={() => {
                                                            setPreviewDoc({
                                                                title: res.source,
                                                                content: res.fullContent || res.text,
                                                                highlightText: res.text
                                                            });
                                                        }}
                                                        className="bg-black/35 border border-neutral-855 hover:border-blue-500/40 p-3.5 rounded-xl space-y-2 cursor-pointer hover:bg-neutral-950/20 transition-all text-left"
                                                    >
                                                        <div className="flex justify-between items-center text-[10px] font-mono">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-blue-400 font-bold truncate max-w-sm">📄 {res.source}</span>
                                                                {res.collection && (
                                                                    <span className="bg-neutral-850 text-neutral-400 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border border-neutral-800">
                                                                        📁 {res.collection}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-green-400 font-bold bg-green-950/20 border border-green-900/30 px-1.5 py-0.5 rounded">
                                                                {(res.score * 100).toFixed(1)}% Relevance
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-neutral-300 leading-relaxed italic border-l-2 border-blue-500/40 pl-3">
                                                            "{res.text}"
                                                        </p>
                                                        <div className="flex justify-end text-[9px] font-bold text-blue-400 uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity">
                                                            Open & View in Context &rarr;
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Collection Header */}
                                <div className="flex justify-between items-center bg-neutral-900/40 p-5 rounded-2xl border border-neutral-800">
                                    <div>
                                        <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                                            <span>📁</span> {activeCollection === 'all' ? 'All Collections' : activeCollection}
                                        </h3>
                                        <p className="text-[10px] text-neutral-500 uppercase mt-0.5 font-bold tracking-wider">
                                            {activeCollection === 'all' ? 'Complete database workspace' : `Folder: ${activeCollection}`}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-neutral-500 font-mono">{filteredSourcesByCol.length} Documents</span>
                                        {filteredSourcesByCol.length > 0 && (
                                            <button
                                                onClick={handleExportTagsCSV}
                                                className="bg-blue-600/15 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-900/30 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                                                title="Export tags in active folder to CSV"
                                            >
                                                📥 Export CSV
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* BATCH ACTIONS FLOATING METADATA CONTROLLER */}
                                {selectedSources.length > 0 && (
                                    <div className="bg-blue-950/20 border border-blue-900/40 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 animate-fade-in shadow-lg">
                                        <div className="flex items-center gap-3">
                                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                                            <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider">
                                                Selected {selectedSources.length} of {filteredSourcesByCol.length} Documents
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 font-sans">
                                            <button
                                                onClick={() => setSelectedSources(filteredSourcesByCol)}
                                                className="text-[10px] text-neutral-400 hover:text-white font-bold uppercase tracking-wider px-2.5 py-1.5 rounded bg-neutral-800/60 cursor-pointer"
                                            >
                                                Select All
                                            </button>
                                            <button
                                                onClick={() => setSelectedSources([])}
                                                className="text-[10px] text-neutral-400 hover:text-white font-bold uppercase tracking-wider px-2.5 py-1.5 rounded bg-neutral-800/60 cursor-pointer"
                                            >
                                                Clear
                                            </button>
                                            <div className="w-px h-4 bg-neutral-850 mx-1" />
                                            <button
                                                onClick={() => setShowBulkTagModal(true)}
                                                className="bg-purple-600 hover:bg-purple-500 text-white font-black uppercase text-[10px] tracking-wider px-3.5 py-1.5 rounded-lg transition-all shadow-md cursor-pointer"
                                            >
                                                🏷 Bulk Tag
                                            </button>
                                            <button
                                                onClick={() => setShowBulkMoveModal(true)}
                                                className="bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-[10px] tracking-wider px-3.5 py-1.5 rounded-lg transition-all shadow-md cursor-pointer"
                                            >
                                                📁 Bulk Move
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Source Document Cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    {filteredSourcesByCol.map(s => {
                                        const isSelected = selectedSources.includes(s);
                                        // Collect unique tags saved on this source's vectors
                                        const matchingVectors = vectors.filter(v => v.source === s);
                                        const tagsSet = new Set<string>();
                                        matchingVectors.forEach(v => {
                                            if (v.metadata?.tags && Array.isArray(v.metadata.tags)) {
                                                v.metadata.tags.forEach((t: string) => tagsSet.add(t));
                                            }
                                        });
                                        const sourceTags = Array.from(tagsSet).slice(0, 4);

                                        return (
                                            <div 
                                                key={s} 
                                                className={`bg-neutral-900/90 border p-3.5 rounded-xl flex flex-col justify-between gap-3 hover:border-neutral-700 transition-all shadow-sm relative group cursor-pointer ${
                                                    isSelected ? 'border-blue-500 ring-1 ring-blue-500/20 bg-neutral-850/40' : 'border-neutral-800'
                                                }`}
                                                onClick={(e) => {
                                                    const target = e.target as HTMLElement;
                                                    if (target.closest('button')) return;
                                                    toggleSelectSource(s);
                                                }}
                                            >
                                                <div className="space-y-1.5">
                                                    {/* Image Asset Thumbnail for Visual Lore Grid */}
                                                    {matchingVectors[0]?.metadata?.thumbnail && (
                                                        <div className="w-full h-28 rounded-lg overflow-hidden border border-neutral-800 bg-black mb-1.5 flex items-center justify-center">
                                                            <img 
                                                                src={matchingVectors[0].metadata.thumbnail} 
                                                                alt={s} 
                                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between items-start gap-2">
                                                        <div className="flex items-center gap-1.5 truncate">
                                                            <span className="text-sm">
                                                                {matchingVectors[0]?.metadata?.type === 'image_asset' ? '🖼️' : '📄'}
                                                            </span>
                                                            <h4 className="text-xs font-bold text-neutral-200 font-mono truncate" title={s}>{s}</h4>
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleSelectSource(s)}
                                                            className="w-3.5 h-3.5 rounded accent-blue-500 bg-black border-neutral-750 focus:ring-0 cursor-pointer"
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        {matchingVectors[0]?.metadata?.type === 'image_asset' && (
                                                            <span className="text-[8px] font-mono font-bold bg-amber-950/60 text-amber-400 border border-amber-900/40 px-1.5 py-0.5 rounded">
                                                                Visual Asset
                                                            </span>
                                                        )}
                                                        <span className="text-[9px] bg-neutral-800 text-neutral-500 font-mono px-1.5 py-0.5 rounded">
                                                            {matchingVectors.length} Chunks
                                                        </span>
                                                        {sourceTags.map(tag => (
                                                            <span key={tag} className="text-[8px] font-mono font-bold bg-purple-950/40 text-purple-400 px-1 rounded border border-purple-900/25">
                                                                #{tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    {matchingVectors[0]?.metadata?.summary && (
                                                        <div className="bg-black/35 p-2 rounded-lg border border-neutral-850/50">
                                                            <span className="text-[8px] font-black uppercase tracking-widest text-blue-400 block mb-0.5 font-sans">Executive Lore Summary</span>
                                                            <p className="text-[10px] text-neutral-400 font-sans italic leading-normal line-clamp-2" title={matchingVectors[0].metadata.summary}>
                                                                "{matchingVectors[0].metadata.summary}"
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 pt-1 border-t border-neutral-850/60 justify-end font-sans">
                                                    <button
                                                        onClick={() => { setMovingSource(s); setShowMoveModal(true); }}
                                                        className="text-[9px] font-bold text-neutral-400 hover:text-white px-2 py-1 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700/50 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                                        title="Assign to folder"
                                                    >
                                                        <span>📁 Folder</span>
                                                    </button>
                                                    <button 
                                                        onClick={() => handlePreviewIndexedSource(s)}
                                                        className="text-[9px] font-bold text-blue-400 hover:text-blue-300 px-2.5 py-1 bg-blue-950/20 hover:bg-blue-900/20 border border-blue-900/30 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                                    >
                                                        <span>Inspect 👁</span>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {filteredSourcesByCol.length === 0 && (
                                        <div className="col-span-full py-10 bg-neutral-950/40 border border-dashed border-neutral-850 rounded-xl text-center text-xs text-neutral-500">
                                            No documents assigned to this collection folder.
                                        </div>
                                    )}
                                </div>

                                {/* SEMANTIC SEARCH CONSOLE (Scoped to Active Collection Folder) */}
                                <div className="bg-neutral-900/95 border border-neutral-850 p-6 rounded-2xl space-y-4 shadow-xl">
                                    <div>
                                        <h4 className="text-xs font-black uppercase text-blue-400 tracking-wider">Semantic Similarity Search Sandbox</h4>
                                        <p className="text-[11px] text-neutral-500 mt-0.5">
                                            {activeCollection === 'all' 
                                                ? "Querying entire embedded workspace." 
                                                : `Scoped search matching ONLY documents in folder: "${activeCollection}"`
                                            }
                                        </p>
                                    </div>
                                    <form onSubmit={handleSemanticSearch} className="flex flex-col sm:flex-row gap-3">
                                        <div className="relative flex-grow">
                                            <input
                                                type="text"
                                                required
                                                value={semanticQuery}
                                                onChange={e => setSemanticQuery(e.target.value)}
                                                placeholder={`Search inside ${activeCollection === 'all' ? 'all' : `"${activeCollection}"`} using vector similarity...`}
                                                className="w-full bg-black border border-neutral-850 p-3 pl-4 pr-10 text-xs text-white placeholder-neutral-500 focus:ring-1 focus:ring-blue-500 outline-none rounded-xl"
                                            />
                                            {semanticQuery && (
                                                <button
                                                    type="button"
                                                    onClick={() => { setSemanticQuery(''); setSemanticResults([]); }}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 text-[10px]"
                                                >
                                                    ✕ Clear
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <div className="flex items-center gap-1.5 bg-black border border-neutral-850 px-3 py-1.5 rounded-xl">
                                                <span className="text-[9px] font-black uppercase text-neutral-500 tracking-wider">Limit</span>
                                                <select
                                                    value={similarityLimit}
                                                    onChange={e => setSimilarityLimit(Number(e.target.value))}
                                                    className="bg-transparent text-xs font-bold text-neutral-300 outline-none cursor-pointer"
                                                >
                                                    <option value={3}>3</option>
                                                    <option value={5}>5</option>
                                                    <option value={10}>10</option>
                                                    <option value={15}>15</option>
                                                </select>
                                            </div>
                                            <button
                                                type="submit"
                                                disabled={isSearching || !semanticQuery.trim()}
                                                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shrink-0"
                                            >
                                                {isSearching ? "Searching..." : "🔍 Query Folder"}
                                            </button>
                                        </div>
                                    </form>

                                    {/* SEMANTIC RESULTS PANEL */}
                                    {filteredSemanticResults.length > 0 && (
                                        <div className="pt-2 space-y-3 border-t border-neutral-850">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Search Results ({filteredSemanticResults.length} matches)</span>
                                                <button 
                                                    onClick={() => setSemanticResults([])}
                                                    className="text-[9px] text-rose-400 hover:text-rose-300 font-bold uppercase tracking-wider"
                                                >
                                                    Clear Results
                                                </button>
                                            </div>
                                            <div className="space-y-2.5 max-h-96 overflow-y-auto custom-scrollbar pr-1">
                                                {filteredSemanticResults.map((r, idx) => (
                                                    <div key={idx} className="bg-black/60 border border-neutral-850 p-4 rounded-xl hover:border-blue-500/30 transition-all flex flex-col gap-2 animate-fade-in">
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[9px] font-mono font-bold uppercase bg-blue-950/40 text-blue-400 px-1.5 py-0.5 rounded border border-blue-900/20">
                                                                    {(r.score * 100).toFixed(1)}% Match
                                                                </span>
                                                                <span className="text-[10px] text-neutral-400 font-mono truncate max-w-xs" title={r.source}>{r.source}</span>
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    const matchedChunks = vectors.filter(v => v.source === r.source);
                                                                    const combinedContent = matchedChunks.map(v => v.text).join('\n\n---\n\n');
                                                                    setPreviewDoc({
                                                                        title: r.source,
                                                                        content: combinedContent,
                                                                        highlightText: r.text,
                                                                        isLoding: false
                                                                    });
                                                                }}
                                                                className="text-[9px] font-bold text-blue-400 hover:underline cursor-pointer"
                                                            >
                                                                Inspect Full 👁
                                                            </button>
                                                        </div>
                                                        <p className="text-xs text-neutral-300 font-mono leading-relaxed whitespace-pre-wrap">{r.text}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* VECTOR STREAM LISTING */}
                                <div className="space-y-2 pt-4">
                                    <h3 className="text-sm font-black text-neutral-400 uppercase tracking-widest mb-4">Vector Stream ({filteredVectorsByCol.length})</h3>
                                    {paginatedVectors.map(v => (
                                        <div key={v.id as string} className="bg-neutral-900/80 border border-neutral-800 p-4 rounded-lg hover:border-blue-500/30 transition-colors">
                                            <div className="flex justify-between mb-2">
                                                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">{v.source}</span>
                                                <span className="text-[10px] text-neutral-600 font-mono">{String(v.id).substring(0,8)}</span>
                                            </div>
                                            <p className="text-xs text-neutral-300 font-mono line-clamp-2">{v.text}</p>
                                        </div>
                                    ))}
                                    {filteredVectorsByCol.length === 0 && (
                                         <div className="text-center py-12 text-neutral-600 bg-neutral-950/20 border border-dashed border-neutral-850 rounded-xl">
                                            <p>No vectors found in this folder.</p>
                                         </div>
                                    )}
                                    {totalPages > 1 && (
                                        <div className="flex justify-between items-center mt-6 pt-4 border-t border-neutral-800 font-sans">
                                            <button
                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                disabled={currentPage === 1}
                                                className="px-4 py-2 text-xs font-bold text-neutral-300 bg-neutral-800 rounded-lg hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                            >
                                                &larr; Previous
                                            </button>
                                            <span className="text-xs font-mono text-neutral-500">
                                                Page {currentPage} of {totalPages}
                                            </span>
                                            <button
                                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                disabled={currentPage === totalPages}
                                                className="px-4 py-2 text-xs font-bold text-neutral-300 bg-neutral-800 rounded-lg hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                            >
                                                Next &rarr;
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {activeTab === 'graph' && (
                     <div className="h-full flex flex-col space-y-4">
                        <div className="flex-shrink-0 flex justify-between items-center px-4">
                            <div>
                                <h3 className="text-sm font-black text-neutral-400 uppercase tracking-widest">Neural Graph Topology</h3>
                                <p className="text-[10px] text-neutral-500 uppercase mt-0.5 font-bold tracking-wider">Semantic Knowledge Network</p>
                            </div>
                            <div className="text-xs text-neutral-500 space-x-4 font-mono">
                                <span>{tripletEdges.length > 0 ? Array.from(new Set(tripletEdges.flatMap(e => [e.s.trim(), e.o.trim()]).filter(Boolean))).length : 0} Unique Entities</span>
                                <span>{tripletEdges.length} Relations</span>
                            </div>
                        </div>

                        <div className="flex-grow min-h-0 bg-neutral-950/20 rounded-2xl p-1">
                           {tripletEdges.length === 0 ? (
                                <div className="h-96 flex items-center justify-center text-neutral-600 font-bold uppercase tracking-widest text-sm border-2 border-dashed border-neutral-850 rounded-2xl">
                                    Graph Empty - Build Graph via Factory tab
                                </div>
                            ) : (
                                <ForceDirectedGraph tripletEdges={tripletEdges} vectors={vectors} />
                            )}
                        </div>
                    </div>
                )}
                
                {activeTab === 'forge' && (
                    <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-neutral-900/90 border border-neutral-800 p-6 rounded-2xl shadow-xl">
                            <h3 className="text-sm font-black text-green-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <PlusIcon className="w-4 h-4" /> Create Node (Legacy)
                            </h3>
                            <div className="space-y-4">
                                <input type="text" value={newNodeLabel} onChange={e => setNewNodeLabel(e.target.value)} placeholder="Label / Entity Name" className="w-full bg-black border border-neutral-700 rounded-lg p-3 text-sm text-white focus:border-green-500 outline-none" />
                                <textarea value={newNodeDesc} onChange={e => setNewNodeDesc(e.target.value)} placeholder="Description / Context..." className="w-full bg-black border border-neutral-700 rounded-lg p-3 text-sm text-white focus:border-green-500 outline-none h-24 resize-none" />
                                <button onClick={handleAddNode} disabled={!newNodeLabel} className="w-full py-3 bg-green-700 hover:bg-green-600 text-white font-bold rounded-lg uppercase text-xs tracking-widest disabled:opacity-50 disabled:cursor-not-allowed">Forge Node</button>
                            </div>
                        </div>

                        <div className="bg-neutral-900/90 border border-neutral-800 p-6 rounded-2xl shadow-xl">
                            <h3 className="text-sm font-black text-blue-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <DatabaseIcon className="w-4 h-4" /> Link Nodes (Legacy)
                            </h3>
                            <div className="space-y-4">
                                <select value={newEdgeSource} onChange={e => setNewEdgeSource(e.target.value)} className="w-full bg-black border border-neutral-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none">
                                    <option value="">Select Source Node...</option>
                                    {graphNodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
                                </select>
                                <select value={newEdgeTarget} onChange={e => setNewEdgeTarget(e.target.value)} className="w-full bg-black border border-neutral-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none">
                                    <option value="">Select Target Node...</option>
                                    {graphNodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
                                </select>
                                <input type="text" value={newEdgeLabel} onChange={e => setNewEdgeLabel(e.target.value)} placeholder="Relationship Label (e.g. 'owns', 'knows')" className="w-full bg-black border border-neutral-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none" />
                                <button onClick={handleAddEdge} disabled={!newEdgeSource || !newEdgeTarget || !newEdgeLabel} className="w-full py-3 bg-blue-700 hover:bg-blue-600 text-white font-bold rounded-lg uppercase text-xs tracking-widest disabled:opacity-50 disabled:cursor-not-allowed">Forge Link</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* FILE PREVIEW READ-ONLY MODAL */}
            {previewDoc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center bg-neutral-950 p-5 border-b border-neutral-800 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-widest border ${
                                    previewDoc.title.endsWith('.pdf') 
                                        ? 'bg-red-950/60 border-red-900/40 text-red-400' 
                                        : 'bg-blue-950/60 border-blue-900/40 text-blue-400'
                                }`}>
                                    {previewDoc.title.split('.').pop() || 'doc'}
                                </span>
                                <h3 className="text-sm font-black text-white font-mono truncate max-w-lg" title={previewDoc.title}>
                                    {previewDoc.title}
                                </h3>
                            </div>
                            <button
                                onClick={() => {
                                    if (isEditingDoc && (editedContent !== (previewDoc.content || '') || versionComment.trim())) {
                                        if (!confirm("You have unsaved changes in your document revision. Are you sure you want to discard them and close?")) {
                                            return;
                                        }
                                    }
                                    setPreviewDoc(null);
                                }}
                                className="text-neutral-400 hover:text-white hover:bg-neutral-800 p-2 rounded-lg transition-all"
                                title="Close Preview"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-grow p-6 overflow-y-auto custom-scrollbar bg-black/40">
                            {previewDoc.isLoding ? (
                                <div className="h-64 flex flex-col items-center justify-center gap-3 text-neutral-500">
                                    <LoadingSpinner className="w-8 h-8 text-blue-500" />
                                    <span className="font-bold text-xs uppercase tracking-widest animate-pulse">Parsing file content...</span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                                    {/* Left Column: Full Document Reader / Revision Editor */}
                                    <div className="lg:col-span-7 space-y-3">
                                         {isEditingDoc ? (
                                             <form onSubmit={handleSaveNewDocVersion} className="space-y-4">
                                                 <div className="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-neutral-850">
                                                     <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider font-mono animate-pulse">🛠 Editing Document Text</span>
                                                     <button
                                                         type="button"
                                                         onClick={() => { setIsEditingDoc(false); setEditedContent(previewDoc.content || ''); }}
                                                         className="text-[10px] font-bold text-neutral-400 hover:text-white uppercase tracking-wider px-2.5 py-1 bg-neutral-800 rounded border border-neutral-700 cursor-pointer"
                                                     >
                                                         Cancel
                                                     </button>
                                                 </div>
                                                 <textarea
                                                     value={editedContent}
                                                     onChange={e => setEditedContent(e.target.value)}
                                                     className="w-full bg-black border border-neutral-750 rounded-xl p-4 text-xs text-neutral-300 font-mono leading-relaxed h-[42vh] outline-none focus:border-blue-500 resize-y"
                                                     placeholder="Edit document content..."
                                                 />
                                                 <div className="space-y-1">
                                                     <span className="text-[9px] uppercase font-black text-neutral-500 tracking-wider font-sans">Change Comment / Revision Notes:</span>
                                                     <input
                                                         type="text"
                                                         required
                                                         value={versionComment}
                                                         onChange={e => setVersionComment(e.target.value)}
                                                         placeholder="What did you update? (e.g. Corrected spell, altered character name)..."
                                                         className="w-full bg-black border border-neutral-750 rounded-lg p-2.5 text-xs text-white placeholder-neutral-500 outline-none focus:border-blue-500 font-sans"
                                                     />
                                                 </div>
                                                 <button
                                                     type="submit"
                                                     disabled={!editedContent.trim() || !versionComment.trim()}
                                                     className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50"
                                                 >
                                                     Commit Changes (Save Version {docVersions.length + 1})
                                                 </button>
                                             </form>
                                         ) : (
                                             <>
                                                 <div className="flex justify-between items-center bg-black/20 p-2.5 rounded-xl border border-neutral-850/60">
                                                     <div className="bg-blue-950/15 border border-blue-900/30 text-blue-400 px-3 py-1 rounded text-[10px] uppercase font-mono tracking-wider flex items-center gap-2">
                                                         <span className="animate-pulse">💡</span> Highlight sections to annotate.
                                                     </div>
                                                     <button
                                                         type="button"
                                                         onClick={() => { setIsEditingDoc(true); setEditedContent(previewDoc.content || ''); }}
                                                         className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-[10px] tracking-wider rounded-lg transition-colors cursor-pointer border border-blue-500/20"
                                                     >
                                                         ✏ Edit Document Text
                                                     </button>
                                                 </div>
                                                 <pre 
                                                     onMouseUp={handleTextSelection}
                                                     className="text-xs text-neutral-300 font-mono whitespace-pre-wrap leading-relaxed select-text p-4 bg-black/30 rounded-xl border border-neutral-850 cursor-text select-text focus:outline-none focus:border-neutral-700 min-h-[40vh]"
                                                 >
                                                     {previewDoc.highlightText 
                                                         ? renderHighlightedContent(previewDoc.content, previewDoc.highlightText) 
                                                         : (previewDoc.content || "Empty content detected.")
                                                     }
                                                 </pre>
                                             </>
                                         )}
                                    </div>

                                    {/* Right Column: Interactive Annotations Dashboard */}
                                    <div className="lg:col-span-5 space-y-4">
                                        {/* Create New Annotation Form */}
                                        {selectedText ? (
                                            <form onSubmit={handleAddAnnotation} className="bg-neutral-900/90 border border-blue-900/30 p-4 rounded-xl space-y-3 shadow-md animate-scale-up">
                                                <div className="flex justify-between items-center pb-1.5 border-b border-neutral-850">
                                                    <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider font-sans">📝 Create Annotation</span>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setSelectedText('')} 
                                                        className="text-neutral-500 hover:text-white text-xs cursor-pointer"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[9px] uppercase font-black text-neutral-500 tracking-wider font-sans">Selected Passage:</span>
                                                    <p className="text-[11px] font-mono text-neutral-300 bg-black/40 p-2 rounded border border-neutral-850/50 max-h-24 overflow-y-auto italic">
                                                        "{selectedText.substring(0, 300)}{selectedText.length > 300 ? '...' : ''}"
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[9px] uppercase font-black text-neutral-500 tracking-wider font-sans">Commentary / Notes:</span>
                                                    <textarea
                                                        required
                                                        value={newComment}
                                                        onChange={e => setNewComment(e.target.value)}
                                                        placeholder="Leave a comment, outline script details, or raise questions..."
                                                        className="w-full bg-black border border-neutral-750 rounded-lg p-2.5 text-xs text-white placeholder-neutral-500 outline-none focus:border-blue-500 h-20 resize-none font-sans"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <span className="text-[9px] uppercase font-black text-neutral-500 tracking-wider font-sans">Mention Production Agent:</span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {agents.map(a => {
                                                            const isSelected = mentionTargets.includes(a.name);
                                                            return (
                                                                <button
                                                                    type="button"
                                                                    key={a.id}
                                                                    onClick={() => {
                                                                        setMentionTargets(prev => 
                                                                            prev.includes(a.name) 
                                                                                ? prev.filter(t => t !== a.name) 
                                                                                : [...prev, a.name]
                                                                        );
                                                                    }}
                                                                    className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                                                                        isSelected 
                                                                            ? 'bg-purple-600 border-purple-500 text-white font-black' 
                                                                            : 'bg-neutral-850 border-neutral-700/60 text-neutral-400 hover:text-neutral-200'
                                                                    }`}
                                                                >
                                                                    @{a.name}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                                <button
                                                    type="submit"
                                                    disabled={!newComment.trim()}
                                                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-[10px] tracking-wider rounded-lg transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                                >
                                                    Publish Annotation
                                                </button>
                                            </form>
                                        ) : (
                                            <div className="bg-neutral-900/40 border border-neutral-850 p-4 rounded-xl text-center text-xs text-neutral-500 italic py-6 font-sans">
                                                Highlight text in the left panel to spawn a comment card here.
                                            </div>
                                        )}

                                        {/* TAB SELECTOR HEADER */}
                                        <div className="flex border-b border-neutral-850 pb-1">
                                            <button
                                                type="button"
                                                onClick={() => setModalSidebarTab('annotations')}
                                                className={`flex-1 pb-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all border-b-2 text-center cursor-pointer ${
                                                    modalSidebarTab === 'annotations'
                                                        ? 'border-blue-500 text-blue-400 font-black'
                                                        : 'border-transparent text-neutral-500 hover:text-neutral-300'
                                                }`}
                                            >
                                                👥 Notes ({documentAnnotations.length})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setModalSidebarTab('citations')}
                                                className={`flex-1 pb-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all border-b-2 text-center cursor-pointer ${
                                                    modalSidebarTab === 'citations'
                                                        ? 'border-blue-500 text-blue-400 font-black'
                                                        : 'border-transparent text-neutral-500 hover:text-neutral-300'
                                                }`}
                                            >
                                                🔍 Cites ({(() => {
                                                    const knownEntities = Array.from(new Set([
                                                        ...agents.map(a => a.name),
                                                        ...tripletEdges.flatMap(e => [e.s.trim(), e.o.trim()]).filter(s => s && s.length > 2)
                                                    ]));
                                                    return knownEntities.filter(entity => {
                                                        const escaped = entity.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                                                        const regex = new RegExp(`\\b${escaped}\\b`, 'i');
                                                        return regex.test(previewDoc.content || '');
                                                    }).length;
                                                })()})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setModalSidebarTab('versions')}
                                                className={`flex-1 pb-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all border-b-2 text-center cursor-pointer ${
                                                    modalSidebarTab === 'versions'
                                                        ? 'border-blue-500 text-blue-400 font-black'
                                                        : 'border-transparent text-neutral-500 hover:text-neutral-300'
                                                }`}
                                            >
                                                ⏳ Revisions ({docVersions.length})
                                            </button>
                                        </div>

                                        {/* TAB CONTENT: Real-time Annotations Feed */}
                                        {modalSidebarTab === 'annotations' && (
                                            <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4 space-y-3 flex-grow flex flex-col font-sans">
                                                <h4 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider pb-2 border-b border-neutral-850 flex justify-between items-center">
                                                    <span>👥 Collaborative Feed</span>
                                                    <span className="bg-neutral-800 text-neutral-400 font-mono px-2 py-0.5 rounded text-[9px]">{documentAnnotations.length} Comments</span>
                                                </h4>
                                                <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                                                    {documentAnnotations.map((item) => (
                                                        <div key={item.id} className="bg-black/40 border border-neutral-850 p-3 rounded-lg space-y-2 relative group hover:border-neutral-750 transition-all font-sans">
                                                            {/* Delete button (only for the comment author) */}
                                                            {auth.currentUser?.uid === item.authorUid && (
                                                                <button
                                                                    onClick={() => handleDeleteAnnotation(item.id)}
                                                                    className="absolute right-2 top-2 text-rose-500 hover:text-rose-400 text-xs px-1.5 py-0.5 rounded hover:bg-rose-950/20 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                                    title="Delete annotation"
                                                                >
                                                                    ✕
                                                                </button>
                                                            )}
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] font-bold text-neutral-200">{item.authorName}</span>
                                                                    <span className="text-[8px] font-mono text-neutral-500">{new Date(item.createdAt).toLocaleDateString()}</span>
                                                                </div>
                                                                <p className="text-[10px] font-mono text-neutral-400 italic bg-black/25 px-2 py-1 rounded border-l-2 border-neutral-750 max-h-16 overflow-y-auto">
                                                                    "{item.highlightedText}"
                                                                </p>
                                                            </div>
                                                            <p className="text-xs text-neutral-300 leading-relaxed font-sans select-text">{item.comment}</p>
                                                            {item.mentions && item.mentions.length > 0 && (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {item.mentions.map((m: string) => (
                                                                        <span key={m} className="text-[8px] font-mono font-bold bg-purple-950/40 text-purple-400 px-1.5 py-0.5 rounded border border-purple-900/20">
                                                                            @{m}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {documentAnnotations.length === 0 && (
                                                        <div className="py-6 text-center text-xs text-neutral-500 italic">
                                                            No collaborative notes left on this document segment.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* TAB CONTENT: Semantic Citation Index */}
                                        {modalSidebarTab === 'citations' && (
                                            <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4 space-y-3 flex-grow flex flex-col font-sans">
                                                <h4 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider pb-2 border-b border-neutral-850 flex justify-between items-center">
                                                    <span>🔍 Semantic Lore Citations</span>
                                                    <span className="bg-neutral-800 text-neutral-400 font-mono px-2 py-0.5 rounded text-[9px]">Cite & Focus</span>
                                                </h4>
                                                <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                                                    {(() => {
                                                        const knownEntities = Array.from(new Set([
                                                            ...agents.map(a => a.name),
                                                            ...tripletEdges.flatMap(e => [e.s.trim(), e.o.trim()]).filter(s => s && s.length > 2)
                                                        ]));
                                                        const detectedCitations = knownEntities.filter(entity => {
                                                            const escaped = entity.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                                                            const regex = new RegExp(`\\b${escaped}\\b`, 'i');
                                                            return regex.test(previewDoc.content || '');
                                                        });

                                                        return detectedCitations.map((entity) => {
                                                            const associatedFacts = tripletEdges.filter(e => 
                                                                e.s.toLowerCase() === entity.toLowerCase() || 
                                                                e.o.toLowerCase() === entity.toLowerCase()
                                                            );
                                                            return (
                                                                <div 
                                                                    key={entity} 
                                                                    onClick={() => {
                                                                        setPreviewDoc(prev => prev ? { ...prev, highlightText: entity } : null);
                                                                    }}
                                                                    className="bg-black/40 border border-neutral-850 hover:border-blue-500/40 p-3 rounded-lg space-y-2 cursor-pointer hover:bg-neutral-950/20 transition-all font-sans"
                                                                >
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-xs font-black text-blue-400 font-mono">✦ {entity}</span>
                                                                        <span className="text-[8px] bg-blue-950/30 text-blue-300 px-1.5 py-0.5 rounded border border-blue-900/20 font-bold uppercase">
                                                                            {agents.some(a => a.name === entity) ? 'Character' : 'Lore Entry'}
                                                                        </span>
                                                                    </div>
                                                                    {associatedFacts.length > 0 ? (
                                                                        <div className="space-y-1">
                                                                            <span className="text-[8px] uppercase font-black text-neutral-500 tracking-widest block">Linked Relations:</span>
                                                                            <div className="space-y-1">
                                                                                {associatedFacts.slice(0, 3).map((f, fIdx) => (
                                                                                    <div key={fIdx} className="text-[9px] text-neutral-400 font-mono truncate leading-normal">
                                                                                        <strong className="text-neutral-300 font-bold">{f.s}</strong> &rarr; <span className="text-purple-400">{f.p}</span> &rarr; <strong className="text-neutral-300 font-bold">{f.o}</strong>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-[9px] text-neutral-500 italic">No connected relational graph edges detected.</p>
                                                                    )}
                                                                </div>
                                                            );
                                                        });
                                                    })()}
                                                    {(() => {
                                                        const knownEntities = Array.from(new Set([
                                                            ...agents.map(a => a.name),
                                                            ...tripletEdges.flatMap(e => [e.s.trim(), e.o.trim()]).filter(s => s && s.length > 2)
                                                        ]));
                                                        const detectedCitations = knownEntities.filter(entity => {
                                                            const escaped = entity.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                                                            const regex = new RegExp(`\\b${escaped}\\b`, 'i');
                                                            return regex.test(previewDoc.content || '');
                                                        });
                                                        return detectedCitations.length === 0;
                                                    })() && (
                                                        <div className="py-6 text-center text-xs text-neutral-500 italic">
                                                            No known characters or lore entries mentioned in this document segment.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                         )}

                                         {/* TAB CONTENT: Document Revisions & Snapshots */}
                                         {modalSidebarTab === 'versions' && (
                                             <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4 space-y-3 flex-grow flex flex-col font-sans">
                                                 <h4 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider pb-2 border-b border-neutral-850 flex justify-between items-center">
                                                     <span>⏳ Revisions Archive</span>
                                                     <span className="bg-neutral-800 text-neutral-400 font-mono px-2 py-0.5 rounded text-[9px]">{docVersions.length} Versions</span>
                                                 </h4>
                                                 <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar pr-1 animate-scale-up">
                                                     {docVersions.map((v) => (
                                                         <div key={v.id} className="bg-black/40 border border-neutral-850 p-3 rounded-lg space-y-2 hover:border-neutral-755 transition-all font-sans relative">
                                                             <div className="flex justify-between items-center">
                                                                 <span className="text-[10px] font-black text-amber-400 font-mono">Snapshot Version {v.version}</span>
                                                                 <span className="text-[8px] font-mono text-neutral-500">{new Date(v.timestamp).toLocaleDateString()} {new Date(v.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                             </div>
                                                             <p className="text-[11px] text-neutral-300 leading-normal font-sans italic bg-black/20 p-2 rounded border-l border-neutral-800">
                                                                 "{v.comment}"
                                                             </p>
                                                             <div className="flex justify-end pt-1">
                                                                 {v.version === docVersions[0]?.version ? (
                                                                     <span className="text-[9px] text-green-400 font-bold uppercase tracking-wider font-mono bg-green-950/20 px-2 py-0.5 rounded border border-green-900/20">
                                                                         ✓ Current Live Version
                                                                     </span>
                                                                 ) : (
                                                                     <button
                                                                         onClick={() => handleRestoreDocVersion(v)}
                                                                         className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 bg-blue-950/40 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-900/30 hover:border-blue-500 rounded-lg transition-all cursor-pointer font-mono"
                                                                     >
                                                                         Restore Version {v.version} &larr;
                                                                     </button>
                                                                 )}
                                                             </div>
                                                         </div>
                                                     ))}
                                                     {docVersions.length === 0 && (
                                                         <div className="py-6 text-center text-xs text-neutral-500 italic">
                                                             No historical snapshots captured for this document.
                                                         </div>
                                                     )}

                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex justify-between items-center bg-neutral-950 px-6 py-4 border-t border-neutral-800 text-[10px] font-mono text-neutral-500 uppercase tracking-wider flex-shrink-0">
                            <div className="flex gap-4">
                                <span>Characters: <strong className="text-neutral-300 font-bold">{previewDoc.content?.length || 0}</strong></span>
                                <span>Words: <strong className="text-neutral-300 font-bold">{previewDoc.content ? previewDoc.content.trim().split(/\s+/).filter(Boolean).length : 0}</strong></span>
                            </div>
                            <button
                                onClick={() => setPreviewDoc(null)}
                                className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white font-black rounded-lg transition-all border border-neutral-700"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CREATE FOLDER MODAL */}
            {showCreateCollectionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-scale-up">
                        <div className="flex justify-between items-center pb-2 border-b border-neutral-800">
                            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                                <span>📁</span> Create Document Collection
                            </h3>
                            <button onClick={() => { setShowCreateCollectionModal(false); setNewCollectionName(''); }} className="text-neutral-500 hover:text-white">✕</button>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Collection Folder Name</label>
                            <input
                                type="text"
                                value={newCollectionName}
                                onChange={e => setNewCollectionName(e.target.value)}
                                placeholder="e.g. Lore, Script Notes, Visual Assets..."
                                className="w-full bg-black border border-neutral-750 rounded-xl p-3 text-xs text-white placeholder-neutral-500 outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="flex gap-2 pt-2 justify-end">
                            <button
                                onClick={() => { setShowCreateCollectionModal(false); setNewCollectionName(''); }}
                                className="px-4 py-2 text-xs font-bold text-neutral-400 bg-neutral-800 rounded-lg hover:bg-neutral-750 border border-neutral-700"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (newCollectionName.trim()) {
                                        setCustomCollections(prev => Array.from(new Set([...prev, newCollectionName.trim()])));
                                        setActiveCollection(newCollectionName.trim());
                                        setNewCollectionName('');
                                        setShowCreateCollectionModal(false);
                                    }
                                }}
                                disabled={!newCollectionName.trim()}
                                className="px-4 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-md"
                            >
                                Create Folder
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MOVE DOCUMENT TO FOLDER MODAL */}
            {showMoveModal && movingSource && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-scale-up">
                        <div className="flex justify-between items-center pb-2 border-b border-neutral-800">
                            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                                <span>📁</span> Move Document to Folder
                            </h3>
                            <button onClick={() => { setShowMoveModal(false); setMovingSource(null); }} className="text-neutral-500 hover:text-white">✕</button>
                        </div>
                        <div className="space-y-3">
                            <p className="text-xs text-neutral-400">
                                Select a folder target for: <strong className="text-neutral-200 font-mono font-bold break-all">{movingSource}</strong>
                            </p>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                                {Array.from(new Set(['Root Documents', 'Scripts', 'Character Profiles', 'World Building', 'Reference Documents', ...customCollections, ...vectors.map(v => v.metadata?.collection).filter(Boolean) as string[]])).map(folderName => (
                                    <button
                                        key={folderName}
                                        onClick={() => handleMoveSourceToCollection(movingSource, folderName)}
                                        className="w-full text-left p-2.5 rounded-lg text-xs font-mono text-neutral-300 hover:text-white hover:bg-neutral-800 border border-neutral-850 hover:border-neutral-700 transition-all flex items-center gap-2"
                                    >
                                        <span>📁</span>
                                        <span className="truncate">{folderName}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex pt-2 justify-end">
                            <button
                                onClick={() => { setShowMoveModal(false); setMovingSource(null); }}
                                className="px-4 py-2 text-xs font-bold text-neutral-400 bg-neutral-800 rounded-lg hover:bg-neutral-750 border border-neutral-700"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* BULK MOVE DOCUMENTS MODAL */}
            {showBulkMoveModal && selectedSources.length > 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-scale-up">
                        <div className="flex justify-between items-center pb-2 border-b border-neutral-800">
                            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                                <span>📁</span> Bulk Move ({selectedSources.length}) Documents
                            </h3>
                            <button onClick={() => setShowBulkMoveModal(false)} className="text-neutral-500 hover:text-white">✕</button>
                        </div>
                        <div className="space-y-3">
                            <p className="text-xs text-neutral-400">
                                Select a target folder to move all <strong className="text-neutral-200">{selectedSources.length}</strong> selected documents:
                            </p>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                                {Array.from(new Set(['Root Documents', 'Scripts', 'Character Profiles', 'World Building', 'Reference Documents', ...customCollections, ...vectors.map(v => v.metadata?.collection).filter(Boolean) as string[]])).map(folderName => (
                                    <button
                                        key={folderName}
                                        onClick={() => handleBulkMove(folderName)}
                                        className="w-full text-left p-2.5 rounded-lg text-xs font-mono text-neutral-300 hover:text-white hover:bg-neutral-800 border border-neutral-850 hover:border-neutral-700 transition-all flex items-center gap-2 cursor-pointer"
                                    >
                                        <span>📁</span>
                                        <span className="truncate">{folderName}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex pt-2 justify-end">
                            <button
                                onClick={() => setShowBulkMoveModal(false)}
                                className="px-4 py-2 text-xs font-bold text-neutral-400 bg-neutral-800 rounded-lg hover:bg-neutral-750 border border-neutral-700"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* BULK TAG DOCUMENTS MODAL */}
            {showBulkTagModal && selectedSources.length > 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-scale-up font-sans">
                        <div className="flex justify-between items-center pb-2 border-b border-neutral-800">
                            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                                <span>🏷</span> Bulk Tag ({selectedSources.length}) Documents
                            </h3>
                            <button onClick={() => { setShowBulkTagModal(false); setBulkTagsInput(''); }} className="text-neutral-500 hover:text-white">✕</button>
                        </div>
                        <div className="space-y-3">
                            <p className="text-xs text-neutral-400">
                                Enter metadata tags (comma-separated) to apply to all <strong className="text-neutral-200">{selectedSources.length}</strong> selected documents simultaneously:
                            </p>
                            <input
                                type="text"
                                value={bulkTagsInput}
                                onChange={e => setBulkTagsInput(e.target.value)}
                                placeholder="e.g. character, plot, important, season1..."
                                className="w-full bg-black border border-neutral-750 rounded-xl p-3 text-xs text-white placeholder-neutral-500 outline-none focus:border-blue-500"
                            />
                            <p className="text-[10px] text-neutral-500 italic">Separate multiple tags with commas. New tags will merge with any existing document tags.</p>
                        </div>
                        <div className="flex gap-2 pt-2 justify-end">
                            <button
                                onClick={() => { setShowBulkTagModal(false); setBulkTagsInput(''); }}
                                className="px-4 py-2 text-xs font-bold text-neutral-400 bg-neutral-800 rounded-lg hover:bg-neutral-750 border border-neutral-700"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBulkTag}
                                disabled={!bulkTagsInput.trim()}
                                className="px-4 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-md cursor-pointer"
                            >
                                Apply Tags
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
