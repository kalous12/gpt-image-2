export function ImageModal({ image, tab, onClose }) {
  if (!image) return null;

  const imgSrc = image.data || image.filename || image.image_path || '';

  return (
    <div
      data-testid="image-modal"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.9)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 40,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '90vw', maxHeight: '90vh', display: 'flex',
          gap: 24, background: '#1a1a1a', borderRadius: 12, padding: 24,
        }}
      >
        <img src={imgSrc} alt="" style={{
          maxWidth: '60vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8,
        }} />
        <div style={{ maxWidth: 300, overflow: 'auto' }}>
          {image.prompt_text && (
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ color: '#aaa', fontSize: 13, margin: '0 0 8px' }}>Prompt</h3>
              <p style={{ color: '#fff', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {image.prompt_text}
              </p>
            </div>
          )}
          {tab === 'generated' && image.ref_image_ids && image.ref_image_ids !== '[]' && (
            <div>
              <h3 style={{ color: '#aaa', fontSize: 13, margin: '0 0 8px' }}>参考图</h3>
              <p style={{ color: '#888', fontSize: 13 }}>
                使用了 {JSON.parse(image.ref_image_ids).length} 张参考图
              </p>
            </div>
          )}
          {image.author && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ color: '#aaa', fontSize: 13, margin: '0 0 4px' }}>作者</h3>
              <p style={{ color: '#fff', fontSize: 14 }}>@{image.author}</p>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16, background: 'none',
            border: 'none', color: '#fff', fontSize: 28, cursor: 'pointer',
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
