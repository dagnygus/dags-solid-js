import { createEffect, createRoot, getOwner } from "solid-js";
import { _eachPotentialTabbable, _getCurrentAssignedOrigin, focusTrap, focusVia, getFocusedElement, hasFocusedElement, isFocused, monitorFocusOrigin, observeHasFocusedElement, observeIsFocused } from "./focus-management";
import { render } from "solid-js/web";

const enum Origin {
    Program = 'program',
    Pointer = 'pointer',
    Keyboard = 'keyboard'
}

const pendingEffects: (() => void)[] = vitest.hoisted(() => []);
const disposeBag: (() => void)[] = [];
let manualEffectsMode = vitest.hoisted(() => true);


vitest.mock(import('./focus-management'), (importModule) => {
    (globalThis as any).__IS_SERVER__ = false;
    return importModule();
});

vitest.mock(import('solid-js'), async (importOgModule) => {
    const ogModule = await importOgModule();
    const ogOnMount = ogModule.onMount;
    const ogCreateEffect = ogModule.createEffect;
    const getOwner = ogModule.getOwner;
    const runWithOwner = ogModule.runWithOwner;

    const fakeOnMount: typeof ogOnMount = (cb: () => void) => {
        if (manualEffectsMode) {
            const owner = getOwner()
            pendingEffects.push(() => runWithOwner(owner, () => ogOnMount(cb)));
        } else {
            ogOnMount(cb);
        }
    };

    const fakeCreateEffect: typeof ogCreateEffect = ((fn: () => any, v: any, o: any) => {
        if (manualEffectsMode) {
            const owner = getOwner();
            pendingEffects.push(() => runWithOwner(owner, () => ogCreateEffect(fn, v, o)));
        } else {
            ogCreateEffect(fn, v, o);
        }
    }) as any;

    return {
        ...ogModule,
        onMount: fakeOnMount,
        createEffect: fakeCreateEffect
    }
})

function fireEffects(): void {
    while (pendingEffects.length) {
        pendingEffects.shift()!();
    }
}

function assertNoPendingEffects(): void {
    expect(pendingEffects.length).toBe(0)
}

function assertPendingEffectsCount(expectedCount: number): void {
    expect(pendingEffects.length).toBe(expectedCount);
}

function discardPendingEffects(): void {
    pendingEffects.splice(0);
}

function dispose(assertNoPendingEffectsAndMicrotask = false): void {
    while (disposeBag.length) {
        disposeBag.shift()!();
    }
    if (assertNoPendingEffectsAndMicrotask && pendingEffects.length) {
        throw new Error('There are still pending effects.');
    }
}

function subscribeEffect(cb: () => void): () => void {
    return createRoot((dispose) => {
        disposeBag.push(dispose);
            createEffect(cb);
        return dispose;
    });
}

function inRoot<T>(fn: () => T): T {
    return createRoot((dispose) => {
        disposeBag.push(dispose);
        return fn();
    });
}

function getTestOwner(): unknown {
    return createRoot((dispose) => {
        disposeBag.push(dispose);
        return getOwner()
    })
}

afterEach(() => {
        Array.from(document.body.children).forEach((node) => node.remove());
        dispose(true);
    });

afterAll(() => {
    delete (globalThis as any).__IS_SERVER__;
    vitest.doUnmock('./focus-origin');
    vitest.doUnmock('solid-js');
});

