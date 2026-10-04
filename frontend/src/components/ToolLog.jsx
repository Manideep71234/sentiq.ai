import { Loader2 } from 'lucide-react';

export default function ToolLog({ logs, isDone }) {
  if (!logs || logs.length === 0 || isDone) return null;
  
  // Only show the latest status
  const currentStatus = logs[logs.length - 1];
  
  return (
    <div className="tool-status-pill">
      <div className="pulse-dot"></div>
      <span>{currentStatus}</span>
    </div>
  );
}
