import { useState, useEffect } from 'react';
import { api } from '../api.js';

export function ApiKeyModal({ onClose }) {
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getApiKey().then(r => setKey(r.apikey || ''));
  }, []);

  const handleSave = async () => {
    await api.saveApiKey(key);
    setSaved(true);
    setTimeout(() => onClose?.(), 800);
  };

  return (
    <div
      data-testid="apikey-modal"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.7)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1a1a1a', borderRadius: 12, padding: 24,
          width: 400, maxWidth: '90vw',
        }}
      >
        <h2 style={{ color: '#fff', margin: '0 0 16px', fontSize: 18 }}>设置 API Key</h2>
        <input
          data-testid="apikey-input"
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="sk-..."
          style={{
            width: '100%', padding: 10, borderRadius: 8,
            border: '1px solid #333', background: '#111', color: '#fff',
            fontSize: 14, outline: 'none', boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid #333',
            background: 'transparent', color: '#fff', cursor: 'pointer',
          }}>
            取消
          </button>
          <button onClick={handleSave} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: saved ? '#4caf50' : '#fff', color: '#000',
            cursor: 'pointer', fontWeight: 500,
          }}>
            {saved ? '已保存' : '保存'}
          </button>
        </div>
        <p style={{ color: '#666', fontSize: 12, marginTop: 12 }}>
          从 <a href="https://apimart.ai/keys" target="_blank" rel="noreferrer" style={{ color: '#888' }}>apimart.ai/keys</a> 获取 API Key
        </p>
      </div>
    </div>
  );
}
