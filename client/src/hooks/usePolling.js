import { useEffect, useRef } from 'react';

export function usePolling(taskId, onComplete) {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!taskId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`http://${window.location.hostname}:3001/api/tasks/${taskId}`);
        const json = await res.json();

        if (cancelled) return;

        if (json.code === 200) {
          const status = json.data?.status;
          if (status === 'completed') {
            onCompleteRef.current?.(json.data);
          } else if (status === 'failed') {
            onCompleteRef.current?.(null);
          }
        }
      } catch {
        // ignore polling errors
      }
    };

    // 立即检查一次
    poll();

    // 每 3 秒轮询
    const intervalId = setInterval(poll, 3000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [taskId]);

  return null;
}
