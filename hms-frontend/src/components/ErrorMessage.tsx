// src/components/ErrorMessage.tsx
interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="mx-auto my-12 max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
      {/* Icon Container */}
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-3xl">
        ⚠️
      </div>
      
      {/* Text Content */}
      <h3 className="mb-2 text-xl font-bold text-slate-900">Something went wrong</h3>
      <p className="mb-6 text-sm text-slate-600">{message}</p>
      
      {/* Action Button */}
      {onRetry && (
        <button 
          onClick={onRetry} 
          className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 sm:w-auto"
        >
          Try Again
        </button>
      )}
    </div>
  );
}