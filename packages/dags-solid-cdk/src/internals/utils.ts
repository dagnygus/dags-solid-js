/** @internal */
export interface _Notifier<TArgs extends unknown[] = []> {
    add(listener: (...args: TArgs) => void): () => void;
    notify(...args: TArgs): void;
    dispose(): void;
    count(): number;
}

/** @internal */
export function _createNotifier<TArgs extends unknown[] = []>(): _Notifier<TArgs> {
    
    const notifier = {
        _disposed: false,
        _notifying: false,
        _listeners: [] as ((...args: TArgs) => void)[],
        _index: 0,
        add(listener: (...args: TArgs) => void) {
            if (this._disposed) { return () => {}; }
            this._listeners.push(listener);
            return () => {
                const index = this._listeners.indexOf(listener);
                if (index > -1) {
                    this._listeners.splice(index, 1);
                    if (this._notifying && index <= this._index) {
                        this._index--;
                    }
                }
            }
        },
        notify(...args: TArgs) {
            if (this._disposed) { return; }
            this._notify(0, args);
        },
        dispose() {
            (this as any).listeners = null;
            this._disposed = true;
        },
        count() {
            return this._listeners.length
        },
        _notify(startIndex: number, args: TArgs) {
            let stop = false
            let ogStopImmediatePropagation: (() => void) | null = null;
            if (args.length === 1 && args[0] instanceof Event) {
                const event = args[0] as Event
                ogStopImmediatePropagation = event.stopImmediatePropagation;
                event.stopImmediatePropagation = function() {
                    ogStopImmediatePropagation!.call(event);
                    stop = true;
                }
            }
            this._notifying = true;
            try {
                for (this._index = startIndex; this._index < this._listeners.length; this._index++) {
                    if (this._disposed || stop) { break; }
                    this._listeners[this._index].call(null, ...args);
                }
            } finally {
                if (!(this._disposed || stop) && this._index < this._listeners.length - 1) {
                    this._notify(this._index + 1, args);
                } else {
                    this._notifying = false;
                    if (ogStopImmediatePropagation) {
                        (args[0] as Event).stopImmediatePropagation = ogStopImmediatePropagation;
                    }
                }
            }
        }
    }

    return notifier;
}