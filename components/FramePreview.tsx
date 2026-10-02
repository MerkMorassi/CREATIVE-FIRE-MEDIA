import React from 'react';

interface FramePreviewProps {
  frames: string[];
  title: string;
}

export const FramePreview: React.FC<FramePreviewProps> = ({ frames, title }) => {
  if (frames.length === 0) {
    return null;
  }
  
  const isSingleImage = frames.length === 1;

  return (
    <div className="w-full">
      <h3 className="text-sm font-medium text-text-secondary mb-2 text-center">{title}</h3>
      <div 
        className={`p-2 bg-primary/50 rounded-md border border-accent ${
          isSingleImage 
            ? 'max-h-64 flex justify-center' 
            : 'grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2 max-h-48 overflow-y-auto'
        }`}
      >
        {frames.map((frame, index) => (
          <img
            key={index}
            src={`data:image/jpeg;base64,${frame}`}
            alt={`Frame ${index + 1}`}
            className={`object-cover rounded bg-accent ${isSingleImage ? 'w-auto h-full max-h-full' : 'w-full h-auto aspect-video'}`}
            loading="lazy"
          />
        ))}
      </div>
    </div>
  );
};