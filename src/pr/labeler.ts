export type PRSize = 'size/small' | 'size/medium' | 'size/large';

export function getPRSizeLabel(totalLines: number): PRSize {
  if (totalLines < 100) return 'size/small';
  if (totalLines <= 500) return 'size/medium';
  return 'size/large';
}
