import { useState, useEffect, useRef } from 'react';

export function usePolling(taskId, onComplete) {
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!taskId) return;

    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/tasks/${taskId}`);
        const json = await res.json();

        if (json.code === 200) {
          const status = json.data?.status;
          if (status === 'completed') {
            clearInterval(intervalRef.current);
            onComplete?.(json.data);
          } else if (status === 'failed') {
            clearInterval(intervalRef.current);
            onComplete?.(null);
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 5000);

    return () => clearInterval(intervalRef.current);
  }, [taskId]);

  return null;
}
