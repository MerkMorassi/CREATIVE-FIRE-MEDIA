

const FRAME_QUALITY = 0.8; // Jpeg quality

/**
 * Extracts a specified number of frames from a video source.
 * @param videoUrl The URL of the video (can be an object URL for local files).
 * @param frameCount The number of frames to extract.
 * @returns A promise that resolves to an array of base64 encoded frame strings (without the data URL prefix).
 */
export const extractFramesFromVideo = (videoUrl: string, frameCount: number): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous'; // Necessary for loading videos from different origins

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const frames: string[] = [];

    if (!context) {
      return reject(new Error('Could not create canvas context.'));
    }

    video.addEventListener('loadedmetadata', () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const duration = video.duration;
      if (duration <= 0 || !isFinite(duration)) {
          video.remove();
          canvas.remove();
          return reject(new Error("The video file appears to be corrupted or is not a valid video format, as its duration could not be read."));
      }

      const interval = duration / frameCount;
      let currentTime = 0;
      let capturedFrames = 0;

      const seekAndCapture = () => {
        if (capturedFrames >= frameCount || currentTime > duration) {
          video.remove();
          canvas.remove();
          resolve(frames);
          return;
        }
        video.currentTime = currentTime;
      };

      video.addEventListener('seeked', () => {
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUrl = canvas.toDataURL('image/jpeg', FRAME_QUALITY);
        const base64Data = dataUrl.split(',')[1];
        if (base64Data) {
            frames.push(base64Data);
        }
        
        capturedFrames++;
        currentTime += interval;
        seekAndCapture();
      });

      seekAndCapture(); // Start the process
    });
    
    video.addEventListener('error', (e) => {
      let errorMsg = 'An unknown error occurred while trying to process the video.';
      switch (video.error?.code) {
        case 1: errorMsg = 'Video loading was aborted.'; break;
        case 2: errorMsg = 'A network error caused the video download to fail. Please check your connection.'; break;
        case 3: errorMsg = 'Video playback was aborted. The file might be corrupted or use a format your browser doesn\'t support.'; break;
        case 4: errorMsg = 'The video could not be loaded. If using a URL, check for CORS issues. If uploading a file, it might be corrupted or in an unsupported format.'; break;
      }
      reject(new Error(errorMsg));
    });

    video.src = videoUrl;
    video.load(); // Start loading the video
  });
};