
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { VideoIcon } from './icons/VideoIcon';
import { ImageIcon } from './icons/ImageIcon';

interface MediaInputProps {
  onMediaChange: (media: { type: 'video' | 'image'; source: File | string | null }) => void;
}

export const MediaInput: React.FC<MediaInputProps> = ({ onMediaChange }) => {
  const [mediaSrc, setMediaSrc] = useState<string | null>(null);
  const [inputType, setInputType] = useState<'upload' | 'url'>('upload');
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video');
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isUrlLoading, setIsUrlLoading] = useState<boolean>(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedFileSize, setUploadedFileSize] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New state for progress indicators
  const [urlLoadProgress, setUrlLoadProgress] = useState<number | null>(null);
  const [isFileProcessing, setIsFileProcessing] = useState(false);


  useEffect(() => {
    return () => {
      if (mediaSrc && mediaSrc.startsWith('blob:')) {
        URL.revokeObjectURL(mediaSrc);
      }
    };
  }, [mediaSrc]);
  
  const resetSource = useCallback(() => {
    if (mediaSrc && mediaSrc.startsWith('blob:')) {
      URL.revokeObjectURL(mediaSrc);
    }
    setMediaSrc(null);
    setUploadedFileName(null);
    setUploadedFileSize(null);
    setUrlInput('');
    setUrlError(null);
    setIsUrlLoading(false); // Also reset loading state
    setUrlLoadProgress(null); // Reset progress
    setIsFileProcessing(false); // Reset file processing state
    if(fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [mediaSrc]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const processFile = (file: File | null) => {
    if (file) {
      resetSource();
      setIsFileProcessing(true);
      // Short delay to allow UI to show processing state before potential blocking operations
      setTimeout(() => {
        const newSrc = URL.createObjectURL(file);
        setMediaSrc(newSrc);
        setUploadedFileName(file.name);
        setUploadedFileSize(formatFileSize(file.size));
        onMediaChange({ type: mediaType, source: file });
        setUrlError(null);
        setIsFileProcessing(false);
      }, 200);
    }
  };

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      processFile(event.target.files?.[0] || null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mediaType] 
  );

  const handleUrlSubmit = useCallback(async () => {
    if (!urlInput.trim()) {
      setUrlError('Please enter a video URL.');
      return;
    }

    const validExtensions = ['.mp4', '.mov', '.webm', '.ogg'];
    const lowerUrl = urlInput.toLowerCase();
    const hasValidExt = validExtensions.some(ext => lowerUrl.endsWith(ext));

    if (!hasValidExt) {
        setUrlError('The URL does not seem to end with a valid video extension (.mp4, .mov, .webm). It might still work, but extraction could fail.');
    } else {
        setUrlError(null);
    }

    setIsUrlLoading(true);
    setUrlLoadProgress(0); // Start progress at 0
    resetSource();

    try {
      await new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.preload = 'metadata';

        const onError = () => {
          video.remove();
          reject(new Error('This is often due to CORS restrictions or an invalid format. Please try downloading the video and uploading it directly.'));
        };
        
        video.addEventListener('progress', () => {
            if (video.duration > 0 && video.buffered.length > 0) {
                const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                const progress = (bufferedEnd / video.duration) * 100;
                setUrlLoadProgress(progress > 95 ? 95 : progress); // Cap at 95 until metadata is fully loaded
            }
        });
        
        video.addEventListener('loadedmetadata', () => { 
            setUrlLoadProgress(100);
            video.remove(); 
            resolve(true); 
        });
        
        video.addEventListener('error', onError);
        video.src = urlInput;
      });
      setMediaSrc(urlInput);
      onMediaChange({ type: 'video', source: urlInput });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setUrlError(`Could not load video. ${errorMessage}`);
      setMediaSrc(null);
      onMediaChange({ type: 'video', source: null });
    } finally {
      setIsUrlLoading(false);
      // Small delay before hiding progress bar for better UX
      setTimeout(() => setUrlLoadProgress(null), 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onMediaChange, urlInput]);


  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const file = event.dataTransfer.files?.[0];
      if (file && file.type.startsWith(`${mediaType}/`)) {
        processFile(file);
      }
    },
     // eslint-disable-next-line react-hooks/exhaustive-deps
    [mediaType]
  );

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };
  
  const handleMediaTypeChange = (type: 'video' | 'image') => {
    if(type === mediaType) return;
    setMediaType(type);
    resetSource();
    onMediaChange({ type, source: null });
  };

  const renderUploadArea = () => (
    <div>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept={`${mediaType}/*`} className="hidden" />
      <label
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => !isFileProcessing && fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center w-full h-48 border-2 border-accent border-dashed rounded-xl  bg-secondary/50 transition-colors relative ${isFileProcessing ? 'cursor-wait' : 'cursor-pointer hover:bg-secondary'}`}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          {mediaType === 'video' ? <VideoIcon className="w-10 h-10 mb-3 text-text-secondary" /> : <ImageIcon className="w-10 h-10 mb-3 text-text-secondary" />}
          <p className="mb-2 text-sm text-text-secondary">
            <span className="font-semibold">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-text-secondary">{mediaType === 'video' ? 'MP4, MOV, AVI, etc.' : 'JPEG, PNG, WEBP, etc.'}</p>
        </div>
      </label>
      {/* Progress/Success Indicator for File Upload */}
      {isFileProcessing && (
        <div className="mt-2 p-3 bg-secondary border border-accent rounded-xl flex items-center gap-3 animate-fade-in">
          <div className="animate-spin h-5 w-5 border-2 border-brand border-t-transparent rounded-full"></div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-text-primary">Processing file...</span>
            <span className="text-[10px] text-text-secondary">Please wait.</span>
          </div>
        </div>
      )}
      {!isFileProcessing && uploadedFileName && (
          <div className="mt-2 p-2 bg-brand/20 border border-brand/30 rounded-xl flex items-center justify-between animate-fade-in">
             <div className="flex items-center gap-2 overflow-hidden">
                <div className="bg-brand rounded-full p-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-text-primary truncate max-w-[200px]">{uploadedFileName}</span>
                    <span className="text-[10px] text-text-secondary">{uploadedFileSize}</span>
                </div>
             </div>
          </div>
      )}
    </div>
  );

  const renderUrlArea = () => (
    <div className="space-y-2">
      <div className="flex space-x-2">
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="Enter direct video URL (e.g., .../video.mp4)"
          className="w-full p-2 bg-secondary border border-accent rounded-xl focus:ring-2 focus:ring-brand focus:outline-none transition placeholder-text-secondary/70"
          disabled={isUrlLoading}
        />
        <button
          onClick={handleUrlSubmit}
          disabled={isUrlLoading}
          className="py-3 px-6 bg-brand text-text-primary font-semibold rounded-xl hover:bg-brand-hover transition-all shadow-md hover:shadow-lg active:scale-95 disabled:bg-accent disabled:cursor-wait disabled:transform-none disabled:shadow-none"
        >
          {isUrlLoading ? 'Loading...' : 'Load'}
        </button>
      </div>
      {/* Progress Bar for URL Loading */}
      {isUrlLoading && urlLoadProgress !== null && (
        <div className="w-full bg-accent rounded-full h-1 mt-2 animate-fade-in">
          <div 
            className="bg-brand h-1 rounded-full transition-all duration-300 ease-linear" 
            style={{ width: `${urlLoadProgress}%` }}
          ></div>
        </div>
      )}
       <p className="text-xs text-text-secondary px-1">
        <b>Note:</b> URL input is for videos only and they must be publicly accessible (CORS enabled). If you encounter errors, please download the video and use the 'Upload' tab instead.
      </p>
      {urlError && (
        <div className="mt-2 text-sm text-red-400 bg-red-900/20 p-3 rounded-xl border border-red-500/30">
          <p className="font-semibold">URL Error</p>
          <p>{urlError}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-text-primary">1. Provide a Video or Image</h2>
      
      <div className="flex space-x-2 p-1 bg-secondary rounded-xl">
         <button
          onClick={() => handleMediaTypeChange('video')}
          className={`w-full py-2 text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 ${
            mediaType === 'video' ? 'bg-brand text-text-primary' : 'text-text-secondary hover:bg-accent'
          }`}
        >
          <VideoIcon className="w-4 h-4" /> Video
        </button>
        <button
          onClick={() => handleMediaTypeChange('image')}
          className={`w-full py-2 text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 ${
            mediaType === 'image' ? 'bg-brand text-text-primary' : 'text-text-secondary hover:bg-accent'
          }`}
        >
          <ImageIcon className="w-4 h-4" /> Image
        </button>
      </div>

      {mediaType === 'video' && (
        <div className="flex space-x-2 p-1 bg-secondary/50 rounded-xl">
          <button onClick={() => setInputType('upload')} className={`w-full py-2 text-sm font-semibold rounded-xl transition-colors ${inputType === 'upload' ? 'bg-accent text-text-primary' : 'text-text-secondary hover:bg-accent/50'}`}>Upload</button>
          <button onClick={() => setInputType('url')} className={`w-full py-2 text-sm font-semibold rounded-xl transition-colors ${inputType === 'url' ? 'bg-accent text-text-primary' : 'text-text-secondary hover:bg-accent/50'}`}>URL</button>
        </div>
      )}

      {inputType === 'upload' || mediaType === 'image' ? renderUploadArea() : renderUrlArea()}

      {mediaSrc && (
        <div className="mt-4">
          <p className="text-sm font-medium text-text-secondary mb-2">Preview:</p>
          {mediaType === 'video' ? (
            <video key={mediaSrc} controls className="w-full rounded-xl max-h-64 bg-black">
              <source src={mediaSrc} />
              Your browser does not support the video tag.
            </video>
          ) : (
            <img src={mediaSrc} alt="Preview" className="w-full rounded-xl max-h-64 object-contain bg-black" />
          )}
        </div>
      )}
    </div>
  );
};
