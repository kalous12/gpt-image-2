import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDataLoader } from './useDataLoader.js';

vi.mock('../api.js', () => ({
  api: {
    getImages: vi.fn(),
    getMaterials: vi.fn(),
  },
}));

import { api } from '../api.js';

describe('useDataLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads user images on load call', async () => {
    api.getImages.mockResolvedValue({ items: [{ id: 1 }], total: 1 });
    const { result } = renderHook(() => useDataLoader());

    result.current.load('user', 1);
    await waitFor(() => expect(result.current.getAllImages().length).toBe(1));

    expect(result.current.getAllImages()).toEqual([{ id: 1 }]);
    expect(result.current.total).toBe(1);
  });

  it('loads generated images on load call', async () => {
    api.getImages.mockResolvedValue({ items: [{ id: 2 }], total: 1 });
    const { result } = renderHook(() => useDataLoader());

    result.current.load('generated', 1);
    await waitFor(() => expect(result.current.getAllImages().length).toBe(1));

    expect(result.current.getAllImages()).toEqual([{ id: 2 }]);
  });

  it('loads materials on load call', async () => {
    api.getMaterials.mockResolvedValue({ items: [{ id: 3 }], total: 1 });
    const { result } = renderHook(() => useDataLoader());

    result.current.load('material', 1);
    await waitFor(() => expect(result.current.getAllImages().length).toBe(1));

    expect(result.current.getAllImages()).toEqual([{ id: 3 }]);
  });

  it('does not reload already loaded pages', async () => {
    api.getImages.mockResolvedValue({ items: [{ id: 1 }], total: 1 });
    const { result } = renderHook(() => useDataLoader());

    result.current.load('user', 1);
    await waitFor(() => expect(result.current.getAllImages().length).toBe(1));

    result.current.load('user', 1);
    expect(api.getImages).toHaveBeenCalledTimes(1);
  });

  it('merges multiple pages in getAllImages', async () => {
    api.getImages
      .mockResolvedValueOnce({ items: [{ id: 1 }], total: 2 })
      .mockResolvedValueOnce({ items: [{ id: 2 }], total: 2 });
    const { result } = renderHook(() => useDataLoader());

    result.current.load('user', 1);
    await waitFor(() => expect(result.current.getAllImages().length).toBe(1));

    result.current.load('user', 2);
    await waitFor(() => expect(result.current.getAllImages().length).toBe(2));

    expect(result.current.getAllImages()).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('clears cache on clearCache call', async () => {
    api.getImages.mockResolvedValue({ items: [{ id: 1 }], total: 1 });
    const { result } = renderHook(() => useDataLoader());

    result.current.load('user', 1);
    await waitFor(() => expect(result.current.getAllImages().length).toBe(1));

    result.current.clearCache();
    await waitFor(() => expect(result.current.getAllImages().length).toBe(0));

    expect(result.current.total).toBe(0);
  });
});
