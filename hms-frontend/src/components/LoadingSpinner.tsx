// src/components/LoadingSpinner.tsx
import dogPic from '../assets/dog-pixel-art.png';

interface LoadingSpinnerProps {
  text?: string;
  imageSrc?: string;
}

export default function LoadingSpinner({
  text = 'Loading...',
  imageSrc = dogPic
}: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-12">
      {imageSrc ? (
        <img
          src={imageSrc}
          alt="Loading..."
          className="h-16 w-16 animate-spin object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
      ) : (
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
      )}

      {text && (
        <p className="animate-pulse text-sm font-medium text-slate-500">
          {text}
        </p>
      )}
    </div>
  );
}