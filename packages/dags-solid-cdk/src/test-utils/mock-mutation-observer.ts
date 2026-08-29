export class _MockMutationObserver implements MutationObserver {
    static #observers = new Set<_MockMutationObserver>();

    static trigger(records: (Omit<MutationRecord, 'addedNodes' | 'removedNodes'> & { addedNodes: Node[], removedNodes: Node[] })[]): void {
        for (const observer of _MockMutationObserver.#observers) {
            observer.#callback(records as any, observer);
        }
    }

    static triggerRemove(target: Node, removed: Node): void {
        this.trigger([{
            addedNodes: [],
            removedNodes: [ removed ],
            attributeName: null,
            attributeNamespace: null,
            nextSibling: null,
            oldValue: null,
            previousSibling: null,
            type: 'childList',
            target
        }]);
    }

    static triggerAdd(target: Node, added: Node): void {
        this.trigger([{
            addedNodes: [ added ],
            removedNodes: [],
            attributeName: null,
            attributeNamespace: null,
            nextSibling: null,
            oldValue: null,
            previousSibling: null,
            type: 'childList',
            target
        }]);
    }

    #callback: MutationCallback;

    constructor(callback: MutationCallback) {
        this.#callback = callback;
        _MockMutationObserver.#observers.add(this);
    }

    observe(_target: Node, _options?: MutationObserverInit): void {
    }

    disconnect(): void {
        _MockMutationObserver.#observers.delete(this);
    }

    takeRecords(): MutationRecord[] {
        return [];
    }

    [Symbol.toStringTag] = 'MutationObserver';
}