const BASE = `http://${window.location.hostname}:3001/api`;
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const LONG_TIMEOUT = 300000;   // 5 minutes for generation

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request(url, opts = {}, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${BASE}${url}`, {
      ...opts,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await res.json();

    if (!res.ok) {
      throw new ApiError(
        data.error || `HTTP ${res.status}`,
        res.status,
        data
      );
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      throw new ApiError('请求超时，请检查网络连接', 408, {});
    }

    if (err instanceof ApiError) {
      throw err;
    }

    throw new ApiError(err.message || '网络请求失败', 0, {});
  }
}

export const api = {
  getImages: (type, page = 1, limit = 20) =>
    request(`/images?type=${type}&page=${page}&limit=${limit}`),

  uploadImage: (data, original_name) =>
    request('/images/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, original_name }),
    }, LONG_TIMEOUT),

  deleteImage: (id, type) =>
    request(`/images/${id}?type=${type}`, { method: 'DELETE' }),

  getImageData: (id, type) => request(`/images/${id}/data?type=${type}`),

  getMaterials: (category, page = 1, limit = 20) =>
    request(`/materials${category ? `?category=${category}&` : '?'}page=${page}&limit=${limit}`),

  generate: (body) =>
    request('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, LONG_TIMEOUT),

  getTask: (id) => request(`/tasks/${id}`),

  cancelTask: (id) => request(`/tasks/${id}/cancel`, { method: 'POST' }),

  getActiveTasks: () => request('/active'),

  getApiKey: () => request('/settings/apikey'),

  saveApiKey: (apikey) =>
    request('/settings/apikey', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apikey }),
    }),
};

export { ApiError };

export const RESOLUTIONS = [
  { value: '1k', label: '1K', price: '¥0.0420' },
  { value: '2k', label: '2K', price: '¥0.0840' },
  { value: '4k', label: '4K', price: '¥0.1260' },
];

export const SIZES = [
  { value: 'auto', label: '自动', type: 'auto' },
  { value: '1:1', label: '1:1 正方', type: 'square' },
  { value: '3:2', label: '3:2 横图', type: 'horizontal' },
  { value: '2:3', label: '2:3 竖图', type: 'vertical' },
  { value: '4:3', label: '4:3 横图', type: 'horizontal' },
  { value: '3:4', label: '3:4 竖图', type: 'vertical' },
  { value: '5:4', label: '5:4 横图', type: 'horizontal' },
  { value: '4:5', label: '4:5 竖图', type: 'vertical' },
  { value: '16:9', label: '16:9 横图', type: 'horizontal' },
  { value: '9:16', label: '9:16 竖图', type: 'vertical' },
  { value: '2:1', label: '2:1 横图', type: 'horizontal' },
  { value: '1:2', label: '1:2 竖图', type: 'vertical' },
  { value: '21:9', label: '21:9 横图', type: 'horizontal' },
  { value: '9:21', label: '9:21 竖图', type: 'vertical' },
];

export const SIZE_4K = ['16:9', '9:16', '2:1', '1:2', '21:9', '9:21'];
