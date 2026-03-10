// src/components/LoadingSpinner.tsx
interface LoadingSpinnerProps {
  text?: string;
}

export default function LoadingSpinner({ text = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <div className="loading-container">
      <div className="spinner"></div>
      {text && <p>{text}</p>}
    </div>
  );
}