describe('monitorFocusOrigin()', () => {

    it('Should throw an error if the first argument is not an element instance or function returning an element.', () => {
        const errorMessage = 'monitorFocusOrigin(): Invalid first argument! It must be a function returning a DOM Element or a DOM Element instance (e.g. HTMLElement, SVGElement, etc.).';
        
        expect(() => monitorFocusOrigin(0 as any)).toThrow(errorMessage);
        expect(() => monitorFocusOrigin(1 as any)).toThrow(errorMessage);
        expect(() => monitorFocusOrigin('' as any)).toThrow(errorMessage);
        expect(() => monitorFocusOrigin('A' as any)).toThrow(errorMessage);
        expect(() => monitorFocusOrigin(true as any)).toThrow(errorMessage);
        expect(() => monitorFocusOrigin(false as any)).toThrow(errorMessage);
        expect(() => monitorFocusOrigin(undefined as any)).toThrow(errorMessage);
        expect(() => monitorFocusOrigin(null as any)).toThrow(errorMessage);
        expect(() => monitorFocusOrigin({} as any)).toThrow(errorMessage);
        expect(() => monitorFocusOrigin([] as any)).toThrow(errorMessage);

        expect(() => monitorFocusOrigin((() => 0) as any)).toThrow(errorMessage);
        expect(() => monitorFocusOrigin((() => 1) as any)).toThrow(errorMessage);
        expect(() => monitorFocusOrigin((() => '') as any)).toThrow(errorMessage);
        expect(() => monitorFocusOrigin((() => 'A') as any)).toThrow(errorMessage);
        expect(() => monitorFocusOrigin((() => true) as any)).toThrow(errorMessage);
        expect(() => monitorFocusOrigin((() => false) as any)).toThrow(errorMessage);
        expect(() => monitorFocusOrigin((() => undefined) as any)).toThrow(errorMessage);
        expect(() => monitorFocusOrigin((() => null) as any)).toThrow(errorMessage);
        expect(() => monitorFocusOrigin((() => ({})) as any)).toThrow(errorMessage);
        expect(() => monitorFocusOrigin((() => []) as any)).toThrow(errorMessage);

        expect(() => monitorFocusOrigin(document.createElement('div'))).not.toThrow();
        expect(() => inRoot(() => monitorFocusOrigin((() => {}) as any))).not.toThrow();
        assertPendingEffectsCount(1);
        discardPendingEffects();
    });

    it('Should throw an error if the second argument is not an optional boolean.', () => {
        const errorMessage = 'monitorFocus(): Invalid second argument! Expected a boolean or nothing.';
        const div = document.createElement('div');

        expect(() => monitorFocusOrigin(div, 0 as any)).toThrow(errorMessage);
        expect(() => monitorFocusOrigin(div, 1 as any)).toThrow(errorMessage);
        expect(() => monitorFocusOrigin(div, '' as any)).toThrow(errorMessage);
        expect(() => monitorFocusOrigin(div, 'A' as any)).toThrow(errorMessage);
        expect(() => monitorFocusOrigin(div, {} as any)).toThrow(errorMessage);
        expect(() => monitorFocusOrigin(div, [] as any)).toThrow(errorMessage);
        expect(() => monitorFocusOrigin(div, (() => {}) as any)).toThrow(errorMessage);

        expect(() => monitorFocusOrigin(div, true)).not.toThrow();
        expect(() => monitorFocusOrigin(div, false)).not.toThrow();
        expect(() => monitorFocusOrigin(div, undefined)).not.toThrow();
        expect(() => monitorFocusOrigin(div, null as any)).not.toThrow();
    });

    it('Should not have any pending effects if the element is provided directly.', () => {
        const div = document.body.appendChild(document.createElement('div'));
        monitorFocusOrigin(div);
        assertNoPendingEffects();
    });

    it('Should not have any pending effects if the element is provided eagerly.', () => {
        const div = document.body.appendChild(document.createElement('div'));
        monitorFocusOrigin(() => div);
        assertNoPendingEffects();
    });

    it('Should have a pending effect if the element is provided lazily.', () => {
        let div: HTMLDivElement = null!;
        inRoot(() => monitorFocusOrigin(() => div));
        div = document.body.appendChild(document.createElement('div'));
        assertPendingEffectsCount(1);
        discardPendingEffects();
    });

    it('Should observe focus correctly when an element instance is provided directly.', async () => {
        const log: any[] = [];
        const div = document.body.appendChild(document.createElement('div'));
        const origin = monitorFocusOrigin(div);
        const handler = () => div.focus();
        const handlerWithStopPropagate = (e: Event) => (e.stopPropagation(), div.focus());
        const noopHandler = () => {};
        const activeElSpy = vitest.spyOn(document, 'activeElement', 'get').mockImplementation(() => activeElement);

        let activeElement: Element | null = null;
        
        div.tabIndex = 0;

        subscribeEffect(() => log.push(origin()));
        fireEffects();

        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Keyboard);
        activeElement = div;
        div.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        div.dispatchEvent(new FocusEvent('blur'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Pointer);
        activeElement = div;
        div.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        div.dispatchEvent(new FocusEvent('blur'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = div;
        div.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        div.dispatchEvent(new FocusEvent('blur'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Pointer);
        activeElement = div;
        div.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        div.dispatchEvent(new FocusEvent('blur'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Keyboard);
        activeElement = div;
        div.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        div.dispatchEvent(new FocusEvent('blur'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElSpy.mockRestore();

        div.addEventListener('pointerdown', handler);
        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('pointerdown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.addEventListener('pointerdown', noopHandler);
        div.addEventListener('pointerdown', handler);
        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('pointerdown', noopHandler);
        div.removeEventListener('pointerdown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.addEventListener('pointerdown', handlerWithStopPropagate);
        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe('program');
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('pointerdown', handlerWithStopPropagate);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.addEventListener('keydown', handler);
        div.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('keydown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.addEventListener('keydown', noopHandler);
        div.addEventListener('keydown', handler);
        div.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('keydown', noopHandler);
        div.removeEventListener('keydown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.addEventListener('keydown', handlerWithStopPropagate);
        div.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('keydown', handlerWithStopPropagate);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        expect(log).toEqual([
            undefined,
            Origin.Keyboard,
            undefined,
            Origin.Pointer,
            undefined,
            Origin.Program,
            undefined,
            Origin.Pointer,
            undefined,
            Origin.Keyboard,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined
        ]);
        
    });

    it('Should observe focus correctly until disposal when an element instance is provided directly.', async () => {
        const log: any[] = [];
        const div = document.body.appendChild(document.createElement('div'));
        const origin = inRoot(() => monitorFocusOrigin(div));
        const handler = () => div.focus();
        const handlerWithStopPropagate = (e: Event) => (e.stopPropagation(), div.focus());
        const noopHandler = () => {};
        const activeElSpy = vitest.spyOn(document, 'activeElement', 'get').mockImplementation(() => activeElement);

        let activeElement: Element | null = null;
        
        div.tabIndex = 0;

        subscribeEffect(() => log.push(origin()));
        fireEffects();

        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Keyboard);
        activeElement = div;
        div.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        div.dispatchEvent(new FocusEvent('blur'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Pointer);
        activeElement = div;
        div.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        div.dispatchEvent(new FocusEvent('blur'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = div;
        div.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        div.dispatchEvent(new FocusEvent('blur'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Pointer);
        activeElement = div;
        div.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        div.dispatchEvent(new FocusEvent('blur'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Keyboard);
        activeElement = div;
        div.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        div.dispatchEvent(new FocusEvent('blur'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElSpy.mockRestore();

        div.addEventListener('pointerdown', handler);
        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('pointerdown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.addEventListener('pointerdown', noopHandler);
        div.addEventListener('pointerdown', handler);
        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('pointerdown', noopHandler);
        div.removeEventListener('pointerdown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.addEventListener('pointerdown', handlerWithStopPropagate);
        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe('program');
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('pointerdown', handlerWithStopPropagate);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.addEventListener('keydown', handler);
        div.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('keydown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.addEventListener('keydown', noopHandler);
        div.addEventListener('keydown', handler);
        div.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('keydown', noopHandler);
        div.removeEventListener('keydown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.addEventListener('keydown', handlerWithStopPropagate);
        div.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('keydown', handlerWithStopPropagate);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        expect(log).toEqual([
            undefined,
            Origin.Keyboard,
            undefined,
            Origin.Pointer,
            undefined,
            Origin.Program,
            undefined,
            Origin.Pointer,
            undefined,
            Origin.Keyboard,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined
        ]);

        log.splice(0);
        dispose();

        div.focus();
        div.blur();
        div.focus();
        div.blur();

        expect(log).toEqual([]);
        
    });

    it('Should observe focus correctly when an element instance is provided eagerly.', async () => {
        const log: any[] = [];
        const div = document.body.appendChild(document.createElement('div'));
        const origin = monitorFocusOrigin(() => div);
        const handler = () => div.focus();
        const handlerWithStopPropagate = (e: Event) => (e.stopPropagation(), div.focus());
        const noopHandler = () => {};
        const activeElSpy = vitest.spyOn(document, 'activeElement', 'get').mockImplementation(() => activeElement);

        let activeElement: Element | null = null;
        
        div.tabIndex = 0;

        subscribeEffect(() => log.push(origin()));
        fireEffects();

        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Keyboard);
        activeElement = div;
        div.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        div.dispatchEvent(new FocusEvent('blur'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Pointer);
        activeElement = div;
        div.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        div.dispatchEvent(new FocusEvent('blur'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = div;
        div.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        div.dispatchEvent(new FocusEvent('blur'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Pointer);
        activeElement = div;
        div.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        div.dispatchEvent(new FocusEvent('blur'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Keyboard);
        activeElement = div;
        div.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        div.dispatchEvent(new FocusEvent('blur'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElSpy.mockRestore();

        div.addEventListener('pointerdown', handler);
        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('pointerdown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.addEventListener('pointerdown', noopHandler);
        div.addEventListener('pointerdown', handler);
        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('pointerdown', noopHandler);
        div.removeEventListener('pointerdown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.addEventListener('pointerdown', handlerWithStopPropagate);
        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe('program');
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('pointerdown', handlerWithStopPropagate);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.addEventListener('keydown', handler);
        div.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('keydown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.addEventListener('keydown', noopHandler);
        div.addEventListener('keydown', handler);
        div.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('keydown', noopHandler);
        div.removeEventListener('keydown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.addEventListener('keydown', handlerWithStopPropagate);
        div.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('keydown', handlerWithStopPropagate);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        expect(log).toEqual([
            undefined,
            Origin.Keyboard,
            undefined,
            Origin.Pointer,
            undefined,
            Origin.Program,
            undefined,
            Origin.Pointer,
            undefined,
            Origin.Keyboard,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined
        ]);
    });

    it('Should observe focus correctly until disposal when an element instance is provided eagerly.', async () => {
        const log: any[] = [];
        const div = document.body.appendChild(document.createElement('div'));
        const origin = inRoot(() => monitorFocusOrigin(() => div));
        const handler = () => div.focus();
        const handlerWithStopPropagate = (e: Event) => (e.stopPropagation(), div.focus());
        const noopHandler = () => {};
        const activeElSpy = vitest.spyOn(document, 'activeElement', 'get').mockImplementation(() => activeElement);

        let activeElement: Element | null = null;
        
        div.tabIndex = 0;

        subscribeEffect(() => log.push(origin()))
        fireEffects()

        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Keyboard);
        activeElement = div;
        div.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        div.dispatchEvent(new FocusEvent('blur'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Pointer);
        activeElement = div;
        div.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        div.dispatchEvent(new FocusEvent('blur'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = div;
        div.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        div.dispatchEvent(new FocusEvent('blur'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Pointer);
        activeElement = div;
        div.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        div.dispatchEvent(new FocusEvent('blur'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Keyboard);
        activeElement = div;
        div.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        div.dispatchEvent(new FocusEvent('blur'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElSpy.mockRestore();

        div.addEventListener('pointerdown', handler);
        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('pointerdown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.addEventListener('pointerdown', noopHandler);
        div.addEventListener('pointerdown', handler);
        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('pointerdown', noopHandler);
        div.removeEventListener('pointerdown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.addEventListener('pointerdown', handlerWithStopPropagate);
        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe('program');
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('pointerdown', handlerWithStopPropagate);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.addEventListener('keydown', handler);
        div.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('keydown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.addEventListener('keydown', noopHandler);
        div.addEventListener('keydown', handler);
        div.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('keydown', noopHandler);
        div.removeEventListener('keydown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.addEventListener('keydown', handlerWithStopPropagate);
        div.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('keydown', handlerWithStopPropagate);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        expect(log).toEqual([
            undefined,
            Origin.Keyboard,
            undefined,
            Origin.Pointer,
            undefined,
            Origin.Program,
            undefined,
            Origin.Pointer,
            undefined,
            Origin.Keyboard,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined
        ]);

        log.splice(0);
        dispose();

        div.focus();
        div.blur();
        div.focus();
        div.blur();

        expect(log).toEqual([]);
    });

    it('Should observe focus correctly until disposal when an element instance is provided lazily.', async () => {
        const log: any[] = [];
        let div: HTMLDivElement = null!;
        const origin = inRoot(() => monitorFocusOrigin(() => div));
        div = document.body.appendChild(document.createElement('div'));
        fireEffects();
        const handler = () => div.focus();
        const handlerWithStopPropagate = (e: Event) => (e.stopPropagation(), div.focus());
        const noopHandler = () => {};
        const activeElSpy = vitest.spyOn(document, 'activeElement', 'get').mockImplementation(() => activeElement);

        let activeElement: Element | null = null;
        
        div.tabIndex = 0;

        subscribeEffect(() => {
            log.push(origin());
        });
        fireEffects()

        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Keyboard);
        activeElement = div;
        div.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        div.dispatchEvent(new FocusEvent('blur'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Pointer);
        activeElement = div;
        div.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        div.dispatchEvent(new FocusEvent('blur'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = div;
        div.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        div.dispatchEvent(new FocusEvent('blur'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Pointer);
        activeElement = div;
        div.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        div.dispatchEvent(new FocusEvent('blur'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Keyboard);
        activeElement = div;
        div.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        div.dispatchEvent(new FocusEvent('blur'));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElSpy.mockRestore();

        div.addEventListener('pointerdown', handler);
        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('pointerdown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.addEventListener('pointerdown', noopHandler);
        div.addEventListener('pointerdown', handler);
        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('pointerdown', noopHandler);
        div.removeEventListener('pointerdown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.addEventListener('pointerdown', handlerWithStopPropagate);
        div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe('program');
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('pointerdown', handlerWithStopPropagate);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.addEventListener('keydown', handler);
        div.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('keydown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.addEventListener('keydown', noopHandler);
        div.addEventListener('keydown', handler);
        div.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('keydown', noopHandler);
        div.removeEventListener('keydown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.addEventListener('keydown', handlerWithStopPropagate);
        div.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        div.dispatchEvent(new FocusEvent('focus'));
        div.removeEventListener('keydown', handlerWithStopPropagate);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        div.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        expect(log).toEqual([
            undefined,
            Origin.Keyboard,
            undefined,
            Origin.Pointer,
            undefined,
            Origin.Program,
            undefined,
            Origin.Pointer,
            undefined,
            Origin.Keyboard,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined
        ]);

        log.splice(0);
        dispose();

        div.focus();
        div.blur();
        div.focus();
        div.blur();

        expect(log).toEqual([]);
    });

    it('Should observe child focus correctly when an element instance is provided directly.', async () => {
        const log: any[] = [];
        const parent = document.body.appendChild(document.createElement('div'));
        const child = parent.appendChild(document.createElement('div'));
        const origin = monitorFocusOrigin(parent, true);
        const handler = () => child.focus();
        const handlerWithStopPropagate = (e: Event) => (e.stopPropagation(), child.focus());
        const noopHandler = () => {};
        const activeElSpy = vitest.spyOn(document, 'activeElement', 'get').mockImplementation(() => activeElement);

        let activeElement: Element | null = null;

        child.tabIndex = 0;

        subscribeEffect(() => log.push(origin()));
        fireEffects();

        child.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Keyboard);
        activeElement = child;
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        
        activeElement = null;
        child.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        child.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Pointer);
        activeElement = child;
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        child.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        
        activeElement = child;
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        child.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        child.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        child.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Pointer);
        activeElement = child;
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        child.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);


        child.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        child.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Keyboard);
        activeElement = child;
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        child.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        
        activeElSpy.mockRestore();

        child.addEventListener('pointerdown', handler);
        child.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        child.removeEventListener('pointerdown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        child.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);


        child.addEventListener('pointerdown', noopHandler);
        child.addEventListener('pointerdown', handler);
        child.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        child.removeEventListener('pointerdown', noopHandler);
        child.removeEventListener('pointerdown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        child.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);


        child.addEventListener('pointerdown', handlerWithStopPropagate);
        child.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        child.removeEventListener('pointerdown', handlerWithStopPropagate);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        child.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        child.addEventListener('keydown', handler);
        child.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        child.removeEventListener('keydown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        child.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);


        child.addEventListener('keydown', noopHandler);
        child.addEventListener('keydown', handler);
        child.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        child.removeEventListener('keydown', noopHandler);
        child.removeEventListener('keydown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        child.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);


        child.addEventListener('keydown', handlerWithStopPropagate);
        child.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        child.removeEventListener('keydown', handlerWithStopPropagate);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        child.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        expect(log).toEqual([
            undefined,
            Origin.Keyboard,
            undefined,
            Origin.Pointer,
            undefined,
            Origin.Program,
            undefined,
            Origin.Pointer,
            undefined,
            Origin.Keyboard,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined
        ]);
    });

    it('Should observe child focus correctly when an element instance is provided eagerly.', async () => {
        const log: any[] = [];
        const parent = document.body.appendChild(document.createElement('div'));
        const child = parent.appendChild(document.createElement('div'));
        const origin = monitorFocusOrigin(parent, true);
        const handler = () => child.focus();
        const handlerWithStopPropagate = (e: Event) => (e.stopPropagation(), child.focus());
        const noopHandler = () => {};
        const activeElSpy = vitest.spyOn(document, 'activeElement', 'get').mockImplementation(() => activeElement);

        let activeElement: Element | null = null;

        child.tabIndex = 0;

        subscribeEffect(() => log.push(origin()));
        fireEffects();

        child.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Keyboard);
        activeElement = child;
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        
        activeElement = null;
        child.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        child.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Pointer);
        activeElement = child;
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        child.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        
        activeElement = child;
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        child.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        child.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        child.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Pointer);
        activeElement = child;
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        child.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);


        child.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        child.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Keyboard);
        activeElement = child;
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        child.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        
        activeElSpy.mockRestore();

        child.addEventListener('pointerdown', handler);
        child.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        child.removeEventListener('pointerdown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        child.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);


        child.addEventListener('pointerdown', noopHandler);
        child.addEventListener('pointerdown', handler);
        child.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        child.removeEventListener('pointerdown', noopHandler);
        child.removeEventListener('pointerdown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        child.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);


        child.addEventListener('pointerdown', handlerWithStopPropagate);
        child.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        child.removeEventListener('pointerdown', handlerWithStopPropagate);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        child.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        child.addEventListener('keydown', handler);
        child.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        child.removeEventListener('keydown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        child.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);


        child.addEventListener('keydown', noopHandler);
        child.addEventListener('keydown', handler);
        child.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        child.removeEventListener('keydown', noopHandler);
        child.removeEventListener('keydown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        child.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);


        child.addEventListener('keydown', handlerWithStopPropagate);
        child.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        child.removeEventListener('keydown', handlerWithStopPropagate);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        child.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        expect(log).toEqual([
            undefined,
            Origin.Keyboard,
            undefined,
            Origin.Pointer,
            undefined,
            Origin.Program,
            undefined,
            Origin.Pointer,
            undefined,
            Origin.Keyboard,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined
        ]);
    });

    it('Should observe child focus correctly when an element instance is provided lazily.', async () => {
        const log: any[] = [];
        let parent: HTMLDivElement = null!;
        const origin = inRoot(() => monitorFocusOrigin(() => parent, true));
        parent = document.body.appendChild(document.createElement('div'));
        const child = parent.appendChild(document.createElement('div'));
        const handler = () => child.focus();
        const handlerWithStopPropagate = (e: Event) => (e.stopPropagation(), child.focus());
        const noopHandler = () => {};
        const activeElSpy = vitest.spyOn(document, 'activeElement', 'get').mockImplementation(() => activeElement);

        child.tabIndex = 0
        fireEffects();

        let activeElement: Element | null = null;

        child.tabIndex = 0;

        subscribeEffect(() => log.push(origin()));
        fireEffects();

        child.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Keyboard);
        activeElement = child;
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        
        activeElement = null;
        child.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        child.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Pointer);
        activeElement = child;
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        child.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        
        activeElement = child;
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        child.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        child.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        child.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Pointer);
        activeElement = child;
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        child.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);


        child.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        child.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Keyboard);
        activeElement = child;
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        activeElement = null;
        child.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        
        activeElSpy.mockRestore();

        child.addEventListener('pointerdown', handler);
        child.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        child.removeEventListener('pointerdown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        child.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);


        child.addEventListener('pointerdown', noopHandler);
        child.addEventListener('pointerdown', handler);
        child.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        child.removeEventListener('pointerdown', noopHandler);
        child.removeEventListener('pointerdown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        child.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);


        child.addEventListener('pointerdown', handlerWithStopPropagate);
        child.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        child.removeEventListener('pointerdown', handlerWithStopPropagate);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        child.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        child.addEventListener('keydown', handler);
        child.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        child.removeEventListener('keydown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        child.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);


        child.addEventListener('keydown', noopHandler);
        child.addEventListener('keydown', handler);
        child.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        child.removeEventListener('keydown', noopHandler);
        child.removeEventListener('keydown', handler);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        child.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);


        child.addEventListener('keydown', handlerWithStopPropagate);
        child.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);
        child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        child.removeEventListener('keydown', handlerWithStopPropagate);
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        child.blur();
        await Promise.resolve();
        expect(_getCurrentAssignedOrigin()).toBe(Origin.Program);

        expect(log).toEqual([
            undefined,
            Origin.Keyboard,
            undefined,
            Origin.Pointer,
            undefined,
            Origin.Program,
            undefined,
            Origin.Pointer,
            undefined,
            Origin.Keyboard,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined,
            Origin.Program,
            undefined
        ]);

    });

    it('Should ignore synthetic keyboard event without real focus change.', async () => {
        const log: any[] = [];
        const div = document.body.appendChild(document.createElement('div'));

        div.tabIndex = 0;

        const origin = monitorFocusOrigin(div);

        subscribeEffect(() => log.push(origin()));
        fireEffects();

        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

        div.dispatchEvent(new FocusEvent('focus'));

        await Promise.resolve();

        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

        await Promise.resolve();

        div.dispatchEvent(new FocusEvent('focus'));

        await Promise.resolve();
        
        expect(log).toEqual([
            undefined
        ]);
    });

    it('Should log error message to the console if propagation is stopped.', async () => {
        function getErrorMessage(type: 'keydown' | 'pointerdown'): string {
            return (
                `monitorFocus(): ${type}.stopPropagation() was called. ` +
                'Focus origin may be incorrectly reported as "program".'
            )
        }
        const log: (string | undefined)[] = [];
        const div1 = document.body.appendChild(document.createElement('div'));
        const div2 = document.body.appendChild(document.createElement('div'));
        using activeElSpy = vitest.spyOn(document, 'activeElement', 'get').mockImplementation(() => activeElement);
        using logErrorSpy = vitest.spyOn(console, 'error').mockImplementation((message) => log.push(message));

        let activeElement: Element | null = null;

        const origin1 = monitorFocusOrigin(div1);

        div1.tabIndex = 0;

        subscribeEffect(() => log.push(origin1()));
        fireEffects();

        div1.addEventListener('keydown', e => e.stopPropagation());
        div1.addEventListener('pointerdown', e => e.stopPropagation());

        div1.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        activeElement = div1;
        div1.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();

        activeElement = null;
        div1.dispatchEvent(new FocusEvent('blur'));
        await Promise.resolve();

        div1.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        activeElement = div1;
        div1.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();

        expect(log).toEqual([ undefined, getErrorMessage('keydown'), Origin.Program, undefined, getErrorMessage('pointerdown'), Origin.Program ]);

        log.splice(0);

        const origin2 = monitorFocusOrigin(div2);

        div2.tabIndex = 0;

        subscribeEffect(() => log.push(origin2()));
        fireEffects();

        div2.addEventListener('keydown', e => e.stopImmediatePropagation());
        div2.addEventListener('pointerdown', e => e.stopImmediatePropagation());

        div2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        activeElement = div2;
        div2.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();

        activeElement = null;
        div2.dispatchEvent(new FocusEvent('blur'));
        await Promise.resolve();

        div2.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        activeElement = div2;
        div2.dispatchEvent(new FocusEvent('focus'));
        await Promise.resolve();

        expect(log).toEqual([ undefined, getErrorMessage('keydown'), Origin.Program, undefined, getErrorMessage('pointerdown'), Origin.Program ]);
    });

    it('Should log error message to the console for child if propagation is stopped.', async () => {
        function getErrorMessage(type: 'keydown' | 'pointerdown'): string {
            return (
                `monitorFocus(): ${type}.stopPropagation() was called. ` +
                'Focus origin may be incorrectly reported as "program".'
            )
        }
        const log: (string | undefined)[] = [];
        const parent1 = document.body.appendChild(document.createElement('div'));
        const child1 = parent1.appendChild(document.createElement('div'));
        const parent2 = document.body.appendChild(document.createElement('div'));
        const child2 = parent2.appendChild(document.createElement('div'));
        using activeElSpy = vitest.spyOn(document, 'activeElement', 'get').mockImplementation(() => activeElement);
        using logErrorSpy = vitest.spyOn(console, 'error').mockImplementation((message) => log.push(message))
        let activeElement: Element | null = null;
        
        const origin1 = monitorFocusOrigin(parent1, true);

        child1.tabIndex = 0;

        subscribeEffect(() => log.push(origin1()));
        fireEffects();

        parent1.addEventListener('keydown', e => e.stopPropagation());
        parent1.addEventListener('pointerdown', e => e.stopPropagation());

        child1.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        activeElement = child1;
        child1.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await Promise.resolve();

        activeElement = null;
        child1.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        await Promise.resolve();

        child1.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        activeElement = child1;
        child1.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await Promise.resolve();


        expect(log).toEqual([ undefined, getErrorMessage('keydown'), Origin.Program, undefined, getErrorMessage('pointerdown'), Origin.Program ]);

        log.splice(0);

        const origin2 = monitorFocusOrigin(parent2, true);

        child2.tabIndex = 0;

        subscribeEffect(() => log.push(origin2()));
        fireEffects();

        parent2.addEventListener('keydown', e => e.stopImmediatePropagation());
        parent2.addEventListener('pointerdown', e => e.stopImmediatePropagation());

        child2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        activeElement = child2;
        child2.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await Promise.resolve();

        activeElement = null;
        child2.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        await Promise.resolve();

        child2.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        activeElement = child2;
        child2.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await Promise.resolve();

        expect(log).toEqual([ undefined, getErrorMessage('keydown'), Origin.Program, undefined, getErrorMessage('pointerdown'), Origin.Program ]);

    });

    it('Should ignore focus changes from descendant elements if second argument is not provided.', async () => {
        const log: (string | undefined)[] = [];
        const parent = document.body.appendChild(document.createElement('div'));
        const child = parent.appendChild(document.createElement('div'));
        const origin = monitorFocusOrigin(parent);

        child.tabIndex = 0;

        subscribeEffect(() => log.push(origin()));
        fireEffects();

        child.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Tab',
            bubbles: true
        }));
        child.focus();
        await Promise.resolve();

        child.blur();
        await Promise.resolve();

        child.dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true
        }));
        child.focus();
        await Promise.resolve();

        expect(origin()).toBeUndefined();

        expect(log).toEqual([
            undefined
        ]);
    });

    it('Should ignore focus changes from descendant elements if second argument is false.', async () => {
        const log: (string | undefined)[] = [];
        const parent = document.body.appendChild(document.createElement('div'));
        const child = parent.appendChild(document.createElement('div'));
        const origin = monitorFocusOrigin(parent, false);

        child.tabIndex = 0;

        subscribeEffect(() => log.push(origin()));
        fireEffects();

        child.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Tab',
            bubbles: true
        }));
        child.focus();
        await Promise.resolve();

        child.blur();
        await Promise.resolve();

        child.dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true
        }));
        child.focus();
        await Promise.resolve();

        expect(origin()).toBeUndefined();

        expect(log).toEqual([
            undefined
        ]);
    });

    it('Should return an undefined accessor in a server environment.', () => {
        const div = document.body.appendChild(document.createElement('div'));
        using spy = vitest.spyOn((globalThis as any), '__IS_SERVER__', 'get').mockImplementation(() => true);

        div.tabIndex = 0;
        const origin = monitorFocusOrigin(div);
        div.focus();

        expect(document.activeElement).toBe(div);
        expect(origin.toString()).toBe('() => undefined');
        expect(origin()).toBe(undefined);
        
    });

});

describe('focusVia()', () => {

    it('Should throw error if it is used in server environment.', () => {
        const errorMessage = 'focusVia(): This function cannot be used in a server environment!';
        using spy = vitest.spyOn((globalThis as any), '__IS_SERVER__', 'get').mockImplementation(() => true);

        expect(() => focusVia(document.createElement('div'), 'program')).toThrow(errorMessage);
    });

    it('Should throw an error if the first argument is not a focusable element.', () => {
        const errorMessage1 = 'focusVia(): Invalid first argument! Expected an Element instance.';
        const errorMessage2 = 'focusVia(): Provided target does not implement the focus() method.';

        expect(() => focusVia(0 as any, 'program')).toThrow(errorMessage1);
        expect(() => focusVia(1 as any, 'program')).toThrow(errorMessage1);
        expect(() => focusVia('' as any, 'program')).toThrow(errorMessage1);
        expect(() => focusVia('A' as any, 'program')).toThrow(errorMessage1);
        expect(() => focusVia(true as any, 'program')).toThrow(errorMessage1);
        expect(() => focusVia(false as any, 'program')).toThrow(errorMessage1);
        expect(() => focusVia(undefined as any, 'program')).toThrow(errorMessage1);
        expect(() => focusVia(null as any, 'program')).toThrow(errorMessage1);
        expect(() => focusVia({} as any, 'program')).toThrow(errorMessage1);
        expect(() => focusVia([] as any, 'program')).toThrow(errorMessage1);
        expect(() => focusVia((() => {}) as any, 'program')).toThrow(errorMessage1);
        
        const notFocusable = document.createElement('div');
        notFocusable.focus = undefined as any;

        expect(() => focusVia(notFocusable, 'program')).toThrow(errorMessage2);

        expect(() => document.createElement('div')).not.toThrow();
    });

    it('Should throw an error if the second argument is not valid origin', () => {
        const errorMessage = 'focusVia(): Invalid second argument! Expected one of ["program", "keyboard", "pointer"].'
        const div = document.createElement('div');

        expect(() => focusVia(div, 0 as any)).toThrow(errorMessage);
        expect(() => focusVia(div, 1 as any)).toThrow(errorMessage);
        expect(() => focusVia(div, '' as any)).toThrow(errorMessage);
        expect(() => focusVia(div, 'A' as any)).toThrow(errorMessage);
        expect(() => focusVia(div, true as any)).toThrow(errorMessage);
        expect(() => focusVia(div, false as any)).toThrow(errorMessage);
        expect(() => focusVia(div, undefined as any)).toThrow(errorMessage);
        expect(() => focusVia(div, null as any)).toThrow(errorMessage);
        expect(() => focusVia(div, {} as any)).toThrow(errorMessage);
        expect(() => focusVia(div, [] as any)).toThrow(errorMessage);
        expect(() => focusVia(div, (() => {}) as any)).toThrow(errorMessage);


        expect(() => focusVia(div, 'keyboard')).not.toThrow();
        expect(() => focusVia(div, 'pointer')).not.toThrow();
        expect(() => focusVia(div, 'program')).not.toThrow();
    })

    it('Should override origin and return true.', () => {
        const log: (string | undefined)[] = [];
        const div = document.body.appendChild(document.createElement('div'));
        const origin = monitorFocusOrigin(div);
        let targetOrigin: 'program' | 'keyboard' | 'pointer' = 'program';
        
        div.tabIndex = 0;
        div.addEventListener('keydown', () => expect(focusVia(div, targetOrigin)).toBe(true));
        div.addEventListener('pointerdown', () => expect(focusVia(div, targetOrigin)).toBe(true));

        using focusSpy = vitest.spyOn(div, 'focus');

        subscribeEffect(() => log.push(origin()));
        fireEffects();

        expect(focusVia(div, Origin.Program)).toBe(true);
        div.blur();

        expect(focusVia(div, Origin.Keyboard)).toBe(true);
        div.blur();

        expect(focusVia(div, Origin.Pointer)).toBe(true);
        div.blur();

        targetOrigin =  Origin.Program;
        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        div.blur();

        targetOrigin = Origin.Keyboard;
        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        div.blur();

        targetOrigin = Origin.Pointer;
        div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        div.blur();

        targetOrigin =  Origin.Program;
        div.dispatchEvent(new PointerEvent('pointerdown', {  bubbles: true }));
        div.blur();

        targetOrigin = Origin.Keyboard;
        div.dispatchEvent(new PointerEvent('pointerdown', {  bubbles: true }));
        div.blur();

        targetOrigin = Origin.Pointer;
        div.dispatchEvent(new PointerEvent('pointerdown', {  bubbles: true }));
        div.blur();

        expect(log).toEqual([
            undefined,
            Origin.Program,
            undefined,
            Origin.Keyboard,
            undefined,
            Origin.Pointer,
            undefined,
            Origin.Program,
            undefined,
            Origin.Keyboard,
            undefined,
            Origin.Pointer,
            undefined,
            Origin.Program,
            undefined,
            Origin.Keyboard,
            undefined,
            Origin.Pointer,
            undefined,
        ]);

        expect(focusSpy).toHaveBeenCalledTimes(9);
    });

    it('Should not invoke focus() and return false if element is already focused.', () => {
        const log: (string | undefined)[] = [];
        const div = document.body.appendChild(document.createElement('div'));

        div.tabIndex = 0;
        div.focus();

        using focusSpy = vitest.spyOn(div, 'focus');
        const origin = monitorFocusOrigin(div);

        subscribeEffect(() => log.push(origin()));
        fireEffects();

        expect(focusVia(div, 'program')).toBe(false);
        expect(focusVia(div, 'keyboard')).toBe(false);
        expect(focusVia(div, 'pointer')).toBe(false);
        expect(focusSpy).toHaveBeenCalledTimes(0);
        expect(log).toEqual([ undefined ]);
    });

    it('Should return false if the element cannot be focused.', () => {
        const log: (string | undefined)[] = [];
        const div = document.body.appendChild(document.createElement('div'));

        using focusSpy = vitest.spyOn(div, 'focus');
        const origin = monitorFocusOrigin(div);

        subscribeEffect(() => log.push(origin()));
        fireEffects();

        expect(focusVia(div, 'program')).toBe(false);
        expect(focusVia(div, 'keyboard')).toBe(false);
        expect(focusVia(div, 'pointer')).toBe(false);
        expect(focusSpy).toHaveBeenCalledTimes(3);
        expect(log).toEqual([ undefined ]);

        div.tabIndex = 0;
        div.remove();

        expect(focusVia(div, 'program')).toBe(false);
        expect(focusVia(div, 'keyboard')).toBe(false);
        expect(focusVia(div, 'pointer')).toBe(false);
        expect(focusSpy).toHaveBeenCalledTimes(6);
        expect(log).toEqual([ undefined ]);
    });

    it('Should throw an error in a server environment.', () => {
        const errorMessage = 'focusVia(): This function cannot be used in a server environment!'
        const div = document.createElement('div');
        using spy = vitest.spyOn((globalThis as any), '__IS_SERVER__', 'get').mockImplementation(() => true);

        expect(() => focusVia(div, 'keyboard')).toThrow(errorMessage);
        expect(() => focusVia(div, 'pointer')).toThrow(errorMessage);
        expect(() => focusVia(div, 'program')).toThrow(errorMessage);
    });

});

describe('isFocused(), hasFocusedElement(), getFocusedElement().', () => {

    it('Should throw error if it is used in server environment.', () => {
        const errorMessage1 = 'isFocused(): This function cannot be used in a server environment!';
        const errorMessage2 = 'hasFocusedElement(): This function cannot be used in a server environment!';
        const errorMessage3 = 'getFocusedElement(): This function cannot be used in a server environment!';
        using spy = vitest.spyOn((globalThis as any), '__IS_SERVER__', 'get').mockImplementation(() => true);

        expect(() => isFocused(document.createElement('div'))).toThrow(errorMessage1);
        expect(() => hasFocusedElement(document.createElement('div'))).toThrow(errorMessage2);
        expect(() => getFocusedElement()).toThrow(errorMessage3);
    });

    it('Should correctly determine focus and focused descendants across nested Shadow DOM boundaries.', () => {
        const host1 = document.body.appendChild(document.createElement('div'));

        const shadow1 = host1.attachShadow({ mode: 'open' });
        const child1 = shadow1.appendChild(document.createElement('div'));
        const host2 = child1.appendChild(document.createElement('div'));

        const shadow2 = host2.attachShadow({ mode: 'open' });
        const child2 = shadow2.appendChild(document.createElement('div'));
        const host3 = child2.appendChild(document.createElement('div'));

        const shadow3 = host3.attachShadow({ mode: 'open' });
        const child3 = shadow3.appendChild(document.createElement('div'));

        const input = child3.appendChild(document.createElement('input'));

        const siblingHost1 = document.body.appendChild(document.createElement('div'));

        const siblingShadow1 = siblingHost1.attachShadow({ mode: 'open' });
        const siblingChild1 = siblingShadow1.appendChild(document.createElement('div'));
        const siblingHost2 = siblingChild1.appendChild(document.createElement('div'));

        const siblingShadow2 = siblingHost2.attachShadow({ mode: 'open' });
        const siblingChild2 = siblingShadow2.appendChild(document.createElement('div'));
        const siblingHost3 = siblingChild2.appendChild(document.createElement('div'));

        const siblingShadow3 = siblingHost3.attachShadow({ mode: 'open' });
        const siblingChild3 = siblingShadow3.appendChild(document.createElement('div'));

        const siblingInput = siblingChild3.appendChild(document.createElement('input'));

        expect(getFocusedElement()).toBe(document.body);

        input.focus();

        expect(getFocusedElement()).toBe(input);
        expect(isFocused(input)).toBe(true);

        expect(isFocused(host3)).toBe(false);
        expect(isFocused(host2)).toBe(false);
        expect(isFocused(host1)).toBe(false);
        expect(isFocused(child3)).toBe(false);
        expect(isFocused(child2)).toBe(false);
        expect(isFocused(child1)).toBe(false);
        expect(isFocused(shadow3)).toBe(false);
        expect(isFocused(shadow2)).toBe(false);
        expect(isFocused(shadow1)).toBe(false);

        expect(hasFocusedElement(input)).toBe(true);
        expect(hasFocusedElement(host3)).toBe(true);
        expect(hasFocusedElement(host2)).toBe(true);
        expect(hasFocusedElement(host1)).toBe(true);
        expect(hasFocusedElement(child3)).toBe(true);
        expect(hasFocusedElement(child2)).toBe(true);
        expect(hasFocusedElement(child1)).toBe(true);
        expect(hasFocusedElement(shadow3)).toBe(true);
        expect(hasFocusedElement(shadow2)).toBe(true);
        expect(hasFocusedElement(shadow1)).toBe(true);

        expect(isFocused(siblingInput)).toBe(false);

        expect(isFocused(siblingHost3)).toBe(false);
        expect(isFocused(siblingHost2)).toBe(false);
        expect(isFocused(siblingHost1)).toBe(false);
        expect(isFocused(siblingChild3)).toBe(false);
        expect(isFocused(siblingChild2)).toBe(false);
        expect(isFocused(siblingChild1)).toBe(false);
        expect(isFocused(siblingShadow3)).toBe(false);
        expect(isFocused(siblingShadow2)).toBe(false);
        expect(isFocused(siblingShadow1)).toBe(false);

        expect(hasFocusedElement(siblingInput)).toBe(false);
        expect(hasFocusedElement(siblingHost3)).toBe(false);
        expect(hasFocusedElement(siblingHost2)).toBe(false);
        expect(hasFocusedElement(siblingHost1)).toBe(false);
        expect(hasFocusedElement(siblingChild3)).toBe(false);
        expect(hasFocusedElement(siblingChild2)).toBe(false);
        expect(hasFocusedElement(siblingChild1)).toBe(false);
        expect(hasFocusedElement(siblingShadow3)).toBe(false);
        expect(hasFocusedElement(siblingShadow2)).toBe(false);
        expect(hasFocusedElement(siblingShadow1)).toBe(false);

        siblingInput.focus();
         
        expect(getFocusedElement()).toBe(siblingInput);
        expect(isFocused(input)).toBe(false);

        expect(isFocused(host3)).toBe(false);
        expect(isFocused(host2)).toBe(false);
        expect(isFocused(host1)).toBe(false);
        expect(isFocused(child3)).toBe(false);
        expect(isFocused(child2)).toBe(false);
        expect(isFocused(child1)).toBe(false);
        expect(isFocused(shadow3)).toBe(false);
        expect(isFocused(shadow2)).toBe(false);
        expect(isFocused(shadow1)).toBe(false);

        expect(hasFocusedElement(input)).toBe(false);
        expect(hasFocusedElement(host3)).toBe(false);
        expect(hasFocusedElement(host2)).toBe(false);
        expect(hasFocusedElement(host1)).toBe(false);
        expect(hasFocusedElement(child3)).toBe(false);
        expect(hasFocusedElement(child2)).toBe(false);
        expect(hasFocusedElement(child1)).toBe(false);
        expect(hasFocusedElement(shadow3)).toBe(false);
        expect(hasFocusedElement(shadow2)).toBe(false);
        expect(hasFocusedElement(shadow1)).toBe(false);

        expect(isFocused(siblingInput)).toBe(true);

        expect(isFocused(siblingHost3)).toBe(false);
        expect(isFocused(siblingHost2)).toBe(false);
        expect(isFocused(siblingHost1)).toBe(false);
        expect(isFocused(siblingChild3)).toBe(false);
        expect(isFocused(siblingChild2)).toBe(false);
        expect(isFocused(siblingChild1)).toBe(false);
        expect(isFocused(siblingShadow3)).toBe(false);
        expect(isFocused(siblingShadow2)).toBe(false);
        expect(isFocused(siblingShadow1)).toBe(false);

        expect(hasFocusedElement(siblingInput)).toBe(true);
        expect(hasFocusedElement(siblingHost3)).toBe(true);
        expect(hasFocusedElement(siblingHost2)).toBe(true);
        expect(hasFocusedElement(siblingHost1)).toBe(true);
        expect(hasFocusedElement(siblingChild3)).toBe(true);
        expect(hasFocusedElement(siblingChild2)).toBe(true);
        expect(hasFocusedElement(siblingChild1)).toBe(true);
        expect(hasFocusedElement(siblingShadow3)).toBe(true);
        expect(hasFocusedElement(siblingShadow2)).toBe(true);
        expect(hasFocusedElement(siblingShadow1)).toBe(true);
    });

    it('Should throw an error in a server environment.', () => {
        const errorMessage1 = 'isFocused(): This function cannot be used in a server environment!';
        const errorMessage2 = 'hasFocusedElement(): This function cannot be used in a server environment!';
        const errorMessage3 = 'getFocusedElement(): This function cannot be used in a server environment!';
        const div = document.createElement('div');
        using spy = vitest.spyOn((globalThis as any), '__IS_SERVER__', 'get').mockImplementation(() => true);

        expect(() => isFocused(div)).toThrow(errorMessage1);
        expect(() => hasFocusedElement(div)).toThrow(errorMessage2);
        expect(() => getFocusedElement()).toThrow(errorMessage3);
    });

});

describe('observeIsFocused()', () => {

    it('Should throw an error if the first argument is not an element instance or function returning an element.', () => {
        const errorMessage = 'observeIsFocused(): Invalid argument! It must be a function returning a DOM Element or a DOM Element instance (e.g. HTMLElement, SVGElement, etc.).';
        
        expect(() => observeIsFocused(0 as any)).toThrow(errorMessage);
        expect(() => observeIsFocused(1 as any)).toThrow(errorMessage);
        expect(() => observeIsFocused('' as any)).toThrow(errorMessage);
        expect(() => observeIsFocused('A' as any)).toThrow(errorMessage);
        expect(() => observeIsFocused(true as any)).toThrow(errorMessage);
        expect(() => observeIsFocused(false as any)).toThrow(errorMessage);
        expect(() => observeIsFocused(undefined as any)).toThrow(errorMessage);
        expect(() => observeIsFocused(null as any)).toThrow(errorMessage);
        expect(() => observeIsFocused({} as any)).toThrow(errorMessage);
        expect(() => observeIsFocused([] as any)).toThrow(errorMessage);

        expect(() => observeIsFocused((() => 0) as any)).toThrow(errorMessage);
        expect(() => observeIsFocused((() => 1) as any)).toThrow(errorMessage);
        expect(() => observeIsFocused((() => '') as any)).toThrow(errorMessage);
        expect(() => observeIsFocused((() => 'A') as any)).toThrow(errorMessage);
        expect(() => observeIsFocused((() => true) as any)).toThrow(errorMessage);
        expect(() => observeIsFocused((() => false) as any)).toThrow(errorMessage);
        expect(() => observeIsFocused((() => undefined) as any)).toThrow(errorMessage);
        expect(() => observeIsFocused((() => null) as any)).toThrow(errorMessage);
        expect(() => observeIsFocused((() => ({})) as any)).toThrow(errorMessage);
        expect(() => observeIsFocused((() => []) as any)).toThrow(errorMessage);

        expect(() => observeIsFocused(document.createElement('div'))).not.toThrow();
        expect(() => inRoot(() => observeIsFocused((() => {}) as any))).not.toThrow();
        assertPendingEffectsCount(1);
        discardPendingEffects();
    });

    it('Should not have any pending effects if the element is provided directly.', () => {
        const div = document.body.appendChild(document.createElement('div'));
        observeIsFocused(div);
        assertNoPendingEffects();
    });

    it('Should not have any pending effects if the element is provided eagerly.', () => {
        const div = document.body.appendChild(document.createElement('div'));
        observeIsFocused(() => div);
        assertNoPendingEffects();
    });

    it('Should have a pending effect if the element is provided lazily.', () => {
        let div: HTMLDivElement = null!;
        inRoot(() => observeIsFocused(() => div));
        div = document.body.appendChild(document.createElement('div'));
        assertPendingEffectsCount(1);
        discardPendingEffects();
    });

    it('Should observe the focus state reactively when an element is provided directly.', () => {
        const log: boolean[] = [];
        const div = document.body.appendChild(document.createElement('div'));
        div.tabIndex = 0;
        const isFocusedSource = observeIsFocused(div);

        subscribeEffect(() => log.push(isFocusedSource()));
        fireEffects();

        div.focus();
        div.blur();
        focusVia(div, 'keyboard');
        div.blur();
        focusVia(div, 'pointer');
        div.blur();
        focusVia(div, 'program');
        div.blur();

        expect([ false, true, false, true, false, true, false, true, false ]);
    });

    it('Should observe the focus state reactively when an element is provided eagerly.', () => {
        const log: boolean[] = [];
        const div = document.body.appendChild(document.createElement('div'));
        div.tabIndex = 0;
        const isFocusedSource = observeIsFocused(() => div);

        subscribeEffect(() => log.push(isFocusedSource()));
        fireEffects();

        div.focus();
        div.blur();
        focusVia(div, 'keyboard');
        div.blur();
        focusVia(div, 'pointer');
        div.blur();
        focusVia(div, 'program');
        div.blur();

        expect([ false, true, false, true, false, true, false, true, false ]);
    });

    it('Should observe the focus state reactively when an element is provided lazily.', () => {
        const log: boolean[] = [];
        let div: HTMLDivElement = null!;
        const isFocusedSource = inRoot(() => observeIsFocused(() => div));
        div = document.body.appendChild(document.createElement('div'));
        div.tabIndex = 0;
        fireEffects();

        subscribeEffect(() => log.push(isFocusedSource()));
        fireEffects();

        div.focus();
        div.blur();
        focusVia(div, 'keyboard');
        div.blur();
        focusVia(div, 'pointer');
        div.blur();
        focusVia(div, 'program');
        div.blur();

        expect([ false, true, false, true, false, true, false, true, false ]);
    });

    it('Should not observe the child focus state reactively when the element is provided directly.', () => {
        const log: boolean[] = [];
        const parent = document.body.appendChild(document.createElement('div'));
        const child = parent.appendChild(document.createElement('div'));
        child.tabIndex = 0;
        const isFocusedSource = observeIsFocused(parent);

        subscribeEffect(() => log.push(isFocusedSource()));
        fireEffects();

        child.focus();
        child.blur();
        focusVia(child, 'keyboard');
        child.blur();
        focusVia(child, 'pointer');
        child.blur();
        focusVia(child, 'program');
        child.blur();

        expect([ false ]);
    });

    it('Should not observe the child focus state reactively when the element is provided eagerly.', () => {
        const log: boolean[] = [];
        const parent = document.body.appendChild(document.createElement('div'));
        const child = parent.appendChild(document.createElement('div'));
        child.tabIndex = 0;
        const isFocusedSource = observeIsFocused(() => parent);

        subscribeEffect(() => log.push(isFocusedSource()));
        fireEffects();

        child.focus();
        child.blur();
        focusVia(child, 'keyboard');
        child.blur();
        focusVia(child, 'pointer');
        child.blur();
        focusVia(child, 'program');
        child.blur();

        expect([ false ]);
    });

    it('Should not observe the child focus state reactively when the element is provided lazily.', () => {
        const log: boolean[] = [];
        let parent: HTMLDivElement = null!;
        const isFocusedSource = inRoot(() => observeIsFocused(() => parent));
        parent = document.body.appendChild(document.createElement('div'))
        const child = parent.appendChild(document.createElement('div'));
        child.tabIndex = 0;
        fireEffects();

        subscribeEffect(() => log.push(isFocusedSource()));
        fireEffects();

        child.focus();
        child.blur();
        focusVia(child, 'keyboard');
        child.blur();
        focusVia(child, 'pointer');
        child.blur();
        focusVia(child, 'program');
        child.blur();

        expect([ false ]);
    });

    it('Should return a false accessor in a server environment.', () => {
        const div = document.body.appendChild(document.createElement('div'));
        using spy = vitest.spyOn((globalThis as any), '__IS_SERVER__', 'get').mockImplementation(() => true);

        div.tabIndex = 0;
        const isFocused = observeIsFocused(div);
        div.focus();

        expect(document.activeElement).toBe(div);
        expect(isFocused.toString()).toBe('() => false');
        expect(isFocused()).toBe(false);
    });

});

describe('observeHasFocusedElement()', () => {

    it('Should throw an error if the first argument is not an element instance or function returning an element.', () => {
        const errorMessage = 'observeHasFocusedElement(): Invalid argument! It must be a function returning a DOM Element or a DOM Element instance (e.g. HTMLElement, SVGElement, etc.).';
        
        expect(() => observeHasFocusedElement(0 as any)).toThrow(errorMessage);
        expect(() => observeHasFocusedElement(1 as any)).toThrow(errorMessage);
        expect(() => observeHasFocusedElement('' as any)).toThrow(errorMessage);
        expect(() => observeHasFocusedElement('A' as any)).toThrow(errorMessage);
        expect(() => observeHasFocusedElement(true as any)).toThrow(errorMessage);
        expect(() => observeHasFocusedElement(false as any)).toThrow(errorMessage);
        expect(() => observeHasFocusedElement(undefined as any)).toThrow(errorMessage);
        expect(() => observeHasFocusedElement(null as any)).toThrow(errorMessage);
        expect(() => observeHasFocusedElement({} as any)).toThrow(errorMessage);
        expect(() => observeHasFocusedElement([] as any)).toThrow(errorMessage);

        expect(() => observeHasFocusedElement((() => 0) as any)).toThrow(errorMessage);
        expect(() => observeHasFocusedElement((() => 1) as any)).toThrow(errorMessage);
        expect(() => observeHasFocusedElement((() => '') as any)).toThrow(errorMessage);
        expect(() => observeHasFocusedElement((() => 'A') as any)).toThrow(errorMessage);
        expect(() => observeHasFocusedElement((() => true) as any)).toThrow(errorMessage);
        expect(() => observeHasFocusedElement((() => false) as any)).toThrow(errorMessage);
        expect(() => observeHasFocusedElement((() => undefined) as any)).toThrow(errorMessage);
        expect(() => observeHasFocusedElement((() => null) as any)).toThrow(errorMessage);
        expect(() => observeHasFocusedElement((() => ({})) as any)).toThrow(errorMessage);
        expect(() => observeHasFocusedElement((() => []) as any)).toThrow(errorMessage);

        expect(() => observeHasFocusedElement(document.createElement('div'))).not.toThrow();
        expect(() => inRoot(() => observeHasFocusedElement((() => {}) as any))).not.toThrow();
        assertPendingEffectsCount(1);
        discardPendingEffects();
    });

    it('Should not have any pending effects if the element is provided directly.', () => {
        const div = document.body.appendChild(document.createElement('div'));
        observeHasFocusedElement(div);
        assertNoPendingEffects();
    });

    it('Should not have any pending effects if the element is provided eagerly.', () => {
        const div = document.body.appendChild(document.createElement('div'));
        observeHasFocusedElement(() => div);
        assertNoPendingEffects();
    });

    it('Should have a pending effect if the element is provided lazily.', () => {
        let div: HTMLDivElement = null!;
        inRoot(() => observeHasFocusedElement(() => div));
        div = document.body.appendChild(document.createElement('div'));
        assertPendingEffectsCount(1);
        discardPendingEffects();
    });

    it('Should observe the focus state reactively when the element is provided directly.', () => {
        const log: boolean[] = [];
        const div = document.body.appendChild(document.createElement('div'));
        div.tabIndex = 0;
        const hasFocusedElementSource = observeHasFocusedElement(div);

        subscribeEffect(() => log.push(hasFocusedElementSource()));
        fireEffects();

        div.focus();
        div.blur();
        focusVia(div, 'keyboard');
        div.blur();
        focusVia(div, 'pointer');
        div.blur();
        focusVia(div, 'program');
        div.blur();

        expect([ false, true, false, true, false, true, false, true, false ]);
    });

    it('Should observe the focus state reactively when the element is provided eagerly.', () => {
        const log: boolean[] = [];
        const div = document.body.appendChild(document.createElement('div'));
        div.tabIndex = 0;
        const hasFocusedElementSource = observeHasFocusedElement(() => div);

        subscribeEffect(() => log.push(hasFocusedElementSource()));
        fireEffects();

        div.focus();
        div.blur();
        focusVia(div, 'keyboard');
        div.blur();
        focusVia(div, 'pointer');
        div.blur();
        focusVia(div, 'program');
        div.blur();

        expect([ false, true, false, true, false, true, false, true, false ]);
    });

    it('Should observe the focus state reactively when the element is provided lazily.', () => {
        const log: boolean[] = [];
        let div: HTMLDivElement = null!;
        const hasFocusedElementSource = inRoot(() => observeHasFocusedElement(() => div));
        div = document.body.appendChild(document.createElement('div'));
        div.tabIndex = 0;
        fireEffects();

        subscribeEffect(() => log.push(hasFocusedElementSource()));
        fireEffects()

        div.focus();
        div.blur();
        focusVia(div, 'keyboard');
        div.blur();
        focusVia(div, 'pointer');
        div.blur();
        focusVia(div, 'program');
        div.blur();

        expect([ false, true, false, true, false, true, false, true, false ]);
    });

    it('Should observe the child focus state reactively when the element is provided directly.', () => {
        const log: boolean[] = [];
        const parent = document.body.appendChild(document.createElement('div'));
        const child = parent.appendChild(document.createElement('div'));
        child.tabIndex = 0;
        const hasFocusedElementSource = observeHasFocusedElement(parent);

        subscribeEffect(() => log.push(hasFocusedElementSource()));
        fireEffects();

        child.focus();
        child.blur();
        focusVia(child, 'keyboard');
        child.blur();
        focusVia(child, 'pointer');
        child.blur();
        focusVia(child, 'program');
        child.blur();

        expect([ false, true, false, true, false, true, false, true, false ]);
    });

    it('Should observe the child focus state reactively when the element is provided eagerly.', () => {
        const log: boolean[] = [];
        const parent = document.body.appendChild(document.createElement('div'));
        const child = parent.appendChild(document.createElement('div'));
        child.tabIndex = 0;
        const hasFocusedElementSource = observeHasFocusedElement(() => parent);

        subscribeEffect(() => log.push(hasFocusedElementSource()));
        fireEffects();

        child.focus();
        child.blur();
        focusVia(child, 'keyboard');
        child.blur();
        focusVia(child, 'pointer');
        child.blur();
        focusVia(child, 'program');
        child.blur();

        expect([ false, true, false, true, false, true, false, true, false ]);
    });

    it('Should observe the child focus state reactively when the element is provided eagerly.', () => {
        const log: boolean[] = [];
        let parent: HTMLDivElement = null!;
        const hasFocusedElementSource = inRoot(() => observeHasFocusedElement(() => parent));
        parent = document.body.appendChild(document.createElement('div'));
        const child = parent.appendChild(document.createElement('div'));
        child.tabIndex = 0;
        fireEffects();

        subscribeEffect(() => log.push(hasFocusedElementSource()));
        fireEffects();

        child.focus();
        child.blur();
        focusVia(child, 'keyboard');
        child.blur();
        focusVia(child, 'pointer');
        child.blur();
        focusVia(child, 'program');
        child.blur();

        expect([ false, true, false, true, false, true, false, true, false ]);
    });

    it('Should return a false accessor in a server environment.', () => {
        const div = document.body.appendChild(document.createElement('div'));
        using spy = vitest.spyOn((globalThis as any), '__IS_SERVER__', 'get').mockImplementation(() => true);

        div.tabIndex = 0;
        const hasFocusedElement = observeHasFocusedElement(div);
        div.focus();

        expect(document.activeElement).toBe(div);
        expect(hasFocusedElement.toString()).toBe('() => false');
        expect(hasFocusedElement()).toBe(false);
    });

});

describe('_eachPotentialFocusable()', () => {

    it('Should invoke the callback for all elements with a non-negative tabindex and all contenteditable elements.', () => {
        const container = document.body.appendChild(document.createElement('div'));
        container.tabIndex = 0;

        const div1 = container.appendChild(document.createElement('div'));
        const div2 = container.appendChild(document.createElement('div'));
        div2.tabIndex = 0;
        const div3 = container.appendChild(document.createElement('div'));
        const div4 = container.appendChild(document.createElement('div'));
        div4.tabIndex = 0;
        const div5 = container.appendChild(document.createElement('div'));
        div5.tabIndex = 0;
        const div6 = container.appendChild(document.createElement('div'));
        const div7 = container.appendChild(document.createElement('div'));
        const div8 = container.appendChild(document.createElement('div'));
        div8.tabIndex = 1;
        const div9 = container.appendChild(document.createElement('div'));
        div9.tabIndex = 2;
        const div10 = container.appendChild(document.createElement('div'));
        div10.tabIndex = 2;
        const div11 = container.appendChild(document.createElement('div'));
        const div12 = container.appendChild(document.createElement('div'));
        (div12 as any).isContentEditable = true; //JsDom does not reflect [contenteditable=true] attribute
        const div13 = container.appendChild(document.createElement('div'));
        div13.tabIndex = -2;
        (div13 as any).isContentEditable = true; //JsDom does not reflect [contenteditable=true] attribute
        const div14 = container.appendChild(document.createElement('div'));
        div14.tabIndex = -2;
        const input = container.appendChild(document.createElement('input'));
        const button = container.appendChild(document.createElement('button'));
        const textarea = container.appendChild(document.createElement('textarea'));
        const select = container.appendChild(document.createElement('select'));

        const items: { element: Element, priority: number }[] = [];

         _eachPotentialTabbable(container, (item) => items.push(item));

        expect(items.map((it) => it ? it.element : null)).toEqual([ container, div2, div4, div5, div8, div9, div10, div12, div13, input, button, textarea, select ]);
        expect(items.filter((it) => it !== null).map(it => it.priority)).toEqual([0, 0, 0, 0, 1, 2, 2, 0, 0, 0, 0, 0, 0]);
    });

    it('Should invoke the callback for all potential tabbable elements across shadow dom bounders.', () => {
        const root = document.body.appendChild(document.createElement('div'));
        const input1 = root.appendChild(document.createElement('input'));
        const child1 = root.appendChild(document.createElement('div'));
        const shadow1 = child1.attachShadow({ mode: 'open' });
        const input2 = shadow1.appendChild(document.createElement('input'));
        const child2 = shadow1.appendChild(document.createElement('div'));
        const shadow2 = child2.attachShadow({ mode: 'open' });
        const input3 = shadow2.appendChild(document.createElement('input'));
        const child3 = shadow2.appendChild(document.createElement('div'));
        const shadow3 = child3.attachShadow({ mode: 'open' });
        const input4 = shadow3.appendChild(document.createElement('input'));

        const elements: Element[] = [];
        
        _eachPotentialTabbable(root, (item) => elements.push(item.element));

        expect(elements).toEqual([ input1, input2, input3, input4 ]);
    });

    it('Should invoke callback for all not disabled native focusable controls.', () => {
        const container = document.body.appendChild(document.createElement('div'));

        const button1 = container.appendChild(document.createElement('button'));
        const button2 = container.appendChild(document.createElement('button'));
        button2.ariaDisabled = 'true';
        const button3 = container.appendChild(document.createElement('button'));
        button3.disabled = true;

        const input1 = container.appendChild(document.createElement('input'));
        const input2 = container.appendChild(document.createElement('input'));
        input2.ariaDisabled = 'true';
        const input3 = container.appendChild(document.createElement('input'));
        input3.disabled = true;

        const select1 = container.appendChild(document.createElement('select'));
        const select2 = container.appendChild(document.createElement('select'));
        select2.ariaDisabled = 'true';
        const select3 = container.appendChild(document.createElement('select'));
        select3.disabled = true;

        const textarea1 = container.appendChild(document.createElement('textarea'));
        const textarea2 = container.appendChild(document.createElement('textarea'));
        textarea2.ariaDisabled = 'true';
        const textarea3 = container.appendChild(document.createElement('textarea'));
        textarea3.disabled = true;

        const elements: Element[] = [];
        
        _eachPotentialTabbable(container, (item) => elements.push(item.element));

        expect(elements).toEqual([ button1, button2, input1, input2, select1, select2, textarea1, textarea2 ]);
    });

    it('Should not invoke callback for all controls inside a disabled fieldset.', () => {
        const container = document.body.appendChild(document.createElement('div'));

        const fieldset1 = container.appendChild(document.createElement('fieldset'));
        const button1 = fieldset1.appendChild(document.createElement('button'));
        const input1 = fieldset1.appendChild(document.createElement('input'));
        const select1 = fieldset1.appendChild(document.createElement('select'));
        const textarea1 = fieldset1.appendChild(document.createElement('textarea'));

        const fieldset2 = container.appendChild(document.createElement('fieldset'));
        const button2 = fieldset2.appendChild(document.createElement('button'));
        const input2 = fieldset2.appendChild(document.createElement('input'));
        const select2 = fieldset2.appendChild(document.createElement('select'));
        const textarea2 = fieldset2.appendChild(document.createElement('textarea'));

        fieldset2.disabled = true;

        const elements: Element[] = [];
        
        _eachPotentialTabbable(container, (item) => elements.push(item.element));

        expect(elements).toEqual([ button1, input1, select1, textarea1 ]);
    });

    it('Should not invoke callback for all potential tabbable elements inside inert container.', () => {
        const container = document.body.appendChild(document.createElement('div'));

        const child1 = container.appendChild(document.createElement('div'));
        const button1 = child1.appendChild(document.createElement('button'));
        const input1 = child1.appendChild(document.createElement('input'));
        const select1 = child1.appendChild(document.createElement('select'));
        const textarea1 = child1.appendChild(document.createElement('textarea'));
        const div1 = child1.appendChild(document.createElement('div'));
        div1.tabIndex = 0
        const div2 = child1.appendChild(document.createElement('div'));
        (div2 as any).isContentEditable = true //JsDom does not reflect [contenteditable=true] attribute

        const child2 = container.appendChild(document.createElement('div'));
        const button2 = child2.appendChild(document.createElement('button'));
        const input2 = child2.appendChild(document.createElement('input'));
        const select2 = child2.appendChild(document.createElement('select'));
        const textarea2 = child2.appendChild(document.createElement('textarea'));
        const div3 = child2.appendChild(document.createElement('div'));
        div3.tabIndex = 0
        const div4 = child2.appendChild(document.createElement('div'));
        (div4 as any).isContentEditable = true //JsDom does not reflect [contenteditable=true] attribute

        child2.inert = true;

        const elements: Element[] = [];
        
        _eachPotentialTabbable(container, (item) => elements.push(item.element));

        expect(elements).toEqual([ button1, input1, select1, textarea1, div1, div2 ]);
    });

    it('Should not invoke callback at all if a container is inert.', () => {
        const container = document.body.appendChild(document.createElement('div'));

        const child = container.appendChild(document.createElement('div'));
        const button = child.appendChild(document.createElement('button'));
        const input = child.appendChild(document.createElement('input'));
        const select = child.appendChild(document.createElement('select'));
        const textarea = child.appendChild(document.createElement('textarea'));
        const div1 = child.appendChild(document.createElement('div'));
        div1.tabIndex = 0
        const div2 = child.appendChild(document.createElement('div'));
        (div2 as any).isContentEditable = true //JsDom does not reflect [contenteditable=true] attribute

        container.inert = true;

        const elements: Element[] = [];
        
        _eachPotentialTabbable(container, (item) => elements.push(item.element));

        expect(elements).toEqual([]);
    });

    it('Should not invoke callback at all if a container is disconnected from document.', () => {
        const root = document.createElement('div');
        const container = root.appendChild(document.createElement('div'));

        const child = container.appendChild(document.createElement('div'));
        const button = child.appendChild(document.createElement('button'));
        const input = child.appendChild(document.createElement('input'));
        const select = child.appendChild(document.createElement('select'));
        const textarea = child.appendChild(document.createElement('textarea'));
        const div1 = child.appendChild(document.createElement('div'));
        div1.tabIndex = 0
        const div2 = child.appendChild(document.createElement('div'));
        (div2 as any).isContentEditable = true //JsDom does not reflect [contenteditable=true] attribute
        
        const elements: Element[] = [];
        
        _eachPotentialTabbable(container, (item) => elements.push(item.element));

        expect(elements).toEqual([]);
    })

    it('Should not invoke callback for an option element.', () => {
        const container = document.body.appendChild(document.createElement('div'));
        container.appendChild(document.createElement('option'));
        container.appendChild(document.createElement('option'));

        (container.children[1] as HTMLElement).tabIndex = 0

        const elements: Element[] = [];
        
        _eachPotentialTabbable(container, (item) => elements.push(item.element));

        expect(elements).toEqual([]);
    });

});

describe('focusTrap()', () => {
    beforeAll(() => {
        manualEffectsMode = false;
        vitest.useFakeTimers({ toFake: ['queueMicrotask', 'performance', 'setImmediate'] });
    });
    afterAll(() => {
        manualEffectsMode = true;
        vitest.useRealTimers();
    });

    it('Should throw an error in a server environment.', () => {
        const errorMessage = 'focusTrap(): This function cannot be used in a server environment!';
        const div = document.body.appendChild(document.createElement('div'));
        using spy = vitest.spyOn((globalThis as any), '__IS_SERVER__', 'get').mockRejectedValue(true);

        expect(() => focusTrap(div)).toThrow(errorMessage);
    });

    it('Should throw an error if the provided argument is not an Element instance.', () => {
        const errorMessage = 'focusTrap(): Invalid argument! Expected an Element instance.';
        const div = document.body.appendChild(document.createElement('div'));

        expect(() => inRoot(() => focusTrap(0 as any))).toThrow(errorMessage);
        expect(() => inRoot(() => focusTrap(1 as any))).toThrow(errorMessage);
        expect(() => inRoot(() => focusTrap('' as any))).toThrow(errorMessage);
        expect(() => inRoot(() => focusTrap('A' as any))).toThrow(errorMessage);
        expect(() => inRoot(() => focusTrap(true as any))).toThrow(errorMessage);
        expect(() => inRoot(() => focusTrap(false as any))).toThrow(errorMessage);
        expect(() => inRoot(() => focusTrap(undefined as any))).toThrow(errorMessage);
        expect(() => inRoot(() => focusTrap(null as any))).toThrow(errorMessage);
        expect(() => inRoot(() => focusTrap({} as any))).toThrow(errorMessage);
        expect(() => inRoot(() => focusTrap([] as any))).toThrow(errorMessage);
        expect(() => inRoot(() => focusTrap((() => {}) as any))).toThrow(errorMessage);

        expect(() => inRoot(() => focusTrap(div))).not.toThrow();

        vitest.runAllTicks();
    });

    it('Should trap focus within the DOM branch.', () => {
        function TestComponent() {
            return (
                <>
                    <div>
                        <div tabindex={0}></div>
                        <div tabindex={0}></div>
                        <div tabindex={0}></div>
                    </div>
                    <div id="container" ref={focusTrap}>
                        <div id="item0" tabindex={0}></div>
                        <div id="item1" tabindex={0}></div>
                        <div id="item2" tabindex={0}></div>
                        <div id="item3" tabindex={1}></div>
                        <div id="item4" tabindex={1}></div>
                        <div id="item5" tabindex={1}></div>
                        <div id="item6" tabindex={2}></div>
                        <div id="item7" tabindex={2}></div>
                        <div id="item8" tabindex={1}></div>
                        <div id="item9" tabindex={0}></div>
                    </div>
                    <div>
                        <div tabindex={0}></div> 
                        <div tabindex={0}></div> 
                        <div tabindex={0}></div> 
                    </div>
                </>
            )
        }

        
        inRoot(() => render(() => <TestComponent/>, document.body.appendChild(document.createElement('div')), undefined));
        vitest.runAllTicks();

        const container = document.getElementById('container') as HTMLElement;

        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(document.getElementById('item6')!)).toBe(true); 

        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(document.getElementById('item7')!)).toBe(true);

        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(document.getElementById('item3')!)).toBe(true);

        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(document.getElementById('item4')!)).toBe(true);

        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(document.getElementById('item5')!)).toBe(true);

        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(document.getElementById('item8')!)).toBe(true);

        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(document.getElementById('item0')!)).toBe(true);

        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(document.getElementById('item1')!)).toBe(true);

        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(document.getElementById('item2')!)).toBe(true);

        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(document.getElementById('item9')!)).toBe(true);

        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(document.getElementById('item6')!)).toBe(true);

    });

    it('Should move focus to the next element that can be focused.', async () => {
        const container = document.body.appendChild(document.createElement('div'));
        const child1 = container.appendChild(document.createElement('div'));
        const child2 = container.appendChild(document.createElement('div'));
        const child3 = container.appendChild(document.createElement('div'));
        const child4 = container.appendChild(document.createElement('div'));
        const child5 = container.appendChild(document.createElement('div'));

        child1.tabIndex = 0;
        child2.tabIndex = 0;
        child3.tabIndex = 0;
        child4.tabIndex = 0;
        child5.tabIndex = 0;

        child2.focus = () => {};
        child4.focus = () => {};

        inRoot(() => focusTrap(container));
        await vitest.runAllTimersAsync();

        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child1)).toBe(true);

        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child3)).toBe(true);

        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child5)).toBe(true);

        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child1)).toBe(true);
    });

    it('Should move focus from the first element that was focused when the trap was created.', async () => {
        const container = document.body.appendChild(document.createElement('div'));
        const child1 = container.appendChild(document.createElement('div'));
        const child2 = container.appendChild(document.createElement('div'));
        const child3 = container.appendChild(document.createElement('div'));
        const child4 = container.appendChild(document.createElement('div'));
        const child5 = container.appendChild(document.createElement('div'));
        const child6 = container.appendChild(document.createElement('div'));

        child1.tabIndex = 0;
        child2.tabIndex = 0;
        child3.tabIndex = 0;
        child4.tabIndex = 0;
        child5.tabIndex = 0;
        child6.tabIndex = 0;

        child1.focus();

        inRoot(() => focusTrap(container));
        await vitest.runAllTimersAsync();

        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child2)).toBe(true);
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child3)).toBe(true);
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child4)).toBe(true);
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child5)).toBe(true);
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child6)).toBe(true);
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child1)).toBe(true);
    });

    it('Should move focus from the last element that was focused when the trap was created.', async () => {
        const container = document.body.appendChild(document.createElement('div'));
        const child1 = container.appendChild(document.createElement('div'));
        const child2 = container.appendChild(document.createElement('div'));
        const child3 = container.appendChild(document.createElement('div'));
        const child4 = container.appendChild(document.createElement('div'));
        const child5 = container.appendChild(document.createElement('div'));
        const child6 = container.appendChild(document.createElement('div'));

        child1.tabIndex = 0;
        child2.tabIndex = 0;
        child3.tabIndex = 0;
        child4.tabIndex = 0;
        child5.tabIndex = 0;
        child6.tabIndex = 0;

        child6.focus();

        inRoot(() => focusTrap(container));
        await vitest.runAllTimersAsync();

        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child1)).toBe(true);
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child2)).toBe(true);
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child3)).toBe(true);
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child4)).toBe(true);
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child5)).toBe(true);
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child6)).toBe(true);
    });

    it('Should move focus from an element that was already focused when the trap was created.', async () => {
        const container = document.body.appendChild(document.createElement('div'));
        const child1 = container.appendChild(document.createElement('div'));
        const child2 = container.appendChild(document.createElement('div'));
        const child3 = container.appendChild(document.createElement('div'));
        const child4 = container.appendChild(document.createElement('div'));
        const child5 = container.appendChild(document.createElement('div'));
        const child6 = container.appendChild(document.createElement('div'));

        child1.tabIndex = 0;
        child2.tabIndex = 0;
        child3.tabIndex = 0;
        child4.tabIndex = 0;
        child5.tabIndex = 0;
        child6.tabIndex = 0;

        child3.focus();

        inRoot(() => focusTrap(container));
        await vitest.runAllTimersAsync();

        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child4)).toBe(true);
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child5)).toBe(true);
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child6)).toBe(true);
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child1)).toBe(true);
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child2)).toBe(true);
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child3)).toBe(true);
    });

    it('Should move focus correctly even if a preceding item has been removed.', async () => {
        const container = document.body.appendChild(document.createElement('div'));
        const child1 = container.appendChild(document.createElement('div'));
        const child2 = container.appendChild(document.createElement('div'));
        const child3 = container.appendChild(document.createElement('div'));
        const child4 = container.appendChild(document.createElement('div'));
        const child5 = container.appendChild(document.createElement('div'));
        const child6 = container.appendChild(document.createElement('div'));

        child1.tabIndex = 0;
        child2.tabIndex = 0;
        child3.tabIndex = 0;
        child4.tabIndex = 0;
        child5.tabIndex = 0;
        child6.tabIndex = 0;

        child4.focus();
        
        inRoot(() => focusTrap(container));
        await vitest.runAllTimersAsync();

        child2.remove();
        await vitest.runAllTimersAsync();

        expect(isFocused(child4)).toBe(true);
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child5)).toBe(true);
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child6)).toBe(true);
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child1)).toBe(true);
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child3)).toBe(true);
    });

    it('Should move focus from the element with higher tabindex that was focused when the trap was created.', async () => {
        const container = document.body.appendChild(document.createElement('div'));
        const child1 = container.appendChild(document.createElement('div'));
        const child2 = container.appendChild(document.createElement('div'));
        const child3 = container.appendChild(document.createElement('div'));
        const child4 = container.appendChild(document.createElement('div'));
        const child5 = container.appendChild(document.createElement('div'));
        const child6 = container.appendChild(document.createElement('div'));

        child1.tabIndex = 0;
        child2.tabIndex = 0;
        child3.tabIndex = 0;
        child4.tabIndex = 1;
        child5.tabIndex = 0;
        child6.tabIndex = 0;

        child4.focus();

        inRoot(() => focusTrap(container));
        await vitest.runAllTimersAsync();

        expect(isFocused(child4)).toBe(true);
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child1)).toBe(true);
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child2)).toBe(true);
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child3)).toBe(true);
    });

    it('Should preserve tabindex order when moving focus through elements.', async () => {
        const container = document.body.appendChild(document.createElement('div'));
        const child1 = container.appendChild(document.createElement('div'));
        const child2 = container.appendChild(document.createElement('div'));
        const child3 = container.appendChild(document.createElement('div'));
        const child4 = container.appendChild(document.createElement('div'));
        const child5 = container.appendChild(document.createElement('div'));
        const child6 = container.appendChild(document.createElement('div'));

        child1.tabIndex = 0;
        child2.tabIndex = 0;
        child3.tabIndex = 1;
        child4.tabIndex = 0;
        child5.tabIndex = 0; 
        child6.tabIndex = 0;

        child1.focus();

        inRoot(() => focusTrap(container));
        await vitest.runAllTimersAsync();

        expect(isFocused(child1)).toBe(true);
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child2)).toBe(true);
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child4)).toBe(true);
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(isFocused(child5)).toBe(true);
    });

})