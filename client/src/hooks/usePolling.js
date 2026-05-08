import { useEffect, useRef, useCallback } from 'react';

// 指数退避配置
const INITIAL_DELAY = 2000;  // 2秒
const MAX_DELAY = 16000;     // 16秒
const BACKOFF_FACTOR = 2;
const MAX_POLL_TIME = 5 * 60 * 1000; // 5分钟

// 支持多个任务同时轮询，使用指数退避
export function useMultiPolling(activeTasks, onTaskComplete) {
  const onTaskCompleteRef = useRef(onTaskComplete);
  onTaskCompleteRef.current = onTaskComplete;

  // 已完成的任务集合，防止重复回调
  const completedTasksRef = useRef(new Set());

  useEffect(() => {
    if (!activeTasks || activeTasks.length === 0) return;

    const generatingTasks = activeTasks.filter(t => t.status === 'generating');
    if (generatingTasks.length === 0) return;

    // 清理已完成集合中不在当前任务列表的任务
    const currentTaskIds = new Set(generatingTasks.map(t => t.taskId));
    for (const taskId of completedTasksRef.current) {
      if (!currentTaskIds.has(taskId)) {
        completedTasksRef.current.delete(taskId);
      }
    }

    const abortControllers = new Map();
    const pollDelays = new Map();
    const startTimes = new Map();
    const timeoutIds = new Map();

    const pollTask = async (taskId) => {
      // 检查是否已完成
      if (completedTasksRef.current.has(taskId)) return;

      // 检查是否超时
      const startTime = startTimes.get(taskId) || Date.now();
      if (Date.now() - startTime > MAX_POLL_TIME) {
        completedTasksRef.current.add(taskId);
        onTaskCompleteRef.current?.(taskId, null, '任务超时，请重试');
        return;
      }

      const controller = abortControllers.get(taskId);
      if (!controller || controller.signal.aborted) return;

      try {
        const res = await fetch(
          `http://${window.location.hostname}:3001/api/tasks/${taskId}`,
          { signal: controller.signal }
        );
        const json = await res.json();

        if (controller.signal.aborted) return;

        if (json.code === 200) {
          const status = json.data?.status;

          if (status === 'completed') {
            completedTasksRef.current.add(taskId);
            onTaskCompleteRef.current?.(taskId, json.data, null);
            return;
          }

          if (status === 'failed') {
            completedTasksRef.current.add(taskId);
            onTaskCompleteRef.current?.(taskId, null, json.data?.errorMessage || '生成失败');
            return;
          }

          // 任务仍在进行，重置退避延迟
          pollDelays.set(taskId, INITIAL_DELAY);
        } else if (json.error) {
          // API 返回错误，继续轮询但保持当前延迟
          console.warn(`Task ${taskId} API error:`, json.error);
        }

        // 安排下一次轮询
        scheduleNextPoll(taskId);
      } catch (err) {
        if (err.name === 'AbortError') return;

        // 网络错误，使用指数退避
        const currentDelay = pollDelays.get(taskId) || INITIAL_DELAY;
        const nextDelay = Math.min(currentDelay * BACKOFF_FACTOR, MAX_DELAY);
        pollDelays.set(taskId, nextDelay);

        console.warn(`Task ${taskId} network error, next poll in ${nextDelay}ms`);

        scheduleNextPoll(taskId, nextDelay);
      }
    };

    const scheduleNextPoll = (taskId, delayOverride = null) => {
      if (completedTasksRef.current.has(taskId)) return;

      const delay = delayOverride || pollDelays.get(taskId) || INITIAL_DELAY;

      const timeoutId = setTimeout(() => {
        pollTask(taskId);
      }, delay);

      timeoutIds.set(taskId, timeoutId);
    };

    // 初始化所有任务
    generatingTasks.forEach(task => {
      const taskId = task.taskId;
      abortControllers.set(taskId, new AbortController());
      pollDelays.set(taskId, INITIAL_DELAY);
      startTimes.set(taskId, Date.now());
    });

    // 立即开始第一次轮询（不延迟）
    generatingTasks.forEach(task => {
      pollTask(task.taskId);
    });

    // 清理函数
    return () => {
      // 取消所有请求
      abortControllers.forEach(c => c.abort());

      // 清除所有定时器
      timeoutIds.forEach(id => clearTimeout(id));
    };
  }, [activeTasks]);

  return null;
}

// 兼容旧的单任务轮询
export function usePolling(taskId, onComplete) {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const handleComplete = useCallback((id, data, error) => {
    if (data) {
      onCompleteRef.current?.(data);
    } else {
      onCompleteRef.current?.(null, error);
    }
  }, []);

  // 将单任务转换为多任务格式
  const activeTasks = taskId ? [{ taskId, status: 'generating' }] : [];

  useMultiPolling(activeTasks, handleComplete);

  return null;
}