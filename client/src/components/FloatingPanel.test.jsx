import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FloatingPanel } from './FloatingPanel';

describe('FloatingPanel', () => {
  it('renders three tabs', () => {
    render(<FloatingPanel current="user" onChange={() => {}} />);
    expect(screen.getByText('用户库')).toBeDefined();
    expect(screen.getByText('生成库')).toBeDefined();
    expect(screen.getByText('素材库')).toBeDefined();
  });

  it('cuts active tab with different style', () => {
    render(<FloatingPanel current="generated" onChange={() => {}} />);
    const btn = screen.getByText('生成库');
    expect(btn.style.background).toBe('rgb(255, 255, 255)');
  });

  it('calls onChange on tab click', async () => {
    const onChange = vi.fn();
    render(<FloatingPanel current="user" onChange={onChange} />);
    await userEvent.click(screen.getByText('生成库'));
    expect(onChange).toHaveBeenCalledWith('generated');
  });
});
