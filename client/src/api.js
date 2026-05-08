const BASE = 'http://localhost:3001/api';

async function request(url, opts) {
  const res = await fetch(`${BASE}${url}`, opts);
  return res.json();
}

export const api = {
  getImages: (type) => request(`/images?type=${type}`),

  uploadImage: (data, original_name) =>
    request('/images/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, original_name }),
    }),

  deleteImage: (id, type) =>
    request(`/images/${id}?type=${type}`, { method: 'DELETE' }),

  getImageData: (id, type) => request(`/images/${id}/data?type=${type}`),

  getMaterials: (category) =>
    request(`/materials${category ? `?category=${category}` : ''}`),

  generate: (body) =>
    request('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  getTask: (id) => request(`/tasks/${id}`),

  getApiKey: () => request('/settings/apikey'),

  saveApiKey: (apikey) =>
    request('/settings/apikey', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apikey }),
    }),
};

// Supported resolutions
export const RESOLUTIONS = [
  { value: '1k', label: '1K', price: '¥0.04' },
  { value: '2k', label: '2K', price: '¥0.08' },
  { value: '4k', label: '4K', price: '¥0.13' },
];

// Supported sizes
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

// 4K only supports these sizes
export const SIZE_4K = ['16:9', '9:16', '2:1', '1:2', '21:9', '9:21'];
