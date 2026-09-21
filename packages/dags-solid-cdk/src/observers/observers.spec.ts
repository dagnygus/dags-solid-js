import { Mock } from 'vitest';
import { _MockResizeObserver } from '../test-utils/moc-resize-observer';
import { 
    type observeResizing as cdkObserveResizing,
    type observerMutations as cdkObserverMutations,
    type observeBatchedMutations as cdkObserveBatchedMutations,
    type disableShadowDomScanning as cdkDisableShadowDomScanning,
    type CdkBatchedMutationRecord, 
    type CdkMutationRecord 
} from './observers'
import type { Accessor, createRoot as solidJsCreateRoot, createSignal as solidJsCreateSignal, createEffect as solidJsCreateEffect } from 'solid-js'

type _MockEnvironmentController<T> = { 
    fireEffectsInitialization(): void,
    disposeEnvironment(): void,
    assertNoPendingEffects(): void,
    assertPendingEffectsCount(count: number): void,
    discardPendingEffects(): void;
} & T;

async function _mockEnvironment(emulationTarget: 'browser' | 'server'): Promise<_MockEnvironmentController<typeof import('./observers')>> {
    let disposed = false;
    vitest.stubGlobal('__IS_SERVER__', emulationTarget === 'server');
    vitest.stubGlobal('ResizeObserver', _MockResizeObserver);

    const { createEffect, untrack, runWithOwner } = await vitest.importActual<typeof import('solid-js')>('solid-js');
    const effects: { owner: any, callback: (...arg: any[]) => any, initialValue?: any }[] = [];


    function fireEffectsInitialization(): void {
        while (effects.length) {
            const effect = effects.shift()!;
            if ('initialValue' in effect) {
                runWithOwner(effect.owner, () => {
                    createEffect(effect.callback, effect.initialValue);
                })
            } else {
                runWithOwner(effect.owner, () => {
                    createEffect(() => untrack(effect.callback));
                })
            }
        }
    }

    function disposeEnvironment(): void {
        if (effects.length) { throw new Error('There are still pending effects!'); }
        vitest.unstubAllGlobals();
        vitest.doUnmock('solid-js');
        vitest.resetModules();
        disposed = true;
    }

    function assertNoPendingEffects(): void {
        expect(effects.length).toBe(0);
    }

    function assertPendingEffectsCount(count: number): void {
        expect(effects.length).toBe(count);
    }

    function discardPendingEffects(): void {
        effects.splice(0);
    }

    vitest.doMock('solid-js', async () => {
        const soldJdModule = await vitest.importActual<typeof import('solid-js')>('solid-js/dist/dev.js');

        const createEffect = (callback: (...arg: any[]) => any, initialValue: any) => {
            if (disposed) {
                throw new Error('createEffect(): environment disposed')
            }
            
            const owner = soldJdModule.getOwner();
            if (!owner) {
                throw new Error('createEffect(): No owner!')
            }

            effects.push({ owner, callback, initialValue });
        };

        const onMount = (callback: (...arg: any[]) => any) => {
            if (disposed) {
                throw new Error('onMouth(): environment disposed');
            }

            const owner = soldJdModule.getOwner();
            if (!owner) {
                throw new Error('onMouth(): No owner!');
            }

            effects.push({ owner, callback });
        };

        return {
            ...soldJdModule,
            createEffect,
            onMount
        }
    });

    const observersModule = await import('./observers');

    return {
        ...observersModule,
        fireEffectsInitialization,
        disposeEnvironment,
        assertNoPendingEffects,
        assertPendingEffectsCount,
        discardPendingEffects
    }
}



