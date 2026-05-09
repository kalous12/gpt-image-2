import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ConfigProvider, theme, Segmented, Masonry, Input, Select, Button, Modal, Space, Spin, message } from 'antd';
import { PlusOutlined, DeleteOutlined, SettingOutlined, EyeOutlined, CopyOutlined, LoadingOutlined, ThunderboltOutlined, PictureOutlined, CloudUploadOutlined, DownloadOutlined, UpOutlined, DownOutlined } from '@ant-design/icons';
import { api, RESOLUTIONS, SIZES, SIZE_4K } from './api.js';
import './App.css';

const { TextArea } = Input;
const { darkAlgorithm } = theme;

// 竖向分页器组件
function VerticalPagination({ current, total, pageSize, onChange }) {
  const totalPages = Math.ceil(total / pageSize) || 1;
  const [inputValue, setInputValue] = useState(String(current));

  useEffect(() => {
    setInputValue(String(current));
  }, [current]);

  const handlePrev = () => {
    if (current > 1) onChange(current - 1);
  };

  const handleNext = () => {
    if (current < totalPages) onChange(current + 1);
  };

  const handleJump = (e) => {
    if (e.key === 'Enter') {
      const page = parseInt(inputValue);
      if (page >= 1 && page <= totalPages) {
        onChange(page);
      } else {
        setInputValue(String(current));
      }
    }
  };

  return (
    <div className="vertical-pagination">
      <button className="pagination-btn" onClick={handlePrev} disabled={current <= 1}>
        <UpOutlined />
      </button>
      <input
        className="pagination-input"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value.replace(/\D/g, ''))}
        onKeyDown={handleJump}
      />
      <span className="pagination-total">/ {totalPages}</span>
      <button className="pagination-btn" onClick={handleNext} disabled={current >= totalPages}>
        <DownOutlined />
      </button>
    </div>
  );
}

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

