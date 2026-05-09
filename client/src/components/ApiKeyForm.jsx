import { useState, useEffect } from 'react';
import { Input, Button, Space } from 'antd';
import { api } from '../api.js';

export function ApiKeyForm({ onClose }) {
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getApiKey().then(r => setKey(r.apikey || ''));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await api.saveApiKey(key);
    setSaving(false);
    onClose();
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Input.Password
        data-testid="apikey-input"
        placeholder="输入你的 API Key..."
        value={key}
        onChange={(e) => setKey(e.target.value)}
        style={{ borderRadius: 10 }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <Button data-testid="apikey-cancel" onClick={onClose}>取消</Button>
        <Button data-testid="apikey-save" type="primary" loading={saving} onClick={handleSave}>
          保存
        </Button>
      </div>
      <p style={{ color: '#71717a', fontSize: 13, margin: 0 }}>
        从 <a href="https://apimart.ai/keys" target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>apimart.ai/keys</a> 获取你的 API Key
      </p>
    </Space>
  );
}
