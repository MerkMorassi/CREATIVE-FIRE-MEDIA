

const CACHE_NAME = 'storyboard-studio-v7';
const urlsToCache = [
  '/',
  '/index.html',
  '/index.tsx',
  '/App.tsx',
  '/types.ts',
  '/services/geminiService.ts',
  '/services/ragService.ts',
  '/services/localRagService.ts', 
  '/services/topazService.ts',
  '/services/scribeRandomizer.ts',
  '/services/agentService.ts',
  '/services/apiKeyService.ts',
  '/services/promptTemplateService.ts',
  '/services/vectorDbService.ts',
  '/services/embeddingService.ts',
  '/services/huggingFaceService.ts',
  '/services/gradioService.ts',
  '/components/InputPanel.tsx',
  '/components/ImageGrid.tsx',
  '/components/icons.tsx',
  '/components/SettingsModal.tsx',
  '/components/Storyboard.tsx',
  '/components/ScriptViewer.tsx',
  '/components/InspirationBoard.tsx',
  '/components/VideoGenerator.tsx',
  '/components/FaceRepairStudio.tsx',
  '/components/PhotorealismStudio.tsx',
  '/components/TopazStudio.tsx',
  '/components/BeforeAfterModal.tsx',
  '/components/RosterStudio.tsx',
  '/components/CharactersStudio.tsx',
  '/components/LoreStudio.tsx',
  '/components/DynamicPromptsStudio.tsx',
  '/components/PromptLibraryStudio.tsx',
  '/components/AgentChatStudio.tsx',
  '/components/DashboardStudio.tsx',
  '/components/AutomationStudio.tsx',
  '/components/ProjectsStudio.tsx',
  '/components/Sidebar.tsx',
  '/components/ScriptWriterStudio.tsx',
  '/components/ImageGeneratorStudio.tsx',
  '/components/MythosCinematicStudio.tsx',
  '/components/GenerativeVideoStudio.tsx',
  '/components/WanimateStudio.tsx',
  '/components/TransitionStudio.tsx',
  '/components/BlenderStudio.tsx',
  '/components/SceneCompositorStudio.tsx',
  '/components/CompositeStudio.tsx',
  '/components/FaceSwapStudio.tsx',
  '/components/ResizeStudio.tsx',
  '/components/GreenScreenStudio.tsx',
  '/components/AgentChatView.tsx',
  '/components/ChatInterface.tsx',
  '/components/ChatMessage.tsx',
  '/components/StudioHeader.tsx',
  '/components/GenericAgentStudio.tsx',
  '/components/CoreStudio.tsx',
  '/components/IdeationStudio.tsx',
  '/components/ScriptingStudio.tsx',
  '/components/DesignStudio.tsx',
  '/components/ArtStudio.tsx',
  '/components/KnowledgeView.tsx',
  '/components/KnowledgeBaseContext.tsx',
  '/components/PromptTemplateForm.tsx',
  '/components/PromptTemplatesView.tsx',
  '/components/AssetActions.tsx',
  '/components/Dataframe.tsx',
  '/components/MediaInput.tsx',
  '/components/AnalysisResult.tsx',
  '/components/Loader.tsx',
  '/components/FramePreview.tsx',
  '/components/AgentForm.tsx',
  '/components/ReEngineeredPrompt.tsx',
  '/components/DubbingStudio.tsx',
  '/modules/director/DirectorStudio.tsx',
  '/modules/director/service.ts',
  '/hooks/useLiveChat.ts',
  '/utils/audio.ts',
  '/utils/htmlToMarkdown.ts',
  '/utils/textFormatting.ts',
  '/utils/video.ts',
  '/utils/numMarkX.ts',
  '/data/writer/structures.json',
  '/data/writer/archetypes.json',
  '/data/writer/novel_themes.json',
  '/data/writer/genres.json',
  '/vite.svg',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://aistudiocdn.com/react@^19.2.0/',
  'https://aistudiocdn.com/react-dom@^19.2.0/',
  'https://aistudiocdn.com/@google/genai@^1.29.0'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        const promises = urlsToCache.map(url => {
            return cache.add(new Request(url, {cache: 'reload'}))
                .catch(err => console.warn(`Failed to cache ${url}:`, err));
        });
        return Promise.all(promises);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Not in cache, go to network.
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          response => {
            // Check if we received a valid response to cache
            // Do not cache API calls to Google
            if(!response || (response.status !== 200 && response.status !== 0) || event.request.url.includes('googleapis.com')) {
              return response;
            }

            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
    );
});

self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});