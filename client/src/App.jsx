import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ConfigProvider, theme, Segmented, Masonry, Input, Select, Button, Modal, Space, Spin } from 'antd';
import { PlusOutlined, DeleteOutlined, SettingOutlined, EyeOutlined, CopyOutlined, LoadingOutlined, ThunderboltOutlined, PictureOutlined, CloudUploadOutlined, DownloadOutlined } from '@ant-design/icons';
import { usePolling } from './hooks/usePolling.js';
import { api, RESOLUTIONS, SIZES, SIZE_4K } from './api.js';

const { TextArea } = Input;
const { darkAlgorithm } = theme;

// 可拖拽调整高度的输入框组件
function ResizableTextArea({ value, onChange, placeholder, minHeight = 40, maxHeight = 200 }) {
  const [height, setHeight] = useState(minHeight);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef(null);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    startYRef.current = e.clientY;
    startHeightRef.current = height;
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const deltaY = startYRef.current - e.clientY;
      const newHeight = Math.min(maxHeight, Math.max(minHeight, startHeightRef.current + deltaY));
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, minHeight, maxHeight]);

  return (
    <div className="resizable-textarea-wrapper" style={{ height }}>
      <div
        className={`resize-handle ${isDragging ? 'dragging' : ''}`}
        onMouseDown={handleMouseDown}
      />
      <TextArea
        ref={textareaRef}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="prompt-input"
        style={{ height: '100%', resize: 'none' }}
      />
    </div>
  );
}

