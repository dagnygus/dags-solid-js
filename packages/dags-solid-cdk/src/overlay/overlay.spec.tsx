import { createRoot, createSignal, getOwner, onCleanup, sharedConfig } from 'solid-js';
import { _getOverlayRoot, _OverlayHandleImpl, _ServerOverlayHandleImpl, createOverlay, useOverlayHandle } from './overlay';

const disposeBag: (() => void)[] = [];

function dispose(): void {
    while (disposeBag.length) {
        disposeBag.shift()!();
    }
}

function inRoot<T = void>(fn: () => T): T {
    return createRoot((dispose) => {
        disposeBag.push(dispose);
        return fn();
    });
}

vitest.mock(import('./overlay'), (importOgModule) => {
    (globalThis as any).__IS_SERVER__ = false;
    return importOgModule();
});

afterEach(() => {
    dispose();
    document.body.replaceChildren();
})

afterAll(() => {
    delete (globalThis as any).__IS_SERVER__;
    vitest.doUnmock('./overlay');
});

describe('createOverlay()', () => {

    it('Should throw an error if used outside owning context.', () => {
        const errorMessage = 'createOverlay(): An owning context is required!';
        expect(() => createOverlay({} as any)).toThrow(errorMessage);
    })

    it('Should throw an error if argument is not a non-array object.', () => {
        const errorMessage = 'createOverlay(): Invalid argument! Expected a non-array object.';
        //@ts-expect-error
        expect(() => inRoot(() => createOverlay())).toThrow(errorMessage);
        expect(() => inRoot(() => createOverlay(0 as any))).toThrow(errorMessage);
        expect(() => inRoot(() => createOverlay(1 as any))).toThrow(errorMessage);
        expect(() => inRoot(() => createOverlay(true as any))).toThrow(errorMessage);
        expect(() => inRoot(() => createOverlay(false as any))).toThrow(errorMessage);
        expect(() => inRoot(() => createOverlay('' as any))).toThrow(errorMessage);
        expect(() => inRoot(() => createOverlay('A' as any))).toThrow(errorMessage);
        expect(() => inRoot(() => createOverlay([] as any))).toThrow(errorMessage);
        expect(() => inRoot(() => createOverlay((() => {}) as any))).toThrow(errorMessage);
        expect(() => inRoot(() => createOverlay(null as any))).toThrow(errorMessage);
        expect(() => inRoot(() => createOverlay(undefined as any))).toThrow(errorMessage);
    });

    it('Should throw an error if the provided argument does not contain the required properties with type of function.', () => {
        const errorMessage1 = 'createOverlay({ component }): Invalid argument! Expected an object with "component" property of type function.';
        const errorMessage2 = 'createOverlay({ positionStrategy }): Invalid argument! Expected an object with "positionStrategy" property of type function.';

        expect(() => inRoot(() => createOverlay({ component: 0 as any, positionStrategy: (el) => el }))).toThrow(errorMessage1);
        expect(() => inRoot(() => createOverlay({ component: 1 as any, positionStrategy: (el) => el }))).toThrow(errorMessage1);
        expect(() => inRoot(() => createOverlay({ component: '' as any, positionStrategy: (el) => el }))).toThrow(errorMessage1);
        expect(() => inRoot(() => createOverlay({ component: 'A' as any, positionStrategy: (el) => el }))).toThrow(errorMessage1);
        expect(() => inRoot(() => createOverlay({ component: false as any, positionStrategy: (el) => el }))).toThrow(errorMessage1);
        expect(() => inRoot(() => createOverlay({ component: true as any, positionStrategy: (el) => el }))).toThrow(errorMessage1);
        expect(() => inRoot(() => createOverlay({ component: {} as any, positionStrategy: (el) => el }))).toThrow(errorMessage1);
        expect(() => inRoot(() => createOverlay({ component: [] as any, positionStrategy: (el) => el }))).toThrow(errorMessage1);
        expect(() => inRoot(() => createOverlay({ component: null as any, positionStrategy: (el) => el }))).toThrow(errorMessage1);
        expect(() => inRoot(() => createOverlay({ component: undefined as any, positionStrategy: (el) => el }))).toThrow(errorMessage1);

        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: 0 as any }))).toThrow(errorMessage2);
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: 1 as any }))).toThrow(errorMessage2);
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: '' as any }))).toThrow(errorMessage2);
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: 'A' as any }))).toThrow(errorMessage2);
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: false as any }))).toThrow(errorMessage2);
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: true as any }))).toThrow(errorMessage2);
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: null as any }))).toThrow(errorMessage2);
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: undefined as any }))).toThrow(errorMessage2);
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: {} as any }))).toThrow(errorMessage2);
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: [] as any }))).toThrow(errorMessage2);

        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el }))).not.toThrow();
    });

    it('Should throw an error if "withBackdrop" property is not an optional boolean.', () => {
        const errorMessage = 'createOverlay({ withBackdrop }): Invalid argument! Expected an object with "withBackdrop" property of type boolean, or without it.';

        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, withBackdrop: 0 as any}))).toThrow(errorMessage);
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, withBackdrop: 1 as any}))).toThrow(errorMessage);
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, withBackdrop: '' as any}))).toThrow(errorMessage);
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, withBackdrop: 'A' as any}))).toThrow(errorMessage);
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, withBackdrop: {} as any}))).toThrow(errorMessage);
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, withBackdrop: [] as any}))).toThrow(errorMessage);
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, withBackdrop: (() => {}) as any}))).toThrow(errorMessage);

        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, withBackdrop: undefined })));
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, withBackdrop: null as any })));
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, withBackdrop: true })));
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, withBackdrop: false })));
    });

    it('Should throw an error if "manualRemove" property is not an optional boolean.', () => {
        const errorMessage = 'createOverlay({ manualRemove }): Invalid argument! Expected an object with "manualRemove" property of type boolean, or without it.';

        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, manualRemove: 0 as any}))).toThrow(errorMessage);
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, manualRemove: 1 as any}))).toThrow(errorMessage);
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, manualRemove: '' as any}))).toThrow(errorMessage);
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, manualRemove: 'A' as any}))).toThrow(errorMessage);
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, manualRemove: {} as any}))).toThrow(errorMessage);
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, manualRemove: [] as any}))).toThrow(errorMessage);
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, manualRemove: (() => {}) as any}))).toThrow(errorMessage);

        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, manualRemove: undefined })));
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, manualRemove: null as any })));
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, manualRemove: true })));
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, manualRemove: false })));
    });

    it('Should throw an error if "withViewTransitions" property is not an optional boolean or optional array.', () => {
        const errorMessage = 
            'createOverlay({ withViewTransitions }): Invalid argument! Expected an object with "withViewTransitions" property of type boolean' +
            ' or array of strings, or without it.';

        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, withViewTransitions: 0 as any}))).toThrow(errorMessage);
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, withViewTransitions: 1 as any}))).toThrow(errorMessage);
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, withViewTransitions: '' as any}))).toThrow(errorMessage);
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, withViewTransitions: 'A' as any}))).toThrow(errorMessage);
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, withViewTransitions: {} as any}))).toThrow(errorMessage);
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, withViewTransitions: (() => {}) as any}))).toThrow(errorMessage);

        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, withViewTransitions: undefined })));
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, withViewTransitions: null as any })));
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, withViewTransitions: true })));
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, withViewTransitions: false })));
        expect(() => inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, withViewTransitions: [] })));
    });

    it('Should return an _OverlayHandleImpl instance in browser environment.', () => {
        const handle = inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el }));
        expect(handle).toBeInstanceOf(_OverlayHandleImpl);
    });

    it('Should return an _OverlayHandleImpl instance in server environment.', () => {
        using spy = vitest.spyOn((globalThis as any), '__IS_SERVER__', 'get').mockReturnValue(true);
        const handle = inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el }));
        expect(handle).toBeInstanceOf(_ServerOverlayHandleImpl);
    });

});

