import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StatusBadge, { DefectRateBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders the status text with underscores replaced', () => {
    render(<StatusBadge status="in_progress" />);
    expect(screen.getByText('in progress')).toBeInTheDocument();
  });

  it.each([
    ['open', 'bg-info-dim text-info'],
    ['in_progress', 'bg-warning-dim text-warning'],
    ['closed', 'bg-[rgba(107,114,128,0.15)] text-text-secondary'],
    ['verified', 'bg-success-dim text-success'],
    ['clean', 'bg-success-dim text-success'],
    ['defect', 'bg-danger-dim text-danger'],
    ['high', 'bg-danger-dim text-danger'],
    ['medium', 'bg-warning-dim text-warning'],
    ['low', 'bg-success-dim text-success'],
    ['critical', 'bg-danger-dim text-danger'],
    ['degrading', 'bg-danger-dim text-danger'],
    ['stable', 'bg-warning-dim text-warning'],
    ['Q1', 'bg-success-dim text-success'],
    ['Q2', 'bg-[rgba(16,185,129,0.1)] text-[#6ee7b7]'],
    ['Q3', 'bg-warning-dim text-warning'],
    ['Q4', 'bg-[rgba(239,68,68,0.1)] text-[#fca5a5]'],
    ['Q5', 'bg-danger-dim text-danger'],
  ])('status "%s" applies correct CSS classes "%s"', (status, expectedClass) => {
    const { container } = render(<StatusBadge status={status} />);
    const badge = container.firstChild as HTMLElement;
    for (const cls of expectedClass.split(' ')) {
      expect(badge.className).toContain(cls);
    }
  });

  it('applies small size by default', () => {
    const { container } = render(<StatusBadge status="open" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('text-[11px]');
  });

  it('applies medium size when specified', () => {
    const { container } = render(<StatusBadge status="open" size="md" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('text-xs');
  });

  it('falls back to no_data styling for unknown status', () => {
    const { container } = render(<StatusBadge status="unknown_status" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('bg-[rgba(107,114,128,0.1)]');
  });
});

describe('DefectRateBadge', () => {
  it('renders percentage value', () => {
    render(<DefectRateBadge rate={0.053} />);
    expect(screen.getByText('5.3%')).toBeInTheDocument();
  });

  it('shows green for rates below 3%', () => {
    const { container } = render(<DefectRateBadge rate={0.02} />);
    expect((container.firstChild as HTMLElement).className).toContain('text-success');
  });

  it('shows yellow for rates between 3% and 7%', () => {
    const { container } = render(<DefectRateBadge rate={0.05} />);
    expect((container.firstChild as HTMLElement).className).toContain('text-warning');
  });

  it('shows red for rates above 7%', () => {
    const { container } = render(<DefectRateBadge rate={0.10} />);
    expect((container.firstChild as HTMLElement).className).toContain('text-danger');
  });
});
