import type { InstanceDetails } from './types';

export function normalizeInstanceTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of tags) {
    const trimmed = tag.trim();
    const key = trimmed.toLocaleLowerCase();

    if (!trimmed || seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(trimmed);
  }

  return normalized;
}

export function parseInstanceTagsInput(input: string): string[] {
  return normalizeInstanceTags(input.split(/[,\n]/));
}

export function getInstanceTags(instance: InstanceDetails): string[] {
  return normalizeInstanceTags(Array.isArray(instance.tags) ? instance.tags : []);
}