describe('_OverlayHandleImpl', () => {

    let hydrating = false;
    const microtasks: (() => void)[] = [];

    function instalMockStartViewTransition(fn: (options: StartViewTransitionOptions) => void): Disposable {
        document.startViewTransition = ((options: any) => fn(options as any)) as any;
        return {
            [Symbol.dispose]() {
                delete (document as any).startViewTransition;
            }
        }
    }

    function instalMockHydrationContext(): Disposable {
        return vitest.spyOn(sharedConfig, 'context', 'get').mockImplementation(() => hydrating ? {} : undefined as any);
    }

    function instalMockQueueMicrotask(): (() => void) & Disposable {

        const spy = vitest.spyOn(globalThis, 'queueMicrotask').mockImplementation((fn) => microtasks.push(fn));

        const flush = () => {
            while (microtasks.length) {
                microtasks.shift()!();
            }
        }

        (flush as any)[Symbol.dispose] = spy[Symbol.dispose];

        return flush as any;
    }

    function assertPendingMicrotaskCount(expectedCount: number) {
        expect(microtasks.length).toBe(expectedCount);
    }

    test('createOverlay() should create an overlay without a backdrop if the withBackdrop property has not been provided.', () => {
        const handle = inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el }));
        expect(handle.backdrop).toBeNull();
    });

    test('createOverlay() should create an overlay without a backdrop if the withBackdrop property has been provided with a value of "false".', () => {
        const handle = inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, withBackdrop: false }));
        expect(handle.backdrop).toBeNull();
    });

    test('createOverlay() should create an overlay with a backdrop if the withBackdrop property has been provided with a value of "true".', () => {
        const handle = inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el, withBackdrop: true }));
        expect(handle.backdrop).toBeInstanceOf(HTMLDivElement);
    });

    it('Should attach an overlay to the DOM without backdrop if "withBackdrop" is not provided.', () => {
        let overlayElement: HTMLElement | null = null;
        const handle = inRoot(() => createOverlay({ component: () => <>Hello world</>, positionStrategy: (el) => (overlayElement = el, el) }));
        
        expect(overlayElement).toBeNull();
        expect(_getOverlayRoot());

        handle.attach();

        const overlayRoot = _getOverlayRoot();

        expect(overlayElement).toBeInstanceOf(HTMLElement);
        expect(overlayRoot).toBeInstanceOf(HTMLElement);
        expect(overlayRoot!.isConnected).toBe(true);
        expect(overlayRoot!.children.length).toBe(1);
        expect(overlayRoot!.children[0]).toBeInstanceOf(HTMLDivElement);
        expect(overlayRoot!.children[0].children.length).toBe(1);
        expect(overlayRoot!.children[0].children[0]).toBe(overlayElement);
        expect(overlayRoot!.textContent).toBe('Hello world');
    });

    it('Should attach an overlay to the DOM without backdrop if "withBackdrop" is provided with a value of "false".', () => {
        let overlayElement: HTMLElement | null = null;
        const handle = inRoot(() => createOverlay({
            component: () => <>Hello world</>,
            positionStrategy: (el) => (overlayElement = el, el),
            withBackdrop: false
        }));

        expect(overlayElement).toBeNull();
        expect(_getOverlayRoot());

        handle.attach();

        const overlayRoot = _getOverlayRoot();

        expect(overlayElement).toBeInstanceOf(HTMLElement);
        expect(overlayRoot).toBeInstanceOf(HTMLElement);
        expect(overlayRoot!.isConnected).toBe(true);
        expect(overlayRoot!.children.length).toBe(1);
        expect(overlayRoot!.children[0]).toBeInstanceOf(HTMLDivElement);
        expect(overlayRoot!.children[0].children.length).toBe(1);
        expect(overlayRoot!.children[0].children[0]).toBe(overlayElement);
        expect(overlayRoot!.textContent).toBe('Hello world');
    });


    it('Should attach an overlay to the DOM without backdrop if "withBackdrop" is provided with a value of "true".', () => {
        let overlayElement: HTMLElement | null = null;
        const handle = inRoot(() => createOverlay({
            component: () => <>Hello world</>,
            positionStrategy: (el) => (overlayElement = el, el),
            withBackdrop: true
        }));

        expect(overlayElement).toBeNull();
        expect(_getOverlayRoot());

        handle.attach();

        const overlayRoot = _getOverlayRoot();

        expect(overlayElement).toBeInstanceOf(HTMLElement);
        expect(overlayRoot).toBeInstanceOf(HTMLElement);
        expect(overlayRoot!.isConnected).toBe(true);
        expect(overlayRoot!.children.length).toBe(1);
        expect(overlayRoot!.children[0]).toBeInstanceOf(HTMLDivElement);
        expect(overlayRoot!.children[0].children.length).toBe(2);
        expect(overlayRoot!.children[0].children[0]).toBe(handle.backdrop);
        expect(overlayRoot!.children[0].children[1]).toBe(overlayElement);
        expect(overlayRoot!.textContent).toBe('Hello world');
    });

    it('Should apply strategies and run life cycle hooks during attachment in correct order.', () => {
        const log: string[] = [];
        let overlayEl: HTMLDivElement | null = null;
        let containerEl: HTMLElement | null = null;
        const handle = inRoot(() => createOverlay({
            component: () => {
                log.push('F');
                expect(handle.attached).toBe(false);
                expect(handle.disposed).toBe(false);
                return <>Hello world</>;
            },
            positionStrategy: (el) => {
                log.push('A');
                expect(handle.attached).toBe(false);
                expect(handle.disposed).toBe(false);
                overlayEl = el
                containerEl = el.appendChild(document.createElement('div'))
                return containerEl;
            },
            underlyingInteractionStrategies: [
                function (localOverlayEl, localContainerEl) {
                    expect(overlayEl).toBeInstanceOf(HTMLDivElement);
                    expect(containerEl).toBeInstanceOf(HTMLElement);
                    expect(localOverlayEl).toBe(overlayEl);
                    expect(localContainerEl).toBe(containerEl);
                    expect(this).toBe(handle);
                    expect(handle.attached).toBe(false);
                    expect(handle.disposed).toBe(false);
                    expect(handle.componentContainer).toBeNull();
                    log.push('B');
                },
                function (localOverlayEl, localContainerEl) {
                    expect(overlayEl).toBeInstanceOf(HTMLDivElement);
                    expect(containerEl).toBeInstanceOf(HTMLElement);
                    expect(localOverlayEl).toBe(overlayEl);
                    expect(localContainerEl).toBe(containerEl);
                    expect(this).toBe(handle);
                    expect(handle.attached).toBe(false);
                    expect(handle.disposed).toBe(false);
                    expect(handle.componentContainer).toBeNull();
                    log.push('C');
                }
            ]
        }));

        expect(handle.attached).toBe(false);
        expect(handle.disposed).toBe(true);

        handle.onPrepared((localHandle) => {
            log.push('D');
            expect(_getOverlayRoot()!.textContent).toBe('');
            expect(localHandle).toBe(handle)
            expect(handle.componentContainer).toBeInstanceOf(HTMLElement);
            expect(handle.attached).toBe(false);
            expect(handle.disposed).toBe(false);
        });
        handle.onBeforeAttach((localHandle) => {
            log.push('E');
            expect(_getOverlayRoot()!.textContent).toBe('');
            expect(localHandle).toBe(handle)
            expect(handle.componentContainer).toBeInstanceOf(HTMLElement);
            expect(handle.attached).toBe(false);
            expect(handle.disposed).toBe(false);
        });
        handle.onAttach((localHandle) => {
            log.push('G');
            expect(_getOverlayRoot()!.textContent).toBe('Hello world');
            expect(localHandle).toBe(handle)
            expect(handle.componentContainer).toBeInstanceOf(HTMLElement);
            expect(handle.attached).toBe(true);
            expect(handle.disposed).toBe(false);
        });

        expect(log).toEqual([]);
        expect(_getOverlayRoot()).toBeNull();
        expect(handle.componentContainer).toBeNull();

        handle.attach();

        expect(log).toEqual([ 'A', 'B', 'C', 'D', 'E', 'F', 'G' ]);
        expect(_getOverlayRoot()!.textContent).toBe('Hello world');
        expect(handle.attached).toBe(true);
        expect(handle.disposed).toBe(false);
    });

    test('_OverlayHandleImpl.onPrepared() should throw an error if the provided argument is not a function.', () => {
        const errorMessage = 'OverlayHandle.onPrepared(): Invalid argument! Expected a function.'
        const handle = inRoot(() => createOverlay({ component: () =>  <></>, positionStrategy: (el) => el }));

        expect(() => handle.onPrepared(0 as any)).toThrow(errorMessage);
        expect(() => handle.onPrepared(1 as any)).toThrow(errorMessage);
        expect(() => handle.onPrepared(true as any)).toThrow(errorMessage);
        expect(() => handle.onPrepared(false as any)).toThrow(errorMessage);
        expect(() => handle.onPrepared('' as any)).toThrow(errorMessage);
        expect(() => handle.onPrepared('A' as any)).toThrow(errorMessage);
        expect(() => handle.onPrepared(undefined as any)).toThrow(errorMessage);
        expect(() => handle.onPrepared(null as any)).toThrow(errorMessage);
        expect(() => handle.onPrepared({} as any)).toThrow(errorMessage);
        expect(() => handle.onPrepared([] as any)).toThrow(errorMessage);

        expect(() => handle.onPrepared(() => {})).not.toThrow();
    });

    test('_OverlayHandleImpl.onBeforeAttach() should throw an error if the provided argument is not a function.', () => {
        const errorMessage = 'OverlayHandle.onBeforeAttach(): Invalid argument! Expected a function.'
        const handle = inRoot(() => createOverlay({ component: () =>  <></>, positionStrategy: (el) => el }));

        expect(() => handle.onBeforeAttach(0 as any)).toThrow(errorMessage);
        expect(() => handle.onBeforeAttach(1 as any)).toThrow(errorMessage);
        expect(() => handle.onBeforeAttach(true as any)).toThrow(errorMessage);
        expect(() => handle.onBeforeAttach(false as any)).toThrow(errorMessage);
        expect(() => handle.onBeforeAttach('' as any)).toThrow(errorMessage);
        expect(() => handle.onBeforeAttach('A' as any)).toThrow(errorMessage);
        expect(() => handle.onBeforeAttach(undefined as any)).toThrow(errorMessage);
        expect(() => handle.onBeforeAttach(null as any)).toThrow(errorMessage);
        expect(() => handle.onBeforeAttach({} as any)).toThrow(errorMessage);
        expect(() => handle.onBeforeAttach([] as any)).toThrow(errorMessage);

        expect(() => handle.onBeforeAttach(() => {})).not.toThrow();
    });

    test('_OverlayHandleImpl.onAttach() should throw an error if the provided argument is not a function.', () => {
        const errorMessage = 'OverlayHandle.onAttach(): Invalid argument! Expected a function.'
        const handle = inRoot(() => createOverlay({ component: () =>  <></>, positionStrategy: (el) => el }));

        expect(() => handle.onAttach(0 as any)).toThrow(errorMessage);
        expect(() => handle.onAttach(1 as any)).toThrow(errorMessage);
        expect(() => handle.onAttach(true as any)).toThrow(errorMessage);
        expect(() => handle.onAttach(false as any)).toThrow(errorMessage);
        expect(() => handle.onAttach('' as any)).toThrow(errorMessage);
        expect(() => handle.onAttach('A' as any)).toThrow(errorMessage);
        expect(() => handle.onAttach(undefined as any)).toThrow(errorMessage);
        expect(() => handle.onAttach(null as any)).toThrow(errorMessage);
        expect(() => handle.onAttach({} as any)).toThrow(errorMessage);
        expect(() => handle.onAttach([] as any)).toThrow(errorMessage);

        expect(() => handle.onAttach(() => {})).not.toThrow();
    });

    test('_OverlayHandleImpl.onDispose() should throw an error if the provided argument is not a function.', () => {
        const errorMessage = 'OverlayHandle.onDispose(): Invalid argument! Expected a function.'
        const handle = inRoot(() => createOverlay({ component: () =>  <></>, positionStrategy: (el) => el }));

        expect(() => handle.onDispose(0 as any)).toThrow(errorMessage);
        expect(() => handle.onDispose(1 as any)).toThrow(errorMessage);
        expect(() => handle.onDispose(true as any)).toThrow(errorMessage);
        expect(() => handle.onDispose(false as any)).toThrow(errorMessage);
        expect(() => handle.onDispose('' as any)).toThrow(errorMessage);
        expect(() => handle.onDispose('A' as any)).toThrow(errorMessage);
        expect(() => handle.onDispose(undefined as any)).toThrow(errorMessage);
        expect(() => handle.onDispose(null as any)).toThrow(errorMessage);
        expect(() => handle.onDispose({} as any)).toThrow(errorMessage);
        expect(() => handle.onDispose([] as any)).toThrow(errorMessage);

        expect(() => handle.onDispose(() => {})).not.toThrow();
    });

    test('_OverlayHandleImpl.onBeforeDetach() should throw an error if the provided argument is not a function.', () => {
        const errorMessage = 'OverlayHandle.onBeforeDetach(): Invalid argument! Expected a function.'
        const handle = inRoot(() => createOverlay({ component: () =>  <></>, positionStrategy: (el) => el }));

        expect(() => handle.onBeforeDetach(0 as any)).toThrow(errorMessage);
        expect(() => handle.onBeforeDetach(1 as any)).toThrow(errorMessage);
        expect(() => handle.onBeforeDetach(true as any)).toThrow(errorMessage);
        expect(() => handle.onBeforeDetach(false as any)).toThrow(errorMessage);
        expect(() => handle.onBeforeDetach('' as any)).toThrow(errorMessage);
        expect(() => handle.onBeforeDetach('A' as any)).toThrow(errorMessage);
        expect(() => handle.onBeforeDetach(undefined as any)).toThrow(errorMessage);
        expect(() => handle.onBeforeDetach(null as any)).toThrow(errorMessage);
        expect(() => handle.onBeforeDetach({} as any)).toThrow(errorMessage);
        expect(() => handle.onBeforeDetach([] as any)).toThrow(errorMessage);

        expect(() => handle.onBeforeDetach(() => {})).not.toThrow();
    });

    test('_OverlayHandleImpl.onDetach() should throw an error if the provided argument is not a function.', () => {
        const errorMessage = 'OverlayHandle.onDetach(): Invalid argument! Expected a function.'
        const handle = inRoot(() => createOverlay({ component: () =>  <></>, positionStrategy: (el) => el }));

        expect(() => handle.onDetach(0 as any)).toThrow(errorMessage);
        expect(() => handle.onDetach(1 as any)).toThrow(errorMessage);
        expect(() => handle.onDetach(true as any)).toThrow(errorMessage);
        expect(() => handle.onDetach(false as any)).toThrow(errorMessage);
        expect(() => handle.onDetach('' as any)).toThrow(errorMessage);
        expect(() => handle.onDetach('A' as any)).toThrow(errorMessage);
        expect(() => handle.onDetach(undefined as any)).toThrow(errorMessage);
        expect(() => handle.onDetach(null as any)).toThrow(errorMessage);
        expect(() => handle.onDetach({} as any)).toThrow(errorMessage);
        expect(() => handle.onDetach([] as any)).toThrow(errorMessage);

        expect(() => handle.onDetach(() => {})).not.toThrow();
    });

    it('Should run onBeforeAttach listeners and render the component outside the view transition callback if "withViewTransitions" is not provided.', () => {
        const log: string[] = [];
        const handle = inRoot(() => createOverlay({
            component: () => log.push('D'),
            positionStrategy: (el) => el,
        }));
        using disposable = instalMockStartViewTransition((options) => {
            log.push('B')
            options.update!();
            log.push('E')
        });

        handle.onPrepared(() => log.push('A'));
        handle.onBeforeAttach(() => log.push('C'));
        handle.attach();

        expect(log).toEqual([ 'A', 'C', 'D' ]);
    });

    it('Should run onBeforeAttach listeners and render the component outside the view transition callback if "withViewTransitions" is provided with a value of "false".', () => {
        const log: string[] = [];
        const handle = inRoot(() => createOverlay({
            component: () => log.push('D'),
            positionStrategy: (el) => el,
            withViewTransitions: false
        }));
        using disposable = instalMockStartViewTransition((options) => {
            log.push('B')
            options.update!();
            log.push('E')
        });

        handle.onPrepared(() => log.push('A'));
        handle.onBeforeAttach(() => log.push('C'));
        handle.attach();

        expect(log).toEqual([ 'A', 'C', 'D' ]);
    });

    it('Should run onBeforeAttach listeners and render the component inside the view transition callback if "withViewTransitions" is provided with a value of "true".', () => {
        const log: string[] = [];
        const handle = inRoot(() => createOverlay({
            component: () => log.push('D'),
            positionStrategy: (el) => el,
            withViewTransitions: true
        }));
        using disposable = instalMockStartViewTransition((options) => {
            log.push('B');
            options.update!();
            log.push('E');
        });

        handle.onPrepared(() => log.push('A'));
        handle.onBeforeAttach(() => log.push('C'));
        handle.attach();

        expect(log).toEqual([ 'A', 'B', 'C', 'D', 'E' ]);
    });

    it('Should run onBeforeAttach listeners and render the component inside the view transition callback if "withViewTransitions" is provided with an array.', () => {
        const log: string[] = [];
        const handle = inRoot(() => createOverlay({
            component: () => log.push('D'),
            positionStrategy: (el) => el,
            withViewTransitions: ['F', 'G']
        }));
        using disposable = instalMockStartViewTransition((options) => {
            log.push('B')
            options.update!();
            log.push('E')
            log.push(...options.types!);
        });

        handle.onPrepared(() => log.push('A'));
        handle.onBeforeAttach(() => log.push('C'));
        handle.attach();

        expect(log).toEqual([ 'A', 'B', 'C', 'D', 'E', 'F', 'G' ]);
    });

    it('Should render the component in element returned by position strategy.', () => {
        let customContainer: HTMLElement | null = null;
        let overlayElement: HTMLDivElement | null = null;
        const handle = inRoot(() => createOverlay({
            component: () => <>Hello world</>,
            positionStrategy: (el) => el.appendChild((overlayElement = el, customContainer = document.createElement('div'))) 
        }));

        expect(customContainer).toBeNull();
        expect(_getOverlayRoot()).toBeNull();

        handle.attach();

        const overlayRoot = _getOverlayRoot();

        expect(customContainer).toBeInstanceOf(HTMLElement);
        expect(overlayRoot).toBeInstanceOf(HTMLElement);
        expect(overlayRoot!.isConnected).toBe(true);
        expect(overlayRoot!.children.length).toBe(1);
        expect(overlayRoot!.children[0].children.length).toBe(1);
        expect(overlayRoot!.children[0].children[0]).toBe(overlayElement);
        expect(overlayRoot!.children[0].children[0].children.length).toBe(1);
        expect(overlayRoot!.children[0].children[0].children[0]).toBe(customContainer);
        expect(handle.componentContainer).toBe(customContainer);
        expect(customContainer!.textContent).toBe('Hello world');
    });

    it('Should detach overlay from the DOM.', () => {
        const handle1 = inRoot(() => createOverlay({
            component: () => <>Foo</>,
            positionStrategy: (el) => el
        }));
        const handle2 = inRoot(() => createOverlay({
            component: () => <>Bar</>,
            positionStrategy: (el) => el,
            withBackdrop: true
        }));

        handle1.attach();
        handle2.attach();
        
        let overlayRoot = _getOverlayRoot();

        expect(overlayRoot!.textContent.includes('Foo')).toBe(true);
        expect(overlayRoot!.textContent.includes('Bar')).toBe(true);
        expect(overlayRoot!.contains(handle1.componentContainer)).toBe(true);
        expect(overlayRoot!.contains(handle2.componentContainer)).toBe(true);
        expect(overlayRoot!.contains(handle2.backdrop)).toBe(true);
        
        handle2.detach();

        expect(overlayRoot!.textContent.includes('Foo')).toBe(true);
        expect(overlayRoot!.textContent.includes('Bar')).toBe(false);
        expect(overlayRoot!.contains(handle1.componentContainer)).toBe(true);
        expect(overlayRoot!.contains(handle2.componentContainer)).toBe(false);
        expect(overlayRoot!.contains(handle2.backdrop)).toBe(false);

        handle1.detach();

        overlayRoot = _getOverlayRoot();
        expect(overlayRoot).toBeNull();

        handle1.attach();
        handle2.attach();

        overlayRoot = _getOverlayRoot();

        expect(overlayRoot!.textContent.includes('Foo')).toBe(true);
        expect(overlayRoot!.textContent.includes('Bar')).toBe(true);
        expect(overlayRoot!.contains(handle1.componentContainer)).toBe(true);
        expect(overlayRoot!.contains(handle2.componentContainer)).toBe(true);
        expect(overlayRoot!.contains(handle2.backdrop)).toBe(true);

        handle1.detach();

        expect(overlayRoot!.textContent.includes('Foo')).toBe(false);
        expect(overlayRoot!.textContent.includes('Bar')).toBe(true);
        expect(overlayRoot!.contains(handle1.componentContainer)).toBe(false);
        expect(overlayRoot!.contains(handle2.componentContainer)).toBe(true);
        expect(overlayRoot!.contains(handle2.backdrop)).toBe(true);

        handle2.detach();

        overlayRoot = _getOverlayRoot();
        expect(overlayRoot).toBeNull();

        handle2.attach();
        handle1.attach();
        
        overlayRoot = _getOverlayRoot();

        expect(overlayRoot!.textContent.includes('Foo')).toBe(true);
        expect(overlayRoot!.textContent.includes('Bar')).toBe(true);
        expect(overlayRoot!.contains(handle1.componentContainer)).toBe(true);
        expect(overlayRoot!.contains(handle2.componentContainer)).toBe(true);
        expect(overlayRoot!.contains(handle2.backdrop)).toBe(true);
        
        handle1.detach();

        expect(overlayRoot!.textContent.includes('Foo')).toBe(false);
        expect(overlayRoot!.textContent.includes('Bar')).toBe(true);
        expect(overlayRoot!.contains(handle1.componentContainer)).toBe(false);
        expect(overlayRoot!.contains(handle2.componentContainer)).toBe(true);
        expect(overlayRoot!.contains(handle2.backdrop)).toBe(true);

        handle2.detach();

        overlayRoot = _getOverlayRoot();
        expect(overlayRoot).toBeNull();

        handle2.attach();
        handle1.attach();
        
        overlayRoot = _getOverlayRoot();

        expect(overlayRoot!.textContent.includes('Foo')).toBe(true);
        expect(overlayRoot!.textContent.includes('Bar')).toBe(true);
        expect(overlayRoot!.contains(handle1.componentContainer)).toBe(true);
        expect(overlayRoot!.contains(handle2.componentContainer)).toBe(true);
        expect(overlayRoot!.contains(handle2.backdrop)).toBe(true);
        
        handle2.detach();

        expect(overlayRoot!.textContent.includes('Foo')).toBe(true);
        expect(overlayRoot!.textContent.includes('Bar')).toBe(false);
        expect(overlayRoot!.contains(handle1.componentContainer)).toBe(true);
        expect(overlayRoot!.contains(handle2.componentContainer)).toBe(false);
        expect(overlayRoot!.contains(handle2.backdrop)).toBe(false);

        handle1.detach();

        overlayRoot = _getOverlayRoot();
        expect(overlayRoot).toBeNull();
    });

    test('_OverlayHandleImpl.moveUp() should move the overlay one position up in the overlay stack if it is possible.', () => {
        const handle1 = inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el }));
        const handle2 = inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el }));
        const handle3 = inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el }));

        handle1.attach();
        handle2.attach();
        handle3.attach();

        const hostEl1 = handle1.componentContainer!.parentElement;
        const hostEl2 = handle2.componentContainer!.parentElement;
        const hostEl3 = handle3.componentContainer!.parentElement;
        const overlayRoot = _getOverlayRoot()!;

        expect(overlayRoot.children[0]).toBe(hostEl1);
        expect(overlayRoot.children[1]).toBe(hostEl2);
        expect(overlayRoot.children[2]).toBe(hostEl3);

        handle1.moveUp();

        expect(overlayRoot.children[0]).toBe(hostEl2);
        expect(overlayRoot.children[1]).toBe(hostEl1);
        expect(overlayRoot.children[2]).toBe(hostEl3);

        handle3.moveUp();

        expect(overlayRoot.children[0]).toBe(hostEl2);
        expect(overlayRoot.children[1]).toBe(hostEl1);
        expect(overlayRoot.children[2]).toBe(hostEl3);
    });

    test('_OverlayHandleImpl.moveDown() should move the overlay one position down in the overlay stack if it is possible.', () => {
        const handle1 = inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el }));
        const handle2 = inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el }));
        const handle3 = inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el }));

        handle1.attach();
        handle2.attach();
        handle3.attach();

        const hostEl1 = handle1.componentContainer!.parentElement;
        const hostEl2 = handle2.componentContainer!.parentElement;
        const hostEl3 = handle3.componentContainer!.parentElement;
        const overlayRoot = _getOverlayRoot()!;

        expect(overlayRoot.children[0]).toBe(hostEl1);
        expect(overlayRoot.children[1]).toBe(hostEl2);
        expect(overlayRoot.children[2]).toBe(hostEl3);

        handle3.moveDown();

        expect(overlayRoot.children[0]).toBe(hostEl1);
        expect(overlayRoot.children[1]).toBe(hostEl3);
        expect(overlayRoot.children[2]).toBe(hostEl2);

        handle1.moveDown();

        expect(overlayRoot.children[0]).toBe(hostEl1);
        expect(overlayRoot.children[1]).toBe(hostEl3);
        expect(overlayRoot.children[2]).toBe(hostEl2);
    });

    test('_OverlayHandleImpl.moveToTheTop() should move the overlay to the top of the overlay stack if it is possible.', () => {
        const handle1 = inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el }));
        const handle2 = inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el }));
        const handle3 = inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el }));

        handle1.attach();
        handle2.attach();
        handle3.attach();

        const hostEl1 = handle1.componentContainer!.parentElement;
        const hostEl2 = handle2.componentContainer!.parentElement;
        const hostEl3 = handle3.componentContainer!.parentElement;
        const overlayRoot = _getOverlayRoot()!;

        expect(overlayRoot.children[0]).toBe(hostEl1);
        expect(overlayRoot.children[1]).toBe(hostEl2);
        expect(overlayRoot.children[2]).toBe(hostEl3);

        handle1.moveToTheTop();

        expect(overlayRoot.children[0]).toBe(hostEl2);
        expect(overlayRoot.children[1]).toBe(hostEl3);
        expect(overlayRoot.children[2]).toBe(hostEl1);

        handle1.moveToTheTop();

        expect(overlayRoot.children[0]).toBe(hostEl2);
        expect(overlayRoot.children[1]).toBe(hostEl3);
        expect(overlayRoot.children[2]).toBe(hostEl1);
    });

    test('_OverlayHandleImpl.moveToTheBottom() should move the overlay to the bottom of the overlay stack if it is possible.', () => {
        const handle1 = inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el }));
        const handle2 = inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el }));
        const handle3 = inRoot(() => createOverlay({ component: () => <></>, positionStrategy: (el) => el }));

        handle1.attach();
        handle2.attach();
        handle3.attach();

        const hostEl1 = handle1.componentContainer!.parentElement;
        const hostEl2 = handle2.componentContainer!.parentElement;
        const hostEl3 = handle3.componentContainer!.parentElement;
        const overlayRoot = _getOverlayRoot()!;

        expect(overlayRoot.children[0]).toBe(hostEl1);
        expect(overlayRoot.children[1]).toBe(hostEl2);
        expect(overlayRoot.children[2]).toBe(hostEl3);

        handle3.moveToTheBottom();

        expect(overlayRoot.children[0]).toBe(hostEl3);
        expect(overlayRoot.children[1]).toBe(hostEl1);
        expect(overlayRoot.children[2]).toBe(hostEl2);

        handle3.moveToTheBottom();

        expect(overlayRoot.children[0]).toBe(hostEl3);
        expect(overlayRoot.children[1]).toBe(hostEl1);
        expect(overlayRoot.children[2]).toBe(hostEl2);
    });

    it('Should run all hooks during detachment in correct order.', async () => {
        const log: string[] = [];
        const handle = inRoot(() => createOverlay({
            component: () => {
                onCleanup(() => log.push('A'));
                return <>Hello world</>;
            },
            positionStrategy: (el) => {
                onCleanup(() => log.push('D'));
                return el;
            },
            underlyingInteractionStrategies: [
                () => onCleanup(() => log.push('C')),
                () => onCleanup(() => log.push('B')),
            ]
        }));
        
        handle.onDispose((localHandle) => {
            log.push('E');
            expect(_getOverlayRoot()!.textContent).toBe('Hello world');
            expect(localHandle).toBe(handle);
            expect(handle.componentContainer).toBeInstanceOf(HTMLElement);
            expect(handle.attached).toBe(true);
            expect(handle.disposed).toBe(true);
        });
        handle.onBeforeDetach((localHandle) => {
            log.push('F');
            expect(_getOverlayRoot()!.textContent).toBe('Hello world');
            expect(localHandle).toBe(handle);
            expect(handle.componentContainer).toBeInstanceOf(HTMLElement);
            expect(handle.attached).toBe(true);
            expect(handle.disposed).toBe(true);
        });
        handle.onDetach((localHandle) =>  {
            log.push('G');
            expect(_getOverlayRoot()).toBeNull();
            expect(localHandle).toBe(handle);
            expect(handle.componentContainer).toBeNull();
            expect(handle.attached).toBe(false);
            expect(handle.disposed).toBe(true);
        })

        handle.attach();
        expect(log).toEqual([]);

        expect(handle.attached).toBe(true);
        expect(handle.disposed).toBe(false);

        handle.detach();
        expect(log).toEqual([ 'A', 'B', 'C', 'D', 'E', 'F', 'G' ]);
        expect(_getOverlayRoot()).toBeNull();
        expect(handle.attached).toBe(false);
        expect(handle.disposed).toBe(true);
        expect(handle.componentContainer).toBeNull();
    });

    test('_OverlayHandleImpl.dispose() should dispose the overlay\'s reactive lifetime without detaching its component from the DOM.', () => {
        const log: string[] = [];
        const handle = inRoot(() => createOverlay({
            component: () => {
                onCleanup(() => log.push('A'));
                return <>Hello world</>;
            },
            positionStrategy: (el) => {
                onCleanup(() => log.push('D'));
                return el;
            },
            underlyingInteractionStrategies: [
                () => onCleanup(() => log.push('C')),
                () => onCleanup(() => log.push('B')),
            ]
        }));
        
        handle.onDispose(() => log.push('E'));
        handle.onBeforeDetach(() => log.push('F'));
        handle.onDetach(() =>  log.push('G'))

        handle.attach();
        expect(log).toEqual([]);

        handle.dispose();
        expect(log).toEqual([ 'A', 'B', 'C', 'D', 'E' ]);
        expect(_getOverlayRoot()!.textContent).toBe('Hello world');
        expect(handle.disposed).toBe(true);
        expect(handle.attached).toBe(true);

        log.splice(0)
        handle.detach();
        expect(log).toEqual([ 'F', 'G' ]);
        expect(handle.disposed).toBe(true);
        expect(handle.attached).toBe(false);
    });

    it('Should run onBeforeDetach listeners and cleanup dom elements outside the view transition callback if "withViewTransitions" is not provided.', () => {
        const log: string[] = []
        const handle = inRoot(() => createOverlay({ component: () => <>Hello world</>, positionStrategy: (el) => el }));
        handle.attach();
        using disposable = instalMockStartViewTransition((options) => {
            log.push('B')
            expect(_getOverlayRoot()!.textContent).toBe('Hello world');
            options.update!();
            expect(_getOverlayRoot()).toBeNull();
            log.push('D')
        });

        handle.onDispose(() => log.push('A'));
        handle.onBeforeDetach(() => log.push('C'));
        handle.onDetach(() => log.push('E'));

        expect(log).toEqual([]);
        handle.detach();
        expect(log).toEqual([ 'A', 'C', 'E' ]);
    });

    it('Should run onBeforeDetach listeners and cleanup dom elements outside the view transition callback if "withViewTransitions" is provided with value of "false".', () => {
        const log: string[] = []
        const handle = inRoot(() => createOverlay({ 
            component: () => <>Hello world</>,
            positionStrategy: (el) => el,
            withViewTransitions: false
        }));
        handle.attach();
        using disposable = instalMockStartViewTransition((options) => {
            log.push('B')
            expect(_getOverlayRoot()!.textContent).toBe('Hello world');
            options.update!();
            expect(_getOverlayRoot()).toBeNull();
            log.push('D')
        });

        handle.onDispose(() => log.push('A'));
        handle.onBeforeDetach(() => log.push('C'));
        handle.onDetach(() => log.push('E'));

        expect(log).toEqual([]);
        handle.detach();
        expect(log).toEqual([ 'A', 'C', 'E' ]);
    });

    it('Should run onBeforeDetach listeners and cleanup dom elements inside the view transition callback if "withViewTransitions" is provided with value of "true".', () => {
        const log: string[] = []
        const handle = inRoot(() => createOverlay({ 
            component: () => <>Hello world</>,
            positionStrategy: (el) => el,
            withViewTransitions: true
        }));
        handle.attach();
        using disposable = instalMockStartViewTransition((options) => {
            log.push('B')
            expect(_getOverlayRoot()!.textContent).toBe('Hello world');
            options.update!();
            expect(_getOverlayRoot()).toBeNull();
            log.push('D')
        });

        handle.onDispose(() => log.push('A'));
        handle.onBeforeDetach(() => log.push('C'));
        handle.onDetach(() => log.push('E'));

        expect(log).toEqual([]);
        handle.detach();
        expect(log).toEqual([ 'A', 'B', 'C', 'D', 'E' ]);
    });

    it('Should run onBeforeDetach listeners and cleanup dom elements inside the view transition callback if "withViewTransitions" is provided with an array.', () => {
        const log: string[] = [];
        const handle = inRoot(() => createOverlay({ 
            component: () => <>Hello world</>,
            positionStrategy: (el) => el,
            withViewTransitions: ['E', 'F']
        }));
        handle.attach();
        using disposable = instalMockStartViewTransition((options) => {
            log.push('B')
            expect(_getOverlayRoot()!.textContent).toBe('Hello world');
            options.update!();
            expect(_getOverlayRoot()).toBeNull();
            log.push('D')
            log.push(...options.types!);
        });

        handle.onDispose(() => log.push('A'));
        handle.onBeforeDetach(() => log.push('C'));
        handle.onDetach(() => log.push('G'));

        expect(log).toEqual([]);
        handle.detach();
        expect(log).toEqual([ 'A', 'B', 'C', 'D', 'E', 'F', 'G' ]);
    });

    test('_OverlayHandleImpl.attach() should throw an error when the position strategy does not return an HTMLElement instance.', () => {
        let returnValue: any;
        const errorMessage = 'PositionStrategy.call(): Invalid return type! Expected an HTMLElement instance.';
        const positionStrategy = () => returnValue;
        const handle = inRoot(() => createOverlay({ component: () => <></>, positionStrategy }));
        const attach = (arg: any) => {
            returnValue = arg;
            handle.attach();
        };

        expect(() => attach(0)).toThrow(errorMessage);
        expect(() => attach(1)).toThrow(errorMessage);
        expect(() => attach('')).toThrow(errorMessage);
        expect(() => attach('A')).toThrow(errorMessage);
        expect(() => attach(true)).toThrow(errorMessage);
        expect(() => attach(false)).toThrow(errorMessage);
        expect(() => attach(undefined)).toThrow(errorMessage);
        expect(() => attach(null)).toThrow(errorMessage);
        expect(() => attach({})).toThrow(errorMessage);
        expect(() => attach([])).toThrow(errorMessage);
        expect(() => attach(() => {})).toThrow(errorMessage);

        expect(() => attach(document.createElement('div'))).not.toThrow();
    });

    test('UnderlyingInteractionStrategy should automatically remove listeners after they are invoked.', () => {
        let subscribe = true;
        const log: string[] = [];
        const handle = inRoot(() => createOverlay({
            component: () => <></>,
            positionStrategy: (el) => el,
            underlyingInteractionStrategies: function() {
                if (subscribe) {
                    this.onPrepared(() => log.push('A'));
                    this.onBeforeAttach(() => log.push('B'));
                    this.onAttach(() => log.push('C'));
                    this.onDispose(() => log.push('D'));
                    this.onBeforeDetach(() => log.push('E'));
                    this.onDetach(() => log.push('F'));
                }
            }
        }));
        
        expect(log).toEqual([]);
        handle.attach();
        expect(log).toEqual([ 'A', 'B', 'C' ]);
        log.splice(0);
        handle.detach();
        expect(log).toEqual([ 'D', 'E', 'F' ]);
        log.splice(0);
        subscribe = false;
        handle.attach();
        handle.detach();
        expect(log).toEqual([]);
    });

    it('Should not render the component if the position strategy throws an error.', () => {
        const handle = inRoot(() => createOverlay({
            component: () => <></>,
            positionStrategy: () => { throw new Error(); }
        }));

        expect(() => handle.attach()).toThrow();
        expect(_getOverlayRoot()).toBeNull();
    });

    it('Should not render the component if the interaction strategy throws an error.', () => {
        const handle = inRoot(() => createOverlay({
            component: () => <></>,
            positionStrategy: (el) => el,
            underlyingInteractionStrategies: () => { throw new Error(); }
        }));

        expect(() => handle.attach()).toThrow();
        expect(_getOverlayRoot()).toBeNull();
    });

    it('Should not render the component if the onPrepared() listener throws an error.', () => {
        const handle = inRoot(() => createOverlay({
            component: () => <></>,
            positionStrategy: (el) => el,
        }));
        
        handle.onPrepared(() => { throw new Error(); });

        expect(() => handle.attach()).toThrow();
        expect(_getOverlayRoot()).toBeNull();
    });

    it('Should not render the component if the onBeforeAttach() listener throws an error.', () => {
        const handle = inRoot(() => createOverlay({
            component: () => <></>,
            positionStrategy: (el) => el,
        }));
        
        handle.onBeforeAttach(() => { throw new Error(); });

        expect(() => handle.attach()).toThrow();
        expect(_getOverlayRoot()).toBeNull();
    });

    it('Should not render the component if the component function throws an error.', () => {
        const handle = inRoot(() => createOverlay({
            component: () => { throw new Error(); },
            positionStrategy: (el) => el,
        }));

        expect(() => handle.attach()).toThrow();
        expect(_getOverlayRoot()).toBeNull();
    });

    it('Should detach overlay after owner disposal if "manualRemove" is not provided.', () => {
        const handle = inRoot(() => createOverlay({ component: () => <>Hello world</>, positionStrategy: (el) => el }));
        
        handle.attach();

        expect(handle.disposed).toBe(false);
        expect(handle.attached).toBe(true);
        expect(_getOverlayRoot()!.textContent).toBe('Hello world');

        dispose();

        expect(handle.disposed).toBe(true);
        expect(handle.attached).toBe(false);
        expect(_getOverlayRoot()).toBeNull();
    });

    it('Should detach overlay after owner disposal if "manualRemove" is provided with value of "false".', () => {
        const handle = inRoot(() => createOverlay({
            component: () => <>Hello world</>,
            positionStrategy: (el) => el,
            manualRemove: false
        }));
        
        handle.attach();

        expect(handle.disposed).toBe(false);
        expect(handle.attached).toBe(true);
        expect(_getOverlayRoot()!.textContent).toBe('Hello world');

        dispose();

        expect(handle.disposed).toBe(true);
        expect(handle.attached).toBe(false);
        expect(_getOverlayRoot()).toBeNull();
    });

    it('Should not detach overlay after owner disposal if "manualRemove" is provided with value of "true".', () => {
        const handle = inRoot(() => createOverlay({
            component: () => <>Hello world</>,
            positionStrategy: (el) => el,
            manualRemove: true
        }));
        
        handle.attach();

        expect(handle.disposed).toBe(false);
        expect(handle.attached).toBe(true);
        expect(_getOverlayRoot()!.textContent).toBe('Hello world');

        dispose();

        expect(handle.disposed).toBe(true);
        expect(handle.attached).toBe(true);
        expect(_getOverlayRoot()!.textContent).toBe('Hello world');

        handle.detach();
        expect(handle.disposed).toBe(true);
        expect(handle.attached).toBe(false);
        expect(_getOverlayRoot()).toBeNull();
    });

    it('Should pass props to the rendered component when attaching the overlay.', () => {
        const handle = inRoot(() => createOverlay({
            component: (props: { text: string }) => <>{props.text}</>,
            positionStrategy: (el) => el
        }));
        const [getText, setText] = createSignal('Foo');

        handle.attach({
            get text() {
                return getText();
            }
        });

        expect(_getOverlayRoot()!.textContent).toBe('Foo');
        setText('Bar')
        expect(_getOverlayRoot()!.textContent).toBe('Bar');
    });

    it('Should provide the overlay handle through useOverlayHandle() within the rendered component.', () => {
        const log: string[] = [];
        const handle = inRoot(() => createOverlay({
            component: () => {
                log.push('A');
                expect(useOverlayHandle()).toBe(handle);
                return <></>
            },
            positionStrategy: (el) => el
        }));

        expect(useOverlayHandle()).toBeUndefined();

        handle.attach();
        expect(log).toEqual([ 'A' ]);
    });

    it('Should register lifecycle listeners from the OverlayHandle context only for the current attachment and ignore onPrepared() and onBeforeAttach() registrations.', () => {
        let subscribe = true;
        const log: string[] = [];
        const handle = inRoot(() => createOverlay({
            component: () => {
                const handle = useOverlayHandle()!;
                if (subscribe) {
                    expect(handle.onPrepared(() => log.push('A')).toString()).toBe('() => {}');
                    expect(handle.onBeforeAttach(() => log.push('B')).toString()).toBe('() => {}');
                    handle.onAttach(() => log.push('C'));
                    handle.onDispose(() => log.push('D'));
                    handle.onBeforeDetach(() => log.push('E'))
                    handle.onDetach(() => log.push('F'))
                }
                return <></>;
            },
            positionStrategy: (el) => el
        }));

        handle.attach();
        subscribe = false;

        expect(log).toEqual([ 'C' ]);

        log.splice(0);
        handle.detach();
        expect(log).toEqual([ 'D', 'E', 'F' ]);
        log.splice(0);
        handle.attach();
        handle.detach();
        expect(log).toEqual([]);
    });

    it('Should schedule overlay attachment during hydration.', () => {
        using disposable = instalMockHydrationContext();
        using flush = instalMockQueueMicrotask();
        const handle = inRoot(() => createOverlay({ component: () => <>Hello world</>, positionStrategy: (el) => el }));

        assertPendingMicrotaskCount(0);

        hydrating = true;
        handle.attach();

        assertPendingMicrotaskCount(1);
        expect(handle.disposed).toBe(false);
        expect(handle.attached).toBe(false);
        expect(_getOverlayRoot()).toBeNull();

        hydrating = false;
        flush();
        
        assertPendingMicrotaskCount(0);
        expect(handle.disposed).toBe(false);
        expect(handle.attached).toBe(true);
        expect(_getOverlayRoot()!.textContent).toBe('Hello world');
    });

    it('Should defer disposal of the overlay\'s reactive lifetime when dispose() is called during hydration.', () => {
        const log: string[] = []; 
        using disposable = instalMockHydrationContext();
        using flush = instalMockQueueMicrotask();
        const handle = inRoot(() => createOverlay({
            component: () => {
                onCleanup(() => log.push('A'))
                return <>Hello world</>
            },
            positionStrategy: (el) => el
        }));

        assertPendingMicrotaskCount(0);

        hydrating = true;
        handle.attach();

        assertPendingMicrotaskCount(1);
        expect(handle.disposed).toBe(false);
        expect(handle.attached).toBe(false);
        expect(_getOverlayRoot()).toBeNull();
        expect(log).toEqual([]);

        hydrating = false;
        handle.dispose();
        assertPendingMicrotaskCount(1);
        expect(handle.disposed).toBe(false);
        expect(handle.attached).toBe(false);
        expect(_getOverlayRoot()).toBeNull();
        expect(log).toEqual([]);

        flush();
        assertPendingMicrotaskCount(0);
        expect(handle.disposed).toBe(true);
        expect(handle.attached).toBe(true);
        expect(_getOverlayRoot()!.textContent).toBe('Hello world');
        expect(log).toEqual([ 'A' ]);
    });

    it('Should cancel a pending overlay attachment when detached during hydration.', () => {
        using disposable = instalMockHydrationContext();
        using flush = instalMockQueueMicrotask();
        const handle = inRoot(() => createOverlay({
            component: () => <>Hello world</>,
            positionStrategy: (el) => el
        }));

        assertPendingMicrotaskCount(0);

        hydrating = true;
        handle.attach();
        hydrating = false;

        assertPendingMicrotaskCount(1);
        expect(handle.disposed).toBe(false);
        expect(handle.attached).toBe(false);
        expect(_getOverlayRoot()).toBeNull();

        handle.detach();
        assertPendingMicrotaskCount(1);
        expect(handle.disposed).toBe(true);
        expect(handle.attached).toBe(false);
        expect(_getOverlayRoot()).toBeNull();

        flush();
        assertPendingMicrotaskCount(0);
        expect(handle.disposed).toBe(true);
        expect(handle.attached).toBe(false);
        expect(_getOverlayRoot()).toBeNull();
    });

});

describe('_ServerOverlayHandleImpl', () => {
    test('_ServerOverlayHandleImpl.attach() should throw an error', () => {
        const errorMessage = 'OverlayHandle.attach(): This method is not available in a server environment!';
        const handle = new _ServerOverlayHandleImpl();
        expect(() => handle.attach()).toThrow(errorMessage);
    });

    it('Should throw an error when the "backdrop" property is accessed.', () => {
        const errorMessage = 'OverlayHandle.backdrop: This property is not available in a server environment!'
        const handle = new _ServerOverlayHandleImpl();
        expect(() => handle.backdrop).toThrow(errorMessage);
    })
})
