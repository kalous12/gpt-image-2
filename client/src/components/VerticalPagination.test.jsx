import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VerticalPagination } from './VerticalPagination.jsx';

describe('VerticalPagination', () => {
  it('renders current page and total pages', () => {
    render(<VerticalPagination current={2} total={40} pageSize={10} onChange={() => {}} />
    );
    expect(screen.getByText('/ 4')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
  });

  it('calls onChange with previous page when up arrow clicked', () => {
    const onChange = vi.fn();
    render(<VerticalPagination current={3} total={30} pageSize={10} onChange={onChange} />
    );
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]); // up arrow
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('calls onChange with next page when down arrow clicked', () => {
    const onChange = vi.fn();
    render(<VerticalPagination current={2} total={30} pageSize={10} onChange={onChange} />
    );
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]); // down arrow
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('disables up arrow on first page', () => {
    render(<VerticalPagination current={1} total={20} pageSize={10} onChange={() => {}} />
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toBeDisabled();
  });

  it('disables down arrow on last page', () => {
    render(<VerticalPagination current={2} total={20} pageSize={10} onChange={() => {}} />
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons[1]).toBeDisabled();
  });

  it('jumps to page on Enter key', () => {
    const onChange = vi.fn();
    render(<VerticalPagination current={1} total={50} pageSize={10} onChange={onChange} />
    );
    const input = screen.getByDisplayValue('1');
    fireEvent.change(input, { target: { value: '3' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(3);
  });
});