// Blue Theme
const blueTheme = {
  algorithm: darkAlgorithm,
  token: {
    colorPrimary: '#3b82f6',
    colorBgContainer: 'rgba(15, 15, 20, 0.85)',
    colorBgElevated: 'rgba(25, 25, 35, 0.95)',
    colorBorder: 'rgba(255, 255, 255, 0.08)',
    colorText: '#e4e4e7',
    colorTextSecondary: '#a1a1aa',
    borderRadius: 12,
    fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  components: {
    Segmented: {
      itemSelectedBg: '#3b82f6',
      itemSelectedColor: '#fff',
      itemColor: '#71717a',
      trackBg: 'rgba(30, 30, 40, 0.8)',
      trackPadding: 4,
    },
    Button: {
      primaryShadow: '0 4px 20px rgba(59, 130, 246, 0.3)',
    },
    Input: {
      colorBgContainer: 'rgba(20, 20, 30, 0.8)',
    },
    Select: {
      colorBgContainer: 'rgba(20, 20, 30, 0.8)',
    },
  },
};

const TAB_OPTIONS = [
  { value: 'user', label: '我的图库', icon: <CloudUploadOutlined /> },
  { value: 'generated', label: 'AI 创作', icon: <ThunderboltOutlined /> },
  { value: 'material', label: '灵感素材', icon: <PictureOutlined /> },
];

const PAGE_SIZE = 20;

export default function App() {
  const [tab, setTab] = useState('user');
  const [images, setImages] = useState([]);
  const [selected, setSelected] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [resolution, setResolution] = useState('1k');
  const [size, setSize] = useState('auto');
  const [count, setCount] = useState(1);
  const [showApiKey, setShowApiKey] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [taskId, setTaskId] = useState(null);
  const [generating, setGenerating] = useState(false);

  const [materialPage, setMaterialPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loaderRef = useRef(null);
  const loadingRef = useRef(false);

  const loadUserOrGenerated = useCallback(async () => {
    if (tab === 'user') {
      const data = await api.getImages('user');
      const withData = await Promise.all(
        data.map(async (img) => {
          const d = await api.getImageData(img.id, 'user');
          return { ...img, data: d.data };
        })
      );
      setImages(withData);
    } else if (tab === 'generated') {
      const data = await api.getImages('generated');
      setImages(data);
    }
  }, [tab]);

  const loadMaterialsFirst = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const data = await api.getMaterials(null, 1, PAGE_SIZE);
    setImages(data.items);
    setHasMore(data.hasMore);
    setMaterialPage(2);
    loadingRef.current = false;
  }, []);

  const loadMoreMaterials = useCallback(async () => {
    if (loadingMore || !hasMore || loadingRef.current) return;
    loadingRef.current = true;
    setLoadingMore(true);
    const currentPage = materialPage;
    const data = await api.getMaterials(null, currentPage, PAGE_SIZE);
    setImages(prev => {
      const existingIds = new Set(prev.map(i => i.id));
      const newItems = data.items.filter(i => !existingIds.has(i.id));
      return [...prev, ...newItems];
    });
    setHasMore(data.hasMore);
    setMaterialPage(currentPage + 1);
    setLoadingMore(false);
    loadingRef.current = false;
  }, [materialPage, hasMore, loadingMore]);

  useEffect(() => {
    setImages([]);
    setMaterialPage(1);
    setHasMore(true);
    setLoadingMore(false);
    loadingRef.current = false;
    if (tab === 'material') {
      loadMaterialsFirst();
    } else {
      loadUserOrGenerated();
    }
  }, [tab]);

  useEffect(() => {
    if (tab !== 'material' || !hasMore || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingRef.current) {
          loadMoreMaterials();
        }
      },
      { rootMargin: '200px' }
    );
    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }
    return () => observer.disconnect();
  }, [tab, hasMore, loadingMore, loadMoreMaterials]);

  useEffect(() => {
    if (tab === 'generated' && taskId) {
      const interval = setInterval(() => loadUserOrGenerated(), 5000);
      return () => clearInterval(interval);
    }
  }, [tab, taskId, loadUserOrGenerated]);

  const handleUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        await api.uploadImage(reader.result, file.name);
        loadUserOrGenerated();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    const imageUrls = selected.map(s => s.data || s.filename).filter(Boolean);

    try {
      const result = await api.generate({
        prompt: prompt.trim(),
        resolution,
        size,
        n: count,
        image_urls: imageUrls.length > 0 ? imageUrls : undefined,
      });
      if (result.taskId) {
        setTaskId(result.taskId);
        setTab('generated');
        setSelected([]);
        loadUserOrGenerated();
      } else {
        Modal.error({ title: '生成失败', content: result.error || '请检查 API Key 是否正确' });
        setGenerating(false);
      }
    } catch (err) {
      Modal.error({ title: '请求失败', content: err.message });
      setGenerating(false);
    }
  };

  const handleTaskComplete = (data) => {
    setTaskId(null);
    setGenerating(false);
    if (data) loadUserOrGenerated();
  };

  usePolling(taskId, handleTaskComplete);

  const getImgSrc = (item) => {
    if (item.data) return item.data;
    if (item.filename) return item.filename;
    if (item.image_path) return `http://${window.location.hostname}:3001/${item.image_path}`;
    return '';
  };

  const handleDownload = async (img) => {
    const src = getImgSrc(img);
    if (!src) return;

    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `generated_${img.id || Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const masonryItems = useMemo(() => {
    const items = [];
    if (tab === 'user' || (tab === 'generated' && images.some(i => i.status === 'generating'))) {
      items.push({ key: 'first', type: 'first' });
    }
    images
      .filter(i => tab !== 'generated' || i.status !== 'generating')
      .forEach(item => {
        items.push({ key: item.id, type: 'image', data: item });
      });
    return items;
  }, [images, tab]);

  const renderMasonryItem = (item) => {
    const { type, data: img } = item;

    if (type === 'first') {
      if (tab === 'user') {
        return (
          <div className="upload-card" onClick={handleUpload}>
            <div className="upload-card-inner">
              <PlusOutlined className="upload-icon" />
              <span className="upload-text">上传图片</span>
            </div>
          </div>
        );
      }
      return (
        <div className="generating-card">
          <div className="generating-pulse" />
          <ThunderboltOutlined className="generating-icon" />
          <span>AI 创作中...</span>
        </div>
      );
    }

    const src = getImgSrc(img);

    return (
      <div className="image-card">
        <img src={src} alt="" className="image-card-img" onClick={() => {
          setPreviewImage(src);
          setPreviewData(img);
          setPreviewOpen(true);
        }} />

        {/* 删除按钮 - 圆圈 + X */}
        {tab !== 'material' && (
          <button className="delete-btn" onClick={async (e) => {
            e.stopPropagation();
            await api.deleteImage(img.id, tab === 'user' ? 'user' : 'generated');
            loadUserOrGenerated();
          }}>
            ×
          </button>
        )}

        {/* Hover 操作层 - 竖排按钮 */}
        <div className="image-card-overlay">
          <div className="overlay-actions">
            <button className="action-btn-vertical" onClick={(e) => {
              e.stopPropagation();
              setPreviewImage(src);
              setPreviewData(img);
              setPreviewOpen(true);
            }}>
              <EyeOutlined />
              <span>查看</span>
            </button>

            {tab !== 'material' && (
              <button className="action-btn-vertical" onClick={(e) => {
                e.stopPropagation();
                if (selected.length >= 16) return;
                setSelected([...selected, img]);
              }}>
                <CopyOutlined />
                <span>选择</span>
              </button>
            )}

            {(tab === 'material' && img.prompt_text) && (
              <button className="action-btn-vertical" onClick={(e) => {
                e.stopPropagation();
                setPrompt(img.prompt_text || img.prompt || '');
              }}>
                <ThunderboltOutlined />
                <span>做同款</span>
              </button>
            )}

            {tab === 'generated' && img.prompt_text && (
              <button className="action-btn-vertical" onClick={(e) => {
                e.stopPropagation();
                setPrompt(img.prompt_text || img.prompt || '');
              }}>
                <ThunderboltOutlined />
                <span>做同款</span>
              </button>
            )}

            {tab === 'generated' && (
              <button className="action-btn-vertical download-btn" onClick={(e) => {
                e.stopPropagation();
                handleDownload(img);
              }}>
                <DownloadOutlined />
                <span>下载</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const currentPrice = RESOLUTIONS.find(r => r.value === resolution)?.price || '';
  const availableSizes = resolution === '4k'
    ? SIZES.filter(s => s.value === 'auto' || SIZE_4K.includes(s.value))
    : SIZES;

  return (
    <ConfigProvider theme={blueTheme}>
      <div className="app-container">
        <div className="ambient-bg" />

        <header className="app-header">
          <div className="header-content">
            <div className="logo">
              <ThunderboltOutlined className="logo-icon" />
              <span className="logo-text">GPT Image Studio</span>
            </div>
            <Segmented
              options={TAB_OPTIONS.map(t => ({ value: t.value, label: (
                <span className="tab-label">
                  {t.icon}
                  <span>{t.label}</span>
                </span>
              )}))}
              value={tab}
              onChange={setTab}
              size="large"
            />
            <Button
              type="text"
              icon={<SettingOutlined />}
              onClick={() => setShowApiKey(true)}
              className="settings-btn"
            />
          </div>
        </header>

        <main className="main-content">
          <Masonry
            columns={{ xs: 1, sm: 2, md: 3, lg: 4, xl: 5, xxl: 6 }}
            gutter={16}
            items={masonryItems}
            itemRender={renderMasonryItem}
          />

          {tab === 'material' && hasMore && (
            <div ref={loaderRef} className="loader">
              {loadingMore && <Spin indicator={<LoadingOutlined spin style={{ color: '#3b82f6' }} />} />}
            </div>
          )}
        </main>

        <div className="bottom-panel">
          <div className="panel-inner">
            {selected.length > 0 && (
              <div className="selected-images">
                <div className="selected-header">
                  <span className="selected-label">参考图 ({selected.length}/16)</span>
                  <button className="selected-clear" onClick={() => setSelected([])}>
                    清空
                  </button>
                </div>
                <div className="selected-grid">
                  {selected.map((img, i) => {
                    const src = getImgSrc(img);
                    return (
                      <div key={i} className="selected-item">
                        <img src={src} alt="" />
                        <button className="selected-remove" onClick={() => setSelected(selected.filter((_, idx) => idx !== i))}>
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="prompt-section">
              <ResizableTextArea
                placeholder="描述你想要生成的图片..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                minHeight={40}
                maxHeight={200}
              />
            </div>

            <div className="controls-section">
              <div className="controls-left">
                <span className="price-tag">
                  {currentPrice}
                </span>

                <Select
                  value={resolution}
                  onChange={setResolution}
                  options={RESOLUTIONS.map(r => ({ value: r.value, label: r.label }))}
                  className="resolution-select"
                  popupMatchSelectWidth={false}
                />

                <Select
                  value={size}
                  onChange={setSize}
                  options={availableSizes.map(s => ({ value: s.value, label: s.label }))}
                  className="size-select"
                  popupMatchSelectWidth={false}
                />

                <Select
                  value={count}
                  onChange={setCount}
                  options={Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: `${i + 1}张` }))}
                  className="count-select"
                />
              </div>

              <Button
                type="primary"
                size="large"
                onClick={handleGenerate}
                disabled={generating || !prompt.trim()}
                loading={generating}
                className="generate-btn"
                icon={<ThunderboltOutlined />}
              >
                {generating ? '创作中' : '开始创作'}
              </Button>
            </div>
          </div>
        </div>

        <Modal
          open={previewOpen}
          onCancel={() => setPreviewOpen(false)}
          footer={null}
          width="90vw"
          centered
          className="preview-modal"
          closable={false}
        >
          <div className="preview-content">
            <img src={previewImage} alt="" className="preview-image" />
            {previewData?.prompt_text && (
              <div className="preview-info">
                <p>{previewData.prompt_text}</p>
              </div>
            )}
            <button className="preview-close" onClick={() => setPreviewOpen(false)}>
              ×
            </button>
          </div>
        </Modal>

        <Modal
          title="API Key 设置"
          open={showApiKey}
          onCancel={() => setShowApiKey(false)}
          footer={null}
          className="settings-modal"
        >
          <ApiKeyForm onClose={() => setShowApiKey(false)} />
        </Modal>
      </div>

      <style>{`
        * { box-sizing: border-box; }

        .app-container {
          min-height: 100vh;
          background: #0a0a0f;
          position: relative;
          overflow-x: hidden;
        }

        .ambient-bg {
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59, 130, 246, 0.1), transparent),
            radial-gradient(ellipse 60% 40% at 80% 60%, rgba(139, 92, 246, 0.05), transparent),
            radial-gradient(ellipse 50% 30% at 20% 80%, rgba(59, 130, 246, 0.05), transparent);
          pointer-events: none;
          z-index: 0;
        }

        .app-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          background: rgba(10, 10, 15, 0.8);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .header-content {
          max-width: 1600px;
          margin: 0 auto;
          padding: 12px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .logo-icon {
          font-size: 24px;
          color: #3b82f6;
          filter: drop-shadow(0 0 10px rgba(59, 130, 246, 0.5));
        }

        .logo-text {
          font-size: 18px;
          font-weight: 600;
          color: #fff;
          letter-spacing: -0.5px;
        }

        .tab-label {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .settings-btn {
          color: #71717a;
          font-size: 18px;
        }

        .settings-btn:hover {
          color: #3b82f6;
        }

        .main-content {
          position: relative;
          z-index: 1;
          padding: 100px 24px 320px;
          max-width: 1600px;
          margin: 0 auto;
        }

        .upload-card {
          aspect-ratio: 1;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(59, 130, 246, 0.02));
          border: 2px dashed rgba(59, 130, 246, 0.3);
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .upload-card:hover {
          border-color: rgba(59, 130, 246, 0.6);
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05));
          transform: scale(1.02);
        }

        .upload-card-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .upload-icon {
          font-size: 48px;
          color: #3b82f6;
          opacity: 0.8;
        }

        .upload-text {
          color: #a1a1aa;
          font-size: 14px;
        }

        .generating-card {
          aspect-ratio: 1;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.05));
          border: 1px solid rgba(59, 130, 246, 0.2);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          position: relative;
          overflow: hidden;
        }

        .generating-pulse {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, rgba(59, 130, 246, 0.2), transparent 70%);
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }

        .generating-icon {
          font-size: 32px;
          color: #3b82f6;
          position: relative;
          z-index: 1;
          animation: spin 2s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .generating-card span {
          color: #60a5fa;
          font-size: 14px;
          position: relative;
          z-index: 1;
        }

        .image-card {
          border-radius: 16px;
          overflow: hidden;
          background: rgba(20, 20, 30, 0.5);
          position: relative;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .image-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
        }

        .image-card-img {
          width: 100%;
          display: block;
          cursor: pointer;
          transition: transform 0.3s ease;
        }

        .image-card:hover .image-card-img {
          transform: scale(1.02);
        }

        /* 删除按钮 - 圆圈 + X */
        .delete-btn {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.8);
          background: rgba(0, 0, 0, 0.5);
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: all 0.2s ease;
          font-size: 18px;
          font-weight: 300;
          line-height: 1;
          z-index: 10;
        }

        .image-card:hover .delete-btn {
          opacity: 1;
        }

        .delete-btn:hover {
          background: #ef4444;
          border-color: #ef4444;
          transform: scale(1.1);
        }

        .image-card-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          opacity: 0;
          transition: opacity 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .image-card:hover .image-card-overlay {
          opacity: 1;
        }

        /* 竖排按钮 */
        .overlay-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .action-btn-vertical {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 8px;
          border: none;
          background: rgba(59, 130, 246, 0.9);
          color: #fff;
          cursor: pointer;
          font-size: 15px;
          font-weight: 500;
          transition: all 0.2s ease;
          min-width: 100px;
        }

        .action-btn-vertical:hover {
          background: #2563eb;
          transform: scale(1.05);
        }

        .action-btn-vertical.download-btn {
          background: rgba(34, 197, 94, 0.9);
        }

        .action-btn-vertical.download-btn:hover {
          background: #16a34a;
        }

        .loader {
          text-align: center;
          padding: 40px 0;
        }

        .bottom-panel {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 100;
          background: rgba(10, 10, 15, 0.95);
          backdrop-filter: blur(20px);
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .panel-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 16px 24px;
        }

        .selected-images {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 12px;
          padding: 12px;
          background: rgba(20, 20, 30, 0.5);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .selected-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .selected-label {
          color: #a1a1aa;
          font-size: 13px;
          font-weight: 500;
        }

        .selected-clear {
          background: transparent;
          border: none;
          color: #71717a;
          font-size: 12px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          transition: all 0.2s ease;
        }

        .selected-clear:hover {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
        }

        .selected-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .selected-item {
          position: relative;
          width: 72px;
          height: 72px;
        }

        .selected-item img {
          width: 100%;
          height: 100%;
          border-radius: 10px;
          object-fit: cover;
          border: 2px solid rgba(59, 130, 246, 0.4);
          transition: border-color 0.2s ease;
        }

        .selected-item:hover img {
          border-color: rgba(59, 130, 246, 0.8);
        }

        .selected-remove {
          position: absolute;
          top: -6px;
          right: -6px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: none;
          background: #ef4444;
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 300;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .selected-item:hover .selected-remove {
          opacity: 1;
        }

        .prompt-section {
          margin-bottom: 12px;
        }

        .resizable-textarea-wrapper {
          position: relative;
          border-radius: 12px;
          background: rgba(20, 20, 30, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.08);
          overflow: hidden;
        }

        .resize-handle {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 6px;
          cursor: ns-resize;
          background: transparent;
          z-index: 10;
          transition: background 0.2s ease;
        }

        .resize-handle:hover,
        .resize-handle.dragging {
          background: rgba(59, 130, 246, 0.3);
        }

        .resize-handle::after {
          content: '';
          position: absolute;
          top: 2px;
          left: 50%;
          transform: translateX(-50%);
          width: 30px;
          height: 2px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 1px;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .resize-handle:hover::after,
        .resize-handle.dragging::after {
          opacity: 1;
        }

        .prompt-input {
          background: transparent !important;
          border: none !important;
          border-radius: 12px !important;
          font-size: 15px !important;
          padding: 10px 14px !important;
        }

        .prompt-input:focus {
          box-shadow: none !important;
        }

        .controls-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }

        .controls-left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .price-tag {
          padding: 8px 14px;
          background: rgba(34, 197, 94, 0.1);
          border-radius: 8px;
          color: #22c55e;
          font-size: 14px;
          font-weight: 600;
        }

        .resolution-select, .size-select, .count-select {
          min-width: 90px;
        }

        .generate-btn {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
          border: none !important;
          font-weight: 600 !important;
          padding: 0 32px !important;
          height: 44px !important;
          border-radius: 12px !important;
        }

        .generate-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4) !important;
        }

        .generate-btn:disabled {
          background: rgba(59, 130, 246, 0.3) !important;
        }

        .preview-modal .ant-modal-content {
          background: transparent !important;
          box-shadow: none !important;
        }

        .preview-content {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .preview-image {
          max-width: 90vw;
          max-height: 80vh;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }

        .preview-info {
          margin-top: 16px;
          padding: 16px 24px;
          background: rgba(20, 20, 30, 0.9);
          border-radius: 12px;
          max-width: 600px;
        }

        .preview-info p {
          color: #e4e4e7;
          margin: 0;
          font-size: 14px;
          line-height: 1.6;
        }

        .preview-close {
          position: fixed;
          top: 24px;
          right: 24px;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: none;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          color: #fff;
          font-size: 28px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .preview-close:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .settings-modal .ant-modal-content {
          background: rgba(20, 20, 30, 0.95) !important;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
        }

        .settings-modal .ant-modal-header {
          background: transparent !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .settings-modal .ant-modal-title {
          color: #fff !important;
        }

        @media (max-width: 768px) {
          .header-content {
            padding: 12px 16px;
          }

          .logo-text {
            display: none;
          }

          .main-content {
            padding: 90px 16px 340px;
          }

          .panel-inner {
            padding: 12px 16px;
          }

          .controls-left {
            width: 100%;
            justify-content: flex-start;
          }

          .generate-btn {
            width: 100%;
          }
        }
      `}</style>
    </ConfigProvider>
  );
}

function ApiKeyForm({ onClose }) {
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
        placeholder="输入你的 API Key..."
        value={key}
        onChange={(e) => setKey(e.target.value)}
        style={{ borderRadius: 10 }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <Button onClick={onClose}>取消</Button>
        <Button type="primary" loading={saving} onClick={handleSave}>
          保存
        </Button>
      </div>
      <p style={{ color: '#71717a', fontSize: 13, margin: 0 }}>
        从 <a href="https://apimart.ai/keys" target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>apimart.ai/keys</a> 获取你的 API Key
      </p>
    </Space>
  );
}
