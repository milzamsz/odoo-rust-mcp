import { describe, expect, it } from 'vitest';
import { focusPrimarySearch, isEditableElement } from '../shortcuts';

describe('shortcuts helpers', () => {
  it('detects editable targets', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);

    expect(isEditableElement(input)).toBe(true);
    expect(isEditableElement(document.body)).toBe(false);

    input.remove();
  });

  it('focuses the primary search input when available', () => {
    const input = document.createElement('input');
    input.setAttribute('data-global-search', 'true');
    document.body.appendChild(input);

    expect(focusPrimarySearch()).toBe(true);
    expect(document.activeElement).toBe(input);

    input.remove();
  });
});
