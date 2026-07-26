import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => cleanup());

// jsdom is missing a handful of browser APIs that Chakra UI / Ark UI touch even
// on a closed (unopened) control. Stub the ones the visual editor exercises.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

/**
 * IntersectionObserver, reporting everything as on screen.
 *
 * The logo picker only builds a category once it nears the viewport, which keeps a
 * 1,300-tile grid from being constructed on open. jsdom has no layout, so there is no
 * honest notion of "on screen" here — reporting everything as visible means the
 * catalog/grouping/filter tests still see the whole list, which is what they are
 * about. The windowing itself is verified in a browser.
 */
class IntersectionObserverStub {
  constructor(private readonly cb: IntersectionObserverCallback) {}
  private readonly seen: Element[] = [];
  observe(el: Element): void {
    this.seen.push(el);
    // Synchronous: the effect that observes runs inside React's commit, so the
    // resulting state update is batched. Deferring it to a microtask instead left
    // updates escaping `act()` and the suite spinning.
    this.cb(
      [{ target: el, isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
globalThis.IntersectionObserver ??=
  IntersectionObserverStub as unknown as typeof IntersectionObserver;

if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// Ark's Select scrolls the highlighted item into view; jsdom has no layout.
Element.prototype.scrollIntoView ??= vi.fn();
