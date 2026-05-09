import { useState, useRef, useEffect } from 'react';
import { Input } from 'antd';

const { TextArea } = Input;

export function ResizableTextArea({ value, onChange, placeholder, minHeight = 40, maxHeight = 200 }) {
  const [height, setHeight] = useState(minHeight);
  const [isDragging, setIsDragging] = useState(false);
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
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="prompt-input"
        style={{ height: '100%', resize: 'none' }}
      />
    </div>
  );
}