describe('Observers', () => {
    
    let observersModule: _MockEnvironmentController<typeof import('./observers')>;
    let createRoot: typeof solidJsCreateRoot;
    let createSignal: typeof solidJsCreateSignal;
    let createEffect: typeof solidJsCreateEffect;
    let fireEffectsInitialization: () => void;
    let assertNoPendingEffects: () => void;
    let assertPendingEffectsCount: (count: number) => void;
    let discardPendingEffects: () => void;

    afterEach(() => {
        document.body.replaceChildren();
        _MockResizeObserver.dispose();
        Array.from(document.body.childNodes).forEach((node) => node.remove());
    })

    describe("Emulated browser environment.", () => {

        let disposeBag: (() => void)[] = [];
        let disposeEnvironment: () => void;

        function inRoot<T>(fn: () => T): T {
            return createRoot((dispose) => {
                disposeBag.push(dispose);
                return fn();
            });
        }

        function subscribeEffect(fn: () => void): () => void {
            return createRoot((dispose) => {
                disposeBag.push(dispose);
                createEffect(fn);
                return dispose;
            })
        }

        function dispose(): void {
            while (disposeBag.length) {
                disposeBag.shift()!();
            }
        }

        beforeEach(async () => {
            observersModule = await _mockEnvironment('browser');
            fireEffectsInitialization = observersModule.fireEffectsInitialization;
            assertNoPendingEffects = observersModule.assertNoPendingEffects;
            assertPendingEffectsCount = observersModule.assertPendingEffectsCount;
            discardPendingEffects = observersModule.discardPendingEffects;
            disposeEnvironment = observersModule.disposeEnvironment;
            const solidJsModule = await import('solid-js');
            createRoot = solidJsModule.createRoot;
            createSignal = solidJsModule.createSignal;
            createEffect = solidJsModule.createEffect;
        });

        afterEach(() => {
            disposeEnvironment();
            dispose();
        });

        describe('observeMutations()', () => {

            let observeMutations: typeof cdkObserverMutations;
            let getPrivates: typeof observersModule._getPrivates;
            let spy: Mock;
            let advanceTime = false;
            let fakeTime = 0;

            beforeAll(() => {
                spy = vitest.spyOn(performance, 'now').mockImplementation(() => {
                    if (advanceTime) {
                        fakeTime += 12;
                    }
                    return fakeTime;
                });
            });

            afterAll(() => {
                spy.mockRestore()
            })

            beforeEach(() => {
                observeMutations = observersModule.observerMutations;
                getPrivates = observersModule._getPrivates;
            });

            it('Should throw an error if it is used outside an owning context.', () => {
                const errorMessage = 'observerMutations(): An owning context is required!'
                const div = document.body.appendChild(document.createElement('div'));

                expect(() => observeMutations(div)).toThrow(errorMessage);
                expect(() => observeMutations(() => div)).toThrow(errorMessage);
            })

            it('Should throw an error if the provided argument is not an Element instance or Function', () => {
                const errorMessage = 
                    'observerMutations(): Invalid argument. It must be a function returning a DOM Element or a DOM Element instance ' +
                    '(e.g. HTMLElement, SVGElement, etc.). It can be also a directly provided Document instance.';
                const div = document.createElement('div');
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                const math = document.createElementNS('http://www.w3.org/1998/Math/MathML', 'math');

                document.body.append(div, svg, math);

                //Will throw
                expect(() => inRoot(() => observeMutations(0 as any))).toThrow(errorMessage);
                expect(() => inRoot(() => observeMutations(1 as any))).toThrow(errorMessage);
                expect(() => inRoot(() => observeMutations('' as any))).toThrow(errorMessage);
                expect(() => inRoot(() => observeMutations('A' as any))).toThrow(errorMessage);
                expect(() => inRoot(() => observeMutations(true as any))).toThrow(errorMessage);
                expect(() => inRoot(() => observeMutations(false as any))).toThrow(errorMessage);
                expect(() => inRoot(() => observeMutations(undefined as any))).toThrow(errorMessage);
                expect(() => inRoot(() => observeMutations(null as any))).toThrow(errorMessage);
                expect(() => inRoot(() => observeMutations({} as any))).toThrow(errorMessage);
                expect(() => inRoot(() => observeMutations([] as any))).toThrow(errorMessage);

                //Will not throw
                expect(() => inRoot(() => observeMutations(div))).not.toThrow();
                expect(() => inRoot(() => observeMutations(svg))).not.toThrow();
                expect(() => inRoot(() => observeMutations(math))).not.toThrow();
                expect(() => inRoot(() => observeMutations(() => null!))).not.toThrow();

                assertPendingEffectsCount(1);
                discardPendingEffects();
            });

            it('Should throw an error if the provided function does not return an element during initialization.', () => {
                const errorMessage = 
                    'observerMutations(): Invalid argument. It must be a function returning a DOM Element or a DOM Element instance ' +
                    '(e.g. HTMLElement, SVGElement, etc.). It can be also a directly provided Document instance.';
                const div = document.createElement('div');
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                const math = document.createElementNS('http://www.w3.org/1998/Math/MathML', 'math');

                let returnValue: any = null;

                document.body.append(div, svg, math);

                inRoot(() => observeMutations(() => returnValue as any));
                assertPendingEffectsCount(1);
                returnValue = 0
                expect(() => fireEffectsInitialization()).toThrow(errorMessage);
                returnValue = null;
                dispose();

                inRoot(() => observeMutations(() => returnValue as any));
                assertPendingEffectsCount(1);
                returnValue = 1
                expect(() => fireEffectsInitialization()).toThrow(errorMessage);
                returnValue = null;
                dispose();

                inRoot(() => observeMutations(() => returnValue as any));
                assertPendingEffectsCount(1);
                returnValue = ''
                expect(() => fireEffectsInitialization()).toThrow(errorMessage);
                returnValue = null;
                dispose();

                inRoot(() => observeMutations(() => returnValue as any));
                assertPendingEffectsCount(1);
                returnValue = 'A'
                expect(() => fireEffectsInitialization()).toThrow(errorMessage);
                returnValue = null;
                dispose();

                inRoot(() => observeMutations(() => returnValue as any));
                assertPendingEffectsCount(1);
                returnValue = true
                expect(() => fireEffectsInitialization()).toThrow(errorMessage);
                returnValue = null;
                dispose();

                inRoot(() => observeMutations(() => returnValue as any));
                assertPendingEffectsCount(1);
                returnValue = false
                expect(() => fireEffectsInitialization()).toThrow(errorMessage);
                returnValue = null;
                dispose();

                inRoot(() => observeMutations(() => returnValue as any));
                assertPendingEffectsCount(1);
                returnValue = undefined
                expect(() => fireEffectsInitialization()).toThrow(errorMessage);
                returnValue = null;
                dispose();

                inRoot(() => observeMutations(() => returnValue as any));
                assertPendingEffectsCount(1);
                returnValue = null
                expect(() => fireEffectsInitialization()).toThrow(errorMessage);
                dispose();

                inRoot(() => observeMutations(() => returnValue as any));
                assertPendingEffectsCount(1);
                returnValue = {}
                expect(() => fireEffectsInitialization()).toThrow(errorMessage);
                returnValue = null;
                dispose();

                inRoot(() => observeMutations(() => returnValue as any));
                assertPendingEffectsCount(1);
                returnValue = div
                expect(() => fireEffectsInitialization()).not.toThrow();
                returnValue = null;
                dispose();

                inRoot(() => observeMutations(() => returnValue as any));
                assertPendingEffectsCount(1);
                returnValue = svg
                expect(() => fireEffectsInitialization()).not.toThrow();
                returnValue = null;
                dispose();

                inRoot(() => observeMutations(() => returnValue as any));
                assertPendingEffectsCount(1);
                returnValue = math
                expect(() => fireEffectsInitialization()).not.toThrow();
                returnValue = null;
                dispose();
            });

            it('Should not have any pending effects if the provided function immediately returns an element.', () => {
                const div = document.body.appendChild(document.createElement('div'));
                inRoot(() => observeMutations(() => div));
                assertNoPendingEffects();
            });

            it('Should not have any pending effects if the element is provided as an argument.', () => {
                const div = document.body.appendChild(document.createElement('div'));
                inRoot(() => observeMutations(div))
                assertNoPendingEffects();
            });

            it('Should have pending effect if provided function lazily returns an element', () => {
                let div: HTMLDivElement = null!;
                inRoot(() => observeMutations(() => div))
                div = document.body.appendChild(document.createElement('div'));
                assertPendingEffectsCount(1);
                discardPendingEffects()
            });

            it('Should update signal when directly provided element mutates.', async () => {
                const div = document.body.appendChild(document.createElement('div'));
                const mutation = inRoot(() => observeMutations(div));

                let latestRecords: readonly CdkMutationRecord[] | null = null;

                assertNoPendingEffects();
                subscribeEffect(() => latestRecords = mutation());
                assertPendingEffectsCount(1);
                fireEffectsInitialization();
                
                expect(mutation()).toBeNull();

                div.setAttribute('dummy-attribute', 'attr-value');
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecords).not.toBe(null);
                expect(latestRecords!.length).toBe(1);
                expect(latestRecords![0].type).toBe('attributes');
                expect(latestRecords![0].target).toBe(div);

                div.appendChild(document.createTextNode('foo'));
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecords!.length).toBe(1);
                expect(latestRecords![0].type).toBe('childList');
                expect(latestRecords![0].target).toBe(div);
                let oldRecord = latestRecords;

                div.firstChild!.textContent = 'baz';
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecords!.length).toBe(1);
                expect(latestRecords).not.toBe(oldRecord);
                expect(latestRecords![0].type).toBe('characterData');
                expect(latestRecords![0].target).toBe(div.firstChild);
                oldRecord = latestRecords;

                div.setAttribute('dummy-attribute2', 'attr-value2');
                div.appendChild(document.createElement('span'));
                div.firstChild!.textContent = 'fiz';
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecords!.length).toBe(3);
                expect(latestRecords).not.toBe(oldRecord);
                expect(latestRecords![0].type).toBe('attributes');
                expect(latestRecords![1].type).toBe('childList');
                expect(latestRecords![2].type).toBe('characterData');
            });

            it('Should update signal when directly provided element mutates until disposal.', async () => {
                const div = document.body.appendChild(document.createElement('div'));
                const mutation = inRoot(() => observeMutations(div));

                let latestRecords: readonly CdkMutationRecord[] | null = null;

                assertNoPendingEffects();
                subscribeEffect(() => latestRecords = mutation());
                assertPendingEffectsCount(1);
                fireEffectsInitialization();
                
                expect(mutation()).toBeNull();

                div.setAttribute('dummy-attribute', 'attr-value');
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecords!.length).toBe(1);
                expect(latestRecords).not.toBe(null);
                expect(latestRecords![0].type).toBe('attributes');
                expect(latestRecords![0].target).toBe(div);

                div.appendChild(document.createTextNode('foo'));
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecords!.length).toBe(1);
                expect(latestRecords![0].type).toBe('childList');
                expect(latestRecords![0].target).toBe(div);
                let oldRecord = latestRecords;

                div.firstChild!.textContent = 'baz';
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecords!.length).toBe(1);
                expect(latestRecords).not.toBe(oldRecord);
                expect(latestRecords![0].type).toBe('characterData');
                expect(latestRecords![0].target).toBe(div.firstChild);
                oldRecord = latestRecords;

                div.setAttribute('dummy-attribute2', 'attr-value2');
                div.appendChild(document.createElement('span'));
                div.firstChild!.textContent = 'fiz';
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecords!.length).toBe(3);
                expect(latestRecords).not.toBe(oldRecord);
                expect(latestRecords![0].type).toBe('attributes');
                expect(latestRecords![1].type).toBe('childList');
                expect(latestRecords![2].type).toBe('characterData');
                oldRecord = latestRecords;

                dispose();

                div.firstChild!.textContent = 'fiz'
                await Promise.resolve();
                await Promise.resolve();
                expect(mutation()).toBe(oldRecord);
            });

            it('Should update signal when eagerly provided element mutates.', async () => {
                const div = document.body.appendChild(document.createElement('div'));
                const mutation = inRoot(() => observeMutations(() => div));
                fireEffectsInitialization()
                
                let latestRecords: readonly CdkMutationRecord[] | null = null;

                assertNoPendingEffects();
                subscribeEffect(() => latestRecords = mutation());
                assertPendingEffectsCount(1);
                fireEffectsInitialization();

                expect(mutation()).toBeNull();

                div.setAttribute('dummy-attribute', 'attr-value');
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecords).not.toBe(null);
                expect(latestRecords![0].type).toBe('attributes');
                expect(latestRecords![0].target).toBe(div);

                div.appendChild(document.createTextNode('foo'));
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecords![0].type).toBe('childList');
                expect(latestRecords![0].target).toBe(div);
                let oldRecord = latestRecords;

                div.firstChild!.textContent = 'baz';
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecords).not.toBe(oldRecord);
                expect(latestRecords![0].type).toBe('characterData');
                expect(latestRecords![0].target).toBe(div.firstChild);
                oldRecord = latestRecords;

                div.setAttribute('dummy-attribute2', 'attr-value2');
                div.appendChild(document.createElement('span'));
                div.firstChild!.textContent = 'fiz';
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecords!.length).toBe(3);
                expect(latestRecords).not.toBe(oldRecord);
                expect(latestRecords![0].type).toBe('attributes');
                expect(latestRecords![1].type).toBe('childList');
                expect(latestRecords![2].type).toBe('characterData');
                oldRecord = latestRecords;

            });

            it('Should update signal when eagerly provided element mutates until disposal.', async () => {
                const div = document.body.appendChild(document.createElement('div'));
                const mutation = inRoot(() => observeMutations(() => div));

                let latestRecords: readonly CdkMutationRecord[] | null = null;

                assertNoPendingEffects();
                subscribeEffect(() => latestRecords = mutation());
                assertPendingEffectsCount(1);
                fireEffectsInitialization();

                expect(mutation()).toBeNull();

                div.setAttribute('dummy-attribute', 'attr-value');
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecords).not.toBe(null);
                expect(latestRecords![0].type).toBe('attributes');
                expect(latestRecords![0].target).toBe(div);

                div.appendChild(document.createTextNode('foo'));
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecords![0].type).toBe('childList');
                expect(latestRecords![0].target).toBe(div);
                let oldRecord = latestRecords;

                div.firstChild!.textContent = 'baz';
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecords).not.toBe(oldRecord);
                expect(latestRecords![0].type).toBe('characterData');
                expect(latestRecords![0].target).toBe(div.firstChild);
                oldRecord = latestRecords;

                div.setAttribute('dummy-attribute2', 'attr-value2');
                div.appendChild(document.createElement('span'));
                div.firstChild!.textContent = 'fiz';
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecords!.length).toBe(3);
                expect(latestRecords).not.toBe(oldRecord);
                expect(latestRecords![0].type).toBe('attributes');
                expect(latestRecords![1].type).toBe('childList');
                expect(latestRecords![2].type).toBe('characterData');
                oldRecord = latestRecords;

                dispose();

                div.firstChild!.textContent = 'fiz'
                await Promise.resolve();
                await Promise.resolve();
                expect(mutation()).toBe(oldRecord);
            });

            it('Should update signal when lazily provided element mutates until disposal.', async () => {
                let div: HTMLDivElement = null!;
                const mutation = inRoot(() => observeMutations(() => div));
                div = document.body.appendChild(document.createElement('div'));
                fireEffectsInitialization()
                
                let latestRecords: readonly CdkMutationRecord[] | null = null;

                assertNoPendingEffects();
                subscribeEffect(() => latestRecords = mutation());
                assertPendingEffectsCount(1);
                fireEffectsInitialization();

                expect(mutation()).toBeNull();

                div.setAttribute('dummy-attribute', 'attr-value');
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecords).not.toBe(null);
                expect(latestRecords![0].type).toBe('attributes');
                expect(latestRecords![0].target).toBe(div);

                div.appendChild(document.createTextNode('foo'));
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecords![0].type).toBe('childList');
                expect(latestRecords![0].target).toBe(div);
                let oldRecord = latestRecords;

                div.firstChild!.textContent = 'baz';
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecords).not.toBe(oldRecord);
                expect(latestRecords![0].type).toBe('characterData');
                expect(latestRecords![0].target).toBe(div.firstChild);
                oldRecord = latestRecords;

                div.setAttribute('dummy-attribute2', 'attr-value2');
                div.appendChild(document.createElement('span'));
                div.firstChild!.textContent = 'fiz';
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecords!.length).toBe(3);
                expect(latestRecords).not.toBe(oldRecord);
                expect(latestRecords![0].type).toBe('attributes');
                expect(latestRecords![1].type).toBe('childList');
                expect(latestRecords![2].type).toBe('characterData');
                oldRecord = latestRecords;

                dispose();

                div.firstChild!.textContent = 'fiz'
                await Promise.resolve();
                await Promise.resolve();
                expect(mutation()).toBe(oldRecord);
            });

            it('Should observe mutations across shadow dom boundaries.', async () => {
                const parent = document.body.appendChild(document.createElement('div'));
                const child = parent.attachShadow({ mode: 'open' }).appendChild(document.createElement('div'));
                const grandchild = child.attachShadow({ mode: 'open' }).appendChild(document.createElement('div'));
                const mutation = inRoot(() => observeMutations(child));

                let latestRecords: readonly CdkMutationRecord[] | null = null;

                assertNoPendingEffects();
                subscribeEffect(() => latestRecords = mutation());
                assertPendingEffectsCount(1);
                fireEffectsInitialization();
                
                expect(mutation()).toBeNull();

                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecords).not.toBe(null);
                expect(latestRecords!.length).toBe(1);
                expect(latestRecords![0].type).toBe('shadowDiscover');
                expect(latestRecords![0].target).toBe(child);
                let oldRecord = latestRecords;

                grandchild.setAttribute('dummy-attribute', 'attr-value');
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecords).not.toBe(oldRecord);
                expect(latestRecords!.length).toBe(1);
                expect(latestRecords![0].type).toBe('attributes');
                expect(latestRecords![0].target).toBe(grandchild);

                grandchild.appendChild(document.createTextNode('foo'));
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecords!.length).toBe(1);
                expect(latestRecords![0].type).toBe('childList');
                expect(latestRecords![0].target).toBe(grandchild);
                oldRecord = latestRecords;

                grandchild.firstChild!.textContent = 'baz';
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecords).not.toBe(oldRecord);
                expect(latestRecords![0].type).toBe('characterData');
                expect(latestRecords![0].target).toBe(grandchild.firstChild);
                oldRecord = latestRecords;
            });

            it('Should finalize internals after owner dispose.', () => {
                const div = document.body.appendChild(document.createElement('div'));
                const mutation = inRoot(() => observeMutations(div));
                let privates = getPrivates();

                expect(privates.emitMutationRecordsTask).not.toBeNull();
                expect(privates.mutableElementSetters).not.toBeNull();
                expect(privates.mutationObserver).not.toBeNull();
                expect(privates.mutationObserverOptions).not.toBeNull();

                dispose();
                privates = getPrivates();

                expect(privates.emitMutationRecordsTask).toBeNull();
                expect(privates.mutableElementSetters).toBeNull();
                expect(privates.mutationObserver).toBeNull();
                expect(privates.mutationObserverOptions).toBeNull();
            });

            it('Should finalize internals after observation target is removed from DOM.', async () => {
                const div0 = document.body.appendChild(document.createElement('div'));
                const div1 = document.body.appendChild(document.createElement('div'));
                const div2 = document.body.appendChild(document.createElement('div'));
                const mutation = inRoot(() => observeMutations(div1));
                let privates = getPrivates();

                expect(privates.emitMutationRecordsTask).not.toBeNull();
                expect(privates.mutableElementSetters).not.toBeNull();
                expect(privates.mutationObserver).not.toBeNull();
                expect(privates.mutationObserverOptions).not.toBeNull();

                div0.remove();
                div1.remove();
                div2.remove();
                await Promise.resolve();
                await Promise.resolve();
                privates = getPrivates();

                expect(privates.emitMutationRecordsTask).toBeNull();
                expect(privates.mutableElementSetters).toBeNull();
                expect(privates.mutationObserver).toBeNull();
                expect(privates.mutationObserverOptions).toBeNull();
            });

            describe('Concurrent.', () => {

                let pendingImmediateSet: (() => void)[] = [];
                let pendingMicrotask: (() => void)[] = [];
                let spy1: Mock;
                let spy2: Mock;
                let disableShadowDomScanning: typeof cdkDisableShadowDomScanning;
                let enableScanning: () => void;

                function flushMicrotasks(): void {
                    while (pendingMicrotask.length) {
                        pendingMicrotask.shift()!();
                    }
                }

                function flushImmediateSet(): void {
                    while (pendingImmediateSet.length) {
                        pendingImmediateSet.shift()!();
                    }
                }

                beforeEach(() => {
                    disableShadowDomScanning = observersModule.disableShadowDomScanning;
                    enableScanning = observersModule._enableScanning;
                    advanceTime = true
                });

                afterEach(() => {
                    enableScanning();
                    if (pendingImmediateSet.length) {
                        throw new Error('There is still pending immediate event!');
                    }
                    if (pendingMicrotask.length) {
                        throw new Error('There is still pending microtask!');
                    }
                })

                beforeAll(() => {
                    spy1 = vitest.spyOn(globalThis, 'setImmediate').mockImplementation(
                        ((fn: (...args: any[]) => void, ...args: any[]) => pendingImmediateSet.push(() => fn(...args))) as any
                    );
                    
                    spy2 = vitest.spyOn(globalThis, 'queueMicrotask').mockImplementation((fn) => pendingMicrotask.push(fn));
                });

                afterAll(() => {
                    spy1.mockRestore();
                    spy2.mockRestore();
                });

                it('Should scan for shadow roots concurrently in a document.', async () => {
                    const container = document.body.appendChild(document.createElement('div'));
                    const child = container.appendChild(document.createElement('div'));
                    let latestRecords: readonly CdkMutationRecord[] | null = null;

                    child.attachShadow({ mode: 'open' });
                    advanceTime = true;

                    const mutation = inRoot(() => observeMutations(container));

                    subscribeEffect(() => latestRecords = mutation());
                    fireEffectsInitialization();

                    await Promise.resolve(); // JsDom Mutation observer is build on 'Promise'
                    flushMicrotasks();
                    expect(latestRecords).toBeNull();

                    advanceTime = false;
                    flushImmediateSet();
                    flushMicrotasks();
                    expect(latestRecords).not.toBeNull();
                    expect(latestRecords!.length).toBe(1);
                    expect(latestRecords![0].type).toBe('shadowDiscover');
                    expect(latestRecords![0].target).toBe(child);
                    expect(latestRecords![0].addedNodes).toBeEach([ child.shadowRoot ]);
                });

                it('Should scan for shadow roots concurrently for added nodes.', async () => {
                    const container = document.body.appendChild(document.createElement('div'));
                    const child1 = document.createElement('div');
                    const child2 = document.createElement('div');
                    const mutation = inRoot(() => observeMutations(container));
                    let latestRecords: readonly CdkMutationRecord[] | null = null;
                    
                    subscribeEffect(() => latestRecords = mutation());
                    fireEffectsInitialization();
                    
                    child1.attachShadow({ mode: 'open' });
                    child2.attachShadow({ mode: 'open' }); 
                    advanceTime = true;
                    container.append(child1, child2);

                    await Promise.resolve(); // JsDom Mutation observer is build on 'Promise'
                    flushMicrotasks();
                    expect(latestRecords).not.toBeNull();
                    expect(latestRecords!.length).toBe(1);
                    expect(latestRecords![0].addedNodes).toBeEach([ child1, child2 ]);

                    advanceTime = false;
                    flushImmediateSet();
                    flushMicrotasks();
                    expect(latestRecords!.length).toBe(2);
                    expect(latestRecords!.map((r) => r.type)).toEqual([ 'shadowDiscover', 'shadowDiscover' ]);
                    expect(latestRecords!.map((r) => r.target)).toBeEach([ child1, child2 ]);
                    expect(latestRecords![0].addedNodes).toBeEach([ child1.shadowRoot ]);
                    expect(latestRecords![1].addedNodes).toBeEach([ child2.shadowRoot ]);
                });

                it('Should not scan for shadow roots concurrently in a document if scanning is disabled.', async () => {
                    disableShadowDomScanning();
                    const container = document.body.appendChild(document.createElement('div'));
                    const child = container.appendChild(document.createElement('div'));
                    let latestRecords: readonly CdkMutationRecord[] | null = null;

                    child.attachShadow({ mode: 'open' });
                    advanceTime = true;

                    const mutation = inRoot(() => observeMutations(container));

                    subscribeEffect(() => latestRecords = mutation());
                    fireEffectsInitialization();

                    await Promise.resolve(); // JsDom Mutation observer is build on 'Promise'
                    flushMicrotasks();
                    expect(latestRecords).toBeNull();
                    expect(pendingImmediateSet.length).toBe(0);
                });

                it('Should not scan for shadow roots concurrently for added nodes if scanning is disabled.', async () => {
                    disableShadowDomScanning();
                    const container = document.body.appendChild(document.createElement('div'));
                    const child1 = document.createElement('div');
                    const child2 = document.createElement('div');
                    const mutation = inRoot(() => observeMutations(container));
                    let latestRecords: readonly CdkMutationRecord[] | null = null;
                    
                    subscribeEffect(() => latestRecords = mutation());
                    fireEffectsInitialization();
                    
                    child1.attachShadow({ mode: 'open' });
                    child2.attachShadow({ mode: 'open' }); 
                    advanceTime = true;
                    container.append(child1, child2);

                    await Promise.resolve(); // JsDom Mutation observer is build on 'Promise'
                    flushMicrotasks();
                    expect(latestRecords).not.toBeNull();
                    expect(latestRecords!.length).toBe(1);
                    expect(latestRecords![0].addedNodes).toBeEach([ child1, child2 ])
                    expect(pendingImmediateSet.length).toBe(0);
                });

                it('Should finalize internals concurrently when observation target is removed from DOM.', async () => {
                    const div0 = document.body.appendChild(document.createElement('div'));
                    const div1 = document.body.appendChild(document.createElement('div'));
                    const div2 = document.body.appendChild(document.createElement('div'));
                    const mutation = inRoot(() => observeMutations(div1));
                    let privates = getPrivates();

                    expect(privates.emitMutationRecordsTask).not.toBeNull();
                    expect(privates.mutableElementSetters).not.toBeNull();
                    expect(privates.mutationObserver).not.toBeNull();
                    expect(privates.mutationObserverOptions).not.toBeNull();
                    expect(privates.mutationTaskHead).toBeNull();
                    expect(privates.mutationTaskTail).toBeNull();

                    div0.remove();
                    div1.remove();
                    div2.remove();
                    await Promise.resolve();
                    flushMicrotasks();
                    privates = getPrivates();

                    expect(privates.emitMutationRecordsTask).not.toBeNull();
                    expect(privates.mutableElementSetters).not.toBeNull();
                    expect(privates.mutationObserver).not.toBeNull();
                    expect(privates.mutationObserverOptions).not.toBeNull();
                    expect(privates.mutationTaskHead).not.toBeNull();
                    expect(privates.mutationTaskTail).not.toBeNull();

                    advanceTime = false;
                    flushImmediateSet();
                    flushMicrotasks();
                    privates = getPrivates();

                    expect(privates.emitMutationRecordsTask).toBeNull();
                    expect(privates.mutableElementSetters).toBeNull();
                    expect(privates.mutationObserver).toBeNull();
                    expect(privates.mutationObserverOptions).toBeNull();
                    expect(privates.mutationTaskHead).toBeNull();
                    expect(privates.mutationTaskTail).toBeNull();
                });

            });

        });

        describe('observeBatchedMutations()', () => {

            let observeBatchedMutations: typeof cdkObserveBatchedMutations

            function isFrozen(record: CdkBatchedMutationRecord): boolean {
                let frozen = Object.isFrozen(record);
                for (const key of Object.keys(record)) {
                    if (typeof (record as any)[key] === 'object' && (record as any)[key] !== null) {
                        frozen = frozen && Object.isFrozen((record as any)[key])
                    }
                }
                return frozen;
            }

            beforeEach(() => {
                observeBatchedMutations = observersModule.observeBatchedMutations;
            });

            beforeAll(() => vitest.stubGlobal('setImmediate', (fn: () => void) => fn()));
            afterAll(() => vitest.unstubAllGlobals());

            it('Should throw an error if provided argument is not an Element instance or Function', () => {
                const errorMessage = 
                    'observeBatchedMutations(): Invalid argument. It must be a function returning a DOM Element or a DOM Element instance ' +
                    '(e.g. HTMLElement, SVGElement, etc.). It can be also a directly provided Document instance.';
                const div = document.createElement('div');
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                const math = document.createElementNS('http://www.w3.org/1998/Math/MathML', 'math');

                document.body.append(div, svg, math);

                //Will throw
                expect(() => inRoot(() =>observeBatchedMutations(0 as any))).toThrow(errorMessage);
                expect(() => inRoot(() =>observeBatchedMutations(1 as any))).toThrow(errorMessage);
                expect(() => inRoot(() =>observeBatchedMutations('' as any))).toThrow(errorMessage);
                expect(() => inRoot(() =>observeBatchedMutations('A' as any))).toThrow(errorMessage);
                expect(() => inRoot(() =>observeBatchedMutations(true as any))).toThrow(errorMessage);
                expect(() => inRoot(() =>observeBatchedMutations(false as any))).toThrow(errorMessage);
                expect(() => inRoot(() =>observeBatchedMutations(undefined as any))).toThrow(errorMessage);
                expect(() => inRoot(() =>observeBatchedMutations(null as any))).toThrow(errorMessage);
                expect(() => inRoot(() =>observeBatchedMutations({} as any))).toThrow(errorMessage);
                

                //Will not throw
                expect(() => inRoot(() =>observeBatchedMutations(div))).not.toThrow();
                expect(() => inRoot(() =>observeBatchedMutations(svg))).not.toThrow();
                expect(() => inRoot(() =>observeBatchedMutations(math))).not.toThrow();
                inRoot(() => expect(() => observeBatchedMutations(() => null!)).not.toThrow());

                assertPendingEffectsCount(1);
                discardPendingEffects();
                dispose();
            });

            it('Should throw error if provided function does not return instance of element during initialization time.', () => {
                const errorMessage = 
                    'observeBatchedMutations(): Invalid argument. It must be a function returning a DOM Element or a DOM Element instance ' +
                    '(e.g. HTMLElement, SVGElement, etc.). It can be also a directly provided Document instance.';
                const div = document.createElement('div');
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                const math = document.createElementNS('http://www.w3.org/1998/Math/MathML', 'math');

                let returnValue: any = null;

                document.body.append(div, svg, math);

                inRoot(() => observeBatchedMutations(() => returnValue as any));
                assertPendingEffectsCount(1);
                returnValue = 0
                expect(() => fireEffectsInitialization()).toThrow(errorMessage);
                returnValue = null;
                dispose();

                inRoot(() => observeBatchedMutations(() => returnValue as any));
                assertPendingEffectsCount(1);
                returnValue = 1
                expect(() => fireEffectsInitialization()).toThrow(errorMessage);
                returnValue = null;
                dispose();

                inRoot(() => observeBatchedMutations(() => returnValue as any));
                assertPendingEffectsCount(1);
                returnValue = ''
                expect(() => fireEffectsInitialization()).toThrow(errorMessage);
                returnValue = null;
                dispose();

                inRoot(() => observeBatchedMutations(() => returnValue as any));
                assertPendingEffectsCount(1);
                returnValue = 'A'
                expect(() => fireEffectsInitialization()).toThrow(errorMessage);
                returnValue = null;
                dispose();

                inRoot(() => observeBatchedMutations(() => returnValue as any));
                assertPendingEffectsCount(1);
                returnValue = true
                expect(() => fireEffectsInitialization()).toThrow(errorMessage);
                returnValue = null;
                dispose();

                inRoot(() => observeBatchedMutations(() => returnValue as any));
                assertPendingEffectsCount(1);
                returnValue = false
                expect(() => fireEffectsInitialization()).toThrow(errorMessage);
                returnValue = null;
                dispose();

                inRoot(() => observeBatchedMutations(() => returnValue as any));
                assertPendingEffectsCount(1);
                returnValue = undefined
                expect(() => fireEffectsInitialization()).toThrow(errorMessage);
                returnValue = null;
                dispose();

                inRoot(() => observeBatchedMutations(() => returnValue as any));
                assertPendingEffectsCount(1);
                returnValue = null
                expect(() => fireEffectsInitialization()).toThrow(errorMessage);
                dispose();

                inRoot(() => observeBatchedMutations(() => returnValue as any));
                assertPendingEffectsCount(1);
                returnValue = {}
                expect(() => fireEffectsInitialization()).toThrow(errorMessage);
                returnValue = null;
                dispose();

                inRoot(() => observeBatchedMutations(() => returnValue as any));
                assertPendingEffectsCount(1);
                returnValue = div
                expect(() => fireEffectsInitialization()).not.toThrow();
                returnValue = null;
                dispose();

                inRoot(() => observeBatchedMutations(() => returnValue as any));
                assertPendingEffectsCount(1);
                returnValue = svg
                expect(() => fireEffectsInitialization()).not.toThrow();
                returnValue = null;
                dispose();

                inRoot(() => observeBatchedMutations(() => returnValue as any));
                assertPendingEffectsCount(1);
                returnValue = math
                expect(() => fireEffectsInitialization()).not.toThrow();
                returnValue = null;
                dispose();
            });

            it('Should not have any pending effects if the provided function immediately returns an element.', () => {
                const div = document.body.appendChild(document.createElement('div'));
                inRoot(() => observeBatchedMutations(() => div))
                assertNoPendingEffects();
            });

            it('Should not have any pending effects if the element is provided as an argument.', () => {
                const div = document.body.appendChild(document.createElement('div'));
                inRoot(() => observeBatchedMutations(div));
                assertNoPendingEffects();
            });

            it('Should have pending effect if provided function lazily returns an element', () => {
                let div: HTMLDivElement = null!;
                inRoot(() => observeBatchedMutations(() => div))
                div = document.body.appendChild(document.createElement('div'));
                assertPendingEffectsCount(1);
                discardPendingEffects()
            });

            it('Should update signal when directly provided element mutates until disposal.', async () => {
                const div = document.body.appendChild(document.createElement('div'));
                const mutation = inRoot(() => observeBatchedMutations(div));

                let latestRecord: CdkBatchedMutationRecord | null = null;

                assertNoPendingEffects()
                subscribeEffect(() => latestRecord = mutation());
                assertPendingEffectsCount(1);
                fireEffectsInitialization();
                
                expect(mutation()).toBeNull();

                div.setAttribute('dummy-attribute', 'attr-value');
                await Promise.resolve();
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecord).not.toBe(null);
                expect(latestRecord!.attributeChange).toBe(true);
                expect(latestRecord!.characterDataChange).toBe(false);
                expect(latestRecord!.childListChange).toBe(false);
                expect(latestRecord!.targets.length).toBe(1);
                expect(latestRecord!.targets[0]).toBe(div);

                div.appendChild(document.createTextNode('foo'));
                await Promise.resolve();
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecord).not.toBe(null);
                expect(latestRecord!.attributeChange).toBe(false);
                expect(latestRecord!.childListChange).toBe(true); 
                expect(latestRecord!.characterDataChange).toBe(false);
                expect(latestRecord!.targets.length).toBe(1);
                expect(latestRecord!.targets[0]).toBe(div);
                let oldRecord = latestRecord;

                div.firstChild!.textContent = 'baz';
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecord).not.toBe(null);
                expect(latestRecord!.attributeChange).toBe(false);
                expect(latestRecord!.childListChange).toBe(false);
                expect(latestRecord!.characterDataChange).toBe(true);
                expect(latestRecord!.targets.length).toBe(1);
                expect(latestRecord!.targets[0]).toBe(div.firstChild);
                expect(latestRecord).not.toBe(oldRecord);
                oldRecord = latestRecord;
            });

            it('Should update signal when directly provided element mutates until disposal.', async () => {
                const div = document.body.appendChild(document.createElement('div'));
                const mutation = inRoot(() => observeBatchedMutations(div));

                let latestRecord: CdkBatchedMutationRecord | null = null;

                assertNoPendingEffects()
                subscribeEffect(() => latestRecord = mutation());
                assertPendingEffectsCount(1);
                fireEffectsInitialization();
                
                expect(mutation()).toBeNull();

                div.setAttribute('dummy-attribute', 'attr-value');
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecord).not.toBe(null);
                expect(latestRecord!.attributeChange).toBe(true);
                expect(latestRecord!.characterDataChange).toBe(false);
                expect(latestRecord!.childListChange).toBe(false);
                expect(latestRecord!.targets.length).toBe(1);
                expect(latestRecord!.targets[0]).toBe(div);

                div.appendChild(document.createTextNode('foo'));
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecord).not.toBe(null);
                expect(latestRecord!.attributeChange).toBe(false);
                expect(latestRecord!.childListChange).toBe(true);
                expect(latestRecord!.characterDataChange).toBe(false);
                expect(latestRecord!.targets.length).toBe(1);
                expect(latestRecord!.targets[0]).toBe(div);
                let oldRecord = latestRecord

                div.firstChild!.textContent = 'baz';
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecord).not.toBe(null);
                expect(latestRecord!.attributeChange).toBe(false);
                expect(latestRecord!.childListChange).toBe(false);
                expect(latestRecord!.characterDataChange).toBe(true);
                expect(latestRecord!.targets.length).toBe(1);
                expect(latestRecord!.targets[0]).toBe(div.firstChild);
                expect(latestRecord).not.toBe(oldRecord);
                oldRecord = latestRecord

                dispose();

                div.firstChild!.textContent = 'fiz'
                await Promise.resolve();
                await Promise.resolve();
                expect(mutation()).toBe(oldRecord);
            });

            it('Should update signal when eagerly provided element mutates until disposal.', async () => {
                const div = document.body.appendChild(document.createElement('div'));
                const mutation = inRoot(() => observeBatchedMutations(() => div));

                let latestRecord: CdkBatchedMutationRecord | null = null;

                assertNoPendingEffects()
                subscribeEffect(() => latestRecord = mutation());
                assertPendingEffectsCount(1);
                fireEffectsInitialization();
                
                expect(mutation()).toBeNull();

                div.setAttribute('dummy-attribute', 'attr-value');
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecord).not.toBe(null);
                expect(latestRecord!.attributeChange).toBe(true);
                expect(latestRecord!.characterDataChange).toBe(false);
                expect(latestRecord!.childListChange).toBe(false);
                expect(latestRecord!.targets.length).toBe(1);
                expect(latestRecord!.targets[0]).toBe(div);

                div.appendChild(document.createTextNode('foo'));
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecord).not.toBe(null);
                expect(latestRecord!.attributeChange).toBe(false);
                expect(latestRecord!.childListChange).toBe(true);
                expect(latestRecord!.characterDataChange).toBe(false);
                expect(latestRecord!.targets.length).toBe(1);
                expect(latestRecord!.targets[0]).toBe(div);
                let oldRecord = latestRecord

                div.firstChild!.textContent = 'baz';
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecord).not.toBe(null);
                expect(latestRecord!.attributeChange).toBe(false);
                expect(latestRecord!.childListChange).toBe(false);
                expect(latestRecord!.characterDataChange).toBe(true);
                expect(latestRecord!.targets.length).toBe(1);
                expect(latestRecord!.targets[0]).toBe(div.firstChild);
                expect(latestRecord).not.toBe(oldRecord);
            });

            it('Should update signal when lazily provided element mutates until disposal.', async () => {
                let div: HTMLDivElement = null!;
                const mutation = inRoot(() => observeBatchedMutations(() => div));
                div = document.body.appendChild(document.createElement('div'));
                fireEffectsInitialization();

                let latestRecord: CdkBatchedMutationRecord | null = null;

                assertNoPendingEffects()
                subscribeEffect(() => latestRecord = mutation());
                assertPendingEffectsCount(1);
                fireEffectsInitialization();
                
                expect(mutation()).toBeNull();

                div.setAttribute('dummy-attribute', 'attr-value');
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecord).not.toBe(null);
                expect(latestRecord!.attributeChange).toBe(true);
                expect(latestRecord!.characterDataChange).toBe(false);
                expect(latestRecord!.childListChange).toBe(false);
                expect(latestRecord!.targets.length).toBe(1);
                expect(latestRecord!.targets[0]).toBe(div);

                div.appendChild(document.createTextNode('foo'));
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecord).not.toBe(null);
                expect(latestRecord!.attributeChange).toBe(false);
                expect(latestRecord!.childListChange).toBe(true);
                expect(latestRecord!.characterDataChange).toBe(false);
                expect(latestRecord!.targets.length).toBe(1);
                expect(latestRecord!.targets[0]).toBe(div);
                let oldRecord = latestRecord;

                div.firstChild!.textContent = 'baz';
                await Promise.resolve();
                await Promise.resolve();
                expect(latestRecord).not.toBe(null);
                expect(latestRecord!.attributeChange).toBe(false);
                expect(latestRecord!.childListChange).toBe(false);
                expect(latestRecord!.characterDataChange).toBe(true);
                expect(latestRecord!.targets.length).toBe(1);
                expect(latestRecord!.targets[0]).toBe(div.firstChild);
                oldRecord = latestRecord;

                dispose();

                div.firstChild!.textContent = 'fiz';
                await Promise.resolve();
                await Promise.resolve();
                expect(mutation()).toBe(oldRecord);
            });

            it('Should batch all attribute changes into to a single record.', async () => {
                const parent = document.body.appendChild(document.createElement('div'));
                const child1 = parent.appendChild(document.createElement('div'));
                const child2 = parent.appendChild(document.createElement('div'));
                const grandchild1 = child1.appendChild(document.createElement('div'));
                const grandchild2 = child1.appendChild(document.createElement('div'));
                const grandchild3 = child2.appendChild(document.createElement('div'));
                const grandchild4 = child2.appendChild(document.createElement('div'));

                async function wait(): Promise<void> {
                    await Promise.resolve();
                    await Promise.resolve();
                }
                
                const mutation = inRoot(() => observeBatchedMutations(parent));

                let latestRecord: CdkBatchedMutationRecord = null!;

                subscribeEffect(() => {
                    latestRecord = mutation()!;
                    if (latestRecord && !isFrozen(latestRecord)) {
                        throw new Error('Incorrect implementation!');
                    }
                });
                fireEffectsInitialization();

                child2.setAttribute('dummy-attr1', 'dummy-val1');
                await wait();
                expect(latestRecord.targets).toBeEach([ child2 ]);
                expect(latestRecord.attributeNames).toEqual([ 'dummy-attr1' ]);
                expect(latestRecord.attributeOwners).toBeEach([ child2 ]);
                expect(latestRecord.attributeNamespaces?.length).toBe(1);

                grandchild1.setAttribute('dummy-attr2', 'dummy-val2');
                await wait();
                expect(latestRecord.targets).toBeEach([ grandchild1 ]);
                expect(latestRecord.attributeNames).toEqual([ 'dummy-attr2' ]);
                expect(latestRecord.attributeOwners).toBeEach([ grandchild1 ]);
                expect(latestRecord.attributeNamespaces?.length).toBe(1);

                grandchild3.setAttribute('dummy-attr3', 'dummy-val3');
                child1.setAttribute('dummy-attr4', 'dummy-val4');
                grandchild2.setAttribute('dummy-attr5', 'dummy-val5');
                grandchild4.setAttribute('dummy-attr6', 'dummy-val6');
                child2.setAttribute('dummy-attr7', 'dummy-val7');
                await wait();
                expect(latestRecord.targets).toBeEach([ grandchild3, child1, grandchild2, grandchild4, child2 ]);
                expect(latestRecord.attributeNames).toEqual([ 'dummy-attr3', 'dummy-attr4', 'dummy-attr5', 'dummy-attr6', 'dummy-attr7'  ]);
                expect(latestRecord.attributeOwners).toBeEach([ grandchild3, child1, grandchild2, grandchild4, child2 ]);
                expect(latestRecord.attributeNamespaces?.length).toBe(5);
            });

            it('Should batch all child list changes into to a single record.', async () => {
                const parent = document.body.appendChild(document.createElement('div'));
                const child1 = parent.appendChild(document.createElement('div'));
                const child2 = parent.appendChild(document.createElement('div'));
                const grandchild1 = child1.appendChild(document.createElement('div'));
                const grandchild2 = child1.appendChild(document.createElement('div'));
                const grandchild3 = child2.appendChild(document.createElement('div'));
                const grandchild4 = child2.appendChild(document.createElement('div'));

                async function wait(): Promise<void> {
                    await Promise.resolve();
                    await Promise.resolve();
                }
                
                const mutation = inRoot(() => observeBatchedMutations(parent));

                let latestRecord: CdkBatchedMutationRecord = null!;

                subscribeEffect(() => {
                    latestRecord = mutation()!;
                    if (latestRecord && !isFrozen(latestRecord)) {
                        throw new Error('Incorrect implementation!');
                    }
                });
                fireEffectsInitialization();

                const textNodeA = grandchild1.appendChild(document.createTextNode('A'));
                await wait();
                expect(latestRecord.childListChange).toBe(true);
                expect(latestRecord.attributeChange).toBe(false);
                expect(latestRecord.characterDataChange).toBe(false);
                expect(latestRecord.addedNodes).toBeEach([ textNodeA ]);
                expect(latestRecord.targets).toEqual([ grandchild1 ]);
                
                const span1 = document.createElement('span');
                const span2 = document.createElement('span');
                grandchild2.append(span1, span2);
                await wait();
                expect(latestRecord.childListChange).toBe(true);
                expect(latestRecord.attributeChange).toBe(false);
                expect(latestRecord.characterDataChange).toBe(false);
                expect(latestRecord.addedNodes).toBeEach([ span1, span2 ]);
                expect(latestRecord.targets).toBeEach([ grandchild2 ]);

                const span3 = document.createElement('span');
                grandchild3.insertAdjacentElement('afterend', span3);
                await wait();
                expect(latestRecord.childListChange).toBe(true)
                expect(latestRecord.attributeChange).toBe(false)
                expect(latestRecord.characterDataChange).toBe(false);
                expect(latestRecord.addedNodes).toBeEach([ span3 ]);
                expect(latestRecord.targets).toBeEach([ child2 ]);

                const span4 = grandchild3.appendChild(document.createElement('spam'));
                const span5 = child1.appendChild(document.createElement('spam'));
                const span6 = grandchild2.appendChild(document.createElement('spam'));
                const span7 = grandchild4.appendChild(document.createElement('spam'));
                const span8 = child2.appendChild(document.createElement('spam'));
                await wait();
                expect(latestRecord.childListChange).toBe(true)
                expect(latestRecord.attributeChange).toBe(false)
                expect(latestRecord.characterDataChange).toBe(false);
                expect(latestRecord.addedNodes).toBeEach([ span4, span5, span6, span7, span8 ]);
                expect(latestRecord.targets).toBeEach([ grandchild3, child1, grandchild2, grandchild4, child2 ]);
            });

            it('Should batch all character data changes into to a single record.', async () => {
                const parent = document.body.appendChild(document.createElement('div'));
                const child1 = parent.appendChild(document.createElement('div'));
                const child2 = parent.appendChild(document.createElement('div'));
                const grandchild1 = child1.appendChild(document.createElement('div'));
                const grandchild2 = child1.appendChild(document.createElement('div'));
                const grandchild3 = child2.appendChild(document.createElement('div'));
                const grandchild4 = child2.appendChild(document.createElement('div'));
                const childText1 = child1.appendChild(document.createTextNode(''));
                const childText2 = child2.appendChild(document.createTextNode(''));
                const grandchildText1 = grandchild1.appendChild(document.createTextNode(''));
                const grandchildText2 = grandchild2.appendChild(document.createTextNode(''));
                const grandchildText3 = grandchild3.appendChild(document.createTextNode(''));
                const grandchildText4 = grandchild4.appendChild(document.createTextNode(''));

                async function wait(): Promise<void> {
                    await Promise.resolve();
                    await Promise.resolve();

                }
                
                const mutation = inRoot(() => observeBatchedMutations(parent));

                let latestRecord: CdkBatchedMutationRecord = null!;

                subscribeEffect(() => {
                    latestRecord = mutation()!;
                    if (latestRecord && !isFrozen(latestRecord)) {
                        throw new Error('Incorrect implementation!');
                    }
                });
                fireEffectsInitialization();

                grandchildText1.textContent = 'A';
                await wait();
                expect(latestRecord.characterDataChange).toBe(true);
                expect(latestRecord.childListChange).toBe(false);
                expect(latestRecord.attributeChange).toBe(false);
                expect(latestRecord.targets).toBeEach([ grandchildText1 ]);

                childText2.textContent = 'B'
                await wait();
                expect(latestRecord.characterDataChange).toBe(true);
                expect(latestRecord.childListChange).toBe(false);
                expect(latestRecord.attributeChange).toBe(false);
                expect(latestRecord.targets).toBeEach([ childText2 ]);

                grandchildText3.textContent = 'C';
                childText1.textContent = 'D';
                grandchildText2.textContent = 'E';
                grandchildText4.textContent = 'F';
                childText1.textContent = 'G'

                await wait();
                expect(latestRecord.characterDataChange).toBe(true);
                expect(latestRecord.childListChange).toBe(false);
                expect(latestRecord.attributeChange).toBe(false);
                expect(latestRecord.targets).toBeEach([ grandchildText3, childText1, grandchildText2, grandchildText4, childText1 ]);
            });

            it('Should batch all changes into to a single record.', async () => {
                const parent = document.body.appendChild(document.createElement('div'));
                const child1 = parent.appendChild(document.createElement('div'));
                const child2 = parent.appendChild(document.createElement('div'));
                const child3 = parent.appendChild(document.createElement('div'));
                const textNode = child1.appendChild(document.createTextNode(''));

                async function wait(): Promise<void> {
                    await Promise.resolve();
                    await Promise.resolve();
                }
                
                const mutation = inRoot(() => observeBatchedMutations(parent));

                let latestRecord: CdkBatchedMutationRecord = null!;

                subscribeEffect(() => {
                    latestRecord = mutation()!;
                    if (latestRecord && !isFrozen(latestRecord)) {
                        throw new Error('Incorrect implementation!');
                    }
                });
                fireEffectsInitialization();

                textNode.textContent = 'A';
                child2.appendChild(document.createElement('span'));
                await wait();
                expect(latestRecord.characterDataChange).toBe(true);
                expect(latestRecord.childListChange).toBe(true);
                expect(latestRecord.attributeChange).toBe(false);
                expect(latestRecord.targets).toBeEach([ textNode, child2 ]);

                textNode.textContent = 'B';
                child3.setAttribute('dummy-attr1', 'dummy-val1');
                await wait();
                expect(latestRecord.characterDataChange).toBe(true);
                expect(latestRecord.childListChange).toBe(false);
                expect(latestRecord.attributeChange).toBe(true);
                expect(latestRecord.targets).toBeEach([ textNode, child3 ]);

                child2.appendChild(document.createElement('span'));
                child3.setAttribute('dummy-attr2', 'dummy-val2');
                await wait();
                expect(latestRecord.characterDataChange).toBe(false);
                expect(latestRecord.childListChange).toBe(true);
                expect(latestRecord.attributeChange).toBe(true);
                expect(latestRecord.targets).toBeEach([ child2, child3 ]);

                textNode.textContent = 'C';
                child2.appendChild(document.createElement('span'));
                child3.setAttribute('dummy-attr3', 'dummy-val3');
                await wait();
                expect(latestRecord.characterDataChange).toBe(true);
                expect(latestRecord.childListChange).toBe(true);
                expect(latestRecord.attributeChange).toBe(true);
                expect(latestRecord.targets).toBeEach([ textNode, child2, child3 ]);

            });

        });

        describe('observeResizing()', () => {

            let observeResizing: typeof cdkObserveResizing;

            beforeEach(() => {
                observeResizing = observersModule.observeResizing;
            });

            it('Should throw an error if the provided argument is not an Element instance or Function.', () => {
                const div = document.createElement('div');
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                const math = document.createElementNS('http://www.w3.org/1998/Math/MathML', 'math');

                document.body.append(div, svg, math);

                inRoot(() => {
                    expect(() => observeResizing(0 as any)).toThrow();
                    expect(() => observeResizing(1 as any)).toThrow();
                    expect(() => observeResizing('' as any)).toThrow();
                    expect(() => observeResizing('A' as any)).toThrow();
                    expect(() => observeResizing(true as any)).toThrow();
                    expect(() => observeResizing(false as any)).toThrow();
                    expect(() => observeResizing(undefined as any)).toThrow();
                    expect(() => observeResizing(null as any)).toThrow();
                    expect(() => observeResizing({} as any)).toThrow();
                    expect(() => observeResizing(div)).not.toThrow();
                    expect(() => observeResizing(svg)).not.toThrow();
                    expect(() => observeResizing(math)).not.toThrow();
                    expect(() => observeResizing(() => null!)).not.toThrow();
                });

                assertPendingEffectsCount(1);
                discardPendingEffects();
            });

            it('Should not throw an error if the provided argument is an object with a \'target\' property whose value is an Element instance or a function.', () => {
                const div = document.createElement('div');
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                const math = document.createElementNS('http://www.w3.org/1998/Math/MathML', 'math');

                document.body.append(div, svg, math);

                let dispose: any = null;

                createRoot((d) => {
                    dispose = d;
                    
                    expect(() => observeResizing({ target: div })).not.toThrow();
                    expect(() => observeResizing({ target: svg })).not.toThrow();
                    expect(() => observeResizing({ target: math })).not.toThrow();
                    expect(() => observeResizing({ target: () => null! })).not.toThrow();
                });


                assertPendingEffectsCount(1);
                discardPendingEffects();
                dispose();
            });

            it('Should throw an error if the provided function does not return an element during initialization.', () => {
                const div = document.createElement('div');
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                const math = document.createElementNS('http://www.w3.org/1998/Math/MathML', 'math');

                let returnResult: any = null

                document.body.append(div, svg, math);

                let dispose: any = null;

                createRoot((d) => {
                    dispose = d;
                    observeResizing(() => 0 as any);
                });

                assertPendingEffectsCount(1);
                expect(() => fireEffectsInitialization()).toThrow();
                dispose();

                createRoot((d) => {
                    dispose = d;
                    observeResizing({ target: () => 0 as any })
                });

                assertPendingEffectsCount(1);
                expect(() => fireEffectsInitialization()).toThrow();
                dispose();

                createRoot((d) => {
                    dispose = d;
                    observeResizing(() => 1 as any)
                });

                assertPendingEffectsCount(1);
                expect(() => fireEffectsInitialization()).toThrow();
                dispose();

                createRoot((d) => {
                    dispose = d;
                    observeResizing({ target: () => 1 as any })
                });

                assertPendingEffectsCount(1);
                expect(() => fireEffectsInitialization()).toThrow();
                dispose();

                createRoot((d) => {
                    dispose = d;
                    observeResizing(() => '' as any)
                });

                assertPendingEffectsCount(1);
                expect(() => fireEffectsInitialization()).toThrow();
                dispose();

                createRoot((d) => {
                    dispose = d;
                    observeResizing({ target: () => '' as any })
                });

                assertPendingEffectsCount(1);
                expect(() => fireEffectsInitialization()).toThrow();
                dispose();

                createRoot((d) => {
                    dispose = d;
                    observeResizing(() => 'A' as any)
                });

                assertPendingEffectsCount(1);
                expect(() => fireEffectsInitialization()).toThrow();
                dispose();

                createRoot((d) => {
                    dispose = d;
                    observeResizing({ target: () => 'A' as any })
                });

                assertPendingEffectsCount(1);
                expect(() => fireEffectsInitialization()).toThrow();
                dispose();

                createRoot((d) => {
                    dispose = d;
                    observeResizing(() => true as any)
                });

                assertPendingEffectsCount(1);
                expect(() => fireEffectsInitialization()).toThrow();
                dispose();

                createRoot((d) => {
                    dispose = d;
                    observeResizing({ target: () => true as any })
                });

                assertPendingEffectsCount(1);
                expect(() => fireEffectsInitialization()).toThrow();
                dispose();

                createRoot((d) => {
                    dispose = d;
                    observeResizing(() => 0 as any)
                });

                assertPendingEffectsCount(1);
                expect(() => fireEffectsInitialization()).toThrow();
                dispose();

                createRoot((d) => {
                    dispose = d;
                    observeResizing({ target: () => false as any })
                });

                assertPendingEffectsCount(1);
                expect(() => fireEffectsInitialization()).toThrow();
                dispose();

                createRoot((d) => {
                    dispose = d;
                    observeResizing(() => undefined as any)
                });

                assertPendingEffectsCount(1);
                expect(() => fireEffectsInitialization()).toThrow();
                dispose();

                createRoot((d) => {
                    dispose = d;
                    observeResizing({ target: () => undefined as any })
                });

                assertPendingEffectsCount(1);
                expect(() => fireEffectsInitialization()).toThrow();
                dispose();

                createRoot((d) => {
                    dispose = d;
                    observeResizing(() => null as any)
                });

                assertPendingEffectsCount(1);
                expect(() => fireEffectsInitialization()).toThrow();
                dispose();

                createRoot((d) => {
                    dispose = d;
                    observeResizing({ target: () => null as any })
                });

                assertPendingEffectsCount(1);
                expect(() => fireEffectsInitialization()).toThrow();
                dispose();

                createRoot((d) => {
                    dispose = d;
                    observeResizing(() => ({}) as any)
                });

                assertPendingEffectsCount(1);
                expect(() => fireEffectsInitialization()).toThrow();
                dispose();

                createRoot((d) => {
                    dispose = d;
                    observeResizing({ target: () => ({}) as any })
                });

                assertPendingEffectsCount(1);
                expect(() => fireEffectsInitialization()).toThrow();
                dispose();

                createRoot((d) => {
                    dispose = d;
                    observeResizing(() => returnResult)
                });

                assertPendingEffectsCount(1);
                returnResult = div;
                expect(() => fireEffectsInitialization()).not.toThrow();
                returnResult = null;
                dispose();

                createRoot((d) => {
                    dispose = d;
                    observeResizing({ target: () => returnResult })
                });

                assertPendingEffectsCount(1);
                returnResult = div;
                expect(() => fireEffectsInitialization()).not.toThrow();
                returnResult = null;
                dispose();

                createRoot((d) => {
                    dispose = d;
                    observeResizing(() => returnResult)
                });

                assertPendingEffectsCount(1);
                returnResult = svg;
                expect(() => fireEffectsInitialization()).not.toThrow();
                returnResult = null;
                dispose();

                createRoot((d) => {
                    dispose = d;
                    observeResizing({ target: () => returnResult })
                });

                assertPendingEffectsCount(1);
                returnResult = svg;
                expect(() => fireEffectsInitialization()).not.toThrow();
                returnResult = null;
                dispose();

                createRoot((d) => {
                    dispose = d;
                    observeResizing(() => returnResult)
                });

                assertPendingEffectsCount(1);
                returnResult = math;
                expect(() => fireEffectsInitialization()).not.toThrow();
                returnResult = null;
                dispose();

                createRoot((d) => {
                    dispose = d;
                    observeResizing({ target: () => returnResult })
                });

                assertPendingEffectsCount(1);
                returnResult = math;
                expect(() => fireEffectsInitialization()).not.toThrow();
                returnResult = null;
                dispose();
                
            });

            it('Should not have any pending effects if the provided function immediately returns an element.', () => {
                const div = document.body.appendChild(document.createElement('div'));

                inRoot(() => observeResizing(() => div));

                assertNoPendingEffects();

                inRoot(() => observeResizing({ target: () => div }));

                assertNoPendingEffects();
            });

            it('Should not have any pending effects if the element is provided as an argument.', () => {
                const div = document.body.appendChild(document.createElement('div'));

                inRoot(() => observeResizing(div));

                assertNoPendingEffects();

                inRoot(() => observeResizing({ target:div }));

                assertNoPendingEffects();
            });

            it('Should have any pending effect if the provided function lazily returns an element.', () => {
                let div: HTMLDivElement = null!;

                inRoot(() => observeResizing(() => div));

                assertPendingEffectsCount(1);
                discardPendingEffects()

                inRoot(() => observeResizing({ target: () => div }));

                assertPendingEffectsCount(1);
                discardPendingEffects()
            });

            it('Should update the signal when the directly provided element resizes, until disposal.', () => {
                const div1 = document.body.appendChild(document.createElement('div'));
                const div2 = document.body.appendChild(document.createElement('div'));

                const entrySource1 = inRoot(() => observeResizing(div1));
                const entrySource2 = inRoot(() => observeResizing(div2));

                assertNoPendingEffects();
                expect(entrySource1()).toBeNull();
                expect(entrySource2()).toBeNull();

                let latestFirstEntry: ResizeObserverEntry | null = null;
                let latestSecondEntry: ResizeObserverEntry | null = null;

                subscribeEffect(() => latestFirstEntry = entrySource1());
                subscribeEffect(() => latestSecondEntry = entrySource2());

                fireEffectsInitialization();

                _MockResizeObserver.trigger([
                    { target: div1, contentRect: new DOMRectReadOnly(0, 0, 100, 100,) },
                    { target: div2, contentRect: new DOMRectReadOnly(0, 0, 100, 100,) },
                ]);
                const firstEntry1 = entrySource1();
                const secondEntry1 = entrySource2();
                expect(firstEntry1).toBeTruthy();
                expect(secondEntry1).toBeTruthy();
                expect(firstEntry1!.target).toBe(div1);
                expect(secondEntry1!.target).toBe(div2);
                expect(firstEntry1).toBe(latestFirstEntry);
                expect(secondEntry1).toBe(latestSecondEntry);

                _MockResizeObserver.trigger([
                    { target: div1, contentRect: new DOMRectReadOnly(0, 0, 50, 50,) },
                    { target: div2, contentRect: new DOMRectReadOnly(0, 0, 50, 50,) },
                ]);

                const firstEntry2 = entrySource1();
                const secondEntry2 = entrySource2();
                expect(firstEntry2).not.toBe(firstEntry1);
                expect(secondEntry2).not.toBe(secondEntry1);
                expect(firstEntry2!.target).toBe(div1);
                expect(secondEntry2!.target).toBe(div2);
                expect(firstEntry2).toBe(latestFirstEntry);
                expect(secondEntry2).toBe(latestSecondEntry);


                dispose();

                _MockResizeObserver.trigger([
                    { target: div1, contentRect: new DOMRectReadOnly(0, 0, 50, 50,) },
                    { target: div2, contentRect: new DOMRectReadOnly(0, 0, 50, 50,) },
                ]);
                expect(entrySource1()).toBe(firstEntry2);
                expect(entrySource2()).toBe(secondEntry2);
            });

            it('Should update the signal when the eagerly provided element resizes, until disposal.', () => {
                const div1 = document.body.appendChild(document.createElement('div'));
                const div2 = document.body.appendChild(document.createElement('div'));

                const entrySource1 = inRoot(() => observeResizing(() => div1));
                const entrySource2 = inRoot(() => observeResizing(() => div2));

                assertNoPendingEffects();
                expect(entrySource1()).toBeNull();
                expect(entrySource2()).toBeNull();

                let latestFirstEntry: ResizeObserverEntry | null = null;
                let latestSecondEntry: ResizeObserverEntry | null = null;

                subscribeEffect(() => latestFirstEntry = entrySource1());
                subscribeEffect(() => latestSecondEntry = entrySource2());

                fireEffectsInitialization();

                _MockResizeObserver.trigger([
                    { target: div1, contentRect: new DOMRectReadOnly(0, 0, 100, 100,) },
                    { target: div2, contentRect: new DOMRectReadOnly(0, 0, 100, 100,) },
                ]);
                const firstEntry1 = entrySource1();
                const secondEntry1 = entrySource2();
                expect(firstEntry1).toBeTruthy();
                expect(secondEntry1).toBeTruthy();
                expect(firstEntry1!.target).toBe(div1);
                expect(secondEntry1!.target).toBe(div2);
                expect(firstEntry1).toBe(latestFirstEntry);
                expect(secondEntry1).toBe(latestSecondEntry);

                _MockResizeObserver.trigger([
                    { target: div1, contentRect: new DOMRectReadOnly(0, 0, 50, 50,) },
                    { target: div2, contentRect: new DOMRectReadOnly(0, 0, 50, 50,) },
                ]);

                const firstEntry2 = entrySource1();
                const secondEntry2 = entrySource2();
                expect(firstEntry2).not.toBe(firstEntry1);
                expect(secondEntry2).not.toBe(secondEntry1);
                expect(firstEntry2!.target).toBe(div1);
                expect(secondEntry2!.target).toBe(div2);
                expect(firstEntry2).toBe(latestFirstEntry);
                expect(secondEntry2).toBe(latestSecondEntry);


                dispose();

                _MockResizeObserver.trigger([
                    { target: div1, contentRect: new DOMRectReadOnly(0, 0, 50, 50,) },
                    { target: div2, contentRect: new DOMRectReadOnly(0, 0, 50, 50,) },
                ]);
                expect(entrySource1()).toBe(firstEntry2);
                expect(entrySource2()).toBe(secondEntry2);
            });

            it('Should update the signal when the lazily provided element resizes, until disposal.', () => {
                let div1: HTMLElement = null!;
                let div2: HTMLElement = null!;

                const entrySource1 = inRoot(() => observeResizing(() => div1));
                const entrySource2 = inRoot(() => observeResizing(() => div2));
                div1 = document.body.appendChild(document.createElement('div'));
                div2 = document.body.appendChild(document.createElement('div'));
                

                assertPendingEffectsCount(2);
                fireEffectsInitialization();

                expect(entrySource1()).toBeNull();
                expect(entrySource2()).toBeNull();

                let latestFirstEntry: ResizeObserverEntry | null = null;
                let latestSecondEntry: ResizeObserverEntry | null = null;

                subscribeEffect(() => latestFirstEntry = entrySource1());
                subscribeEffect(() => latestSecondEntry = entrySource2());

                fireEffectsInitialization();

                _MockResizeObserver.trigger([
                    { target: div1, contentRect: new DOMRectReadOnly(0, 0, 100, 100,) },
                    { target: div2, contentRect: new DOMRectReadOnly(0, 0, 100, 100,) },
                ]);
                const firstEntry1 = entrySource1();
                const secondEntry1 = entrySource2();
                expect(firstEntry1).toBeTruthy();
                expect(secondEntry1).toBeTruthy();
                expect(firstEntry1!.target).toBe(div1);
                expect(secondEntry1!.target).toBe(div2);
                expect(firstEntry1).toBe(latestFirstEntry);
                expect(secondEntry1).toBe(latestSecondEntry);

                _MockResizeObserver.trigger([
                    { target: div1, contentRect: new DOMRectReadOnly(0, 0, 50, 50,) },
                    { target: div2, contentRect: new DOMRectReadOnly(0, 0, 50, 50,) },
                ]);

                const firstEntry2 = entrySource1();
                const secondEntry2 = entrySource2();
                expect(firstEntry2).not.toBe(firstEntry1);
                expect(secondEntry2).not.toBe(secondEntry1);
                expect(firstEntry2!.target).toBe(div1);
                expect(secondEntry2!.target).toBe(div2);
                expect(firstEntry2).toBe(latestFirstEntry);
                expect(secondEntry2).toBe(latestSecondEntry);


                dispose();

                _MockResizeObserver.trigger([
                    { target: div1, contentRect: new DOMRectReadOnly(0, 0, 50, 50,) },
                    { target: div2, contentRect: new DOMRectReadOnly(0, 0, 50, 50,) },
                ]);
                expect(entrySource1()).toBe(firstEntry2);
                expect(entrySource2()).toBe(secondEntry2);
            });

            it('Should not update signal if observe option returns false form the start, but allows update when it change to true.', () => {
                const [observe, setObserve] = createSignal(false)
                const div1 = document.createElement('div');
                const div2 = document.createElement('div');
                document.body.appendChild(div1);
                document.body.appendChild(div2);

                let entrySource1: Accessor<ResizeObserverEntry | null> = null!;
                let entrySource2: Accessor<ResizeObserverEntry | null> = null!;
                let dispose: any = null;
                let returnValue: any = null;

                createRoot((d) => {
                    dispose = d;
                    entrySource1 = observeResizing({ target: div1, observe });
                    entrySource2 = observeResizing({ target: () => returnValue, observe });
                });

                assertPendingEffectsCount(1);
                returnValue = div2
                fireEffectsInitialization();
                returnValue = null;

                _MockResizeObserver.trigger([
                    { target: div1, contentRect: new DOMRectReadOnly(0, 0, 100, 100) },
                    { target: div2, contentRect: new DOMRectReadOnly(0, 0, 100, 100) },
                ]);

                expect(entrySource1()).toBeNull();
                expect(entrySource2()).toBeNull();

                setObserve(true);

                _MockResizeObserver.trigger([
                    { target: div1, contentRect: new DOMRectReadOnly(0, 0, 70, 70) },
                    { target: div2, contentRect: new DOMRectReadOnly(0, 0, 70, 70) },
                ]);

                const entry1 = entrySource1();
                const entry2 = entrySource2();
                expect(entry1).not.toBeNull();
                expect(entry2).not.toBeNull();

                setObserve(false);

                _MockResizeObserver.trigger([
                    { target: div1, contentRect: new DOMRectReadOnly(0, 0, 50, 50) },
                    { target: div2, contentRect: new DOMRectReadOnly(0, 0, 50, 50) },
                ]);

                expect(entrySource1()).toBe(entry1);
                expect(entrySource2()).toBe(entry2);

                dispose();
            });

        });
    });

    describe('Emulated server environment.', () => {

        let disposeEnvironment: () => void;

        beforeEach(async () => {
            observersModule = await _mockEnvironment('server');
            disposeEnvironment = observersModule.disposeEnvironment;
            const solidJsModule = await import('solid-js');
            createRoot = solidJsModule.createRoot;
            createSignal = solidJsModule.createSignal;
        })

        afterEach(() => {
            disposeEnvironment();
        });

        describe('observeMutations()', () => {

            let observeMutations: typeof cdkObserverMutations;

            beforeEach(() => {
                observeMutations = observersModule.observerMutations;
            })

            it('Should returns a null getter for directly provided element.', async () => {
                const div = document.createElement('div');
                document.body.appendChild(div);
                
                let mutation: Accessor<readonly CdkMutationRecord[] | null> = null!;
                createRoot(() => {
                    mutation = observeMutations(div);
                });
                expect(mutation.toString()).toBe('() => null');

                div.setAttribute('dummy-attr', 'dummy-attr-value');
                await Promise.resolve();
                expect(mutation()).toBeNull();

                div.appendChild(
                    document.createElement('span')
                );
                await Promise.resolve();
                expect(mutation()).toBeNull();
            });

            it('Should returns a null getter for eagerly provided element.', async () => {
                const div = document.createElement('div');
                document.body.appendChild(div);
                
                let mutation: Accessor<readonly CdkMutationRecord[] | null> = null!;
                createRoot(() => {
                    mutation = observeMutations(() => div);
                });
                expect(mutation.toString()).toBe('() => null');

                div.setAttribute('dummy-attr', 'dummy-attr-value');
                await Promise.resolve();
                expect(mutation()).toBeNull();

                div.appendChild(
                    document.createElement('span')
                );
                await Promise.resolve();
                expect(mutation()).toBeNull();
            });

            it('Should not be any pending effect for lazily provided element.', () => {
                createRoot(() => {
                    observeMutations(() => null!);
                });
                assertNoPendingEffects();
            });

        });

        describe('observeBatchedMutations()', () => {

            let observeBatchedMutations: typeof cdkObserveBatchedMutations;

            beforeEach(() => {
                observeBatchedMutations = observersModule.observeBatchedMutations;
            })

            it('Should returns a null getter for directly provided element.', async () => {
                const div = document.createElement('div');
                document.body.appendChild(div);
                
                let mutation: Accessor<CdkBatchedMutationRecord | null> = null!;
                createRoot(() => {
                    mutation = observeBatchedMutations(div);
                });

                expect(mutation.toString()).toBe('() => null');

                div.setAttribute('dummy-attr', 'dummy-attr-value');
                await Promise.resolve();
                expect(mutation()).toBeNull();

                div.appendChild(
                    document.createElement('span')
                );
                await Promise.resolve();
                expect(mutation()).toBeNull();
            });

            it('Should returns a null getter for eagerly provided element.', async () => {
                const div = document.createElement('div');
                document.body.appendChild(div);
                
                let mutation: Accessor<CdkBatchedMutationRecord | null> = null!;
                createRoot(() => {
                    mutation = observeBatchedMutations(() => div);
                });
                expect(mutation.toString()).toBe('() => null');

                div.setAttribute('dummy-attr', 'dummy-attr-value');
                await Promise.resolve();
                expect(mutation()).toBeNull();

                div.appendChild(
                    document.createElement('span')
                );
                await Promise.resolve();
                expect(mutation()).toBeNull();
            });

            it('Should not be any pending effect for lazily provided element.', () => {
                createRoot(() => {
                    observeBatchedMutations(() => null!);
                });
                assertNoPendingEffects();
            });

        });

        describe('observeResizing()', () => {
            
            let observerResizing: typeof cdkObserveResizing;

            beforeEach(() => {
                observerResizing = observersModule.observeResizing;
            });

            it('Should returns a null getter for directly provided element.', () => {
                const div1 = document.createElement('div');
                const div2 = document.createElement('div');

                document.body.append(div1, div2);

                let entry1: Accessor<ResizeObserverEntry | null> = null!;
                let entry2: Accessor<ResizeObserverEntry | null> = null!;

                createRoot(() => {
                    entry1 = observerResizing(div1);
                    entry2 = observerResizing({ target: div2 });
                });

                expect(_MockResizeObserver.targetsCount()).toBe(0);
                expect(entry1()).toBeNull();
                expect(entry2()).toBeNull();
            });

            it('Should returns a null getter for eagerly provided element.', () => {
                const div1 = document.createElement('div');
                const div2 = document.createElement('div');

                document.body.append(div1, div2);

                let entry1: Accessor<ResizeObserverEntry | null> = null!;
                let entry2: Accessor<ResizeObserverEntry | null> = null!;

                createRoot(() => {
                    entry1 = observerResizing(() => div1);
                    entry2 = observerResizing({ target: () => div2 });
                });

                expect(_MockResizeObserver.targetsCount()).toBe(0);
                expect(entry1()).toBeNull();
                expect(entry2()).toBeNull();
            });

            it('Should returns a null getter for lazily provided element.', () => {
                let entry1: Accessor<ResizeObserverEntry | null> = null!;
                let entry2: Accessor<ResizeObserverEntry | null> = null!;

                createRoot(() => {
                    entry1 = observerResizing(() => null!);
                    entry2 = observerResizing({ target: () => null! });
                });

                assertNoPendingEffects();
                expect(entry1()).toBeNull();
                expect(entry2()).toBeNull();

            });

        })
    })

})