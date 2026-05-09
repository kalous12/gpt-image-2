import { useState, useCallback, useRef } from 'react';
import { api } from '../api.js';

export const PAGE_SIZE = 20;

export function useDataLoader() {
  const [state, setState] = useState({
    pages: {},
    loadedPages: [],
    loading: false,
    error: null,
    total: 0,
  });

  const loadedPagesRef = useRef(new Set());
  const loadingPagesRef = useRef(new Set());

  const load = useCallback(async (tab, page = 1, limit = PAGE_SIZE) => {
    if (loadedPagesRef.current.has(page) || loadingPagesRef.current.has(page)) {
      return;
    }

    loadingPagesRef.current.add(page);
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      let data;
      if (tab === 'user') {
        data = await api.getImages('user', page, limit);
      } else if (tab === 'generated') {
        data = await api.getImages('generated', page, limit);
      } else {
        data = await api.getMaterials(null, page, limit);
      }

      loadedPagesRef.current.add(page);

      setState(prev => ({
        ...prev,
        pages: { ...prev.pages, [page]: data.items || [] },
        loadedPages: [...new Set([...prev.loadedPages, page])].sort((a, b) => a - b),
        loading: false,
        error: null,
        total: data.total || 0,
      }));
      return data;
    } catch (err) {
      setState(prev => ({ ...prev, loading: false, error: err.message }));
      throw err;
    } finally {
      loadingPagesRef.current.delete(page);
    }
  }, []);

  const preload = useCallback(async (tab, page, limit = PAGE_SIZE) => {
    if (loadedPagesRef.current.has(page) || loadingPagesRef.current.has(page)) return;

    loadingPagesRef.current.add(page);

    try {
      let data;
      if (tab === 'user') {
        data = await api.getImages('user', page, limit);
      } else if (tab === 'generated') {
        data = await api.getImages('generated', page, limit);
      } else {
        data = await api.getMaterials(null, page, limit);
      }

      loadedPagesRef.current.add(page);

      setState(prev => ({
        ...prev,
        pages: { ...prev.pages, [page]: data.items || [] },
        loadedPages: [...new Set([...prev.loadedPages, page])].sort((a, b) => a - b),
        total: data.total || prev.total,
      }));
    } catch (err) {
      console.warn('Preload failed:', err.message);
    } finally {
      loadingPagesRef.current.delete(page);
    }
  }, []);

  const refresh = useCallback(async (tab, page = 1, limit = PAGE_SIZE) => {
    loadedPagesRef.current.delete(page);
    loadingPagesRef.current.delete(page);
    return load(tab, page, limit);
  }, [load]);

  const clearCache = useCallback(() => {
    loadedPagesRef.current.clear();
    loadingPagesRef.current.clear();
    setState({ pages: {}, loadedPages: [], total: 0, loading: false, error: null });
  }, []);

  const getAllImages = useCallback(() => {
    const result = [];
    for (const page of state.loadedPages) {
      if (state.pages[page]) {
        result.push(...state.pages[page]);
      }
    }
    return result;
  }, [state.pages, state.loadedPages]);

  return {
    ...state,
    getAllImages,
    load,
    preload,
    refresh,
    clearCache,
  };
}
