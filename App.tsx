

import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { DashboardStudio } from './components/DashboardStudio';
import { ProjectsStudio } from './components/ProjectsStudio';
import { AutomationStudio } from './components/AutomationStudio';
import { DirectorStudio } from './modules/director/DirectorStudio';
import { ScriptWriterStudio } from './components/ScriptWriterStudio';
import { ImageGeneratorStudio } from './components/ImageGeneratorStudio';
import { Veo3Studio } from './components/Veo3Studio';
import { NanoBananaStudio } from './components/NanoBananaStudio';
import { LyriaStudio } from './components/LyriaStudio';
import { ComposerStudio } from './components/ComposerStudio';
import { BiggerPicsStudio } from './components/BiggerPicsStudio';
import { LoadingSpinner } from './components/icons.tsx';
import { MythosCinematicStudio } from './components/MythosCinematicStudio';
import { SimpleCinematicStudio } from './components/SimpleCinematicStudio';
import { GenerativeVideoStudio } from './components/GenerativeVideoStudio';
import { LTXStudio } from './components/LTXStudio';
import { TransitionStudio } from './components/TransitionStudio';
import { CameraMovementStudio } from './components/CameraMovementStudio';
import { CameraMovesStudio } from './components/CameraMovesStudio';
import { BlenderStudio } from './components/BlenderStudio';
import { SceneCompositorStudio } from './components/SceneCompositorStudio';
import { CompositeStudio } from './components/CompositeStudio';
import { FaceSwapStudio } from './components/FaceSwapStudio';
import { FaceRepairStudio } from './components/FaceRepairStudio';
import { PhotorealismStudio } from './components/PhotorealismStudio';
import { ResizeStudio } from './components/ResizeStudio';
import { GreenScreenStudio } from './components/GreenScreenStudio';
import { BackgroundRemovalStudio } from './components/BackgroundRemovalStudio';
import { QwenImageEditStudio } from './components/QwenImageEditStudio';
import { TopazStudio } from './components/TopazStudio';
import { ImageGrid } from './components/ImageGrid';
import { Storyboard } from './components/Storyboard';
import { InspirationBoard } from './components/InspirationBoard';
import { ScriptViewer } from './components/ScriptViewer';
import { CharactersStudio } from './components/CharactersStudio';
import { LoreStudio } from './components/LoreStudio';
import { PromptLibraryStudio } from './components/PromptLibraryStudio';
import { DynamicPromptsStudio } from './components/DynamicPromptsStudio';
import { AgentChatStudio } from './components/AgentChatStudio';
import { KnowledgeView } from './components/KnowledgeView';
import { ModelSettingsStudio } from './components/ModelSettingsStudio';
import { GenericAgentStudio } from './components/GenericAgentStudio';
import { CoreStudio } from './components/CoreStudio';
import { IdeationStudio } from './components/IdeationStudio';
import { ScriptingStudio } from './components/ScriptingStudio';
import { DesignStudio } from './components/DesignStudio';
import { ArtStudio } from './components/ArtStudio';
import { RosterStudio } from './components/RosterStudio';
import { VoiceLab } from './components/VoiceLab.tsx';
import { ImageModal } from './components/ImageModal.tsx';
import { LiveStudio } from './components/LiveStudio.tsx';
import { TranscriptionStudio } from './components/TranscriptionStudio.tsx';
import { Agent, Project, ActiveView, ImageState } from './types';
import { getHfApiKey, getTopazApiKey, saveHfApiKey, saveTopazApiKey, getVoiceLabUrl, saveVoiceLabUrl, getDolphinUrl, saveDolphinUrl, getCinematicCoreUrl, saveCinematicCoreUrl, getCameraDollyUrl, saveCameraDollyUrl } from './services/apiKeyService';
import { getAnimAgentsTeam } from './services/agentService';
import { vectorDb } from './services/vectorDbService';
import { TeamStudio } from './components/TeamStudio.tsx';
import { WanimateStudio } from './components/WanimateStudio.tsx';
import { StudioHeader } from './components/StudioHeader.tsx';
import { SaveStatus } from './components/AutoSaveIndicator.tsx';
import { DubbingStudio } from './components/DubbingStudio.tsx';
import { factoryService as lorepackService } from './services/lorepack.ts';
import { AgentChatView } from './components/AgentChatView.tsx';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './services/firebase';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where, onSnapshot } from 'firebase/firestore';

const DEFAULT_PROJECT_ID = 'project-alpha';

const INITIAL_PROJECT: Project = {
    id: DEFAULT_PROJECT_ID,
    name: 'New MythOS Production',
    tagline: 'Film, TV, Audio & Digital Content Creation.',
    progress: 0,
    data: {
        images: [],
        storyboard: [],
        scriptText: '',
        scriptsBin: [],
        inspirationImages: [],
        blenderImages: [],
        blenderResult: null,
        sceneCompositorState: { background: null, character: null, result: null },
        compositeState: { refImage1: null, refImage2: null, task1: 'ip', task2: 'ip', prompt: '', negativePrompt: '', width: 1024, height: 1024, seed: 0, randomizeSeed: true, resultImage: null, resultVideoUrl: null },
        faceSwapState: { source: null, face: null, result: null },
        faceRepairState: { source: null, result: null },
        photorealismState: { source: null, result: null, prompt: '', negativePrompt: '' },
        resizeState: { source: null, result: null, width: 1024, height: 1024, prompt: '', alignment: 'Middle', overlap: 50, steps: 50, directions: { left: false, right: false, top: false, bottom: false } },
        greenScreenState: { source: null, resultUrl: null },
        backgroundRemovalState: { source: null, result: null },
        qwenImageEditState: { images: [null, null, null, null, null, null], result: null, prompt: '', negativePrompt: '', cfgScale: 4.0, seed: 0, randomizeSeed: true, width: 1024, height: 1024, steps: 25 },
        generativeVideoState: { 
            image: null, 
            resultUrl: null, 
            seed: 42, 
            randomizeSeed: true, 
            motionBucketId: 127, 
            cfgScale: 2.5,
            steps: 25,
        },
        ltxStudioState: {
            prompt: 'Make this image come alive with cinematic motion, smooth animation', 
            image: null, 
            resultUrl: null, 
            duration: 3, 
            seed: 42, 
            randomizeSeed: true, 
            width: 768, 
            height: 512, 
            enhancePrompt: true
        },
        cameraMovementState: { source: null, prompt: '', negativePrompt: '', movementType: '', steps: 25, guidanceScale: 7.5, seed: 0, randomizeSeed: true, resultUrl: null },
        cameraMovesState: { sourceVideo: null, prompt: 'A cinematic camera move around the subject', cameraType: '1', steps: 20, resultUrl: null },
        transitionState: { startImage: null, endImage: null, prompt: '', negativePrompt: '', duration: 4, steps: 25, guidanceScale: 7.5, guidanceScale2: 7.5, seed: 0, randomizeSeed: true, resultUrl: null },
        topazState: { activeMediaType: 'image', source: null, result: null, resultUrl: null, operation: 'enhance', parameters: { scale: 2, strength: 50 }, faceRecovery: true },
        directorState: {},
        agents: getAnimAgentsTeam(),
        studioPlayers: [],
        characters: [],
        lore: [],
        dynamicPromptLists: [],
        promptTemplates: [],
        automationConfig: { ragEnabled: false, ragProvider: 'browser', ragApiKey: '', ragBaseUrl: '', ragKnowledgeBoxId: '', ragLocalhostUrl: '', webhookUrls: [] },
        wanimateState: {
            inputImage: null,
            lastImage: null,
            prompt: "make this image come alive, cinematic motion, smooth animation",
            steps: 6,
            negativePrompt: "static, details fuzzy, subtitles, style, artwork, painting, still image, worst quality, low quality, JPEG artifacts, ugly, deformed, extra fingers, poorly drawn hands, poorly drawn faces, malformed, disfigured, malformed limbs, fused fingers, motionless image, cluttered background",
            durationSeconds: 10,
            guidanceScale: 1,
            guidanceScale2: 1,
            seed: 42,
            randomizeSeed: true,
            quality: 6,
            scheduler: 'UniPCMultistep',
            flowShift: 3,
            frameMultiplier: '16',
            resultUrl: null,
        },
        dubbingState: {
            sourceVideo: null,
            sourceAudio: null,
            resultUrl: null,
        },
    // FIX: 'string' is a type, not a value. Initialized to an empty string.
        mythosPrompt: '',
        lyriaTracks: [],
        composerTracks: [],
        transcripts: [],
    }
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });

