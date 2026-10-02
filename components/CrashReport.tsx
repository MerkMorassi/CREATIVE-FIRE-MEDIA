
import React from 'react';
import { WarningIcon } from './icons/WarningIcon';

export const CrashReport: React.FC<{ error: Error; componentStack?: string }> = ({ error, componentStack }) => {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-primary text-text-primary p-8 text-center">
      <WarningIcon className="w-16 h-16 text-red-500 mb-6" />
      <h1 className="text-3xl font-bold text-red-400 mb-3">System Malfunction Detected</h1>
      <p className="text-lg text-neutral-300 mb-4">An unexpected error occurred during rendering. The MythOS System encountered a critical fault.</p>
      <p className="text-neutral-400 text-sm mb-6">
        Please try refreshing the page. If the issue persists, contact support with the details below.
      </p>
      
      <div className="bg-neutral-800 border border-neutral-700 p-6 rounded-lg text-left max-w-xl w-full">
        <h2 className="text-xl font-semibold text-white mb-2">Error Details:</h2>
        <pre className="bg-black/50 p-4 rounded-md text-red-300 text-xs overflow-x-auto whitespace-pre-wrap break-words font-mono">
          <strong>Message:</strong> {error.message}
          {componentStack && (
            <>
              <br/><br/>
              <strong>Component Stack:</strong> {componentStack}
            </>
          )}
          <br/><br/>
          <strong>Stack Trace:</strong> {error.stack}
        </pre>
      </div>

      <button
        onClick={() => window.location.reload()}
        className="mt-8 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors shadow-lg"
      >
        Reload Application
      </button>
    </div>
  );
};
