export function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const editableSelector = [
    'input',
    'textarea',
    'select',
    '[contenteditable="true"]',
    '[role="textbox"]',
    '[role="combobox"]',
  ].join(',');

  return Boolean(target.closest(editableSelector));
}

export function focusPrimarySearch(): boolean {
  const candidates = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-global-search="true"]')
  );

  const target = candidates.find((element) => !element.disabled && element.getAttribute('aria-hidden') !== 'true');
  if (!target) {
    return false;
  }

  target.focus();
  if (typeof target.select === 'function') {
    target.select();
  }

  return document.activeElement === target;
}
