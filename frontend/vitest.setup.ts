import "@testing-library/jest-dom/vitest";

/**
 * Browser APIs jsdom does not implement.
 *
 * These live here rather than in each spec because they are not the thing
 * under test — a component that asks whether the reader prefers reduced
 * motion, or whether it is on screen, should not fail every assertion with a
 * TypeError before it renders. HeroSlider.test.tsx carries its own matchMedia
 * stub for the same reason; anything needing different answers can still
 * override these with vi.stubGlobal in its own file.
 *
 * Defaults are deliberately the "nothing special" case: motion allowed, and
 * nothing reported as on screen until a test says otherwise.
 */
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

if (!window.IntersectionObserver) {
  class NoopIntersectionObserver {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: ReadonlyArray<number> = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  window.IntersectionObserver = NoopIntersectionObserver as unknown as typeof window.IntersectionObserver;
}

// jsdom implements no scrolling at all. These are no-ops rather than stubs
// with behaviour — a test that cares about scroll position has to assert on
// the call, not on a position jsdom was never going to update.
if (!Element.prototype.scrollBy) {
  Element.prototype.scrollBy = () => {};
}
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {};
}
