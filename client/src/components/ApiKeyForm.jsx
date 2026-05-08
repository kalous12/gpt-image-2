import { useState, useEffect } from 'react';
import { Input, Button, Space, Radio, Tag, Spin } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { api } from '../api.js';

const API_ENDPOINTS = [
  { value: 'https://api.apimart.ai', label: 'apimart.ai (主节点)' },
  { value: 'https://api.apib.ai', label: 'apib.ai (备用1)' },
  { value: 'https://api.aiuxu.com', label: 'aiuxu.com (备用2)' },
  { value: 'https://api.aishuch.com', label: 'aishuch.com (备用3)' },
];

export function ApiKeyForm({ onClose }) {
  const [key, setKey] = useState('');
  const [endpoint, setEndpoint] = useState(API_ENDPOINTS[0].value);
  const [saving, setSaving] = useState(false);
  const [testResults, setTestResults] = useState({});
  const [testingAll, setTestingAll] = useState(false);
  const [testingSingle, setTestingSingle] = useState(null);

  useEffect(() => {
    api.getApiKey().then(r => setKey(r.apikey || ''));
    api.getApiEndpoint().then(r => setEndpoint(r.endpoint || API_ENDPOINTS[0].value));
  }, []);

  const handleTestSingle = async (ep) => {
    setTestingSingle(ep);
    try {
      const result = await api.testApiEndpoint(ep);
      setTestResults(prev => ({ ...prev, [ep]: result }));
    } catch (err) {
      setTestResults(prev => ({ ...prev, [ep]: { success: false, error: err.message } }));
    } finally {
      setTestingSingle(null);
    }
  };

  const handleTestAll = async () => {
    setTestingAll(true);
    setTestResults({});

    // 并行测试所有端点，实时更新结果
    let fastest = null;
    let minLatency = Infinity;

    await Promise.all(API_ENDPOINTS.map(async (ep) => {
      try {
        const result = await api.testApiEndpoint(ep.value);
        setTestResults(prev => ({ ...prev, [ep.value]: result }));

        if (result.success && result.latency < minLatency) {
          minLatency = result.latency;
          fastest = ep.value;
          setEndpoint(ep.value);
        }
      } catch (err) {
        setTestResults(prev => ({ ...prev, [ep.value]: { success: false, error: err.message } }));
      }
    }));

    setTestingAll(false);
  };

  const getLatencyTag = (ep) => {
    const result = testResults[ep];
    const isLoading = testingAll || testingSingle === ep;

    if (isLoading && !result) {
      return (
        <Tag style={{ minWidth: 60 }}>
          <Spin indicator={<LoadingOutlined spin />} size="small" />
        </Tag>
      );
    }
    if (!result) return <Tag style={{ minWidth: 60 }}>--</Tag>;
    if (result.success) {
      return <Tag color="success" style={{ minWidth: 60 }}>{result.latency}ms</Tag>;
    }
    return <Tag color="error" style={{ minWidth: 60 }}><CloseCircleOutlined /></Tag>;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.saveApiKey(key);
      await api.saveApiEndpoint(endpoint);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div>
        <label style={{ display: 'block', marginBottom: 8, color: '#a1a1aa', fontSize: 13 }}>API Key</label>
        <Input.Password
          data-testid="apikey-input"
          placeholder="输入你的 API Key..."
          value={key}
          onChange={(e) => setKey(e.target.value)}
          style={{ borderRadius: 10 }}
        />
        <p style={{ color: '#71717a', fontSize: 12, margin: '8px 0 0' }}>
          从 <a href="https://apimart.ai/keys" target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>apimart.ai/keys</a> 获取你的 API Key
        </p>
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: 8, color: '#a1a1aa', fontSize: 13 }}>API 端点</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {API_ENDPOINTS.map((ep) => (
            <div key={ep.value} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Radio
                checked={endpoint === ep.value}
                onChange={() => setEndpoint(ep.value)}
              />
              <span style={{ flex: 1, fontSize: 14 }}>{ep.label}</span>
              {getLatencyTag(ep.value)}
              <Button
                size="small"
                onClick={() => handleTestSingle(ep.value)}
                loading={testingSingle === ep.value}
                disabled={testingAll}
                style={{ borderRadius: 8 }}
              >
                测试
              </Button>
            </div>
          ))}
        </div>
        <p style={{ color: '#71717a', fontSize: 12, margin: '8px 0 0' }}>
          选择可用的 API 端点，点击测试按钮检查连通性
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
        <Button onClick={handleTestAll} loading={testingAll}>
          {testingAll ? '测试中...' : '自动测试'}
        </Button>
        <Button data-testid="apikey-cancel" onClick={onClose}>取消</Button>
        <Button data-testid="apikey-save" type="primary" loading={saving} onClick={handleSave}>
          保存
        </Button>
      </div>
    </Space>
  );
}