// 统一的数据加载状态管理，支持多页缓存和无限滚动
function useDataLoader() {
  const [state, setState] = useState({
    pages: {},        // 缓存各页数据 { pageNum: [items] }
    loadedPages: [],  // 已加载的页码列表
    loading: false,
    error: null,
    total: 0,
  });

  // 使用 ref 跟踪已加载页面，避免闭包问题
  const loadedPagesRef = useRef(new Set());
  const loadingPagesRef = useRef(new Set()); // 正在加载中的页面

  const load = useCallback(async (tab, page = 1, limit = PAGE_SIZE) => {
    // 检查是否已加载或正在加载
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

  // 预加载某一页（不改变当前页）
  const preload = useCallback(async (tab, page, limit = PAGE_SIZE) => {
    // 使用 ref 检查，避免闭包问题
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

  // 清空缓存
  const clearCache = useCallback(() => {
    loadedPagesRef.current.clear();
    loadingPagesRef.current.clear();
    setState({ pages: {}, loadedPages: [], total: 0, loading: false, error: null });
  }, []);

  // 获取所有已加载页的数据（按页码顺序合并）
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
    clearCache,
  };
}

export default function App() {
  const [tab, setTab] = useState('user');
  const [selected, setSelected] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [resolution, setResolution] = useState('1k');
  const [size, setSize] = useState('auto');
  const [count, setCount] = useState(1);
  const [showApiKey, setShowApiKey] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // 统一的数据加载
  const { getAllImages, loadedPages, loading, load, clearCache, total } = useDataLoader();

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(total / PAGE_SIZE) || 0;

  // 获取所有已加载的图片
  const images = getAllImages();

  // 拖拽上传处理
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

    // 保存当前位置
    const savedPage = currentPage;

    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          await api.uploadImage(reader.result, file.name);
          // 重新加载当前页
          load('user', savedPage);
          message.success(`${file.name} 上传成功`);
        } catch (err) {
          message.error(`${file.name} 上传失败: ${err.message}`);
        }
      };
      reader.readAsDataURL(file);
    }
  }, [tab, load, currentPage]);

  // 计算当前可视页码（基于已加载的图片数量）
  const updateCurrentPageFromScroll = useCallback(() => {
    if (totalPages <= 1 || loadedPages.length === 0) return;

    const { scrollTop, clientHeight } = document.documentElement;
    // 找到当前可视区域中间位置对应的图片索引
    const viewportMiddle = scrollTop + clientHeight / 2;

    // 获取所有图片元素
    const imageCards = document.querySelectorAll('.image-card, .upload-card, .generating-card');
    if (imageCards.length === 0) return;

    // 找到最接近视口中间的图片
    let closestIndex = 0;
    let minDistance = Infinity;
    imageCards.forEach((card, index) => {
      const rect = card.getBoundingClientRect();
      const cardMiddle = rect.top + rect.height / 2;
      const distance = Math.abs(cardMiddle - clientHeight / 2);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    // 根据图片索引计算页码
    const imageIndex = closestIndex + 1; // 1-based
    const newPage = Math.ceil(imageIndex / PAGE_SIZE);
    const clampedPage = Math.max(1, Math.min(totalPages, newPage));

    if (clampedPage !== currentPage) {
      setCurrentPage(clampedPage);
    }
  }, [totalPages, loadedPages.length, currentPage]);

  // 是否有正在生成的任务（从数据库列表判断）
  const generating = images.some(i => i.status === 'generating');

  const loadGenerated = useCallback(async (page = 1) => {
    return load('generated', page);
  }, [load]);

  const showPagination = totalPages > 1;

  const handlePageChange = useCallback(async (page) => {
    setCurrentPage(page);

    // 计算目标图片索引
    const targetIndex = (page - 1) * PAGE_SIZE;
    const imageCards = document.querySelectorAll('.image-card, .upload-card, .generating-card');

    // 如果目标图片还没加载，先加载目标页及相邻页
    if (!loadedPages.includes(page)) {
      await load(tab, page);
      if (page > 1) load(tab, page - 1);
      if (page < totalPages) load(tab, page + 1);

      // 等待渲染完成后滚动
      setTimeout(() => {
        const newCards = document.querySelectorAll('.image-card, .upload-card, .generating-card');
        if (newCards[targetIndex]) {
          newCards[targetIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    } else if (imageCards[targetIndex]) {
      imageCards[targetIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (imageCards.length > 0) {
      // 滚动到最后一个已加载的图片
      imageCards[imageCards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [tab, loadedPages, load, totalPages]);

  // 滚动监听：更新当前页码 + 预加载后续页
  useEffect(() => {
    if (totalPages <= 1) return;

    let loadingPages = new Set(); // 防止重复加载

    const handleScroll = () => {
      updateCurrentPageFromScroll();

      // 预加载：当前页 + 2 页
      const lastLoadedPage = loadedPages[loadedPages.length - 1] || 0;
      const needLoadUpTo = currentPage + 2;

      // 只加载未缓存且未在加载中的页
      for (let page = lastLoadedPage + 1; page <= needLoadUpTo && page <= totalPages; page++) {
        if (!loadingPages.has(page)) {
          loadingPages.add(page);
          load(tab, page).finally(() => {
            loadingPages.delete(page);
          });
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [tab, totalPages, loadedPages, currentPage, load, updateCurrentPageFromScroll]);

  // 初始加载
  useEffect(() => {
    setCurrentPage(1);
    clearCache();
    // 初始加载前3页
    load(tab, 1);
    load(tab, 2);
    load(tab, 3);
  }, [tab, load, clearCache]);

  useEffect(() => {
    // 有生成中的任务时定期刷新数据
    if (tab === 'generated' && generating) {
      const interval = setInterval(() => {
        // 刷新所有已加载的页面，保持当前位置
        for (const page of loadedPages) {
          load('generated', page);
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [tab, generating, load, loadedPages]);

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
          // 重新加载当前页，保持位置
          load('user', currentPage);
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
    if (!prompt.trim() || generating) return;

    // 构建参考图列表 - 直接传递文件路径，后端处理
    const imageUrls = selected.map(s => {
      if (s.data) return s.data;
      if (s.file_path) return s.file_path;
      if (s.filename) return s.filename;
      return null;
    }).filter(Boolean);

    try {
      const result = await api.generate({
        prompt: prompt.trim(),
        resolution,
        size,
        n: count,
        image_urls: imageUrls.length > 0 ? imageUrls : undefined,
      });

      if (result.taskId) {
        setTab('generated');
        setSelected([]);

        // 显示提示
        if (result.cached) {
          message.info('使用缓存结果');
        } else if (result.duplicate) {
          message.info('已有相同请求正在生成中');
        }

        setCurrentPage(1);
        loadGenerated(1);
      } else {
        const errorMsg = getErrorMessage(result);
        Modal.error({ title: '生成失败', content: errorMsg });
      }
    } catch (err) {
      Modal.error({ title: '请求失败', content: err.message });
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
    // file_path 现在已经是可直接访问的相对路径（如 /uploads/xxx.png）
    if (item.file_path) return item.file_path;
    // 兼容旧的 data 字段
    if (item.data) return item.data;
    // 兼容旧的 filename 字段
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

    // 如果没有图片源，显示占位符
    if (!src) {
      return (
        <div className="image-card image-card-placeholder">
          <div className="placeholder-content">
            <PictureOutlined className="placeholder-icon" />
            <span>图片加载中...</span>
          </div>
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

        {/* 删除按钮 - 圆圈 + X */}
        {tab !== 'material' && (
          <button className="delete-btn" onClick={async (e) => {
            e.stopPropagation();
            try {
              await api.deleteImage(img.id, tab === 'user' ? 'user' : 'generated');
              // 清空缓存并重新加载当前页及相邻页
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

  const currentPrice = RESOLUTIONS.find(r => r.value === resolution)?.price || '';
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

        {/* 拖拽上传提示 */}
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
                disabled={!prompt.trim()}
                loading={generating}
                className="generate-btn"
                icon={<ThunderboltOutlined />}
              >
                {generating ? '创作中...' : '开始创作'}
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

      <style>{`
        * { box-sizing: border-box; }

        .app-container {
          min-height: 100vh;
          background: #0a0a0f;
          position: relative;
          overflow-x: hidden;
        }

        .drag-overlay {
          position: fixed;
          inset: 0;
          background: rgba(59, 130, 246, 0.15);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }

        .drag-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 48px 64px;
          background: rgba(20, 20, 30, 0.9);
          border: 2px dashed #3b82f6;
          border-radius: 16px;
        }

        .drag-icon {
          font-size: 64px;
          color: #3b82f6;
        }

        .drag-text {
          font-size: 18px;
          color: #e4e4e7;
          font-weight: 500;
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

        .image-card-placeholder {
          aspect-ratio: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .placeholder-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          color: #71717a;
        }

        .placeholder-icon {
          font-size: 32px;
          opacity: 0.5;
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
          padding: 8px;
        }

        .image-card:hover .image-card-overlay {
          opacity: 1;
        }

        /* 竖排按钮 */
        .overlay-actions {
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: 100%;
          max-width: 120px;
        }

        .action-btn-vertical {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 6px;
          border: none;
          background: rgba(59, 130, 246, 0.9);
          color: #fff;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .action-btn-vertical:hover {
          background: #2563eb;
          transform: scale(1.02);
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

        .vertical-pagination {
          position: fixed;
          right: 24px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 50;
          background: rgba(20, 20, 30, 0.9);
          backdrop-filter: blur(10px);
          border-radius: 12px;
          padding: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .pagination-btn {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(30, 30, 40, 0.8);
          color: #a1a1aa;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .pagination-btn:hover:not(:disabled) {
          color: #3b82f6;
          border-color: rgba(59, 130, 246, 0.5);
          background: rgba(59, 130, 246, 0.1);
        }

        .pagination-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .pagination-input {
          width: 48px;
          height: 32px;
          text-align: center;
          background: rgba(30, 30, 40, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: #fff;
          font-size: 14px;
          outline: none;
        }

        .pagination-input:focus {
          border-color: #3b82f6;
        }

        .pagination-total {
          color: #71717a;
          font-size: 12px;
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

        .selected-placeholder {
          width: 100%;
          height: 100%;
          border-radius: 10px;
          background: rgba(59, 130, 246, 0.1);
          border: 2px dashed rgba(59, 130, 246, 0.3);
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
