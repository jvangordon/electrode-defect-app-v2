import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SkeletonTable, SkeletonCard, SkeletonChart } from './LoadingSkeleton';

describe('SkeletonTable', () => {
  it('renders the default 5 rows plus 1 header', () => {
    const { container } = render(<SkeletonTable />);
    // 1 header (h-10) + 5 rows (h-8) = 6 skeleton elements
    const skeletons = container.querySelectorAll('.skeleton');
    expect(skeletons).toHaveLength(6);
  });

  it('renders custom number of rows plus header', () => {
    const { container } = render(<SkeletonTable rows={3} />);
    const skeletons = container.querySelectorAll('.skeleton');
    expect(skeletons).toHaveLength(4); // 1 header + 3 rows
  });

  it('renders custom number of rows plus header (10 rows)', () => {
    const { container } = render(<SkeletonTable rows={10} />);
    const skeletons = container.querySelectorAll('.skeleton');
    expect(skeletons).toHaveLength(11); // 1 header + 10 rows
  });
});

describe('SkeletonCard', () => {
  it('renders with default height class', () => {
    const { container } = render(<SkeletonCard />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('skeleton');
    expect(el.className).toContain('h-32');
  });

  it('renders with custom height', () => {
    const { container } = render(<SkeletonCard height="h-64" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('h-64');
  });
});

describe('SkeletonChart', () => {
  it('renders with default height class', () => {
    const { container } = render(<SkeletonChart />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('skeleton');
    expect(el.className).toContain('h-64');
  });

  it('renders with custom height', () => {
    const { container } = render(<SkeletonChart height="h-48" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('h-48');
  });
});
