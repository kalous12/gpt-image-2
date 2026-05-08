import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApiKeyForm } from './ApiKeyForm.jsx';

vi.mock('../api.js', () => ({
  api: {
    getApiKey: vi.fn(),
    saveApiKey: vi.fn(),
  },
}));

import { api } from '../api.js';

describe('ApiKeyForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads existing api key on mount', async () => {
    api.getApiKey.mockResolvedValue({ apikey: 'sk-existing' });
    render(<ApiKeyForm onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('sk-existing')).toBeInTheDocument();
    });
  });

  it('calls saveApiKey and onClose when save clicked', async () => {
    api.getApiKey.mockResolvedValue({ apikey: '' });
    api.saveApiKey.mockResolvedValue({});
    const onClose = vi.fn();
    render(<ApiKeyForm onClose={onClose} />);

    const input = await screen.findByTestId('apikey-input');
    fireEvent.change(input, { target: { value: 'sk-new-key' } });

    const saveBtn = screen.getByTestId('apikey-save');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(api.saveApiKey).toHaveBeenCalledWith('sk-new-key');
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('calls onClose when cancel clicked', async () => {
    api.getApiKey.mockResolvedValue({ apikey: '' });
    const onClose = vi.fn();
    render(<ApiKeyForm onClose={onClose} />);

    const cancelBtn = await screen.findByTestId('apikey-cancel');
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
