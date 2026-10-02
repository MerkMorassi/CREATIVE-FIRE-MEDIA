import React, { useEffect } from 'react';
import { CloseIcon } from './icons.tsx';

interface BeforeAfterModalProps {
  isOpen: boolean;
  onClose: () => void;
  beforeImage: { base64: string; mimeType: string } | null;
  afterImage: string | null;
}

export const BeforeAfterModal: React.FC<BeforeAfterModalProps> = ({ isOpen, onClose, beforeImage, afterImage }) => {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  if (!isOpen || !beforeImage || !afterImage) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-neutral-900 shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-neutral-800 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-neutral-400 hover:text-white transition-colors z-20 bg-black/40 p-1.5"
          aria-label="Close image viewer"
        >
          <CloseIcon />
        </button>

        <div className="flex-grow p-4 flex flex-col md:flex-row items-center justify-center gap-4 overflow-auto">
          <div className="w-full md:w-1/2 flex flex-col items-center">
            <h3 className="text-lg font-bold text-neutral-400 mb-2">Before</h3>
            <img
              src={`data:${beforeImage.mimeType};base64,${beforeImage.base64}`}
              alt="Before image"
              className="max-w-full max-h-[75vh] object-contain shadow-lg"
            />
          </div>
          <div className="w-full md:w-1/2 flex flex-col items-center">
            <h3 className="text-lg font-bold text-neutral-300 mb-2">After</h3>
            <img
              src={`data:image/jpeg;base64,${afterImage}`}
              alt="After image"
              className="max-w-full max-h-[75vh] object-contain shadow-lg"
            />
          </div>
        </div>
      </div>
    </div>
  );
};