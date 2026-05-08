export function PromptInput({ value, onChange }) {
  return (
    <div style={{ padding: '0 16px 8px' }}>
      <textarea
        data-testid="prompt-input"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder="输入 prompt 描述你要生成的图片..."
        rows={3}
        style={{
          width: '100%', padding: 12, borderRadius: 8, border: '1px solid #333',
          background: '#1a1a1a', color: '#fff', fontSize: 14, resize: 'vertical',
          outline: 'none', boxSizing: 'border-box',
        }}
      />
    </div>
  );
}
