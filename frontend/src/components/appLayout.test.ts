import { describe, it, expect } from 'vitest';
import { isFixedViewport, pageWidthFor } from './appLayout';

describe('pageWidthFor', () => {
  it('gives grid and dashboard pages the wide container', () => {
    expect(pageWidthFor('/app/home')).toBe('wide');
    expect(pageWidthFor('/app/pets/3f2a')).toBe('wide');
    expect(pageWidthFor('/app/rescues/abc')).toBe('wide');
  });

  it('keeps forms that live under a wide path in the reading column', () => {
    // `/app/pets/:id` would match these and stretch a form to 1152px.
    expect(pageWidthFor('/app/pets/new')).toBe('column');
    expect(pageWidthFor('/app/parks/new')).toBe('column');
    expect(pageWidthFor('/app/lost/report-missing')).toBe('column');
    expect(pageWidthFor('/app/lost/report-found')).toBe('column');
  });

  it('does not widen a page because it sits under a wide one', () => {
    // matchPath is exact: an editor below a wide detail page stays a column.
    expect(pageWidthFor('/app/pets/3f2a/edit')).toBe('column');
    expect(pageWidthFor('/app/parks/9/edit')).toBe('column');
  });

  it('defaults an unlisted page to the column', () => {
    expect(pageWidthFor('/app/security')).toBe('column');
    expect(pageWidthFor('/app/some-new-page')).toBe('column');
  });
});

describe('isFixedViewport', () => {
  it('is true for the map screens and not their detail pages', () => {
    expect(isFixedViewport('/app/lost')).toBe(true);
    expect(isFixedViewport('/app/rescues/map')).toBe(true);
    expect(isFixedViewport('/app/lost/123')).toBe(false);
    expect(isFixedViewport('/app/rescues')).toBe(false);
  });
});
