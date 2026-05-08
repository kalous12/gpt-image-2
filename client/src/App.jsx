import { useState, useEffect, useCallback } from 'react';
import { FloatingPanel } from './components/FloatingPanel.jsx';
import { ImageCard } from './components/ImageCard.jsx';
import { ImageModal } from './components/ImageModal.jsx';
import { SelectedImages } from './components/SelectedImages.jsx';
import { PromptInput } from './components/PromptInput.jsx';
import { ActionBar } from './components/ActionBar.jsx';
import { ApiKeyModal } from './components/ApiKeyModal.jsx';
import { usePolling } from './hooks/usePolling.js';
import { api } from './api.js';

export default function App() {
  const [tab, setTab] = useState('user');
  const [images, setImages] = useState([]);
  const [selected, setSelected] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [resolution, setResolution] = useState('1k');
  const [size, setSize] = useState('auto');
  const [count, setCount] = useState(1);
  const [showApiKey, setShowApiKey] = useState(false);
  const [modalImage, setModalImage] = useState(null);
  const [modalTab, setModalTab] = useState(null);
  const [taskId, setTaskId] = useState(null);
  const [generating, setGenerating] = useState(false);

  const loadImages = useCallback(async () => {
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
    } else {
      const data = await api.getMaterials();
      setImages(data);
    }
  }, [tab]);

  useEffect(() => { loadImages(); }, [loadImages]);

  useEffect(() => {
    if (tab === 'generated' && taskId) {
      const interval = setInterval(() => loadImages(), 5000);
      return () => clearInterval(interval);
    }
  }, [tab, taskId, loadImages]);

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
        loadImages();
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
        loadImages();
      } else {
        alert(result.error || '生成失败');
        setGenerating(false);
      }
    } catch (err) {
      alert('请求失败: ' + err.message);
      setGenerating(false);
    }
  };

  const handleTaskComplete = (data) => {
    setTaskId(null);
    setGenerating(false);
    if (data) loadImages();
  };

  usePolling(taskId, handleTaskComplete);

  return (
    <div style={{
      background: '#0a0a0a', minHeight: '100vh', color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <FloatingPanel current={tab} onChange={setTab} />

      <div style={{ padding: '80px 16px 280px', columnCount: 4, columnGap: 12 }}>
        {(tab === 'user' || (tab === 'generated' && images.some(i => i.status === 'generating'))) && (
          <div style={{ breakInside: 'avoid', marginBottom: 12 }}>
            <ImageCard
              tab={tab}
              isFirst
              item={images.find(i => i.status === 'generating')}
              onUpload={handleUpload}
            />
          </div>
        )}

        {images.filter(i => tab !== 'generated' || i.status !== 'generating').map(item => (
          <div key={item.id} style={{ breakInside: 'avoid', marginBottom: 12 }}>
            <ImageCard
              item={item}
              tab={tab}
              onView={(img) => { setModalImage(img); setModalTab(tab); }}
              onSelect={(img) => {
                if (selected.length >= 16) return;
                setSelected([...selected, img]);
              }}
              onRedo={(img) => setPrompt(img.prompt_text || img.prompt || '')}
              onDelete={async () => {
                await api.deleteImage(item.id, tab === 'user' ? 'user' : 'generated');
                loadImages();
              }}
            />
          </div>
        ))}
      </div>

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: '#111', borderTop: '1px solid #222',
      }}>
        <SelectedImages
          images={selected}
          onRemove={(i) => setSelected(selected.filter((_, idx) => idx !== i))}
          onView={(img) => { setModalImage(img); setModalTab('user'); }}
        />
        <PromptInput value={prompt} onChange={setPrompt} />
        <ActionBar
          resolution={resolution}
          onResolutionChange={setResolution}
          size={size}
          onSizeChange={setSize}
          count={count}
          onCountChange={setCount}
          onOpenApiKey={() => setShowApiKey(true)}
          onGenerate={handleGenerate}
          generating={generating}
        />
      </div>

      {modalImage && (
        <ImageModal image={modalImage} tab={modalTab} onClose={() => setModalImage(null)} />
      )}
      {showApiKey && (
        <ApiKeyModal onClose={() => setShowApiKey(false)} />
      )}
    </div>
  );
}