export const App = () => {
    const [activeView, setActiveView] = useState<ActiveView>('dashboard');
    const [activeProjectId, setActiveProjectId] = useState<string>(DEFAULT_PROJECT_ID);
    const [projects, setProjects] = useState<Project[]>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch (e) {
            console.error("Failed to parse initial projects from localStorage", e);
        }
        return [INITIAL_PROJECT];
    });
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const [viewingImage, setViewingImage] = useState<ImageState | null>(null);
    const [chatModalState, setChatModalState] = useState<{ isOpen: boolean; agent: Agent | null; initialMode: 'chat' | 'call' }>({
        isOpen: false,
        agent: null,
        initialMode: 'chat'
    });
    
    // Real-time sliding Toast Notification System for Factual Contradictions
    const [activeToastDiscrepancy, setActiveToastDiscrepancy] = useState<any | null>(null);
    const appLoadTimeRef = useRef<number>(Date.now());
    const [agentFilter, setAgentFilter] = useState<string>('');

    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
    const [lastSavedTime, setLastSavedTime] = useState<Date | null>(new Date());
    const isInitialLoadRef = React.useRef(true);

    // Global hands-free voice command listener states
    const [voiceAssistantActive, setVoiceAssistantActive] = useState<boolean>(false);
    const [lastSpokenCommand, setLastSpokenCommand] = useState<string>('');
    const [flashVoiceCommand, setFlashVoiceCommand] = useState<boolean>(false);
    const [isVoiceRecording, setIsVoiceRecording] = useState<boolean>(false);
    const [recordingSeconds, setRecordingSeconds] = useState<number>(0);

    const voiceRecorderRef = useRef<MediaRecorder | null>(null);
    const voiceChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<any>(null);

    // Audio recording seconds tracker
    useEffect(() => {
        if (isVoiceRecording) {
            setRecordingSeconds(0);
            recordingTimerRef.current = setInterval(() => {
                setRecordingSeconds(prev => prev + 1);
            }, 1000);
        } else {
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
            }
        }
        return () => {
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        };
    }, [isVoiceRecording]);

    // Real-time Toast Notifications for Newly Detected Factual Contradictions
    useEffect(() => {
        const q = query(collection(db, 'discrepancies'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            let newlyDetected: any = null;
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    const createdTime = new Date(data.createdAt || 0).getTime();
                    // Only trigger if the document was created after the app was loaded
                    if (createdTime > appLoadTimeRef.current) {
                        newlyDetected = { id: change.doc.id, ...data };
                    }
                }
            });

            if (newlyDetected) {
                setActiveToastDiscrepancy(newlyDetected);
                // Play warning sound
                try {
                    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    oscillator.type = 'sine';
                    oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
                    gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
                    oscillator.start();
                    oscillator.stop(audioContext.currentTime + 0.15);
                } catch (e) {
                    console.warn("Sound play blocked by user interaction gesture requirement.");
                }
            }
        }, (error) => {
            console.error("Factual integrity toast subscription failed:", error);
        });

        return () => unsubscribe();
    }, []);

    const triggerStartVoiceRecording = async () => {
        if (isVoiceRecording) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            voiceRecorderRef.current = recorder;
            voiceChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    voiceChunksRef.current.push(e.data);
                }
            };

            recorder.onstop = async () => {
                const blob = new Blob(voiceChunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64Data = (reader.result as string).split(',')[1];
                    const nextProj = projects.map(p => {
                        if (p.id === activeProjectId) {
                            const newTranscript = {
                                id: `transcript_${Date.now()}`,
                                title: `Hands-Free Audio Session - ${new Date().toLocaleTimeString()}`,
                                base64Audio: base64Data,
                                transcript: "Hands-free audio recording. Use Gemini on transcription studio to extract contents.",
                                type: "mic" as const,
                                timestamp: Date.now()
                            };
                            return {
                                ...p,
                                data: {
                                    ...p.data,
                                    transcripts: [...(p.data.transcripts || []), newTranscript]
                                }
                            };
                        }
                        return p;
                    });
                    setProjects(nextProj);
                };
                reader.readAsDataURL(blob);

                // Stop mic track
                stream.getTracks().forEach(track => track.stop());
            };

            recorder.start();
            setIsVoiceRecording(true);
        } catch (err) {
            console.error("Failed to initiate voice recording stream:", err);
            alert("Mic hardware failed or permission denied.");
        }
    };

    const triggerStopVoiceRecording = () => {
        if (!isVoiceRecording || !voiceRecorderRef.current) return;
        try {
            voiceRecorderRef.current.stop();
            setIsVoiceRecording(false);
        } catch (e) {
            console.error("Failed to stop voice recording stream:", e);
        }
    };

    // Web Speech API recognition listener
    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
            const lastIndex = event.results.length - 1;
            const transcript = event.results[lastIndex][0].transcript.trim().toLowerCase();
            console.log("[HANDS-FREE TRIGGER]:", transcript);

            // Command parsing router
            let matched = true;
            if (transcript.includes('dashboard')) {
                setActiveView('dashboard');
                setLastSpokenCommand("Take me to Dashboard");
            } else if (transcript.includes('lore') || transcript.includes('go to lore')) {
                setActiveView('lore');
                setLastSpokenCommand("Take me to Lore Studio");
            } else if (transcript.includes('characters')) {
                setActiveView('characters');
                setLastSpokenCommand("Take me to Characters");
            } else if (transcript.includes('prompt library') || transcript.includes('go to prompt')) {
                setActiveView('prompt-library');
                setLastSpokenCommand("Take me to Prompt Library");
            } else if (transcript.includes('settings')) {
                setActiveView('model-settings');
                setLastSpokenCommand("Take me to Settings");
            } else if (transcript.includes('transcription')) {
                setActiveView('transcription-studio');
                setLastSpokenCommand("Take me to Transcription");
            } else if (transcript.includes('voice lab') || transcript.includes('voice-lab')) {
                setActiveView('voice-lab');
                setLastSpokenCommand("Take me to Voice Lab");
            } else if (transcript.includes('dubbing')) {
                setActiveView('dubbing-studio');
                setLastSpokenCommand("Take me to Dubbing Studio");
            } else if (transcript.includes('vault') || transcript.includes('assets') || transcript.includes('grid')) {
                setActiveView('grid');
                setLastSpokenCommand("Take me to Asset Vault");
            } else if (transcript.includes('scripts')) {
                setActiveView('scripts-bin');
                setLastSpokenCommand("Take me to Scripts Bin");
            } else if (transcript.includes('team')) {
                setActiveView('team');
                setLastSpokenCommand("Take me to Team");
            } else if (transcript.includes('start recording')) {
                triggerStartVoiceRecording();
                setLastSpokenCommand("Start Recording Session");
            } else if (transcript.includes('stop recording')) {
                triggerStopVoiceRecording();
                setLastSpokenCommand("Stop Recording Session");
            } else {
                matched = false;
            }

            if (matched) {
                setFlashVoiceCommand(true);
                const timer = setTimeout(() => setFlashVoiceCommand(false), 3000);
                return () => clearTimeout(timer);
            }
        };

        recognition.onerror = (err: any) => {
            console.error("Speech Recognition Error:", err);
        };

        recognition.onend = () => {
            if (voiceAssistantActive) {
                try {
                    recognition.start();
                } catch (e) {
                    // Ignore restart collision
                }
            }
        };

        if (voiceAssistantActive) {
            try {
                recognition.start();
            } catch (e) {
                console.error("Failed to start speech recognition:", e);
            }
        } else {
            try {
                recognition.stop();
            } catch (e) {
                // Ignore
            }
        }

        return () => {
            try {
                recognition.stop();
            } catch (e) {
                // Ignore
            }
        };
    }, [voiceAssistantActive, activeProjectId, projects]);

    const [user, setUser] = useState<any>(null);
    const [authLoading, setAuthLoading] = useState(true);

    const STORAGE_KEY = 'mythos_projects_v2';

    // Firebase Auth and Firestore Initialization
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);
                setAuthLoading(true);
                try {
                    // Sync user profile information to Firestore safely
                    const userDocRef = doc(db, 'users', firebaseUser.uid);
                    const userDocSnap = await getDoc(userDocRef);
                    
                    if (!userDocSnap.exists()) {
                        await setDoc(userDocRef, {
                            uid: firebaseUser.uid,
                            email: firebaseUser.email || '',
                            displayName: firebaseUser.displayName || '',
                            createdAt: new Date().toISOString()
                        });
                    } else {
                        const existingData = userDocSnap.data();
                        const nextEmail = firebaseUser.email || '';
                        const nextDisplayName = firebaseUser.displayName || '';
                        if (existingData?.email !== nextEmail || existingData?.displayName !== nextDisplayName) {
                            await setDoc(userDocRef, {
                                email: nextEmail,
                                displayName: nextDisplayName
                            }, { merge: true });
                        }
                    }

                    // Fetch user's projects from Firestore
                    const pRef = collection(db, 'users', firebaseUser.uid, 'projects');
                    const snapshot = await getDocs(pRef);
                    
                    if (!snapshot.empty) {
                        const fetchedProjects: Project[] = [];
                        snapshot.forEach((docSnapshot) => {
                            fetchedProjects.push(docSnapshot.data() as Project);
                        });
                        setProjects(fetchedProjects);
                    } else {
                        // If Firestore is empty, seed with initial project
                        const initialProj = { ...INITIAL_PROJECT, userId: firebaseUser.uid };
                        await setDoc(doc(db, 'users', firebaseUser.uid, 'projects', initialProj.id), initialProj);
                        setProjects([initialProj]);
                    }
                } catch (error) {
                    console.error("Error connecting or synchronizing with Firestore:", error);
                    // Fallback to local storage
                    const stored = localStorage.getItem(STORAGE_KEY);
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            setProjects(parsed);
                        }
                    }
                } finally {
                    setAuthLoading(false);
                }
            } else {
                setUser(null);
                setAuthLoading(false);
                // Ensure local storage projects are restored for offline/local session
                const stored = localStorage.getItem(STORAGE_KEY);
                if (stored) {
                    try {
                        const parsed = JSON.parse(stored);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            setProjects(parsed);
                        }
                    } catch (e) {
                        console.error("Local storage project restore failed:", e);
                    }
                }
            }
        });

        // Set up periodic sync
        const syncInterval = setInterval(() => {
            lorepackService.syncLorepackToServer().catch(() => {});
        }, 5 * 60 * 1000);

        lorepackService.syncLorepackToServer().catch(() => {});

        return () => {
            unsubscribe();
            clearInterval(syncInterval);
        };
    }, []);

    // Auto-save whenever projects state changes to both LocalStorage and Firestore
    useEffect(() => {
        if (isInitialLoadRef.current) {
            isInitialLoadRef.current = false;
            return;
        }

        setSaveStatus('saving');

        const timer = setTimeout(async () => {
            try {
                // ALWAYS Save to localStorage to persist lore, characters, and project data across sessions
                localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
                
                // If user is authenticated with Firebase, also persist to Firestore
                if (user) {
                    for (const proj of projects) {
                        const projectWithUser = { ...proj, userId: user.uid, updatedAt: new Date().toISOString() };
                        try {
                            await setDoc(doc(db, 'users', user.uid, 'projects', proj.id), projectWithUser);
                        } catch (fsError) {
                            handleFirestoreError(fsError, OperationType.WRITE, `users/${user.uid}/projects/${proj.id}`);
                        }
                    }
                }
                
                lorepackService.syncLorepackToServer().catch(() => {});
                setLastSavedTime(new Date());
                setSaveStatus('saved');
            } catch (err) {
                console.error('Auto-save error:', err);
                setSaveStatus('error');
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [projects, user]);

    const handleGoogleSignIn = async () => {
        setAuthLoading(true);
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Google login failed:", error);
            alert("Authentication failed. Please verify your internet connection.");
        } finally {
            setAuthLoading(false);
        }
    };

    const handleSignOut = async () => {
        setAuthLoading(true);
        try {
            await signOut(auth);
            setProjects([INITIAL_PROJECT]);
            setActiveView('dashboard');
        } catch (error) {
            console.error("Sign out failed:", error);
        } finally {
            setAuthLoading(false);
        }
    };

    const handleRetrySave = async () => {
        if (!user) return;
        setSaveStatus('saving');
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
            for (const proj of projects) {
                const projectWithUser = { ...proj, userId: user.uid, updatedAt: new Date().toISOString() };
                await setDoc(doc(db, 'users', user.uid, 'projects', proj.id), projectWithUser);
            }
            lorepackService.syncLorepackToServer().catch(() => {});
            setLastSavedTime(new Date());
            setSaveStatus('saved');
        } catch (err) {
            setSaveStatus('error');
        }
    };

    const project = projects.find(p => p.id === activeProjectId) || projects[0];

    const updateProjectData = (updates: Partial<typeof project.data>) => {
        setProjects(prev => prev.map(p => 
            p.id === activeProjectId 
                ? { ...p, data: { ...p.data, ...updates } } 
                : p
        ));
    };

    const handleAddAssetToGrid = (asset: { type: 'image' | 'video'; base64?: string; url?: string; mimeType?: string; metadata?: any, agentId?: string }, targetProjectId?: string) => {
        const pid = targetProjectId || activeProjectId;
        const newAssetId = `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const newAsset: ImageState = {
            id: newAssetId,
            type: asset.type,
            base64: asset.base64,
            url: asset.url,
            mimeType: asset.mimeType,
            metadata: asset.metadata,
            agentId: asset.agentId,
            tags: []
        };

        // Add asset to the project state
        setProjects(prev => prev.map(p => {
            if (p.id === pid) {
                if (asset.agentId) {
                    // Find the agent and add the asset to their private media gallery
                    const updatedAgents = p.data.agents.map(agent => {
                        if (agent.id === asset.agentId) {
                            return {
                                ...agent,
                                media: [newAsset, ...(agent.media || [])]
                            };
                        }
                        return agent;
                    });
                    return { ...p, data: { ...p.data, agents: updatedAgents } };
                } else {
                    // Add to the global project vault
                    return { ...p, data: { ...p.data, images: [newAsset, ...p.data.images] } };
                }
            }
            return p;
        }));

        // Run AI Auto-tagging in background if asset has base64 or url
        if (asset.base64 || asset.url) {
            fetch('/api/auto-tag', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    base64: asset.base64,
                    url: asset.url,
                    mimeType: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg')
                })
            })
            .then(res => {
                if (!res.ok) throw new Error("Auto-tagging endpoint returned error");
                return res.json();
            })
            .then(data => {
                if (data && Array.isArray(data.tags)) {
                    // Inject tags into the image in state
                    setProjects(prev => prev.map(p => {
                        if (p.id === pid) {
                            const updatedImages = p.data.images.map(img => 
                                img.id === newAssetId ? { ...img, tags: data.tags } : img
                            );
                            const updatedAgents = p.data.agents.map(agent => {
                                if (agent.media) {
                                    const hasMedia = agent.media.some(img => img.id === newAssetId);
                                    if (hasMedia) {
                                        return {
                                            ...agent,
                                            media: agent.media.map(img => 
                                                img.id === newAssetId ? { ...img, tags: data.tags } : img
                                            )
                                        };
                                    }
                                }
                                return agent;
                            });
                            return {
                                ...p,
                                data: {
                                    ...p.data,
                                    images: updatedImages,
                                    agents: updatedAgents
                                }
                            };
                        }
                        return p;
                    }));
                }
            })
            .catch(err => {
                console.error("Failed to auto-tag added image:", err);
            });
        }
    };

    const handleAddToStoryboard = (base64: string) => {
        const newFrame = {
            id: `frame_${Date.now()}`,
            base64Image: base64,
            notes: ''
        };
        updateProjectData({ storyboard: [...project.data.storyboard, newFrame] });
    };

    const handleAddToInspiration = (base64: string) => {
        const newId = `inspo_${Date.now()}`;
        const newImage = {
            id: newId,
            base64Image: base64,
            tags: []
        };
        updateProjectData({ inspirationImages: [...project.data.inspirationImages, newImage] });

        // Trigger AI background auto-tagging for uploaded files
        fetch('/api/auto-tag', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64, mimeType: 'image/png' })
        })
        .then(res => {
            if (!res.ok) throw new Error("Auto-tagging endpoint returned error");
            return res.json();
        })
        .then(data => {
            if (data && Array.isArray(data.tags)) {
                setProjects(prev => prev.map(p => {
                    if (p.id === activeProjectId) {
                        const updatedInspiration = p.data.inspirationImages.map(img => 
                            img.id === newId ? { ...img, tags: data.tags } : img
                        );
                        return {
                            ...p,
                            data: {
                                ...p.data,
                                inspirationImages: updatedInspiration
                            }
                        };
                    }
                    return p;
                }));
            }
        })
        .catch(err => {
            console.error("Failed to auto-tag inspiration image:", err);
        });
    };

    const handleNavigate = (view: ActiveView, agentId?: string) => {
        setActiveView(view);
        if (agentId) setSelectedAgentId(agentId);
    };
    
    const openChatModal = (agent: Agent, mode: 'chat' | 'call') => {
        setChatModalState({ isOpen: true, agent, initialMode: mode });
    };

    const renderContent = () => {
        const coreAgent = (id: string) => project.data.agents.find(a => a.id === id)!;
        switch (activeView) {
            case 'dashboard': return <DashboardStudio project={project} onUpdateProject={(u) => setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, ...u } : p))} images={project.data.images} stats={{ storyboardFrames: project.data.storyboard.length, agents: project.data.agents.length, loreEntries: project.data.lore.length, inspirationImages: project.data.inspirationImages.length, dynamicPromptLists: project.data.dynamicPromptLists.length, promptTemplates: project.data.promptTemplates.length, imagesGenerated: project.data.images.length, totalProjects: projects.length, scriptsCount: project.data.scriptsBin.length }} onNavigate={handleNavigate} />;
            case 'projects': return <ProjectsStudio projects={projects} activeProjectId={activeProjectId} onSelectProject={setActiveProjectId} onCreateProject={(d) => setProjects(prev => [...prev, { ...INITIAL_PROJECT, id: `proj_${Date.now()}`, name: d.name, tagline: d.tagline, thumbnail: d.thumbnail }])} onRenameProject={(id, name) => setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p))} onDeleteProject={(id) => { setProjects(prev => prev.filter(p => p.id !== id)); if (activeProjectId === id && projects.length > 1) setActiveProjectId(projects[0].id); }} />;
            case 'team': return <TeamStudio 
               agents={project.data.agents}
               images={project.data.images} 
               onUpdateAgent={(id, u) => updateProjectData({ agents: project.data.agents.map(a => a.id === id ? { ...a, ...u } : a) })} 
               onUpdateAgentAvatar={async (id, file) => { const b64 = await fileToBase64(file); updateProjectData({ agents: project.data.agents.map(a => a.id === id ? {...a, avatar: b64} : a) }) }}
               onNavigate={handleNavigate} 
               onCallAgent={(agent) => openChatModal(agent, 'call')} 
               onViewImage={setViewingImage}
               onCreateEntity={(d) => { const newAgent = { ...d, id: `agent_${Date.now()}`, media: [] } as Agent; updateProjectData({ agents: [...project.data.agents, newAgent] }); return newAgent; }}
               onDeleteEntity={(id) => updateProjectData({ agents: project.data.agents.filter(a => a.id !== id) })}
           />;
            case 'agent-workspace': return selectedAgentId ? <GenericAgentStudio agent={project.data.agents.find(a => a.id === selectedAgentId)!} onNavigate={handleNavigate} onOpenChat={(mode) => openChatModal(project.data.agents.find(a => a.id === selectedAgentId)!, mode)} /> : <div className="p-10 text-center text-neutral-500">Agent Not Found</div>;
            
            // Core Agents
            case 'core': return <CoreStudio agent={coreAgent('agent-core')} onNavigate={handleNavigate} onOpenChat={(mode) => openChatModal(coreAgent('agent-core'), mode)} />;
            case 'ideation': return <IdeationStudio agent={coreAgent('agent-ideation')} onNavigate={handleNavigate} onOpenChat={(mode) => openChatModal(coreAgent('agent-ideation'), mode)} />;
            case 'scripting': return <ScriptingStudio agent={coreAgent('agent-scripting')} onNavigate={handleNavigate} onOpenChat={(mode) => openChatModal(coreAgent('agent-scripting'), mode)} scriptText={project.data.scriptText} scriptsBin={project.data.scriptsBin} onDeleteScript={(id) => updateProjectData({ scriptsBin: project.data.scriptsBin.filter(s => s.id !== id) })} onScriptUpload={(f) => { const r = new FileReader(); r.onload = e => updateProjectData({ scriptText: e.target?.result as string }); r.readAsText(f); }} />;
            case 'design': return <DesignStudio agent={coreAgent('agent-design')} onNavigate={handleNavigate} onOpenChat={(mode) => openChatModal(coreAgent('agent-design'), mode)} />;
            case 'art': return <ArtStudio agent={coreAgent('agent-art')} onNavigate={handleNavigate} onOpenChat={(mode) => openChatModal(coreAgent('agent-art'), mode)} />;
            
            // Tools
            case 'director': return <DirectorStudio onNavigate={handleNavigate} />;
            case 'agent-chat': return <AgentChatStudio agents={project.data.agents} onUploadLore={() => {}} onCallTool={async () => ({ textResult: '' })} onAddToStoryboard={handleAddToStoryboard} onAddToInspiration={handleAddToInspiration} onAddAssetToGrid={handleAddAssetToGrid} />;
            
            // Creation
            case 'script-writer': return <ScriptWriterStudio onSendToScriptsBin={(s) => updateProjectData({ scriptsBin: [...project.data.scriptsBin, { ...s, id: `script_${Date.now()}`, date: new Date().toLocaleDateString() }] })} onNavigate={handleNavigate} promptTemplates={project.data.promptTemplates} dynamicPromptLists={project.data.dynamicPromptLists} characters={project.data.characters} lore={project.data.lore} />;
            case 'veo-3-studio': return <Veo3Studio hfToken={getHfApiKey() || ''} onAddToStoryboard={handleAddToStoryboard} onAddAssetToGrid={handleAddAssetToGrid} projects={[{ id: project.id, name: project.name }]} activeProjectId={project.id} />;
            case 'nano-banana-studio': return <NanoBananaStudio hfToken={getHfApiKey() || ''} promptTemplates={project.data.promptTemplates} dynamicPromptLists={project.data.dynamicPromptLists} agents={project.data.agents} onAddAssetToGrid={handleAddAssetToGrid} onAddToStoryboard={handleAddToStoryboard} onAddToInspiration={handleAddToInspiration} onCreateAgent={(d) => { const newAgent = { ...d, id: `agent_${Date.now()}` } as Agent; updateProjectData({ agents: [...project.data.agents, newAgent] }); return newAgent; }} />;
            case 'lyria-studio': return <LyriaStudio 
                onAddAssetToGrid={handleAddAssetToGrid} 
                savedTracks={project.data.lyriaTracks || []}
                onSaveTrack={(track) => updateProjectData({ lyriaTracks: [...(project.data.lyriaTracks || []), track] })}
                onDeleteTrack={(id) => updateProjectData({ lyriaTracks: (project.data.lyriaTracks || []).filter(t => t.id !== id) })}
            />;
            case 'composer-studio': return <ComposerStudio 
                onAddAssetToGrid={handleAddAssetToGrid} 
                savedTracks={project.data.composerTracks || []}
                onSaveTrack={(track) => updateProjectData({ composerTracks: [...(project.data.composerTracks || []), track] })}
                onDeleteTrack={(id) => updateProjectData({ composerTracks: (project.data.composerTracks || []).filter(t => t.id !== id) })}
            />;
            case 'image-generator': return <ImageGeneratorStudio hfToken={getHfApiKey() || ''} promptTemplates={project.data.promptTemplates} dynamicPromptLists={project.data.dynamicPromptLists} agents={project.data.agents} onAddAssetToGrid={handleAddAssetToGrid} onAddToStoryboard={handleAddToStoryboard} onAddToInspiration={onAddToInspiration} onCreateAgent={(d) => { const newAgent = { ...d, id: `agent_${Date.now()}` } as Agent; updateProjectData({ agents: [...project.data.agents, newAgent] }); return newAgent; }} lore={project.data.lore} characters={project.data.characters} />;
            case 'one-shot-cinematic': return <SimpleCinematicStudio hfToken={getHfApiKey() || ''} onAddAssetToGrid={handleAddAssetToGrid} onAddToStoryboard={handleAddToStoryboard} onAddToInspiration={handleAddToInspiration} project={project} />;
            case 'mythos-cinematic-engine': return <MythosCinematicStudio hfToken={getHfApiKey() || ''} promptTemplates={project.data.promptTemplates} dynamicPromptLists={project.data.dynamicPromptLists} onAddAssetToGrid={handleAddAssetToGrid} onAddToStoryboard={handleAddToStoryboard} onAddToInspiration={handleAddToInspiration} onClearInitialPrompt={() => {}} />;
            case 'generative-video': return <GenerativeVideoStudio hfToken={getHfApiKey() || ''} videoState={project.data.generativeVideoState} onStateUpdate={s => updateProjectData({ generativeVideoState: s })} onAddToStoryboard={handleAddToStoryboard} onAddAssetToGrid={handleAddAssetToGrid} projects={[{ id: project.id, name: project.name }]} activeProjectId={project.id} />;
            case 'ltx-studio': return <LTXStudio hfToken={getHfApiKey() || ''} videoState={project.data.ltxStudioState} onStateUpdate={s => updateProjectData({ ltxStudioState: s })} onAddToStoryboard={handleAddToStoryboard} onAddAssetToGrid={handleAddAssetToGrid} projects={[{ id: project.id, name: project.name }]} activeProjectId={project.id} />;
            case 'wanimate-studio': return <WanimateStudio state={project.data.wanimateState} onStateUpdate={s => updateProjectData({ wanimateState: s })} onAddAssetToGrid={handleAddAssetToGrid} onAddToStoryboard={handleAddToStoryboard} hfToken={getHfApiKey() || ''} projects={[{ id: project.id, name: project.name }]} activeProjectId={project.id} />;
            case 'transition-studio': return <TransitionStudio state={project.data.transitionState} onStateUpdate={s => updateProjectData({ transitionState: s })} onAddAssetToGrid={handleAddAssetToGrid} onAddToStoryboard={handleAddToStoryboard} onAddToInspiration={handleAddToInspiration} hfToken={getHfApiKey() || ''} projects={[{ id: project.id, name: project.name }]} activeProjectId={project.id} promptTemplates={project.data.promptTemplates} />;
            case 'camera-movement': return <CameraMovementStudio state={project.data.cameraMovementState} onStateUpdate={s => updateProjectData({ cameraMovementState: s })} onAddAssetToGrid={handleAddAssetToGrid} onAddToStoryboard={handleAddToStoryboard} onAddToInspiration={handleAddToInspiration} hfToken={getHfApiKey() || ''} />;
            case 'camera-moves': return <CameraMovesStudio state={project.data.cameraMovesState} onStateUpdate={s => updateProjectData({ cameraMovesState: s })} onAddAssetToGrid={handleAddAssetToGrid} onAddToStoryboard={handleAddToStoryboard} hfToken={getHfApiKey() || ''} />;
            case 'blender': return <BlenderStudio sourceImages={project.data.blenderImages} resultImage={project.data.blenderResult} isLoading={false} error={null} onUpload={() => {}} onRemoveImage={() => {}} onGenerate={() => {}} onAddToStoryboard={handleAddToStoryboard} onAddToInspiration={handleAddToInspiration} hfToken={getHfApiKey() || ''} />;
            case 'scene-compositor': return <SceneCompositorStudio sceneState={project.data.sceneCompositorState} isLoading={false} error={null} onUpload={(t, f) => { const r = new FileReader(); r.onload = e => updateProjectData({ sceneCompositorState: { ...project.data.sceneCompositorState, [t]: { base64: (e.target?.result as string).split(',')[1], mimeType: f.type } } }); r.readAsDataURL(f); }} onRemoveImage={(t) => updateProjectData({ sceneCompositorState: { ...project.data.sceneCompositorState, [t]: null } })} onGenerate={() => {}} onAddToStoryboard={handleAddToStoryboard} onAddToInspiration={handleAddToInspiration} hfToken={getHfApiKey() || ''} onUpdateImage={(t, b, m) => updateProjectData({ sceneCompositorState: { ...project.data.sceneCompositorState, [t]: { base64: b, mimeType: m } } })} />;
            case 'composite': return <CompositeStudio state={project.data.compositeState} onStateUpdate={s => updateProjectData({ compositeState: s })} onAddAssetToGrid={handleAddAssetToGrid} onAddToStoryboard={handleAddToStoryboard} onAddToInspiration={handleAddToInspiration} hfToken={getHfApiKey() || ''} />;
            case 'face-swap': return <FaceSwapStudio faceSwapState={project.data.faceSwapState} isLoading={false} error={null} onUpload={(t, f) => { const r = new FileReader(); r.onload = e => updateProjectData({ faceSwapState: { ...project.data.faceSwapState, [t]: { base64: (e.target?.result as string).split(',')[1], mimeType: f.type } } }); r.readAsDataURL(f); }} onRemoveImage={(t) => updateProjectData({ faceSwapState: { ...project.data.faceSwapState, [t]: null } })} onGenerate={() => {}} onAddToStoryboard={handleAddToStoryboard} onAddToInspiration={handleAddToInspiration} hfToken={getHfApiKey() || ''} />;
            case 'face-repair': return <FaceRepairStudio faceRepairState={project.data.faceRepairState} isLoading={false} error={null} onUpload={(f) => { const r = new FileReader(); r.onload = e => updateProjectData({ faceRepairState: { ...project.data.faceRepairState, source: { base64: (e.target?.result as string).split(',')[1], mimeType: f.type } } }); r.readAsDataURL(f); }} onRemoveImage={() => updateProjectData({ faceRepairState: { ...project.data.faceRepairState, source: null } })} onGenerate={() => {}} onAddToStoryboard={handleAddToStoryboard} onAddToInspiration={handleAddToInspiration} hfToken={getHfApiKey() || ''} />;
            case 'photorealism': return <PhotorealismStudio photorealismState={project.data.photorealismState} isLoading={false} error={null} onUpload={() => {}} onRemoveImage={() => {}} onGenerate={() => {}} onAddToStoryboard={handleAddToStoryboard} onAddToInspiration={handleAddToInspiration} onPromptChange={(p, n) => updateProjectData({ photorealismState: { ...project.data.photorealismState, prompt: p, negativePrompt: n } })} hfToken={getHfApiKey() || ''} onAddAssetToGrid={handleAddAssetToGrid} />;
            case 'resize': return <ResizeStudio state={project.data.resizeState} onStateUpdate={s => updateProjectData({ resizeState: s })} onAddAssetToGrid={handleAddAssetToGrid} onAddToStoryboard={handleAddToStoryboard} onAddToInspiration={handleAddToInspiration} hfToken={getHfApiKey() || ''} />;
            case 'green-screen': return <GreenScreenStudio greenScreenState={project.data.greenScreenState} isLoading={false} error={null} onStateUpdate={s => updateProjectData({ greenScreenState: s })} onAddToStoryboard={handleAddToStoryboard} onAddAssetToGrid={handleAddAssetToGrid} hfToken={getHfApiKey() || ''} />;
            case 'background-removal': return <BackgroundRemovalStudio state={project.data.backgroundRemovalState} onStateUpdate={s => updateProjectData({ backgroundRemovalState: s })} onAddToStoryboard={handleAddToStoryboard} onAddToInspiration={handleAddToInspiration} onAddAssetToGrid={handleAddAssetToGrid} hfToken={getHfApiKey() || ''} />;
            case 'qwen-image-edit': return <QwenImageEditStudio state={project.data.qwenImageEditState} onStateUpdate={s => updateProjectData({ qwenImageEditState: s })} onAddToStoryboard={handleAddToStoryboard} onAddToInspiration={handleAddToInspiration} onAddAssetToGrid={handleAddAssetToGrid} hfToken={getHfApiKey() || ''} />;
            case 'topaz': return <TopazStudio topazState={project.data.topazState} isLoading={false} error={null} onStateUpdate={s => updateProjectData({ topazState: s })} onGenerate={() => {}} onAddToStoryboard={handleAddToStoryboard} onAddToInspiration={handleAddToInspiration} onAddAssetToGrid={handleAddAssetToGrid} progress="" />;
            case 'bigger-pics-studio': return <BiggerPicsStudio onAddAssetToGrid={handleAddAssetToGrid} projects={[{ id: project.id, name: project.name }]} activeProjectId={project.id} />;
            
            // Audio
            case 'live-studio': return <LiveStudio agents={project.data.agents} />;
            case 'voice-lab': return <VoiceLab agents={project.data.agents} />;
            case 'transcription-studio': return <TranscriptionStudio transcripts={project.data.transcripts || []} onSaveTranscript={(t) => updateProjectData({ transcripts: [...(project.data.transcripts || []), t] })} onDeleteTranscript={(id) => updateProjectData({ transcripts: (project.data.transcripts || []).filter(t => t.id !== id) })} />;
            case 'dubbing-studio': return <DubbingStudio state={project.data.dubbingState} onStateUpdate={s => updateProjectData({ dubbingState: s })} onAddAssetToGrid={handleAddAssetToGrid} onAddToStoryboard={handleAddToStoryboard} projects={[{ id: project.id, name: project.name }]} activeProjectId={project.id} />;

            // Assets
            case 'grid': return <ImageGrid images={project.data.images} isLoading={false} error={null} onViewImage={() => {}} gridOverlay='none' onGridOverlayChange={() => {}} onEditImage={() => {}} onAddToStoryboard={handleAddToStoryboard} onAddToInspiration={handleAddToInspiration} onUpscaleImage={() => {}} agents={project.data.agents} onAssignAgentToImage={(iid, aid) => updateProjectData({ images: project.data.images.map(i => i.id === iid ? { ...i, agentId: aid || undefined } : i) })} onCreateAgent={(d) => { const newAgent = { ...d, id: `agent_${Date.now()}` } as Agent; updateProjectData({ agents: [...project.data.agents, newAgent] }); return newAgent; }} agentFilter={agentFilter} onAgentFilterChange={setAgentFilter} awaitingExternalGeneration={false} showGridSelectors={false} onUploadImage={handleAddAssetToGrid} onUpdateImages={(newImages) => updateProjectData({ images: newImages })} />;
            case 'story': return <Storyboard frames={project.data.storyboard} onUpdateNote={(id, notes) => updateProjectData({ storyboard: project.data.storyboard.map(f => f.id === id ? { ...f, notes } : f) })} onRemove={(id) => updateProjectData({ storyboard: project.data.storyboard.filter(f => f.id !== id) })} onReorder={(s, e) => { const list = [...project.data.storyboard]; const [removed] = list.splice(s, 1); list.splice(e, 0, removed); updateProjectData({ storyboard: list }); }} />;
            case 'inspiration': return <InspirationBoard images={project.data.inspirationImages} onUpload={(f) => { const r = new FileReader(); r.onload = e => handleAddToInspiration((e.target?.result as string).split(',')[1]); r.readAsDataURL(f); }} onRemove={(id) => updateProjectData({ inspirationImages: project.data.inspirationImages.filter(i => i.id !== id) })} onUseAsGuide={() => {}} />;
            case 'scripts-bin': return <ScriptingStudio agent={coreAgent('agent-scripting')} onNavigate={handleNavigate} onOpenChat={(mode) => openChatModal(coreAgent('agent-scripting'), mode)} scriptText={project.data.scriptText} scriptsBin={project.data.scriptsBin} onDeleteScript={(id) => updateProjectData({ scriptsBin: project.data.scriptsBin.filter(s => s.id !== id) })} onScriptUpload={(f) => { const r = new FileReader(); r.onload = e => updateProjectData({ scriptText: e.target?.result as string }); r.readAsText(f); }} defaultTab="bin" />;
            
            // Knowledge
            case 'characters': return <CharactersStudio characters={project.data.characters} onCreate={(c) => updateProjectData({ characters: [...project.data.characters, { ...c, id: `char_${Date.now()}` } as any] })} onUpdate={(id, u) => updateProjectData({ characters: project.data.characters.map(c => c.id === id ? { ...c, ...u } : c) })} onDelete={(id) => updateProjectData({ characters: project.data.characters.filter(c => c.id !== id) })} />;
            case 'lore': return <LoreStudio lore={project.data.lore} projects={projects} characters={project.data.characters} promptTemplates={project.data.promptTemplates} images={project.data.images} activeProjectId={project.id} onCreate={(t, c, pid) => {
                const targetPid = pid || project.id;
                const newEntry = { id: `lore_${Date.now()}`, title: t, content: c, projectId: targetPid };
                setProjects(prev => prev.map(p => {
                    if (p.id === targetPid) {
                        return {
                            ...p,
                            data: {
                                ...p.data,
                                lore: [...(p.data.lore || []), newEntry]
                            }
                        };
                    }
                    return p;
                }));
            }} onUpdate={(id, t, c) => updateProjectData({ lore: project.data.lore.map(l => l.id === id ? { ...l, title: t, content: c } : l) })} onDelete={(id) => updateProjectData({ lore: project.data.lore.filter(l => l.id !== id) })} onUpdateCharacters={(chars) => updateProjectData({ characters: chars })} onUpdateLore={(loreEntries) => updateProjectData({ lore: loreEntries })} />;
            case 'prompt-library': return <PromptLibraryStudio templates={project.data.promptTemplates} onCreate={(n, p, neg) => updateProjectData({ promptTemplates: [...project.data.promptTemplates, { id: `tmpl_${Date.now()}`, name: n, positivePrompt: p, negativePrompt: neg }] })} onUpdate={(id, n, p, neg) => updateProjectData({ promptTemplates: project.data.promptTemplates.map(t => t.id === id ? { ...t, name: n, positivePrompt: p, negativePrompt: neg } : t) })} onDelete={(id) => updateProjectData({ promptTemplates: project.data.promptTemplates.filter(t => t.id !== id) })} />;
            case 'dynamic-prompts': return <DynamicPromptsStudio lists={project.data.dynamicPromptLists} onCreate={(n, i) => updateProjectData({ dynamicPromptLists: [...project.data.dynamicPromptLists, { id: `list_${Date.now()}`, name: n, items: i }] })} onUpdate={(id, n, i) => updateProjectData({ dynamicPromptLists: project.data.dynamicPromptLists.map(l => l.id === id ? { ...l, name: n, items: i } : l) })} onDelete={(id) => updateProjectData({ dynamicPromptLists: project.data.dynamicPromptLists.filter(l => l.id !== id) })} />;
            case 'knowledge': return <KnowledgeView agents={project.data.agents} onUpdateAgent={(id, u) => updateProjectData({ agents: project.data.agents.map(a => a.id === id ? { ...a, ...u } : a) })} projectLore={project.data.lore} projectCharacters={project.data.characters} onAddLore={(title, content) => updateProjectData({ lore: [...project.data.lore, { id: `lore_${Date.now()}`, title, content, projectId: project.id }] })} />;
            case 'automation': return <AutomationStudio config={project.data.automationConfig} onSave={(c) => updateProjectData({ automationConfig: c })} onTestWebhook={async () => true} />;
            case 'studio-players': return <RosterStudio rosterType='player' agents={project.data.studioPlayers} images={[]} onCreateEntity={(d) => { const newAgent = { ...d, id: `player_${Date.now()}` } as Agent; updateProjectData({ studioPlayers: [...project.data.studioPlayers, newAgent] }); return newAgent; }} onViewImage={() => {}} onUpdateEntity={(id, u) => updateProjectData({ studioPlayers: project.data.studioPlayers.map(p => p.id === id ? { ...p, ...u } : p) })} onDeleteEntity={(id) => updateProjectData({ studioPlayers: project.data.studioPlayers.filter(p => p.id !== id) })} onImageUpload={() => {}} onCallEntity={() => {}} />;
            
            case 'model-settings': return <ModelSettingsStudio />;

            default: return <DashboardStudio project={project} onUpdateProject={(u) => setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, ...u } : p))} images={project.data.images} stats={{ storyboardFrames: project.data.storyboard.length, agents: project.data.agents.length, loreEntries: project.data.lore.length, inspirationImages: project.data.inspirationImages.length, dynamicPromptLists: project.data.dynamicPromptLists.length, promptTemplates: project.data.promptTemplates.length, imagesGenerated: project.data.images.length, totalProjects: projects.length, scriptsCount: project.data.scriptsBin.length }} onNavigate={handleNavigate} />;
        }
    };

    const getHeaderConfig = () => {
        const pBreadcrumb = { label: project.name, onClick: () => handleNavigate('dashboard') };
        const tBreadcrumb = { label: 'Production Team', onClick: () => handleNavigate('team') };

        const coreAgent = (id: string) => project.data.agents.find(a => a.id === id);

        switch (activeView) {
            case 'dashboard': return { breadcrumbs: [pBreadcrumb, { label: 'Dashboard' }] };
            case 'projects': return { breadcrumbs: [pBreadcrumb, { label: 'Projects' }] };
            case 'team': return { breadcrumbs: [pBreadcrumb, { label: 'Production Team' }] };
            case 'core': return { breadcrumbs: [tBreadcrumb, { label: "Producer's Office (Nexus)" }], agent: coreAgent('agent-core') };
            case 'ideation': return { breadcrumbs: [tBreadcrumb, { label: "The Think Tank (Spark)" }], agent: coreAgent('agent-ideation') };
            case 'scripting': return { breadcrumbs: [tBreadcrumb, { label: "Writers' Room (Scribe)" }], agent: coreAgent('agent-scripting') };
            case 'design': return { breadcrumbs: [tBreadcrumb, { label: "VisDev Lab (Stylus)" }], agent: coreAgent('agent-design') };
            case 'art': return { breadcrumbs: [tBreadcrumb, { label: "The Atelier (Chroma)" }], agent: coreAgent('agent-art') };
            case 'agent-workspace': {
                const ag = selectedAgentId ? project.data.agents.find(a => a.id === selectedAgentId) : undefined;
                return { breadcrumbs: [tBreadcrumb, { label: ag?.name || 'Agent Workspace' }], agent: ag };
            }
            case 'director': return { breadcrumbs: [pBreadcrumb, { label: 'Director Suite' }] };
            case 'script-writer': return { breadcrumbs: [pBreadcrumb, { label: 'Script Writer' }] };
            case 'veo-3-studio': return { breadcrumbs: [pBreadcrumb, { label: 'Veo 3 Studio' }] };
            case 'nano-banana-studio': return { breadcrumbs: [pBreadcrumb, { label: 'Nano Banana Studio' }] };
            case 'lyria-studio': return { breadcrumbs: [pBreadcrumb, { label: 'Lyria Studio' }] };
            case 'composer-studio': return { breadcrumbs: [pBreadcrumb, { label: 'Composer Studio' }] };
            case 'image-generator': return { breadcrumbs: [pBreadcrumb, { label: 'Image Generator' }] };
            case 'one-shot-cinematic': return { breadcrumbs: [pBreadcrumb, { label: 'One-Shot Cinematic' }] };
            case 'mythos-cinematic-engine': return { breadcrumbs: [pBreadcrumb, { label: 'MythOS Engine' }] };
            case 'generative-video': return { breadcrumbs: [pBreadcrumb, { label: 'Generative Video' }] };
            case 'ltx-studio': return { breadcrumbs: [pBreadcrumb, { label: 'LTX Studio' }] };
            case 'wanimate-studio': return { breadcrumbs: [pBreadcrumb, { label: 'Wanimate Studio' }] };
            case 'transition-studio': return { breadcrumbs: [pBreadcrumb, { label: 'Transition Studio' }] };
            case 'camera-movement': return { breadcrumbs: [pBreadcrumb, { label: 'Camera Movement' }] };
            case 'camera-moves': return { breadcrumbs: [pBreadcrumb, { label: 'Camera Moves' }] };
            case 'blender': return { breadcrumbs: [pBreadcrumb, { label: '3D Blender Studio' }] };
            case 'scene-compositor': return { breadcrumbs: [pBreadcrumb, { label: 'Scene Compositor' }] };
            case 'composite': return { breadcrumbs: [pBreadcrumb, { label: 'Composite Studio' }] };
            case 'face-swap': return { breadcrumbs: [pBreadcrumb, { label: 'Face Swap' }] };
            case 'face-repair': return { breadcrumbs: [pBreadcrumb, { label: 'Face Repair' }] };
            case 'photorealism': return { breadcrumbs: [pBreadcrumb, { label: 'Photorealism' }] };
            case 'resize': return { breadcrumbs: [pBreadcrumb, { label: 'Resize & Expand' }] };
            case 'green-screen': return { breadcrumbs: [pBreadcrumb, { label: 'Green Screen' }] };
            case 'background-removal': return { breadcrumbs: [pBreadcrumb, { label: 'Background Removal' }] };
            case 'qwen-image-edit': return { breadcrumbs: [pBreadcrumb, { label: 'Qwen Image Edit' }] };
            case 'topaz': return { breadcrumbs: [pBreadcrumb, { label: 'Topaz Enhancement' }] };
            case 'bigger-pics-studio': return { breadcrumbs: [pBreadcrumb, { label: 'Bigger Pics Studio' }] };
            case 'live-studio': return { breadcrumbs: [pBreadcrumb, { label: 'Live Studio' }] };
            case 'voice-lab': return { breadcrumbs: [pBreadcrumb, { label: 'Voice Lab' }] };
            case 'dubbing-studio': return { breadcrumbs: [pBreadcrumb, { label: 'Dubbing Studio' }] };
            case 'grid': return { breadcrumbs: [pBreadcrumb, { label: 'Asset Vault' }] };
            case 'story': return { breadcrumbs: [pBreadcrumb, { label: 'Storyboard' }] };
            case 'inspiration': return { breadcrumbs: [pBreadcrumb, { label: 'Inspiration Board' }] };
            case 'scripts-bin': return { breadcrumbs: [pBreadcrumb, { label: 'Scripts Bin' }] };
            case 'characters': return { breadcrumbs: [pBreadcrumb, { label: 'Characters' }] };
            case 'lore': return { breadcrumbs: [pBreadcrumb, { label: 'Lore Engine' }] };
            case 'prompt-library': return { breadcrumbs: [pBreadcrumb, { label: 'Prompt Library' }] };
            case 'dynamic-prompts': return { breadcrumbs: [pBreadcrumb, { label: 'Dynamic Prompts' }] };
            case 'agent-chat': return { breadcrumbs: [pBreadcrumb, { label: 'Agent Chat' }] };
            case 'knowledge': return { breadcrumbs: [pBreadcrumb, { label: 'Knowledge Base' }] };
            case 'automation': return { breadcrumbs: [pBreadcrumb, { label: 'Automation' }] };
            case 'model-settings': return { breadcrumbs: [pBreadcrumb, { label: 'Model Settings' }] };
            default: return { breadcrumbs: [pBreadcrumb, { label: 'Studio' }] };
        }
    };

    const headerConfig = getHeaderConfig();

    if (authLoading) {
        return (
            <div className="flex h-screen w-screen bg-neutral-950 items-center justify-center">
                <div className="text-center">
                    <LoadingSpinner className="w-10 h-10 text-blue-600 mx-auto" />
                    <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mt-4 animate-pulse">Initializing Neural Workspace...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex h-screen w-screen bg-neutral-950 text-white relative overflow-hidden items-center justify-center font-sans">
                {/* Visual Ambient Background Mesh */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.06)_0%,transparent_60%)] pointer-events-none" />
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.5),rgba(0,0,0,0.9))] pointer-events-none" />
                
                <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 p-8 rounded-2xl shadow-2xl relative z-10 flex flex-col items-center">
                    {/* Brand lockup */}
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-900/50 mb-6">M</div>
                    <h1 className="text-xl font-black tracking-tight text-white uppercase text-center leading-none">MythOS Studio Pro</h1>
                    <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mt-2">Production Operating System</p>
                    
                    <div className="w-full border-b border-neutral-800 my-6" />

                    <p className="text-xs text-neutral-400 text-center leading-relaxed mb-6">
                        Welcome to MythOS Studio Pro. Sign in using your Google account to access your visual director, scriptwriter suite, neural video synthesizers, and lorepacks.
                    </p>

                    {/* Google Login button */}
                    <button
                        onClick={handleGoogleSignIn}
                        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-neutral-100 text-neutral-900 font-bold text-xs py-3.5 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl shrink-0"
                    >
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                            <path
                                fill="#EA4335"
                                d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.3C17.65 1.58 14.99 1 12 1 7.35 1 3.37 3.65 1.39 7.5l3.85 3C6.14 7.57 8.84 5.04 12 5.04z"
                            />
                            <path
                                fill="#4285F4"
                                d="M23.49 12.27c0-.81-.07-1.59-.2-2.27H12v4.3h6.44c-.28 1.46-1.08 2.69-2.31 3.52l3.6 2.79c2.1-1.94 3.76-4.79 3.76-8.34z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M5.24 14.5c-.24-.71-.38-1.47-.38-2.5s.14-1.79.38-2.5L1.39 6.5C.5 8.24 0 10.06 0 12s.5 3.76 1.39 5.5l3.85-3z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 23c3.24 0 5.95-1.08 7.93-2.91l-3.6-2.79c-.99.66-2.26 1.06-4.33 1.06-3.16 0-5.86-2.53-6.81-5.46L1.39 15.9C3.37 19.75 7.35 23 12 23z"
                            />
                        </svg>
                        <span className="uppercase tracking-wider">Sign In with Google</span>
                    </button>
                    
                    <p className="text-[10px] text-neutral-500 mt-8 text-center">
                        Authorized users only. All activity is logged and monitored.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-primary text-text-primary overflow-hidden font-sans">
            <Sidebar activeView={activeView} onNavigate={handleNavigate} user={user} onSignOut={handleSignOut} />
            <div className="flex-grow flex flex-col min-w-0 bg-secondary/20 h-screen overflow-hidden">
                <StudioHeader 
                    breadcrumbs={headerConfig.breadcrumbs}
                    agent={headerConfig.agent}
                    onOpenChat={headerConfig.agent ? (mode) => openChatModal(headerConfig.agent!, mode) : undefined}
                    saveStatus={saveStatus}
                    lastSavedTime={lastSavedTime}
                    onRetrySave={handleRetrySave}
                    projects={projects}
                    activeProjectId={activeProjectId}
                    onSelectProject={setActiveProjectId}
                    projectLore={project.data.lore}
                    projectAgents={project.data.agents}
                    onNavigate={handleNavigate}
                />
                <div className="flex-1 overflow-y-auto min-h-0">
                    {renderContent()}
                </div>
            </div>
             {viewingImage && (
                <ImageModal 
                    image={viewingImage}
                    onClose={() => setViewingImage(null)}
                    onEdit={() => {}}
                    onAddToStoryboard={(b64) => { handleAddToStoryboard(b64); setViewingImage(null); }}
                    onAddToInspiration={(b64) => { handleAddToInspiration(b64); setViewingImage(null); }}
                    agents={project.data.agents}
                    onAssignAgentToImage={(iid, aid) => updateProjectData({ images: project.data.images.map(i => i.id === iid ? { ...i, agentId: aid || undefined } : i) })}
                    onCreateAgent={(d) => { const newAgent = { ...d, id: `agent_${Date.now()}` } as Agent; updateProjectData({ agents: [...project.data.agents, newAgent] }); return newAgent; }}
                />
            )}
            {chatModalState.isOpen && chatModalState.agent && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <style>{`
                        @keyframes slideInRight {
                            from { transform: translateX(100%); }
                            to { transform: translateX(0); }
                        }
                        .animate-slide-in-right { animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
                    `}</style>
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setChatModalState({ ...chatModalState, isOpen: false })}></div>
                    <div className={`relative w-full ${chatModalState.initialMode === 'call' ? 'max-w-lg' : 'max-w-md'} bg-neutral-900 border-l border-neutral-700 shadow-2xl h-full flex flex-col animate-slide-in-right`}>
                        <AgentChatView 
                            agent={chatModalState.agent}
                            initialMode={chatModalState.initialMode}
                            onClose={() => setChatModalState({ ...chatModalState, isOpen: false })}
                        />
                    </div>
                </div>
            )}

            {/* Hands-Free Voice Controller floating widget */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 pointer-events-none">
                {/* Status banner */}
                {voiceAssistantActive && (
                    <div className="p-3 bg-neutral-900/95 border border-purple-500/30 text-neutral-200 text-xs font-black uppercase rounded-xl tracking-wider shadow-2xl flex items-center gap-2 animate-bounce pointer-events-auto backdrop-blur-md">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-ping inline-block" />
                        <span>Hands-Free Active</span>
                    </div>
                )}

                {/* Floating button */}
                <button
                    onClick={() => setVoiceAssistantActive(!voiceAssistantActive)}
                    className={`p-4 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 pointer-events-auto border flex items-center justify-center ${
                        voiceAssistantActive 
                            ? 'bg-purple-600 hover:bg-purple-500 text-white border-purple-400/40 ring-4 ring-purple-500/20' 
                            : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border-neutral-700/60'
                    }`}
                    title={voiceAssistantActive ? "Deactivate Voice Commands (Hands-Free)" : "Activate Voice Commands (Hands-Free)"}
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                </button>
            </div>

            {/* Flash command confirmation popup */}
            {flashVoiceCommand && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-black uppercase p-3.5 px-6 rounded-xl shadow-2xl border border-purple-400/30 tracking-widest flex items-center gap-2 animate-pulse">
                    <span>🔮 Voice Triggered:</span>
                    <span className="text-yellow-300 font-mono">"{lastSpokenCommand}"</span>
                </div>
            )}

            {/* Active Hands-Free Recording Indicator */}
            {isVoiceRecording && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-rose-950/90 border border-rose-500 text-rose-200 text-xs font-black uppercase p-3 px-5 rounded-full shadow-2xl flex items-center gap-2.5 animate-pulse backdrop-blur-md">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping inline-block" />
                    <span>Hands-Free Recording:</span>
                    <span className="font-mono text-white bg-rose-900/60 px-2 py-0.5 rounded text-[10px]">
                        {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')}
                    </span>
                    <span className="text-[10px] text-rose-400 ml-1.5 font-bold">Say "Stop recording" to save</span>
                </div>
            )}

            {/* REAL-TIME KNOWLEDGE DELTA CONTRADICTION TOAST */}
            {activeToastDiscrepancy && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md bg-gradient-to-r from-red-950 via-black to-red-950 border border-red-500 rounded-2xl p-4 shadow-[0_0_25px_rgba(239,68,68,0.4)] flex flex-col gap-2.5 backdrop-blur-md animate-slide-in-down">
                    <style>{`
                        @keyframes slideInDown {
                            from { transform: translate(-50%, -150%); opacity: 0; }
                            to { transform: translate(-50%, 0); opacity: 1; }
                        }
                        .animate-slide-in-down { animation: slideInDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                    `}</style>
                    <div className="flex justify-between items-center pb-1.5 border-b border-red-900/30">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                            <span className="text-[10px] font-black uppercase text-red-400 tracking-widest font-mono">Real-Time Collision Warning</span>
                        </div>
                        <button 
                            onClick={() => setActiveToastDiscrepancy(null)}
                            className="text-neutral-500 hover:text-white text-xs cursor-pointer font-sans"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[11px] text-neutral-300 font-sans">
                            Background continuity scans detected a <strong className="text-white">Factual Contradiction</strong> in newly uploaded file: <strong className="text-red-400">{activeToastDiscrepancy.source}</strong>.
                        </p>
                        <p className="text-[10px] text-neutral-400 font-mono italic leading-relaxed line-clamp-2 bg-black/40 p-2 rounded border border-red-950">
                            "{activeToastDiscrepancy.context}"
                        </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-1 border-t border-red-950/20">
                        <button
                            onClick={() => setActiveToastDiscrepancy(null)}
                            className="px-2.5 py-1 text-[9px] uppercase tracking-wider text-neutral-400 hover:text-white font-bold font-sans cursor-pointer"
                        >
                            Dismiss
                        </button>
                        <button
                            onClick={() => {
                                handleNavigate('knowledge');
                                setActiveToastDiscrepancy(null);
                            }}
                            className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white border border-red-500 text-[9px] font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer font-mono"
                        >
                            Inspect Collision Console &rarr;
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};