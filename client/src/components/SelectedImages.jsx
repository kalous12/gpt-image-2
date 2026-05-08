export function SelectedImages({ images, onRemove, onView }) {
  if (!images?.length) return null;

  return (
    <div
      data-testid="selected-images"
      style={{
        display: 'flex', gap: 8, padding: '8px 16px', overflowX: 'auto',
        background: '#111', borderTop: '1px solid #222', minHeight: 80,
        alignItems: 'center',
      }}
    >
      {images.map((img, i) => {
        const src = img.data || img.filename || '';
        return (
          <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
            <img
              src={src}
              alt=""
              onClick={() => onView?.(img)}
              style={{
                width: 64, height: 64, objectFit: 'cover',
                borderRadius: 6, cursor: 'pointer', border: '1px solid #333',
              }}
            />
            <button
              onClick={() => onRemove?.(i)}
              style={{
                position: 'absolute', top: -6, right: -6,
                width: 20, height: 20, borderRadius: '50%', border: 'none',
                background: 'rgba(255,0,0,0.8)', color: '#fff',
                cursor: 'pointer', fontSize: 12, lineHeight: '20px',
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
