import { useState } from 'react';

export function ImageCard({ item, tab, isFirst, onView, onSelect, onRedo, onDelete, onUpload }) {
  const [hovered, setHovered] = useState(false);

  // First card special case: upload button for user library
  if (isFirst && tab === 'user') {
    return (
      <div
        onClick={onUpload}
        data-testid="upload-card"
        style={{
          width: '100%', aspectRatio: '1', border: '2px dashed #555',
          borderRadius: 8, display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', color: '#888',
          fontSize: 40, background: '#1a1a1a',
        }}
      >
        +
      </div>
    );
  }

  // Generating placeholder
  if (isFirst && tab === 'generated' && item?.status === 'generating') {
    return (
      <div
        data-testid="generating-card"
        style={{
          width: '100%', aspectRatio: '1', borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#1a1a1a', border: '2px solid #333',
        }}
      >
        <div style={{
          width: 40, height: 40, border: '3px solid #333',
          borderTop: '3px solid #fff', borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const imgSrc = item.data
    ? item.data
    : item.filename
      ? item.filename
      : item.image_path
        ? `http://localhost:5173/${item.image_path}`
        : '';

  return (
    <div
      data-testid="image-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', borderRadius: 8, overflow: 'hidden',
        position: 'relative', cursor: 'pointer', background: '#1a1a1a',
      }}
    >
      <img src={imgSrc} alt="" style={{ width: '100%', display: 'block' }} />

      {/* Hover overlay */}
      {hovered && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 8, flexWrap: 'wrap', padding: 8,
        }}>
          <OverlayButton onClick={() => onView?.(item)} label="查看" />
          {tab !== 'material' && (
            <OverlayButton onClick={() => onSelect?.(item)} label="选择" />
          )}
          {tab !== 'user' && (
            <OverlayButton onClick={() => onRedo?.(item)} label="做同款" />
          )}
        </div>
      )}

      {/* Delete button (top right) */}
      {tab !== 'material' && hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete?.(item); }}
          style={{
            position: 'absolute', top: 4, right: 4,
            width: 24, height: 24, borderRadius: '50%', border: 'none',
            background: 'rgba(255,0,0,0.8)', color: '#fff', cursor: 'pointer',
            fontSize: 14, lineHeight: '24px', textAlign: 'center',
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

function OverlayButton({ onClick, label }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      style={{
        padding: '6px 14px', borderRadius: 6, border: 'none',
        background: 'rgba(255,255,255,0.9)', color: '#000',
        cursor: 'pointer', fontSize: 12, fontWeight: 500,
      }}
    >
      {label}
    </button>
  );
}
