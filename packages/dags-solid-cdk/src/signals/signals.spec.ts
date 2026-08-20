import type { 
    EffectFunction,
    createSignal as solidCreateSignal,
    createRoot as solidCreateRoot,
    createEffect as solidCreateEffect,
} from 'solid-js';
import type {
    createAsapEffect as cdkCreateAsapEffect,
    createAsyncEffect as cdkCreateAsyncEffect,
    createAsapRenderEffect as cdkCreateAsapRenderEffect,
    createAsyncRenderEffect as cdkCreateAsyncRenderEffect,
    createPresence as cdkCreatePresence, 
    createEntrance as cdkCreateEntrance,
    createLazyMemo as cdkCreateLazyMemo
} from './signals';
import { _EventLogs, _mocEnvironment, _MockEnvironmentController } from '../test-utils/schedulers_test_utils';

type _FakeElementEventName = 'transitionstart' | 'transitionend' | 'transitioncancel' | 'animationstart' | 'animationend' | 'animationcancel';

const EFFECT_RUNS = 'EFFECT_RUNS';
const RENDER_EFFECT_RUNS = 'RENDER_EFFECT_RUNS';
const REACTION_RUNS = 'REACTION_RUNS';



describe('Signals', () => {
    let disposeBag: (() => void)[] = [];

    let signalsModule: _MockEnvironmentController & typeof import('./signals');
    let solidJsModule: typeof import('solid-js');

    let fireTimeoutEvent: () => void;
    let fireMicrotaskEvent: () => void;
    let fireAnimationFrameEvent: () => void;
    let assertLog: (logs: (string | number)[]) =>  void;
    let logEvent: (logs: string | number) =>  void;
    let createRoot: typeof solidCreateRoot;
    let getOwner: () => any;
    let createSignal: typeof solidCreateSignal;
    let disposeEnvironment: () => void;

    function inRoot<T>(fn: () => T): T {
        return createRoot((dispose) => {
            disposeBag.push(dispose)
            return fn();
        })
    }

    function dispose(): void {
        while (disposeBag.length) {
            disposeBag.shift()!();
        }
    }
    

    beforeAll(async () => {
        vitest.doMock('solid-js', async () => {
            const ogSolidJsModule = await vitest.importActual<typeof import('solid-js')>('solid-js/dist/dev.js');
            const createEffect = ogSolidJsModule.createEffect;
            const createRenderEffect = ogSolidJsModule.createRenderEffect;
            const createReaction = ogSolidJsModule.createReaction;
            const onMount = ogSolidJsModule.onMount
            return {
                ...ogSolidJsModule,
                createEffect: (cb: EffectFunction<any, any>, v: any, o: any) => {
                    createEffect((v) => {
                        logEvent(EFFECT_RUNS);
                        return cb(v);
                    }, v, o);
                },
                createRenderEffect: (cb: EffectFunction<any, any>, v: any, o: any) => {
                    createRenderEffect((v) => {
                        logEvent(RENDER_EFFECT_RUNS);
                        return cb(v);
                    }, v, o);
                },
                createReaction: (onInvalidate: () =>  void, options: any) => {
                    return createReaction(() => {
                        logEvent(REACTION_RUNS);
                        onInvalidate();
                    }, options)
                },
                onMount: (fn: () => void) => {
                    onMount(() => {
                        logEvent(EFFECT_RUNS);
                        fn();
                    })
                }
            }
        });

        solidJsModule = await import('solid-js');
        createRoot = solidJsModule.createRoot;
        createSignal = solidJsModule.createSignal;
        getOwner = solidJsModule.getOwner;
    });

    afterEach(() => {
        dispose();
        disposeEnvironment();
    })

    afterAll(() => {
        vitest.doUnmock('solid-js');
    });

    describe('Emulated browser environment.', () => {

        beforeEach(async () => {
            signalsModule = await _mocEnvironment('browser', () => import('./signals'));
            disposeEnvironment = signalsModule.disposeEnvironment;
            logEvent = signalsModule.logEvent;
            assertLog = signalsModule.assertLogs;
            fireTimeoutEvent = signalsModule.fireTimeoutEvent;
            fireMicrotaskEvent = signalsModule.fireMicrotaskEvent;
            fireAnimationFrameEvent = signalsModule.fireAnimationFrameEvent;
        });
        
        describe('createAsapEffect().', () => {

            let createAsapEffect: typeof cdkCreateAsapEffect;

            beforeEach(() => {
                createAsapEffect = signalsModule.createAsapEffect;
            });

            it('Should throw an error if the first arg is not function or not empty array of functions.', () => {
                const errorMessage = 'createAsapEffect(): Invalid first argument! Expected a function.';
                inRoot(() => {
                    //will throw
                    expect(() => createAsapEffect(true as any)).toThrow(errorMessage);
                    expect(() => createAsapEffect(false as any)).toThrow(errorMessage);
                    expect(() => createAsapEffect(0 as any)).toThrow(errorMessage);
                    expect(() => createAsapEffect(1 as any)).toThrow(errorMessage);
                    expect(() => createAsapEffect('' as any)).toThrow(errorMessage);
                    expect(() => createAsapEffect('A' as any)).toThrow(errorMessage);
                    expect(() => createAsapEffect(Symbol() as any)).toThrow(errorMessage);
                    expect(() => createAsapEffect(null as any)).toThrow(errorMessage);
                    expect(() => createAsapEffect(undefined as any)).toThrow(errorMessage);
                    expect(() => createAsapEffect({} as any)).toThrow(errorMessage);
                    expect(() => createAsapEffect([] as any)).toThrow(errorMessage);

                    //will not throw
                    expect(() => createAsapEffect(() => {})).not.toThrow();
                });

                assertLog([ EFFECT_RUNS ]);
            });

            it('Should throw an error if the second argument is not an optional boolean.', () => {
                const errorMessage = 'Invalid second argument! Expected a boolean or nothing.';

                inRoot(() => {
                    //Will throw
                    expect(() => createAsapEffect(() => {}, 0 as any)).toThrow(errorMessage);
                    expect(() => createAsapEffect(() => {}, 1 as any)).toThrow(errorMessage);
                    expect(() => createAsapEffect(() => {}, '' as any)).toThrow(errorMessage);
                    expect(() => createAsapEffect(() => {}, 'A' as any)).toThrow(errorMessage);
                    expect(() => createAsapEffect(() => {}, Symbol() as any)).toThrow(errorMessage);
                    expect(() => createAsapEffect(() => {}, {} as any)).toThrow(errorMessage);
                    expect(() => createAsapEffect(() => {}, [] as any)).toThrow(errorMessage);
                    expect(() => createAsapEffect(() => {}, (() => {}) as any)).toThrow(errorMessage);

                    //Will not throw
                    expect(() => createAsapEffect(() => {}, true)).not.toThrow();
                    expect(() => createAsapEffect(() => {}, false)).not.toThrow();
                    expect(() => createAsapEffect(() => {}, null as any)).not.toThrow();
                    expect(() => createAsapEffect(() => {}, undefined)).not.toThrow();
                });

                assertLog([ EFFECT_RUNS, _EventLogs.AddMicrotask ,EFFECT_RUNS, EFFECT_RUNS, EFFECT_RUNS ]);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask ]);
            });

            it('Should not schedule initial call.', () => {
                inRoot(() => createAsapEffect(() => {
                    logEvent('A')
                }));
                assertLog([ EFFECT_RUNS, 'A' ]);
            });

            it('Should not schedule the initial call when the third argument is false.', () => {
                inRoot(() => createAsapEffect(() => {
                    logEvent('A')
                }, false));
                assertLog([ EFFECT_RUNS, 'A' ]);
            });

            it('Should schedule the initial call when the third argument is true.', () => {
                inRoot(() => createAsapEffect(() => {
                    logEvent('A')
                }, true));
                assertLog([ EFFECT_RUNS, _EventLogs.AddMicrotask ]);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask, 'A' ]);
            });

            it('Should schedule when signal change.', () => {
                const [counter, setCounter] = createSignal(0);

                inRoot(() => createAsapEffect(() => {
                    logEvent(`A${counter()}`);
                }));

                assertLog([ EFFECT_RUNS, 'A0' ]);
                setCounter(1);
                assertLog([ REACTION_RUNS, _EventLogs.AddMicrotask ])
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask, 'A1' ]);
            });

            it('Should coalesce when signal change multiple times.', () => {
                const [counter, setCounter] = createSignal(0);

                inRoot(() => createAsapEffect(() => {
                    logEvent(`A${counter()}`);
                }));

                assertLog([ EFFECT_RUNS, 'A0' ]);
                setCounter(1);
                assertLog([ REACTION_RUNS, _EventLogs.AddMicrotask ]);
                setCounter(2);
                assertLog([]);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask, 'A2' ]);
            });

            it('Should run cleanup after signal change.', () => {
                const [counter, setCounter] = createSignal(0);

                inRoot(() => createAsapEffect(() => {
                    const value = counter()
                    logEvent(`A${value}`);
                    return () => logEvent(`A${value}_cleanup`);
                }));

                assertLog([ EFFECT_RUNS, 'A0' ]);
                setCounter(1);
                assertLog([ 'A0_cleanup', REACTION_RUNS, _EventLogs.AddMicrotask ])
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask, 'A1' ]);
                dispose();
                assertLog([ 'A1_cleanup' ]);
            });

            it('Should run scheduled effect in owning context',() => {
                const [source, setSource] = createSignal(false);
                let owner: any = undefined;

                inRoot(() => createAsapEffect(() => {
                    if (source()) {
                        owner = getOwner();
                    }
                }));

                assertLog([ EFFECT_RUNS ]);
                setSource(true);
                assertLog([ REACTION_RUNS, _EventLogs.AddMicrotask ]);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask ]);
                expect(owner).toBeTypeOf('object');
            });

            it('Should work with multiple signals', () => {

                const [counterA, setCounterA] = createSignal(0);
                const [counterB, setCounterB] = createSignal(0);

                inRoot(() => createAsapEffect(() => {
                    const valueA = counterA()
                    const valueB = counterB()
                    logEvent(`A${valueA}`);
                    logEvent(`B${valueB}`);

                    return () => {
                        logEvent(`A${valueA}_cleanup`);
                        logEvent(`B${valueB}_cleanup`);
                    }
                }));

                assertLog([ EFFECT_RUNS, 'A0', 'B0' ]);
                setCounterA(1);
                assertLog([ 'A0_cleanup', 'B0_cleanup', REACTION_RUNS, _EventLogs.AddMicrotask ]);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask, 'A1', 'B0' ]);
                setCounterB(1);
                assertLog([ 'A1_cleanup', 'B0_cleanup', REACTION_RUNS, _EventLogs.AddMicrotask ]);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask, 'A1', 'B1' ]);
                setCounterA(2);
                setCounterB(2);
                assertLog([ 'A1_cleanup', 'B1_cleanup', REACTION_RUNS, _EventLogs.AddMicrotask ]);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask, 'A2', 'B2' ]);
                setCounterA(3);
                setCounterB(3);
                setCounterA(4);
                setCounterB(4);
                assertLog([ 'A2_cleanup', 'B2_cleanup', REACTION_RUNS, _EventLogs.AddMicrotask ]);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask, 'A4', 'B4' ]);
                dispose();
                assertLog([ 'A4_cleanup', 'B4_cleanup',  ])
            });

        });

        describe('createAsyncEffect().', () => {

            let createAsyncEffect: typeof cdkCreateAsyncEffect;

            beforeEach(() => {
                createAsyncEffect = signalsModule.createAsyncEffect;
            });

            it('Should throw an error if the first arg is not function or not empty array of functions.', () => {
                const errorMessage = 'createAsyncEffect(): Invalid first argument! Expected a function.';
                inRoot(() => {
                    //will throw
                    expect(() => createAsyncEffect(true as any)).toThrow(errorMessage);
                    expect(() => createAsyncEffect(false as any)).toThrow(errorMessage);
                    expect(() => createAsyncEffect(0 as any)).toThrow(errorMessage);
                    expect(() => createAsyncEffect(1 as any)).toThrow(errorMessage);
                    expect(() => createAsyncEffect('' as any)).toThrow(errorMessage);
                    expect(() => createAsyncEffect('A' as any)).toThrow(errorMessage);
                    expect(() => createAsyncEffect(Symbol() as any)).toThrow(errorMessage);
                    expect(() => createAsyncEffect(null as any)).toThrow(errorMessage);
                    expect(() => createAsyncEffect(undefined as any)).toThrow(errorMessage);
                    expect(() => createAsyncEffect({} as any)).toThrow(errorMessage);
                    expect(() => createAsyncEffect([] as any)).toThrow(errorMessage);

                    //will not throw
                    expect(() => createAsyncEffect(() => {})).not.toThrow();
                });

                assertLog([ EFFECT_RUNS ]);
            });

            it('Should throw an error if the second argument is not an optional boolean.', () => {
                const errorMessage = 'Invalid second argument! Expected a boolean or nothing.';

                inRoot(() => {
                    //Will throw
                    expect(() => createAsyncEffect(() => {}, 0 as any)).toThrow(errorMessage);
                    expect(() => createAsyncEffect(() => {}, 1 as any)).toThrow(errorMessage);
                    expect(() => createAsyncEffect(() => {}, '' as any)).toThrow(errorMessage);
                    expect(() => createAsyncEffect(() => {}, 'A' as any)).toThrow(errorMessage);
                    expect(() => createAsyncEffect(() => {}, Symbol() as any)).toThrow(errorMessage);
                    expect(() => createAsyncEffect(() => {}, {} as any)).toThrow(errorMessage);
                    expect(() => createAsyncEffect(() => {}, [] as any)).toThrow(errorMessage);
                    expect(() => createAsyncEffect(() => {}, (() => {}) as any)).toThrow(errorMessage);

                    //Will not throw
                    expect(() => createAsyncEffect(() => {}, true)).not.toThrow();
                    expect(() => createAsyncEffect(() => {}, false)).not.toThrow();
                    expect(() => createAsyncEffect(() => {}, null as any)).not.toThrow();
                    expect(() => createAsyncEffect(() => {}, undefined)).not.toThrow();
                });

                assertLog([ EFFECT_RUNS, _EventLogs.SetTimeout, _EventLogs.RequestAnimationFrame ,EFFECT_RUNS, EFFECT_RUNS, EFFECT_RUNS ]);
                fireTimeoutEvent();
                assertLog([ _EventLogs.FireTimeout, _EventLogs.CancelAnimationFrame ]);
            });

            it('Should not schedule initial call.', () => {
                inRoot(() => createAsyncEffect(() => {
                    logEvent('A')
                }));
                assertLog([ EFFECT_RUNS, 'A' ]);
            });

            it('Should not schedule the initial call when the third argument is false.', () => {
                inRoot(() => createAsyncEffect(() => {
                    logEvent('A')
                }, false));
                assertLog([ EFFECT_RUNS, 'A' ]);
            });

            it('Should schedule the initial call when the third argument is true.', () => {
                inRoot(() => createAsyncEffect(() => {
                    logEvent('A')
                }, true));
                assertLog([ EFFECT_RUNS, _EventLogs.SetTimeout, _EventLogs.RequestAnimationFrame ]);
                fireTimeoutEvent();
                assertLog([ _EventLogs.FireTimeout, _EventLogs.CancelAnimationFrame, 'A' ]);
            });

            it('Should schedule when signal change.', () => {
                const [counter, setCounter] = createSignal(0);

                inRoot(() => createAsyncEffect(() => {
                    logEvent(`A${counter()}`);
                }));

                assertLog([ EFFECT_RUNS, 'A0' ]);
                setCounter(1);
                assertLog([ REACTION_RUNS, _EventLogs.SetTimeout, _EventLogs.RequestAnimationFrame ])
                fireTimeoutEvent();
                assertLog([ _EventLogs.FireTimeout, _EventLogs.CancelAnimationFrame, 'A1' ]);
            });

            it('Should coalesce when signal change multiple times.', () => {
                const [counter, setCounter] = createSignal(0);

                inRoot(() => createAsyncEffect(() => {
                    logEvent(`A${counter()}`);
                }));

                assertLog([ EFFECT_RUNS, 'A0' ]);
                setCounter(1);
                assertLog([ REACTION_RUNS, _EventLogs.SetTimeout, _EventLogs.RequestAnimationFrame ]);
                setCounter(2);
                assertLog([]);
                fireTimeoutEvent();
                assertLog([ _EventLogs.FireTimeout, _EventLogs.CancelAnimationFrame, 'A2' ]);
            });

            it('Should run cleanup after signal change.', () => {
                const [counter, setCounter] = createSignal(0);

                inRoot(() => createAsyncEffect(() => {
                    const value = counter()
                    logEvent(`A${value}`);
                    return () => logEvent(`A${value}_cleanup`);
                }));

                assertLog([ EFFECT_RUNS, 'A0' ]);
                setCounter(1);
                assertLog([ 'A0_cleanup', REACTION_RUNS, _EventLogs.SetTimeout, _EventLogs.RequestAnimationFrame ])
                fireTimeoutEvent();
                assertLog([ _EventLogs.FireTimeout, _EventLogs.CancelAnimationFrame, 'A1' ]);
                dispose()
                assertLog([ 'A1_cleanup' ]);
            });

            it('Should run scheduled effect in owning context',() => {
                const [source, setSource] = createSignal(false);
                let owner: any = undefined;

                inRoot(() => createAsyncEffect(() => {
                    if (source()) {
                        owner = getOwner();
                    }
                }));

                assertLog([ EFFECT_RUNS ]);
                setSource(true);
                assertLog([ REACTION_RUNS, _EventLogs.SetTimeout, _EventLogs.RequestAnimationFrame ]);
                fireTimeoutEvent();
                assertLog([ _EventLogs.FireTimeout, _EventLogs.CancelAnimationFrame ]);
                expect(owner).toBeTypeOf('object');
            });

            it('Should work with multiple signals', () => {
                const [counterA, setCounterA] = createSignal(0);
                const [counterB, setCounterB] = createSignal(0);

                inRoot(() => createAsyncEffect(() => {
                    const valueA = counterA()
                    const valueB = counterB()
                    logEvent(`A${valueA}`);
                    logEvent(`B${valueB}`);

                    return () => {
                        logEvent(`A${valueA}_cleanup`);
                        logEvent(`B${valueB}_cleanup`);
                    }
                }));

                assertLog([ EFFECT_RUNS, 'A0', 'B0' ]);
                setCounterA(1);
                assertLog([ 'A0_cleanup', 'B0_cleanup', REACTION_RUNS, _EventLogs.SetTimeout, _EventLogs.RequestAnimationFrame ]);
                fireTimeoutEvent();
                assertLog([ _EventLogs.FireTimeout, _EventLogs.CancelAnimationFrame, 'A1', 'B0' ]);
                setCounterB(1);
                assertLog([ 'A1_cleanup', 'B0_cleanup', REACTION_RUNS, _EventLogs.SetTimeout, _EventLogs.RequestAnimationFrame ]);
                fireTimeoutEvent();
                assertLog([ _EventLogs.FireTimeout, _EventLogs.CancelAnimationFrame, 'A1', 'B1' ])
                setCounterA(2);
                setCounterB(2);
                assertLog([ 'A1_cleanup', 'B1_cleanup', REACTION_RUNS, _EventLogs.SetTimeout, _EventLogs.RequestAnimationFrame ]);
                fireTimeoutEvent();
                assertLog([ _EventLogs.FireTimeout, _EventLogs.CancelAnimationFrame, 'A2', 'B2' ]);
                setCounterA(3);
                setCounterB(3);
                setCounterA(4);
                setCounterB(4);
                assertLog([ 'A2_cleanup', 'B2_cleanup', REACTION_RUNS, _EventLogs.SetTimeout, _EventLogs.RequestAnimationFrame ]);
                fireTimeoutEvent();
                assertLog([ _EventLogs.FireTimeout, _EventLogs.CancelAnimationFrame, 'A4', 'B4' ]);
                dispose()
                assertLog([ 'A4_cleanup', 'B4_cleanup',  ])
            });

        });

        describe('createAsapRenderEffect().', () => {

            let createAsapRenderEffect: typeof cdkCreateAsapRenderEffect;

            beforeEach(() => {
                createAsapRenderEffect = signalsModule.createAsapRenderEffect;
            });

            it('Should throw error if first arg is not function or not empty array of functions.', () => {
                const errorMessage = 'createAsapRenderEffect(): Invalid argument! Expected a function.';
                inRoot(() => {
                    //will throw
                    expect(() => createAsapRenderEffect(true as any)).toThrow(errorMessage);
                    expect(() => createAsapRenderEffect(false as any)).toThrow(errorMessage);
                    expect(() => createAsapRenderEffect(0 as any)).toThrow(errorMessage);
                    expect(() => createAsapRenderEffect(1 as any)).toThrow(errorMessage);
                    expect(() => createAsapRenderEffect('' as any)).toThrow(errorMessage);
                    expect(() => createAsapRenderEffect('A' as any)).toThrow(errorMessage);
                    expect(() => createAsapRenderEffect(Symbol() as any)).toThrow(errorMessage);
                    expect(() => createAsapRenderEffect(null as any)).toThrow(errorMessage);
                    expect(() => createAsapRenderEffect(undefined as any)).toThrow(errorMessage);
                    expect(() => createAsapRenderEffect({} as any)).toThrow(errorMessage);
                    expect(() => createAsapRenderEffect([] as any)).toThrow(errorMessage);

                    //will not throw
                    expect(() => createAsapRenderEffect(() => {})).not.toThrow();
                });

                assertLog([ RENDER_EFFECT_RUNS ]);
            });


            it('Should schedule when signal change.', () => {
                const [counter, setCounter] = createSignal(0);

                inRoot(() => createAsapRenderEffect(() => {
                    logEvent(`A${counter()}`);
                }));

                assertLog([ RENDER_EFFECT_RUNS, 'A0' ]);
                setCounter(1);
                assertLog([ REACTION_RUNS, _EventLogs.AddMicrotask ]);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask, 'A1' ]);
            });

            it('Should coalesce when signal change multiple times.', () => {
                const [counter, setCounter] = createSignal(0);

                inRoot(() => createAsapRenderEffect(() => {
                    logEvent(`A${counter()}`);
                }));

                assertLog([ RENDER_EFFECT_RUNS, 'A0' ]);
                setCounter(1);
                assertLog([ REACTION_RUNS, _EventLogs.AddMicrotask ]);
                setCounter(2);
                assertLog([]);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask, 'A2' ]);
            });

            it('Should run cleanup after signal change.', () => {
                const [counter, setCounter] = createSignal(0);

                inRoot(() => createAsapRenderEffect(() => {
                    const value = counter()
                    logEvent(`A${value}`);
                    return () => logEvent(`A${value}_cleanup`);
                }));

                assertLog([ RENDER_EFFECT_RUNS, 'A0' ]);
                setCounter(1);
                assertLog([ 'A0_cleanup', REACTION_RUNS, _EventLogs.AddMicrotask ]);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask, 'A1' ]);
                dispose();
                assertLog([ 'A1_cleanup' ]);
            });

            it('Should run scheduled effect in owning context.',() => {
                const [source, setSource] = createSignal(false);
                let owner: any = undefined;

                inRoot(() => createAsapRenderEffect(() => {
                    if (source()) {
                        owner = getOwner();
                    }
                }));

                assertLog([ RENDER_EFFECT_RUNS ]);
                setSource(true);
                assertLog([ REACTION_RUNS, _EventLogs.AddMicrotask ]);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask ]);
                expect(owner).toBeTypeOf('object');
            });

            it('Should work with multiple signals.', () => {
                const [counterA, setCounterA] = createSignal(0);
                const [counterB, setCounterB] = createSignal(0);

                inRoot(() => createAsapRenderEffect(() => {
                    const valueA = counterA()
                    const valueB = counterB()
                    logEvent(`A${valueA}`);
                    logEvent(`B${valueB}`);

                    return () => {
                        logEvent(`A${valueA}_cleanup`);
                        logEvent(`B${valueB}_cleanup`);
                    }
                }));

                assertLog([ RENDER_EFFECT_RUNS, 'A0', 'B0' ])
                setCounterA(1);
                assertLog([ 'A0_cleanup', 'B0_cleanup', REACTION_RUNS, _EventLogs.AddMicrotask ]);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask, 'A1', 'B0' ]);
                setCounterB(1);
                assertLog([ 'A1_cleanup', 'B0_cleanup', REACTION_RUNS, _EventLogs.AddMicrotask ]);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask, 'A1', 'B1' ])
                setCounterA(2);
                setCounterB(2);
                assertLog([ 'A1_cleanup', 'B1_cleanup', REACTION_RUNS, _EventLogs.AddMicrotask ]);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask, 'A2', 'B2' ]);
                setCounterA(3);
                setCounterB(3);
                setCounterA(4);
                setCounterB(4);
                assertLog([ 'A2_cleanup', 'B2_cleanup',  REACTION_RUNS, _EventLogs.AddMicrotask ]);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask, 'A4', 'B4' ]);
                dispose();
                assertLog([ 'A4_cleanup', 'B4_cleanup' ]);
            });

        });

        describe('createAsyncRenderEffect().', () => {

            let createAsyncRenderEffect: typeof cdkCreateAsyncRenderEffect;

            beforeEach(() => {
                createAsyncRenderEffect = signalsModule.createAsyncRenderEffect;
            });

            it('Should throw error if first arg is not function or not empty array of functions.', () => {
                const errorMessage = 'createAsyncRenderEffect(): Invalid argument! Expected a function.';

                inRoot(() => {
                    //will throw
                    expect(() => createAsyncRenderEffect(true as any)).toThrow(errorMessage);
                    expect(() => createAsyncRenderEffect(false as any)).toThrow(errorMessage);
                    expect(() => createAsyncRenderEffect(0 as any)).toThrow(errorMessage);
                    expect(() => createAsyncRenderEffect(1 as any)).toThrow(errorMessage);
                    expect(() => createAsyncRenderEffect('' as any)).toThrow(errorMessage);
                    expect(() => createAsyncRenderEffect('A' as any)).toThrow(errorMessage);
                    expect(() => createAsyncRenderEffect(Symbol() as any)).toThrow(errorMessage);
                    expect(() => createAsyncRenderEffect(null as any)).toThrow(errorMessage);
                    expect(() => createAsyncRenderEffect(undefined as any)).toThrow(errorMessage);
                    expect(() => createAsyncRenderEffect({} as any)).toThrow(errorMessage);
                    expect(() => createAsyncRenderEffect([] as any)).toThrow(errorMessage);

                    //will not throw
                    expect(() => createAsyncRenderEffect(() => {})).not.toThrow();
                });

                assertLog([ RENDER_EFFECT_RUNS ]);
            });

            it('Should schedule when signal change.', () => {
                const [counter, setCounter] = createSignal(0);

                inRoot(() => createAsyncRenderEffect(() => {
                    logEvent(`A${counter()}`);
                }));

                assertLog([ RENDER_EFFECT_RUNS, 'A0' ]);
                setCounter(1);
                assertLog([ REACTION_RUNS, _EventLogs.SetTimeout, _EventLogs.RequestAnimationFrame ])
                fireTimeoutEvent();
                assertLog([ _EventLogs.FireTimeout, _EventLogs.CancelAnimationFrame, 'A1' ]);
            });

            it('Should coalesce when signal change multiple times.', () => {
                const [counter, setCounter] = createSignal(0);

                inRoot(() => createAsyncRenderEffect(() => {
                    logEvent(`A${counter()}`);
                }));

                assertLog([ RENDER_EFFECT_RUNS, 'A0' ]);
                setCounter(1);
                assertLog([ REACTION_RUNS, _EventLogs.SetTimeout, _EventLogs.RequestAnimationFrame ]);
                setCounter(2);
                assertLog([]);
                fireTimeoutEvent();
                assertLog([ _EventLogs.FireTimeout, _EventLogs.CancelAnimationFrame, 'A2' ]);
            });

            it('Should run cleanup after signal change.', () => {
                const [counter, setCounter] = createSignal(0);

                inRoot(() => createAsyncRenderEffect(() => {
                    const value = counter()
                    logEvent(`A${value}`);
                    return () => logEvent(`A${value}_cleanup`);
                }));

                assertLog([ RENDER_EFFECT_RUNS, 'A0' ]);
                setCounter(1);
                assertLog([ 'A0_cleanup', REACTION_RUNS, _EventLogs.SetTimeout, _EventLogs.RequestAnimationFrame ]);
                fireTimeoutEvent();
                assertLog([ _EventLogs.FireTimeout, _EventLogs.CancelAnimationFrame, 'A1' ]);
                dispose();
                assertLog(['A1_cleanup']);
            });

            it('Should run scheduled effect in owning context.',() => {
                const [source, setSource] = createSignal(false);
                let owner: any = undefined;

                inRoot(() => createAsyncRenderEffect(() => {
                    if (source()) {
                        owner = getOwner();
                    }
                }));

                assertLog([ RENDER_EFFECT_RUNS ]);
                setSource(true);
                assertLog([ REACTION_RUNS, _EventLogs.SetTimeout, _EventLogs.RequestAnimationFrame ]);
                fireTimeoutEvent();
                assertLog([ _EventLogs.FireTimeout, _EventLogs.CancelAnimationFrame ]);
                expect(owner).toBeTypeOf('object');
            });

            it('Should work with multiple signals', () => {
                const [counterA, setCounterA] = createSignal(0);
                const [counterB, setCounterB] = createSignal(0);
                inRoot(() => createAsyncRenderEffect(() => {
                    const valueA = counterA()
                    const valueB = counterB()
                    logEvent(`A${valueA}`);
                    logEvent(`B${valueB}`);

                    return () => {
                        logEvent(`A${valueA}_cleanup`);
                        logEvent(`B${valueB}_cleanup`);
                    }
                }));

                assertLog([ RENDER_EFFECT_RUNS, 'A0', 'B0' ]);
                setCounterA(1);
                assertLog([ 'A0_cleanup', 'B0_cleanup', REACTION_RUNS, _EventLogs.SetTimeout, _EventLogs.RequestAnimationFrame ]);
                fireTimeoutEvent();
                assertLog([ _EventLogs.FireTimeout, _EventLogs.CancelAnimationFrame, 'A1', 'B0' ]);
                setCounterB(1);
                assertLog([ 'A1_cleanup', 'B0_cleanup', REACTION_RUNS, _EventLogs.SetTimeout, _EventLogs.RequestAnimationFrame ]);
                fireTimeoutEvent();
                assertLog([ _EventLogs.FireTimeout, _EventLogs.CancelAnimationFrame, 'A1', 'B1' ])
                setCounterA(2);
                setCounterB(2);
                assertLog([ 'A1_cleanup', 'B1_cleanup', REACTION_RUNS, _EventLogs.SetTimeout, _EventLogs.RequestAnimationFrame ]);
                fireTimeoutEvent();
                assertLog([ _EventLogs.FireTimeout, _EventLogs.CancelAnimationFrame, 'A2', 'B2' ]);
                setCounterA(3);
                setCounterB(3);
                setCounterA(4);
                setCounterB(4);
                assertLog([ 'A2_cleanup', 'B2_cleanup', REACTION_RUNS, _EventLogs.SetTimeout, _EventLogs.RequestAnimationFrame ]);
                fireTimeoutEvent();
                assertLog([ _EventLogs.FireTimeout, _EventLogs.CancelAnimationFrame, 'A4', 'B4' ]);
                dispose();
                assertLog([ 'A4_cleanup', 'B4_cleanup',  ])
            });

        });

        describe('createLazyMemo()', () => {
            let createLazyMemo: typeof cdkCreateLazyMemo;

            beforeEach(() => createLazyMemo = signalsModule.createLazyMemo);

            it('Should create memo lazily.', () => {
                const fn = vitest.fn(() => 1);
                const memo = createLazyMemo(fn);

                expect(fn).not.toHaveBeenCalled();
                expect(memo()).toBe(1);
                expect(fn).toHaveBeenCalledTimes(1);
            });
        });

        describe('createPresence()', () => {

            type EventName = 'animationstart' | 'animationend' | 'animationcancel' | 'transitionstart' | 'transitionend'| 'transitioncancel';

            function createElement(): Element {
                return document.createElement('div');
            }

            function fireEvent(target: Element, eventName: EventName): void {
                if (eventName.startsWith('animation')) {
                    target.dispatchEvent(new Event(eventName));
                } else {
                    target.dispatchEvent(new TransitionEvent(eventName));
                }
            }

            let createPresence: typeof cdkCreatePresence;

            beforeEach(() => {
                createPresence = signalsModule.createPresence;
            });

            it('Should throw error if provided argument is not a function', () => {
                const errorMessage = 'createPresence(): Invalid argument! It must be a function!';

                // Will throw
                expect(() => createPresence(true as any)).toThrow(errorMessage);
                expect(() => createPresence(false as any)).toThrow(errorMessage);
                expect(() => createPresence(0 as any)).toThrow(errorMessage);
                expect(() => createPresence(1 as any)).toThrow(errorMessage);
                expect(() => createPresence('' as any)).toThrow(errorMessage);
                expect(() => createPresence('A' as any)).toThrow(errorMessage);
                expect(() => createPresence(undefined as any)).toThrow(errorMessage);
                expect(() => createPresence(null as any)).toThrow(errorMessage);
                expect(() => createPresence({} as any)).toThrow(errorMessage);

                // Will not throw
                expect(() => createPresence((() => {}) as any)).not.toThrow();

                assertLog([ EFFECT_RUNS ]);
            });

            it('Should throw an error is directive argument is not na Element instance.', () => {
                const errorMessage = 'createPresence()[1]: Invalid argument! Expected an Element instance.';
                const [source] = createSignal(null);
                const [_, directive] = createPresence(source);

                assertLog([EFFECT_RUNS])

                //Will throw
                expect(() => directive(0 as any)).toThrow(errorMessage);
                expect(() => directive(1 as any)).toThrow(errorMessage);
                expect(() => directive('' as any)).toThrow(errorMessage);
                expect(() => directive('A' as any)).toThrow(errorMessage);
                expect(() => directive(true as any)).toThrow(errorMessage);
                expect(() => directive(false as any)).toThrow(errorMessage);
                expect(() => directive(undefined as any)).toThrow(errorMessage);
                expect(() => directive(null as any)).toThrow(errorMessage);
                expect(() => directive({} as any)).toThrow(errorMessage);
                expect(() => directive([] as any)).toThrow(errorMessage);
                expect(() => directive((() => {}) as any)).toThrow(errorMessage);

                //Will not throw
                expect(() => directive(createElement())).not.toThrow();

            });

            it('Should update falsy value on microtask if element is not provided to directive.', () => {
                const o = {}
                const [source, setSource] = createSignal(o)
                const [state] = inRoot(() => createPresence(source));

                assertLog([ EFFECT_RUNS ]);
                setSource(() => null);
                assertLog([ REACTION_RUNS, _EventLogs.AddMicrotask ]);
                expect(state()).toBe(o);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask ]);
                expect(state()).toBe(null);
            });

            it('Should update falsy value on microtask if provided element to directive is not animation or transitioning.', () => {
                const o = {}
                const element = createElement();
                const [source, setSource] = createSignal(o);
                const [state] = inRoot(() => {
                    const p = createPresence(source);
                    p[1](element as any);
                    return p
                });

                assertLog([ EFFECT_RUNS ])
                setSource(() => null);
                assertLog([ REACTION_RUNS, _EventLogs.AddMicrotask ]);
                expect(state()).toBe(o);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask ]);
                expect(state()).toBe(null);
            });

            it('Should update falsy value on transition end if transition has stared.', () => {
                const o = {}
                const element = createElement();
                const [source, setSource] = createSignal<object | null>(o);
                const [state] = inRoot(() => {
                    const p = createPresence(source);
                    p[1](element as any);
                    return p
                });

                assertLog([ EFFECT_RUNS ]);
                fireEvent(element, 'transitionstart')
                setSource(null);
                assertLog([ REACTION_RUNS, _EventLogs.AddMicrotask ]);
                expect(state()).toBe(o);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask ]);
                expect(state()).toBe(o);
                fireEvent(element, 'transitionend');
                expect(state()).toBe(null);
            });

            it('Should update falsy value on transition cancel if transition has stared.', () => {
                const o = {}
                const element = createElement();
                const [source, setSource] = createSignal<object | null>(o);
                const [state] = inRoot(() => {
                    const p = createPresence(source);
                    p[1](element as any);
                    return p;
                });

                assertLog([ EFFECT_RUNS ]);
                fireEvent(element, 'transitionstart');
                setSource(null);
                assertLog([ REACTION_RUNS, _EventLogs.AddMicrotask ]);
                expect(state()).toBe(o);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask ]);
                expect(state()).toBe(o);
                fireEvent(element, 'transitioncancel');
                expect(state()).toBe(null);
            });

            it('Should update falsy value on animation end if animation has stared.', () => {
                const o = {}
                const element = createElement();
                const [source, setSource] = createSignal<object | null>(o);
                const [state] = inRoot(() => {
                    const p = createPresence(source);
                    p[1](element as any);
                    return p
                });

                assertLog([ EFFECT_RUNS ]);
                fireEvent(element, 'animationstart');
                setSource(null);
                assertLog([ REACTION_RUNS, _EventLogs.AddMicrotask ]);
                expect(state()).toBe(o);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask ]);
                expect(state()).toBe(o);
                fireEvent(element, 'animationend');
                expect(state()).toBe(null);
            });

            it('Should update falsy value on animation cancel if animation has stared.', () => {
                const o = {}
                const element = createElement();
                const [source, setSource] = createSignal<object | null>(o);
                const [state] = inRoot(() => {
                    const p = createPresence(source);
                    p[1](element as any);
                    return p
                });

                assertLog([ EFFECT_RUNS ]);
                fireEvent(element, 'animationstart');
                setSource(null);
                assertLog([ REACTION_RUNS, _EventLogs.AddMicrotask ]);
                expect(state()).toBe(o);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask ]);
                expect(state()).toBe(o);
                fireEvent(element, 'animationcancel');
                expect(state()).toBe(null);
            });

            it('Should update truthy value on microtask despise of transition.', () => {
                const o = {}
                const element = createElement();
                const [source, setSource] = createSignal<object | null>(null);
                const [state] = inRoot(() => {
                    const p = createPresence(source);
                    p[1](element as any);
                    return p
                });

                assertLog([ EFFECT_RUNS ]);
                fireEvent(element, 'transitionstart');
                setSource(o);
                assertLog([ REACTION_RUNS, _EventLogs.AddMicrotask ]);
                expect(state()).toBe(null);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask ]);
                expect(state()).toBe(o)
            });

            it('Should update truthy value on microtask despise of animation.', () => {
                const o = {}
                const element = createElement();
                const [source, setSource] = createSignal<object | null>(null);
                const [state] = inRoot(() => {
                    const p = createPresence(source);
                    p[1](element as any);
                    return p
                });

                assertLog([ EFFECT_RUNS ]);
                fireEvent(element, 'animationstart');
                setSource(o);
                assertLog([ REACTION_RUNS, _EventLogs.AddMicrotask ]);
                expect(state()).toBe(null);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask ]);
                expect(state()).toBe(o)
                dispose();
            });

            it('Should update falsy value for transitioning and animating element if both ends or gets canceled', () => {
                const o1 = {}
                const element1 = createElement();
                const [source1, setSource1] = createSignal<object | null>(o1);
                const [state1] = inRoot(() => {
                    const p = createPresence(source1);
                    p[1](element1 as any);
                    return p;
                });
                assertLog([ EFFECT_RUNS ]);
                fireEvent(element1, 'transitionstart');
                fireEvent(element1, 'animationstart');
                setSource1(null);
                assertLog([ REACTION_RUNS, _EventLogs.AddMicrotask ]);
                expect(state1()).toBe(o1);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask ]);
                expect(state1()).toBe(o1);
                fireEvent(element1, 'transitionend');
                expect(state1()).toBe(o1);
                fireEvent(element1, 'animationend');
                expect(state1()).toBe(null);
                dispose();

                const o2 = {}
                const element2 = createElement();
                const [source2, setSource2] = createSignal<object | null>(o2);
                const [state2] = inRoot(() => {
                    const p = createPresence(source2);
                    p[1](element2 as any);
                    return p
                });
                assertLog([ EFFECT_RUNS ]);
                fireEvent(element2, 'transitionstart');
                fireEvent(element2, 'animationstart');
                setSource2(null);
                assertLog([ REACTION_RUNS, _EventLogs.AddMicrotask ]);
                expect(state2()).toBe(o2);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask ]);
                expect(state2()).toBe(o2);
                fireEvent(element2, 'transitioncancel');
                expect(state2()).toBe(o2);
                fireEvent(element2, 'animationcancel');
                expect(state2()).toBe(null);
                dispose();

                const o3 = {};
                const element3 = createElement();
                const [source3, setSource3] = createSignal<object | null>(o3);
                const [state3] = inRoot(() => {
                    const p = createPresence(source3);
                    p[1](element3 as any);
                    return p
                });
                assertLog([ EFFECT_RUNS ]);
                fireEvent(element3, 'transitionstart');
                fireEvent(element3, 'animationstart');
                setSource3(null);
                assertLog([ REACTION_RUNS, _EventLogs.AddMicrotask ]);
                expect(state3()).toBe(o3);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask ]);
                expect(state3()).toBe(o3);
                fireEvent(element3, 'transitionend');
                expect(state3()).toBe(o3);
                fireEvent(element3, 'animationcancel');
                expect(state3()).toBe(null);
                dispose();

                
                const o4 = {}
                const element4 = createElement();
                const [source4, setSource4] = createSignal<object | null>(o4);
                const [state4] = inRoot(() => {
                    const p = createPresence(source4);
                    p[1](element4 as any);
                    return p;
                });
                assertLog([ EFFECT_RUNS ]);
                fireEvent(element4, 'transitionstart');
                fireEvent(element4, 'animationstart');
                setSource4(null);
                assertLog([ REACTION_RUNS, _EventLogs.AddMicrotask ]);
                expect(state4()).toBe(o4);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask ]);
                expect(state4()).toBe(o4);
                fireEvent(element4, 'transitioncancel');
                expect(state4()).toBe(o4);
                fireEvent(element4, 'animationend')
                expect(state4()).toBe(null);
                dispose();
            });

            it('Should update falsy value on microtask for element if owning directive context is disposed, despise of animation or transition', () => {
                function disposeLast(): void {
                    if (disposeBag.length) {
                        disposeBag[disposeBag.length - 1]();
                    }
                }

                const o1 = {}
                const element1 = createElement();
                const [source1, setSource1] = createSignal<object | null>(o1);
                const [state1, directive1] = inRoot(() => createPresence(source1));

                inRoot(() => directive1(element1 as any));

                assertLog([ EFFECT_RUNS ]);
                expect(state1()).toBe(o1);
                disposeLast();
                fireEvent(element1, 'transitionstart')
                setSource1(null);
                assertLog([ REACTION_RUNS, _EventLogs.AddMicrotask ]);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask ]);
                expect(state1()).toBe(null);
                dispose();

                const o2 = {}
                const element2 = createElement();
                const [source2, setSource2] = createSignal<object | null>(o2);
                const [state2, directive2] = inRoot(() => createPresence(source2));

                inRoot(() => directive2(element2 as any));

                assertLog([ EFFECT_RUNS ]);
                expect(state2()).toBe(o2);
                disposeLast();
                fireEvent(element2, 'animationstart')
                setSource2(null);
                assertLog([ REACTION_RUNS, _EventLogs.AddMicrotask ]);
                fireMicrotaskEvent();
                assertLog([ _EventLogs.FireMicrotask ]);
                expect(state2()).toBe(null);
                dispose();
            });
            
        });

        describe('createEntrance()', () => {

            let createEntrance: typeof cdkCreateEntrance;

            beforeEach(() => {
                createEntrance = signalsModule.createEntrance;
            });

            it('Should update value from false to true after browser repaint when value has been read.', () => {
                const entrance = createEntrance();

                expect(entrance()).toBe(false);
                assertLog([ _EventLogs.RequestAnimationFrame ]);
                fireAnimationFrameEvent();
                assertLog([ _EventLogs.FireAnimationFrame, _EventLogs.RequestAnimationFrame ]);
                expect(entrance()).toBe(false);
                fireAnimationFrameEvent();
                assertLog([ _EventLogs.FireAnimationFrame ]);
                expect(entrance()).toBe(true);
            });

            it('Should not update value if owning context will have been disposed before first animation frame event fire.', () => {
                const entrance = createEntrance();
                
                expect(inRoot(() => entrance())).toBe(false);
                assertLog([ _EventLogs.RequestAnimationFrame ]);
                dispose();
                fireAnimationFrameEvent();
                fireAnimationFrameEvent();
                assertLog([ _EventLogs.FireAnimationFrame, _EventLogs.RequestAnimationFrame, _EventLogs.FireAnimationFrame ]);
                expect(entrance()).toBe(false);
            });

            it('Should not update value if owning context will have been disposed before second animation frame event fire.', () => {
                const entrance = createEntrance();

                expect(inRoot(() => entrance())).toBe(false);
                assertLog([ _EventLogs.RequestAnimationFrame ]);
                fireAnimationFrameEvent();
                assertLog([ _EventLogs.FireAnimationFrame, _EventLogs.RequestAnimationFrame ]);
                dispose();
                fireAnimationFrameEvent();
                assertLog([ _EventLogs.FireAnimationFrame ]);
                expect(entrance()).toBe(false);
            });
        });

    });

    describe('Emulating server environment', () => {

        beforeEach(async () => {
            signalsModule = await _mocEnvironment('server', () => import('./signals'));
            disposeEnvironment = signalsModule.disposeEnvironment;
            logEvent = signalsModule.logEvent;
            assertLog = signalsModule.assertLogs;
            fireTimeoutEvent = signalsModule.fireTimeoutEvent;
            fireMicrotaskEvent = signalsModule.fireMicrotaskEvent;
            fireAnimationFrameEvent = signalsModule.fireAnimationFrameEvent;
        });

        describe('createAsapEffect()', () => {
            
            let createAsapEffect: typeof cdkCreateAsapEffect;

            beforeEach(() => {
                createAsapEffect = signalsModule.createAsapEffect;
            })

            it('Should do nothing.', () => {
                assertLog([]);
                const [counter] = createSignal(0);
                inRoot(() => createAsapEffect(() => {
                    counter();
                    logEvent('A');
                }));
                assertLog([]);
            });
        });

        describe('createAsapEffect()', () => {
            
            let createAsapEffect: typeof cdkCreateAsapEffect;

            beforeEach(() => {
                createAsapEffect = signalsModule.createAsapEffect;
            })

            it('Should do nothing.', () => {
                assertLog([]);
                const [counter] = createSignal(0);
                inRoot(() => createAsapEffect(() => {
                    counter();
                    logEvent('A')
                }));
                assertLog([]);
            });
        });

        describe('createAsyncEffect()', () => {

            let createAsyncEffect: typeof cdkCreateAsyncEffect;

            beforeEach(() => {
                createAsyncEffect = signalsModule.createAsyncEffect;
            });

            it('Should do nothing.', () => {
                assertLog([]);
                const [counter] = createSignal(0);
                inRoot(() => createAsyncEffect(() => {
                    counter();
                    logEvent('A');
                }));
                assertLog([]);
            })
        });

        describe('createAsapRenderEffect()', () => {
            let createAsapRenderEffect: typeof cdkCreateAsapRenderEffect;

            beforeEach(() => {
                createAsapRenderEffect = signalsModule.createAsapRenderEffect;
            })

            it('Should fallback to createRenderEffect() function.', () => {
                assertLog([]);
                const [counter, setCounter] = createSignal(0);
                inRoot(() => createAsapRenderEffect(() => {
                    const value = counter();
                    logEvent(`A${value}`);
                    return () => logEvent(`A${value}_cleanup`);
                }));
                assertLog([ RENDER_EFFECT_RUNS, 'A0' ]);
                setCounter(1);
                assertLog([ 'A0_cleanup', RENDER_EFFECT_RUNS, 'A1' ]);
                dispose();
                assertLog([ 'A1_cleanup' ]);
            });
        });

        describe('createAsyncRenderEffect()', () => {
            let createAsyncRenderEffect: typeof cdkCreateAsyncRenderEffect;

            beforeEach(() => {
                createAsyncRenderEffect = signalsModule.createAsyncRenderEffect;
            })

            it('Should fallback to createRenderEffect() function.', () => {
                assertLog([]);
                const [counter, setCounter] = createSignal(0);
                inRoot(() => createAsyncRenderEffect(() => {
                    const value = counter();
                    logEvent(`A${value}`);
                    return () => logEvent(`A${value}_cleanup`);
                }));
                assertLog([ RENDER_EFFECT_RUNS, 'A0' ]);
                setCounter(1);
                assertLog([ 'A0_cleanup', RENDER_EFFECT_RUNS, 'A1' ]);
                dispose();
                assertLog([ 'A1_cleanup' ]);
            });
        });

        describe('createPresence()', () => {
            let createPresence: typeof cdkCreatePresence;

            beforeEach(() => {
                createPresence = signalsModule.createPresence;
            });

            it('Should return the source.', () => {
                const [source] = createSignal({});
                const [state] = createPresence(source);
                expect(state).toBe(source);
            });

        });

        describe('createEntrance()', () => {
            let createEntrance: typeof cdkCreateEntrance;

            beforeEach(() => {
                createEntrance = signalsModule.createEntrance;
            });

            it('Should always return false.', () => {
                const entrance = createEntrance();
                assertLog([]);
                expect(entrance()).toBe(false);
                assertLog([]);
                expect(entrance()).toBe(false);
                
            });
        });

    });
})