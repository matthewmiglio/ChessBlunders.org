interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message = "Loading..." }: LoadingSpinnerProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-[#f44336] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#b4b4b4]">{message}</p>
      </div>
    </div>
  );
}
