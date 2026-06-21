import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PromptForm } from '../components/PromptForm';
import { renderWithProviders } from '../test/renderWithProviders';

describe('PromptForm', () => {
  it('renders the shared prompt drawer fields', () => {
    renderWithProviders(<PromptForm prompt={null} onSave={() => undefined} onCancel={() => undefined} />);

    expect(screen.getByText('Create a new shared prompt')).toBeInTheDocument();
    expect(screen.getByLabelText('Prompt name')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Content')).toBeInTheDocument();
  }, 15000);
});
