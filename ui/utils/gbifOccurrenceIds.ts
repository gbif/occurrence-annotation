export function parseGbifOccurrenceIds(input: string): string[] {
  const values = input.trim() ? input.trim().split(/[,\s]+/).filter(Boolean) : [];
  if (values.some(value => !/^\d+$/.test(value) || /^0+$/.test(value)) ||
      (input.trim() && values.length === 0)) {
    throw new Error('Enter positive numeric GBIF occurrence IDs separated by commas or whitespace.');
  }
  return [...new Set(values.map(value => value.replace(/^0+/, '')))];
}

export function appendGbifOccurrenceIds(params: URLSearchParams, ids?: string[]): void {
  ids?.forEach(id => params.append('gbifId', id));
}
