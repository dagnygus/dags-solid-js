import { _dispatcher, _getListeners, addDelegatedEventListener as ogAddDelegatedEventListener } from "./event-delegation";

vitest.mock(import('./event-delegation'), (importModule) => {
    (globalThis as any).__IS_SERVER__ = false;
    return importModule();
})

afterAll(() => {
    vitest.doMock('./event-delegation');
    delete (globalThis as any).__IS_SERVER__;
})

describe('addDelegatedEventListener()', () => {

    const listeners = _getListeners();
    const disposeBag: (() => void)[] = [];

    function getListenersCount(type: string): number {
        return Array.from(listeners.get(type)?.values() || []).reduce((prev, notifier) => prev + notifier.count(), 0);
    }

    function addDelegatedEventListener(target: Element, type: string, listener: (e: Event) => void) {
        const remove = ogAddDelegatedEventListener(target, type, listener);
        disposeBag.push(remove);
        return remove;
    }

    afterEach(() => {
        Array.from(document.body.childNodes).forEach((node) => node.remove());
        while (disposeBag.length) {
            disposeBag.shift()!();
        }
    });

    it('Should correctly count references.', () => {
        const docListeners = new Map<string, Function>();
        const div1 = document.body.appendChild(document.createElement('div'));
        const div2 = document.body.appendChild(document.createElement('div'));
        const div3 = document.body.appendChild(document.createElement('div'));

        using addSpy = vitest.spyOn(Document.prototype, 'addEventListener').mockImplementation((type, listener) => {
            if (listener !== _dispatcher) { return; }
            if (docListeners.has(type)) {
                throw new Error('Incorrect implementation');
            }
            docListeners.set(type, listener);
        });

        using removeSpy = vitest.spyOn(Document.prototype, 'removeEventListener').mockImplementation((type, listener) => {
            if (listener !== _dispatcher) { return; }
            if (!docListeners.has(type)) {
                throw new Error('Incorrect implementation');
            }
            docListeners.delete(type);
        });

        addDelegatedEventListener(div1, 'Foo', () => {});//0
        expect(getListenersCount('Foo')).toBe(1);
        expect(docListeners.has('Foo')).toBe(true);
        expect(listeners.get('Foo')?.has(div1)).toBe(true);

        addDelegatedEventListener(div1, 'Foo', () => {});//1
        expect(getListenersCount('Foo')).toBe(2);
        expect(docListeners.has('Foo')).toBe(true);
        expect(listeners.get('Foo')?.has(div1)).toBe(true);

        addDelegatedEventListener(div1, 'Foo', () => {});//2
        expect(getListenersCount('Foo')).toBe(3);
        expect(docListeners.has('Foo')).toBe(true);
        expect(listeners.get('Foo')?.has(div1)).toBe(true);

        addDelegatedEventListener(div2, 'Foo', () => {});//3
        expect(getListenersCount('Foo')).toBe(4);
        expect(docListeners.has('Foo')).toBe(true);
        expect(listeners.get('Foo')?.has(div2)).toBe(true);

        addDelegatedEventListener(div2, 'Foo', () => {});//4
        expect(getListenersCount('Foo')).toBe(5);
        expect(docListeners.has('Foo')).toBe(true);
        expect(listeners.get('Foo')?.has(div2)).toBe(true);

        addDelegatedEventListener(div2, 'Baz', () => {});//5
        expect(getListenersCount('Baz')).toBe(1);
        expect(docListeners.has('Baz')).toBe(true);
        expect(listeners.get('Baz')?.has(div2)).toBe(true);

        addDelegatedEventListener(div2, 'Baz', () => {});//6
        expect(getListenersCount('Baz')).toBe(2);
        expect(docListeners.has('Baz')).toBe(true);
        expect(listeners.get('Baz')?.has(div2)).toBe(true);

        addDelegatedEventListener(div3, 'Baz', () => {});//7
        expect(getListenersCount('Baz')).toBe(3);
        expect(docListeners.has('Baz')).toBe(true);
        expect(listeners.get('Baz')?.has(div3)).toBe(true);

        addDelegatedEventListener(div3, 'Baz', () => {});//8
        expect(getListenersCount('Baz')).toBe(4);
        expect(docListeners.has('Baz')).toBe(true);
        expect(listeners.get('Baz')?.has(div3)).toBe(true);

        disposeBag[2]();
        expect(getListenersCount('Foo')).toBe(4);

        disposeBag[4]();
        expect(getListenersCount('Foo')).toBe(3);

        disposeBag[1]();
        expect(getListenersCount('Foo')).toBe(2);

        disposeBag[3]();
        expect(getListenersCount('Foo')).toBe(1);
        expect(docListeners.has('Foo')).toBe(true);
        expect(listeners.get('Foo')?.has(div1)).toBe(true);
        expect(listeners.get('Foo')?.has(div2)).toBe(false);

        disposeBag[0]();
        expect(getListenersCount('Foo')).toBe(0);
        expect(docListeners.has('Foo')).toBe(false);
        expect(listeners.get('Foo')?.has(div1)).toBeUndefined();
        expect(listeners.get('Foo')?.has(div2)).toBeUndefined();
        expect(listeners.get('Baz')?.has(div2)).toBe(true);
        expect(listeners.get('Baz')?.has(div3)).toBe(true);

        disposeBag[5]();
        expect(getListenersCount('Baz')).toBe(3);

        disposeBag[8]();
        expect(getListenersCount('Baz')).toBe(2);

        disposeBag[6]();
        expect(getListenersCount('Baz')).toBe(1);
        expect(docListeners.has('Baz')).toBe(true);
        expect(listeners.get('Baz')?.has(div2)).toBe(false);
        expect(listeners.get('Baz')?.has(div3)).toBe(true);

        disposeBag[7]();
        expect(getListenersCount('Baz')).toBe(0);
        expect(docListeners.has('Baz')).toBe(false);
        expect(listeners.get('Baz')?.has(div2)).toBeUndefined();
        expect(listeners.get('Baz')?.has(div3)).toBeUndefined();
    });

    it('Should handle event', () => {
        const log: string[] = [];
        const div = document.body.appendChild(document.createElement('div'));

        addDelegatedEventListener(div, 'keydown', (e) => log.push((e as KeyboardEvent).key));
        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', bubbles: true, cancelable: true }));
        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'B', bubbles: true, cancelable: true }));
        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'C', bubbles: true, cancelable: true }));
        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', bubbles: true, cancelable: true }));

        expect(log).toEqual([ 'A', 'B', 'C', 'D' ]);
    });

    it('Should not handle event if handler is unregistered.', () => {
        const log: string[] = [];
        const div = document.body.appendChild(document.createElement('div'));

        const remove = addDelegatedEventListener(div, 'keydown', (e) => log.push((e as KeyboardEvent).key));

        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', bubbles: true, cancelable: true }));
        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'B', bubbles: true, cancelable: true }));
        remove();
        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'C', bubbles: true, cancelable: true }));
        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', bubbles: true, cancelable: true }));

        expect(log).toEqual([ 'A', 'B' ]);
    });

    it('Should handle bubbling event.', () => {
        const log: string[] = [];
        const parent = document.body.appendChild(document.createElement('div'));
        const child = parent.appendChild(document.createElement('div'));

        addDelegatedEventListener(parent, 'keydown', (e) => log.push((e as KeyboardEvent).key + '_parent'));
        addDelegatedEventListener(child, 'keydown', (e) => log.push((e as KeyboardEvent).key + '_child'));

        child.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', bubbles: true, cancelable: true }));
        child.dispatchEvent(new KeyboardEvent('keydown', { key: 'B', bubbles: true, cancelable: true }));
        child.dispatchEvent(new KeyboardEvent('keydown', { key: 'C', bubbles: true, cancelable: true }));
        child.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', bubbles: true, cancelable: true }));

        expect(log).toEqual([ 'A_child', 'A_parent', 'B_child', 'B_parent', 'C_child', 'C_parent', 'D_child', 'D_parent' ]);
    });

    it('Should handle non-bubbling event where stopPropagation() has been invoked.', () => {
        const log: string[] = [];
        const parent = document.body.appendChild(document.createElement('div'));
        const child = parent.appendChild(document.createElement('div'));

        addDelegatedEventListener(parent, 'keydown', (e) => log.push((e as KeyboardEvent).key + '_parent'));
        addDelegatedEventListener(child, 'keydown', (e) => (e.stopPropagation(), log.push((e as KeyboardEvent).key + '_child')));

        child.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', bubbles: true, cancelable: true }));
        child.dispatchEvent(new KeyboardEvent('keydown', { key: 'B', bubbles: true, cancelable: true }));
        child.dispatchEvent(new KeyboardEvent('keydown', { key: 'C', bubbles: true, cancelable: true }));
        child.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', bubbles: true, cancelable: true }));

        expect(log).toEqual([ 'A_child', 'B_child', 'C_child', 'D_child' ]);
    });

    it('Should handle non-bubbling event where stopImmediatePropagation() has been invoked.', () => {
        const log: string[] = [];
        const parent = document.body.appendChild(document.createElement('div'));
        const child = parent.appendChild(document.createElement('div'));

        addDelegatedEventListener(parent, 'keydown', (e) => log.push((e as KeyboardEvent).key + '_parent'));
        addDelegatedEventListener(child, 'keydown', (e) => (e.stopImmediatePropagation(), log.push((e as KeyboardEvent).key + '_child')));

        child.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', bubbles: true, cancelable: true }));
        child.dispatchEvent(new KeyboardEvent('keydown', { key: 'B', bubbles: true, cancelable: true }));
        child.dispatchEvent(new KeyboardEvent('keydown', { key: 'C', bubbles: true, cancelable: true }));
        child.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', bubbles: true, cancelable: true }));

        expect(log).toEqual([ 'A_child', 'B_child', 'C_child', 'D_child' ]);
    });

    it('Should invoke all listeners despite an error.', () => {
        const log: string[] = [];
        const parent = document.body.appendChild(document.createElement('div'));
        const child = parent.appendChild(document.createElement('div'));
        const grandchild = child.appendChild(document.createElement('div'));
        const errorHandler = (e: ErrorEvent) => e.preventDefault();

        window.addEventListener('error', errorHandler);

        addDelegatedEventListener(grandchild, 'click', () => log.push('A1'));
        addDelegatedEventListener(grandchild, 'click', () => log.push('A2'));
        addDelegatedEventListener(grandchild, 'click', () => log.push('A3'));

        addDelegatedEventListener(child, 'click', () => log.push('B1'));
        addDelegatedEventListener(child, 'click', () => { log.push('B2'); throw new Error()});
        addDelegatedEventListener(child, 'click', () => log.push('B3'));

        addDelegatedEventListener(parent, 'click', () => log.push('C1'));
        addDelegatedEventListener(parent, 'click', () => log.push('C2'));
        addDelegatedEventListener(parent, 'click', () => log.push('C3'));

        grandchild.dispatchEvent(new PointerEvent('click', { bubbles: true, cancelable: true }));
        
        expect(log).toEqual([ 'A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3' ]);

        window.removeEventListener('error', errorHandler);
    });
});