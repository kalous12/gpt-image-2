import { useState, useEffect, useCallback, useMemo } from 'react';
import { ConfigProvider, theme, Segmented, Masonry, Select, Button, Modal, message } from 'antd';
import { PlusOutlined, SettingOutlined, EyeOutlined, CopyOutlined, ThunderboltOutlined, PictureOutlined, CloudUploadOutlined, DownloadOutlined } from '@ant-design/icons';
import { api, RESOLUTIONS, SIZES, SIZE_4K, MODELS, QUALITIES, loadPricing, getPrice } from './api.js';
import { useDataLoader, PAGE_SIZE } from './hooks/useDataLoader.js';
import { VerticalPagination } from './components/VerticalPagination.jsx';
import { ResizableTextArea } from './components/ResizableTextArea.jsx';
import { ApiKeyForm } from './components/ApiKeyForm.jsx';
import './App.css';

const { darkAlgorithm } = theme;

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

export default function App() {
  const [tab, setTab] = useState('user');
  const [selected, setSelected] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [resolution, setResolution] = useState('1k');
  const [size, setSize] = useState('auto');
  const [count, setCount] = useState(1);
  const [showApiKey, setShowApiKey] = useState(false);
  const [currentModel, setCurrentModel] = useState('gpt-image-2');
  const [currentQuality, setCurrentQuality] = useState('auto');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { getAllImages, loadedPages, loading, load, refresh, clearCache, total } = useDataLoader();

  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(total / PAGE_SIZE) || 0;

  const images = getAllImages();

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (tab === 'user') {
      setIsDragging(true);
    }
  }, [tab]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (tab !== 'user') return;

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const savedPage = currentPage;

    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          await api.uploadImage(reader.result, file.name);
          refresh('user', savedPage);
          message.success(`${file.name} 上传成功`);
        } catch (err) {
          message.error(`${file.name} 上传失败: ${err.message}`);
        }
      };
      reader.readAsDataURL(file);
    }
  }, [tab, load, refresh, currentPage]);

  const updateCurrentPageFromScroll = useCallback(() => {
    if (totalPages <= 1 || loadedPages.length === 0) return;

    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    const totalItems = Math.min(images.length + 1, loadedPages.length * PAGE_SIZE + 1);
    if (totalItems === 0 || scrollHeight <= clientHeight) return;

    const avgItemHeight = scrollHeight / totalItems;
    const currentIndex = Math.floor((scrollTop + clientHeight / 2) / avgItemHeight);
    const newPage = Math.ceil(currentIndex / PAGE_SIZE);
    const clampedPage = Math.max(1, Math.min(totalPages, newPage));

    if (clampedPage !== currentPage) {
      setCurrentPage(clampedPage);
    }
  }, [totalPages, loadedPages.length, currentPage, images.length]);

  const generating = images.some(i => i.status === 'generating');

  const loadGenerated = useCallback(async (page = 1) => {
    return load('generated', page);
  }, [load]);

  const showPagination = totalPages > 1;

  const handlePageChange = useCallback(async (page) => {
    setCurrentPage(page);

    const targetIndex = (page - 1) * PAGE_SIZE;
    const imageCards = document.querySelectorAll('.image-card, .upload-card, .generating-card');

    if (!loadedPages.includes(page)) {
      await load(tab, page);
      if (page > 1) load(tab, page - 1);
      if (page < totalPages) load(tab, page + 1);

      setTimeout(() => {
        const newCards = document.querySelectorAll('.image-card, .upload-card, .generating-card');
        if (newCards[targetIndex]) {
          newCards[targetIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    } else if (imageCards[targetIndex]) {
      imageCards[targetIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (imageCards.length > 0) {
      imageCards[imageCards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [tab, loadedPages, load, totalPages]);

  useEffect(() => {
    if (totalPages <= 1) return;

    let loadingPages = new Set();
    let throttleTimer = null;

    const handleScroll = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        throttleTimer = null;
        updateCurrentPageFromScroll();

        const lastLoadedPage = loadedPages[loadedPages.length - 1] || 0;
        const needLoadUpTo = currentPage + 2;

        for (let page = lastLoadedPage + 1; page <= needLoadUpTo && page <= totalPages; page++) {
          if (!loadingPages.has(page)) {
            loadingPages.add(page);
            load(tab, page).finally(() => {
              loadingPages.delete(page);
            });
          }
        }
      }, 200);
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [tab, totalPages, loadedPages, currentPage, load, updateCurrentPageFromScroll]);

  useEffect(() => {
    setCurrentPage(1);
    clearCache();
    load(tab, 1);
    load(tab, 2);
    load(tab, 3);
  }, [tab, load, clearCache]);

  useEffect(() => {
    loadPricing();
  }, []);

  useEffect(() => {
    api.getAllSettings().then(r => {
      setCurrentModel(r.model || 'gpt-image-2');
      setCurrentQuality(r.quality || 'auto');
    });
  }, []);

  const handleModelChange = async (model) => {
    setCurrentModel(model);
    try {
      await api.saveModel(model);
      // 切换到 official 模型时，设置默认值
      if (model === 'gpt-image-2-official') {
        setCurrentQuality('low');
        setSize('16:9');
        await api.saveQuality('low');
      } else {
        // 非 official 模型，尺寸默认为自动
        setSize('auto');
      }
    } catch (err) {
      console.error('Failed to save model:', err);
    }
  };

  const handleQualityChange = async (quality) => {
    setCurrentQuality(quality);
    try {
      await api.saveQuality(quality);
    } catch (err) {
      console.error('Failed to save quality:', err);
    }
  };

  useEffect(() => {
    if (tab === 'generated' && generating) {
      const interval = setInterval(() => {
        for (const page of loadedPages) {
          refresh('generated', page);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [tab, generating, refresh, loadedPages]);

  const handleUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          await api.uploadImage(reader.result, file.name);
          refresh('user', currentPage);
          message.success('上传成功');
        } catch (err) {
          message.error('上传失败: ' + err.message);
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || submitting) return;

    const imageUrls = selected.map(s => {
      if (s.data) return s.data;
      if (s.file_path) return s.file_path;
      if (s.filename) return s.filename;
      return null;
    }).filter(Boolean);

    setSubmitting(true);
    try {
      const requestBody = {
        prompt: prompt.trim(),
        resolution,
        size,
        n: count,
        model: currentModel,
        image_urls: imageUrls.length > 0 ? imageUrls : undefined,
      };

      if (currentModel === 'gpt-image-2-official') {
        requestBody.quality = currentQuality;
      }

      const result = await api.generate(requestBody);

      if (result.taskId) {
        message.success('提交成功');
        setTab('generated');
        setSelected([]);

        if (result.cached) {
          message.info('使用缓存结果');
        } else if (result.duplicate) {
          message.info('已有相同请求正在生成中');
        }

        // 刷新创作库
        clearCache();
        load('generated', 1);
        load('generated', 2);
      } else {
        const errorMsg = getErrorMessage(result);
        Modal.error({ title: '生成失败', content: errorMsg });
      }
    } catch (err) {
      Modal.error({ title: '请求失败', content: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const getErrorMessage = (result) => {
    if (result.error) return result.error;
    switch (result.code) {
      case 401: return 'API Key 无效，请检查设置';
      case 402: return '账户余额不足，请充值后再试';
      case 429: return '请求过于频繁，请稍后再试';
      case 503: return '服务暂时不可用，请稍后再试';
      default: return '请检查 API Key 是否正确';
    }
  };

  const getImgSrc = (item) => {
    if (item.file_path) return item.file_path;
    if (item.data) return item.data;
    if (item.filename) return item.filename;
    if (item.image_path) return item.image_path;
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
    if (tab === 'user') {
      items.push({ key: 'upload', type: 'upload' });
    }
    if (tab === 'generated') {
      images
        .filter(i => i.status === 'generating')
        .forEach(img => {
          items.push({ key: `gen-${img.id}`, type: 'generating', data: img });
        });
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

    if (type === 'upload') {
      return (
        <div className="upload-card" onClick={handleUpload}>
          <div className="upload-card-inner">
            <PlusOutlined className="upload-icon" />
            <span className="upload-text">上传图片</span>
          </div>
        </div>
      );
    }

    if (type === 'generating') {
      return (
        <div className="generating-card">
          <div className="generating-pulse" />
          <ThunderboltOutlined className="generating-icon" />
          <span>AI 创作中...</span>
          <button
            className="delete-btn"
            onClick={async (e) => {
              e.stopPropagation();
              try {
                await api.cancelTask(img.task_id);
                refresh('generated', currentPage);
                message.success('已取消关注');
              } catch (err) {
                message.error('取消失败: ' + err.message);
              }
            }}
          >
            ×
          </button>
        </div>
      );
    }

    const src = getImgSrc(img);

    if (!src) {
      return (
        <div className="image-card image-card-placeholder">
          <div className="placeholder-content">
            <PictureOutlined className="placeholder-icon" />
            <span>{img.status === 'failed' ? '生成失败' : '图片加载中...'}</span>
          </div>
          {tab === 'generated' && img.task_id && (
            <div className="placeholder-actions">
              <button className="retry-btn" onClick={async (e) => {
                e.stopPropagation();
                try {
                  const result = await api.getTask(img.task_id, true);
                  if (result.data?.status === 'completed' && result.data?.filePath) {
                    refresh('generated', currentPage);
                    message.success('已获取图片');
                  } else if (result.data?.status === 'failed') {
                    message.error('生成失败: ' + (result.data?.error?.message || result.data?.errorMessage || '未知错误'));
                  } else {
                    message.info('任务仍在处理中');
                  }
                } catch (err) {
                  message.error('查询失败: ' + err.message);
                }
              }}>
                重新获取
              </button>
            </div>
          )}
          {tab !== 'material' && (
            <button className="delete-btn" onClick={async (e) => {
              e.stopPropagation();
              try {
                await api.deleteImage(img.id, tab === 'user' ? 'user' : 'generated');
                clearCache();
                load(tab, Math.max(1, currentPage - 1));
                load(tab, currentPage);
                if (currentPage < totalPages) load(tab, currentPage + 1);
                message.success('删除成功');
              } catch (err) {
                message.error('删除失败: ' + err.message);
              }
            }}>
              ×
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="image-card">
        <img src={src} alt="" className="image-card-img" onClick={() => {
          setPreviewImage(src);
          setPreviewData(img);
          setPreviewOpen(true);
        }} />

        {tab !== 'material' && (
          <button className="delete-btn" onClick={async (e) => {
            e.stopPropagation();
            try {
              await api.deleteImage(img.id, tab === 'user' ? 'user' : 'generated');
              clearCache();
              load(tab, Math.max(1, currentPage - 1));
              load(tab, currentPage);
              if (currentPage < totalPages) load(tab, currentPage + 1);
              message.success('删除成功');
            } catch (err) {
              message.error('删除失败: ' + err.message);
            }
          }}>
            ×
          </button>
        )}

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

            {tab === 'generated' && img.prompt && (
              <button className="action-btn-vertical" onClick={(e) => {
                e.stopPropagation();
                setPrompt(img.prompt);
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

  const currentPrice = getPrice(currentModel, resolution, size, currentQuality) || RESOLUTIONS.find(r => r.value === resolution)?.price || '';
  const availableSizes = resolution === '4k'
    ? SIZES.filter(s => s.value === 'auto' || SIZE_4K.includes(s.value))
    : SIZES;

  return (
    <ConfigProvider theme={blueTheme}>
      <div
        className="app-container"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="ambient-bg" />

        {isDragging && (
          <div className="drag-overlay">
            <div className="drag-content">
              <CloudUploadOutlined className="drag-icon" />
              <span className="drag-text">释放以上传图片</span>
            </div>
          </div>
        )}

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

          {showPagination && (
            <VerticalPagination
              current={currentPage}
              total={total}
              pageSize={PAGE_SIZE}
              onChange={handlePageChange}
            />
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
                        {src ? <img src={src} alt="" /> : <div className="selected-placeholder" />}
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
                minHeight={120}
                maxHeight={400}
              />
            </div>

            <div className="controls-section">
              <div className="controls-left">
                <span className="price-tag">
                  {currentPrice}
                </span>

                <Select
                  value={currentModel}
                  onChange={handleModelChange}
                  options={MODELS.map(m => ({ value: m.value, label: m.label }))}
                  className="model-select"
                  popupMatchSelectWidth={false}
                />

                {currentModel === 'gpt-image-2-official' && (
                  <Select
                    value={currentQuality}
                    onChange={handleQualityChange}
                    options={QUALITIES.map(q => ({ value: q.value, label: q.label }))}
                    className="quality-select"
                    popupMatchSelectWidth={false}
                  />
                )}

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
                  options={Array.from({ length: 4 }, (_, i) => ({ value: i + 1, label: `${i + 1}张` }))}
                  className="count-select"
                />
              </div>

              <Button
                type="primary"
                size="large"
                onClick={handleGenerate}
                disabled={!prompt.trim() || submitting}
                loading={submitting}
                className="generate-btn"
                icon={<ThunderboltOutlined />}
              >
                {submitting ? '提交中...' : '开始创作'}
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
            {previewData?.prompt && (
              <div className="preview-info">
                <p>{previewData.prompt}</p>
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
    </ConfigProvider>
  );
}
