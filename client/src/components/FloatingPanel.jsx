const tabs = [
  { key: 'user', label: '用户库' },
  { key: 'generated', label: '生成库' },
  { key: 'material', label: '素材库' },
];

export function FloatingPanel({ current, onChange }) {
  return (
    <div style={{
      position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
      zIndex: 100, display: 'flex', gap: 2,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)',
      borderRadius: 12, padding: 4,
    }}>
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            padding: '8px 20px', borderRadius: 10, border: 'none',
            cursor: 'pointer', fontSize: 14, fontWeight: 500,
            background: current === t.key ? '#fff' : 'transparent',
            color: current === t.key ? '#000' : '#fff',
            transition: 'all 0.2s',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
