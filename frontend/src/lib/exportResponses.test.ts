import { beforeEach, describe, expect, it, vi } from 'vitest';

const save = vi.fn(() => Promise.resolve());
const then = vi.fn(function (this: unknown) {
  return { then, save };
});
const worker = {
  set: vi.fn(() => worker),
  from: vi.fn(() => worker),
  toPdf: vi.fn(() => worker),
  get: vi.fn(() => ({ then, save })),
};

vi.mock('html2pdf.js', () => ({ default: () => worker }));

const { exportToPdf } = await import('./exportResponses');

describe('exportToPdf', () => {
  let element: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    element = document.createElement('div');
    element.setAttribute('style', 'display: none; padding: 30px');
    document.body.appendChild(element);
  });

  it('restores the template style after a successful render', async () => {
    await exportToPdf(element);
    expect(element.getAttribute('style')).toBe('display: none; padding: 30px');
  });

  it('restores the template style when rendering throws', async () => {
    // This is the bug: restoration used to live in the resolve and reject
    // branches of a promise chain, so a throw between .set() and .save()
    // matched neither and left a 1200px-wide white template positioned over
    // the whole app until the user reloaded.
    save.mockRejectedValueOnce(new Error('html2canvas exploded'));

    await expect(exportToPdf(element)).rejects.toThrow('html2canvas exploded');
    expect(element.getAttribute('style')).toBe('display: none; padding: 30px');
  });

  it('shows the template while rendering, since html2canvas cannot rasterise display:none', async () => {
    let styleDuringRender = '';
    save.mockImplementationOnce(() => {
      styleDuringRender = element.style.display;
      return Promise.resolve();
    });

    await exportToPdf(element);
    expect(styleDuringRender).toBe('block');
  });
});
