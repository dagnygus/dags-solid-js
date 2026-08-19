type _ResizeObserverCallbackRef = {
  callback: ResizeObserverCallback;
  observer: _MockResizeObserver;
};

/** @internal */
export class _MockResizeObserver implements ResizeObserver {
    private static _resizeObservers: _ResizeObserverCallbackRef[] = [];
    private _targets = new Set<Element>();

    constructor(public readonly callback: ResizeObserverCallback) {
        _MockResizeObserver._resizeObservers.push({ callback, observer: this });
    }

    observe(target: Element, _options?: ResizeObserverOptions): void {
        this._targets.add(target);
    }

    unobserve(target: Element): void {
        this._targets.delete(target);
    }

    disconnect(): void {
        this._targets.clear();
    }

    static trigger(entries: { target: Element, contentRect: DOMRectReadOnly } [], observer?: _MockResizeObserver): void {

        const localEntries = entries.map((entry) => ({
            ...entry,
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: []
        } as ResizeObserverEntry));

        for (const item of _MockResizeObserver._resizeObservers) {
             const filtered = localEntries
                .filter(({ target }) => item.observer._targets.has(target))
                .map((entry) => ({ ...entry }));

            if (!observer || item.observer === observer) {
                item.callback(filtered, item.observer);
            }
        }
    }

    static assertIsDisposed(): void {
        if (_MockResizeObserver._resizeObservers.length) {
            throw new Error('_MockResizeObserver is not disposed!');
        }
    }

    static dispose(): void {
        _MockResizeObserver._resizeObservers.forEach(({ observer }) => observer._targets.clear())
        _MockResizeObserver._resizeObservers.splice(0);
    }

    static targetsCount(): number {
        let count = 0;
        _MockResizeObserver._resizeObservers.forEach(({ observer }) => count += observer._targets.size);
        return count;
    }
}