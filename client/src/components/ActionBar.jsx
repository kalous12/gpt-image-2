import { RESOLUTIONS, SIZES, SIZE_4K } from '../api.js';

export function ActionBar({
  resolution, onResolutionChange,
  size, onSizeChange,
  count, onCountChange,
  onOpenApiKey, onGenerate,
  generating,
}) {
  const currentPrice = RESOLUTIONS.find(r => r.value === resolution)?.price || '';

  // Filter sizes when 4K is selected
  const availableSizes = resolution === '4k'
    ? SIZES.filter(s => s.value === 'auto' || SIZE_4K.includes(s.value))
    : SIZES;

  return (
    <div data-testid="action-bar" style={{
      display: 'flex', gap: 12, padding: '8px 16px 12px',
      alignItems: 'center', flexWrap: 'wrap',
    }}>
      {/* Price */}
      <span style={{ color: '#888', fontSize: 13, minWidth: 70 }}>
        价格: <span style={{ color: '#4caf50', fontWeight: 500 }}>{currentPrice}/张</span>
      </span>

      {/* API Key */}
      <button
        onClick={onOpenApiKey}
        style={{
          padding: '6px 12px', borderRadius: 6, border: '1px solid #444',
          background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 13,
        }}
      >
        API Key
      </button>

      {/* Resolution */}
      <select
        data-testid="resolution-select"
        value={resolution}
        onChange={(e) => onResolutionChange?.(e.target.value)}
        style={selectStyle}
      >
        {RESOLUTIONS.map(r => (
          <option key={r.value} value={r.value}>{r.label} ({r.price}/张)</option>
        ))}
      </select>

      {/* Size */}
      <select
        data-testid="size-select"
        value={size}
        onChange={(e) => onSizeChange?.(e.target.value)}
        style={selectStyle}
      >
        {availableSizes.map(s => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      {/* Count */}
      <select
        data-testid="count-select"
        value={count}
        onChange={(e) => onCountChange?.(Number(e.target.value))}
        style={selectStyle}
      >
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
          <option key={n} value={n}>{n} 张</option>
        ))}
      </select>

      {/* Generate */}
      <button
        onClick={onGenerate}
        disabled={generating}
        style={{
          padding: '8px 24px', borderRadius: 8, border: 'none',
          background: generating ? '#555' : '#fff',
          color: '#000', cursor: generating ? 'not-allowed' : 'pointer',
          fontWeight: 600, fontSize: 14,
        }}
      >
        {generating ? '生成中...' : '生成'}
      </button>
    </div>
  );
}

const selectStyle = {
  padding: '6px 10px', borderRadius: 6, border: '1px solid #333',
  background: '#1a1a1a', color: '#fff', fontSize: 13, outline: 'none',
};
