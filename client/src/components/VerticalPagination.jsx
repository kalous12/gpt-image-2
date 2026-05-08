import { useState, useEffect } from 'react';
import { UpOutlined, DownOutlined } from '@ant-design/icons';

export function VerticalPagination({ current, total, pageSize, onChange }) {
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
