import { createRoot, createSignal } from "solid-js";
import { createOverlay } from "../overlay";
import { _validConnections, connectedEdgesPositionStrategy, ConnectedEdgesStrategyConfig, Edge, EdgeConnection, fixedAlignmentStrategy, FixedAlignmentStrategyConfig, fixedCoordinateStrategy, FixedCoordinateStrategyConfig, TargetOrientedEdgeConnection } from "./position-strategy";
import { page } from "vitest/browser";

const disposeBag: (() => void)[] = [];
const ogRequestAnimationFrame = requestAnimationFrame;

function inRoot<T>(fn: () => T): T {
    return createRoot((dispose) => {
        disposeBag.push(dispose);
        return fn();
    })
}

function dispose(): void {
    while (disposeBag.length) {
        disposeBag.shift()!();
    }
}

function waitToAnimationFrame(flush?: () => void): Promise<void> {
    return new Promise<void>((resolve) => ogRequestAnimationFrame(() => (flush?.(), resolve())))
}

function installMocQueueMicrotask(): (() => void) & Disposable & { microtaskCount: number } {
    const microtasks: (() => void)[] = [] 
    const spy = vitest.spyOn(globalThis, 'queueMicrotask').mockImplementation((fn) => {
        microtasks.push(fn);
    });

    const flush = () => {
        try {
            while (microtasks.length) {
                microtasks.shift()!();
            }
        } finally {
            if (microtasks.length) {
                flush()
            }
        }
    }

    (flush as any)[Symbol.dispose] = spy[Symbol.dispose];

    Object.defineProperty(flush, 'microtaskCount', {
        get() {
            return microtasks.length;
        },
    })

    return flush as any
}

function installMockRequestAnimationFrame(): (() => void) & Disposable & { callbacksCount: number } {
    let id = 1;
    const callbacksRefs: { cb: FrameRequestCallback, id: number }[] = [];
    const spy1 = vitest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
        const cbRef = {
            cb,
            id: id++
        };
        callbacksRefs.push(cbRef);
        return id;
    });

    const spy2 = vitest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((handle) => {
        const index = callbacksRefs.findIndex(({ id }) => id === handle);
        if (index === -1) { return; }
        callbacksRefs.splice(index, 1);
    })

    const flush = () => {
        try {
            while (callbacksRefs.length) {
                callbacksRefs.shift()!.cb(performance.now())
            }
        } finally {
            if (callbacksRefs.length) {
                flush();
            }
        }
    }

    (flush as any)[Symbol.dispose] = () => {
        spy1.mockRestore();
        spy2.mockRestore();
    }

    Object.defineProperty(flush, 'callbacksCount', {
        get() {
            return callbacksRefs.length;
        },
    })

    return flush as any;
}

vitest.mock(import('../overlay'), (importOgModule) => {
    (globalThis as any).__IS_SERVER__ = false;
    return importOgModule();
});

beforeAll(async () => {
    await page.viewport(1280, 720);
})

afterEach(() => {
    dispose();
    document.body.replaceChildren();
});

afterAll(() => {
    vitest.doUnmock('./position-strategy');
    delete (globalThis as any).__IS_SERVER__;
})


describe('fixedAlignmentStrategy()', () => {

    it('Should throw an error if used in a server environment.', () => {
        using spy = vitest.spyOn((globalThis as any), '__IS_SERVER__', 'get').mockReturnValue(true);
        const errorMessage = 'fixedAlignmentStrategy(): This function is not available in a server environment!';
        expect(() => fixedAlignmentStrategy({ horizontalAlignment: 'center', verticalAlignment: 'center' })).toThrow(errorMessage);
    });

    it('Should throw an error if the provided argument is not an non-array object.', () => {
        const errorMessage = 'fixedAlignmentStrategy(): Invalid argument! Expected an non-array object.'
        expect(() => fixedAlignmentStrategy(0 as any)).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy(1 as any)).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy('' as any)).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy('A' as any)).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy(undefined as any)).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy(null as any)).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy((() => {}) as any)).toThrow(errorMessage);
    });

    it('Should throw an error if the provided argument does not contain the horizontalAlignment property.', () => {
        const errorMessage = 'fixedAlignmentStrategy({ horizontalAlignment }): Invalid argument! Expected an object with a "horizontalAlignment" property set to one of ["start", "center", "end"].';
        expect(() => fixedAlignmentStrategy({ verticalAlignment: 'start' } as any)).toThrow(errorMessage);
    });

    it('Should throw an error if the provided argument does not contain the verticalAlignment property.', () => {
        const errorMessage = 'fixedAlignmentStrategy({ verticalAlignment }): Invalid argument! Expected an object with a "verticalAlignment" property set to one of ["start", "center", "end"].';
        expect(() => fixedAlignmentStrategy({ horizontalAlignment: 'start' } as any)).toThrow(errorMessage);
    });

    it('Should throw an error if the horizontalAlignment property is not one of ["start", "center", "end"].', () => {
        const errorMessage = 'fixedAlignmentStrategy({ horizontalAlignment }): Invalid argument! Expected an object with a "horizontalAlignment" property set to one of ["start", "center", "end"].';

        expect(() => fixedAlignmentStrategy({ verticalAlignment: 'start', horizontalAlignment: 0 as any })).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy({ verticalAlignment: 'start', horizontalAlignment: 1 as any })).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy({ verticalAlignment: 'start', horizontalAlignment: '' as any })).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy({ verticalAlignment: 'start', horizontalAlignment: 'A' as any })).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy({ verticalAlignment: 'start', horizontalAlignment: true as any })).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy({ verticalAlignment: 'start', horizontalAlignment: false as any })).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy({ verticalAlignment: 'start', horizontalAlignment: undefined as any })).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy({ verticalAlignment: 'start', horizontalAlignment: null as any })).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy({ verticalAlignment: 'start', horizontalAlignment: {} as any })).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy({ verticalAlignment: 'start', horizontalAlignment: [] as any })).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy({ verticalAlignment: 'start', horizontalAlignment: (() => {}) as any })).toThrow(errorMessage);

        expect(() => fixedAlignmentStrategy({ verticalAlignment: 'start', horizontalAlignment: 'start' })).not.toThrow();
        expect(() => fixedAlignmentStrategy({ verticalAlignment: 'start', horizontalAlignment: 'end' })).not.toThrow();
        expect(() => fixedAlignmentStrategy({ verticalAlignment: 'start', horizontalAlignment: 'center' })).not.toThrow();
    });

    it('Should throw an error if the verticalAlignment property is not one of ["start", "center", "end"].', () => {
        const errorMessage = 'fixedAlignmentStrategy({ verticalAlignment }): Invalid argument! Expected an object with a "verticalAlignment" property set to one of ["start", "center", "end"].';

        expect(() => fixedAlignmentStrategy({ horizontalAlignment: 'start', verticalAlignment: 0 as any })).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy({ horizontalAlignment: 'start', verticalAlignment: 1 as any })).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy({ horizontalAlignment: 'start', verticalAlignment: '' as any })).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy({ horizontalAlignment: 'start', verticalAlignment: 'A' as any })).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy({ horizontalAlignment: 'start', verticalAlignment: true as any })).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy({ horizontalAlignment: 'start', verticalAlignment: false as any })).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy({ horizontalAlignment: 'start', verticalAlignment: undefined as any })).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy({ horizontalAlignment: 'start', verticalAlignment: null as any })).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy({ horizontalAlignment: 'start', verticalAlignment: {} as any })).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy({ horizontalAlignment: 'start', verticalAlignment: [] as any })).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy({ horizontalAlignment: 'start', verticalAlignment: (() => {}) as any })).toThrow(errorMessage);

        expect(() => fixedAlignmentStrategy({ horizontalAlignment: 'start', verticalAlignment: 'start' })).not.toThrow();
        expect(() => fixedAlignmentStrategy({ horizontalAlignment: 'start', verticalAlignment: 'end' })).not.toThrow();
        expect(() => fixedAlignmentStrategy({ horizontalAlignment: 'start', verticalAlignment: 'center' })).not.toThrow();
    });

    it('Should throw an error if the optional margin property is not a string.', () => {
        const errorMessage = 'fixedAlignmentStrategy({ margin }): Invalid argument! Expected am object with "margin" property of type string or without it.';

        expect(() => fixedAlignmentStrategy({ horizontalAlignment: 'start', verticalAlignment: 'start', margin: 0 as any })).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy({ horizontalAlignment: 'start', verticalAlignment: 'start', margin: 1 as any })).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy({ horizontalAlignment: 'start', verticalAlignment: 'start', margin: true as any })).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy({ horizontalAlignment: 'start', verticalAlignment: 'start', margin: false as any })).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy({ horizontalAlignment: 'start', verticalAlignment: 'start', margin: {} as any })).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy({ horizontalAlignment: 'start', verticalAlignment: 'start', margin: [] as any })).toThrow(errorMessage);
        expect(() => fixedAlignmentStrategy({ horizontalAlignment: 'start', verticalAlignment: 'start', margin: (() => {}) as any })).toThrow(errorMessage);

        expect(() => fixedAlignmentStrategy({ horizontalAlignment: 'start', verticalAlignment: 'start', margin: '' })).not.toThrow();
        expect(() => fixedAlignmentStrategy({ horizontalAlignment: 'start', verticalAlignment: 'start', margin: 'A' })).not.toThrow();
        expect(() => fixedAlignmentStrategy({ horizontalAlignment: 'start', verticalAlignment: 'start', margin: undefined })).not.toThrow();
        expect(() => fixedAlignmentStrategy({ horizontalAlignment: 'start', verticalAlignment: 'start', margin: null as any })).not.toThrow();
    });
    
    it('Should align an overlay with the center of the viewport.', async () => {
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 500px; height: 500px"></div>,
            positionStrategy: fixedAlignmentStrategy({
                horizontalAlignment: 'center',
                verticalAlignment: 'center'
            })
        }));

        handle.attach();

        await waitToAnimationFrame();

        const overlayElement = handle.componentContainer!.parentElement;

        expect(overlayElement).toBeInstanceOf(HTMLDivElement);

        const overlayRect = overlayElement!.getBoundingClientRect();

        expect(overlayRect.left).toBe(0);
        expect(overlayRect.top).toBe(0);
        expect(overlayRect.right).toBe(1280);
        expect(overlayRect.bottom).toBe(720);
        expect(overlayElement!.style.display).toBe('flex');
        expect(overlayElement!.style.justifyContent).toBe('center');
        expect(overlayElement!.style.alignItems).toBe('center');
        expect(overlayElement!.style.pointerEvents).toBe('none');

        const containerRect = handle.componentContainer!.getBoundingClientRect();
        expect(containerRect.left).toBe(390);
        expect(containerRect.right).toBe(890);
        expect(containerRect.top).toBe(110);
        expect(containerRect.bottom).toBe(610);
    });

    it('Should align an overlay with the top center of the viewport.', async () => {
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 500px; height: 500px"></div>,
            positionStrategy: fixedAlignmentStrategy({
                horizontalAlignment: 'center',
                verticalAlignment: 'start'
            })
        }));

        handle.attach();

        await waitToAnimationFrame();

        const overlayElement = handle.componentContainer!.parentElement;

        expect(overlayElement).toBeInstanceOf(HTMLDivElement);

        const overlayRect = overlayElement!.getBoundingClientRect();

        expect(overlayRect.left).toBe(0);
        expect(overlayRect.top).toBe(0);
        expect(overlayRect.right).toBe(1280);
        expect(overlayRect.bottom).toBe(720);
        expect(overlayElement!.style.display).toBe('flex');
        expect(overlayElement!.style.justifyContent).toBe('center');
        expect(overlayElement!.style.alignItems).toBe('flex-start');
        expect(overlayElement!.style.pointerEvents).toBe('none');

        const containerRect = handle.componentContainer!.getBoundingClientRect();
        expect(containerRect.left).toBe(390);
        expect(containerRect.right).toBe(890);
        expect(containerRect.top).toBe(0);
        expect(containerRect.bottom).toBe(500);
    });

    it('Should align an overlay with the bottom center of the viewport.', async () => {
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 500px; height: 500px"></div>,
            positionStrategy: fixedAlignmentStrategy({
                horizontalAlignment: 'center',
                verticalAlignment: 'end'
            })
        }));

        handle.attach();

        await waitToAnimationFrame();

        const overlayElement = handle.componentContainer!.parentElement;

        expect(overlayElement).toBeInstanceOf(HTMLDivElement);

        const overlayRect = overlayElement!.getBoundingClientRect();

        expect(overlayRect.left).toBe(0);
        expect(overlayRect.top).toBe(0);
        expect(overlayRect.right).toBe(1280);
        expect(overlayRect.bottom).toBe(720);
        expect(overlayElement!.style.display).toBe('flex');
        expect(overlayElement!.style.justifyContent).toBe('center');
        expect(overlayElement!.style.alignItems).toBe('flex-end');
        expect(overlayElement!.style.pointerEvents).toBe('none');

        const containerRect = handle.componentContainer!.getBoundingClientRect();
        expect(containerRect.left).toBe(390);
        expect(containerRect.right).toBe(890);
        expect(containerRect.top).toBe(220);
        expect(containerRect.bottom).toBe(720);
    });

    it('Should align an overlay with the center left of the viewport.', async () => {
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 500px; height: 500px"></div>,
            positionStrategy: fixedAlignmentStrategy({
                horizontalAlignment: 'start',
                verticalAlignment: 'center'
            })
        }));

        handle.attach();

        await waitToAnimationFrame();

        const overlayElement = handle.componentContainer!.parentElement;

        expect(overlayElement).toBeInstanceOf(HTMLDivElement);

        const overlayRect = overlayElement!.getBoundingClientRect();

        expect(overlayRect.left).toBe(0);
        expect(overlayRect.top).toBe(0);
        expect(overlayRect.right).toBe(1280);
        expect(overlayRect.bottom).toBe(720);
        expect(overlayElement!.style.display).toBe('flex');
        expect(overlayElement!.style.justifyContent).toBe('flex-start');
        expect(overlayElement!.style.alignItems).toBe('center');
        expect(overlayElement!.style.pointerEvents).toBe('none');

        const containerRect = handle.componentContainer!.getBoundingClientRect();
        expect(containerRect.left).toBe(0);
        expect(containerRect.right).toBe(500);
        expect(containerRect.top).toBe(110);
        expect(containerRect.bottom).toBe(610);
    });

    it('Should align an overlay with the center right of the viewport.', async () => {
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 500px; height: 500px"></div>,
            positionStrategy: fixedAlignmentStrategy({
                horizontalAlignment: 'end',
                verticalAlignment: 'center'
            })
        }));

        handle.attach();

        await waitToAnimationFrame();

        const overlayElement = handle.componentContainer!.parentElement;

        expect(overlayElement).toBeInstanceOf(HTMLDivElement);

        const overlayRect = overlayElement!.getBoundingClientRect();

        expect(overlayRect.left).toBe(0);
        expect(overlayRect.top).toBe(0);
        expect(overlayRect.right).toBe(1280);
        expect(overlayRect.bottom).toBe(720);
        expect(overlayElement!.style.display).toBe('flex');
        expect(overlayElement!.style.justifyContent).toBe('flex-end');
        expect(overlayElement!.style.alignItems).toBe('center');
        expect(overlayElement!.style.pointerEvents).toBe('none');

        const containerRect = handle.componentContainer!.getBoundingClientRect();
        expect(containerRect.left).toBe(780);
        expect(containerRect.right).toBe(1280);
        expect(containerRect.top).toBe(110);
        expect(containerRect.bottom).toBe(610);
    });

    it('Should align an overlay with the top left of the viewport.', async () => {
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 500px; height: 500px"></div>,
            positionStrategy: fixedAlignmentStrategy({
                horizontalAlignment: 'start',
                verticalAlignment: 'start'
            })
        }));

        handle.attach();

        await waitToAnimationFrame();

        const overlayElement = handle.componentContainer!.parentElement;

        expect(overlayElement).toBeInstanceOf(HTMLDivElement);

        const overlayRect = overlayElement!.getBoundingClientRect();

        expect(overlayRect.left).toBe(0);
        expect(overlayRect.top).toBe(0);
        expect(overlayRect.right).toBe(1280);
        expect(overlayRect.bottom).toBe(720);
        expect(overlayElement!.style.display).toBe('flex');
        expect(overlayElement!.style.justifyContent).toBe('flex-start');
        expect(overlayElement!.style.alignItems).toBe('flex-start');
        expect(overlayElement!.style.pointerEvents).toBe('none');

        const containerRect = handle.componentContainer!.getBoundingClientRect();
        expect(containerRect.left).toBe(0);
        expect(containerRect.right).toBe(500);
        expect(containerRect.top).toBe(0);
        expect(containerRect.bottom).toBe(500);
    });

    it('Should align an overlay with the top right of the viewport.', async () => {
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 500px; height: 500px"></div>,
            positionStrategy: fixedAlignmentStrategy({
                horizontalAlignment: 'end',
                verticalAlignment: 'start'
            })
        }));

        handle.attach();

        await waitToAnimationFrame();

        const overlayElement = handle.componentContainer!.parentElement;

        expect(overlayElement).toBeInstanceOf(HTMLDivElement);

        const overlayRect = overlayElement!.getBoundingClientRect();

        expect(overlayRect.left).toBe(0);
        expect(overlayRect.top).toBe(0);
        expect(overlayRect.right).toBe(1280);
        expect(overlayRect.bottom).toBe(720);
        expect(overlayElement!.style.display).toBe('flex');
        expect(overlayElement!.style.justifyContent).toBe('flex-end');
        expect(overlayElement!.style.alignItems).toBe('flex-start');
        expect(overlayElement!.style.pointerEvents).toBe('none');

        const containerRect = handle.componentContainer!.getBoundingClientRect();
        expect(containerRect.left).toBe(780);
        expect(containerRect.right).toBe(1280);
        expect(containerRect.top).toBe(0);
        expect(containerRect.bottom).toBe(500);
    });

    it('Should align an overlay with the bottom left of the viewport.', async () => {
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 500px; height: 500px"></div>,
            positionStrategy: fixedAlignmentStrategy({
                horizontalAlignment: 'start',
                verticalAlignment: 'end'
            })
        }));

        handle.attach();

        await waitToAnimationFrame();

        const overlayElement = handle.componentContainer!.parentElement;

        expect(overlayElement).toBeInstanceOf(HTMLDivElement);

        const overlayRect = overlayElement!.getBoundingClientRect();

        expect(overlayRect.left).toBe(0);
        expect(overlayRect.top).toBe(0);
        expect(overlayRect.right).toBe(1280);
        expect(overlayRect.bottom).toBe(720);
        expect(overlayElement!.style.display).toBe('flex');
        expect(overlayElement!.style.justifyContent).toBe('flex-start');
        expect(overlayElement!.style.alignItems).toBe('flex-end');
        expect(overlayElement!.style.pointerEvents).toBe('none');

        const containerRect = handle.componentContainer!.getBoundingClientRect();
        expect(containerRect.left).toBe(0);
        expect(containerRect.right).toBe(500);
        expect(containerRect.top).toBe(220);
        expect(containerRect.bottom).toBe(720);
    });

    it('Should align an overlay with the bottom right of the viewport.', async () => {
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 500px; height: 500px"></div>,
            positionStrategy: fixedAlignmentStrategy({
                horizontalAlignment: 'end',
                verticalAlignment: 'end'
            })
        }));

        handle.attach();

        await waitToAnimationFrame();

        const overlayElement = handle.componentContainer!.parentElement;

        expect(overlayElement).toBeInstanceOf(HTMLDivElement);

        const overlayRect = overlayElement!.getBoundingClientRect();

        expect(overlayRect.left).toBe(0);
        expect(overlayRect.top).toBe(0);
        expect(overlayRect.right).toBe(1280);
        expect(overlayRect.bottom).toBe(720);
        expect(overlayElement!.style.display).toBe('flex');
        expect(overlayElement!.style.justifyContent).toBe('flex-end');
        expect(overlayElement!.style.alignItems).toBe('flex-end');
        expect(overlayElement!.style.pointerEvents).toBe('none');

        const containerRect = handle.componentContainer!.getBoundingClientRect();
        expect(containerRect.left).toBe(780);
        expect(containerRect.right).toBe(1280);
        expect(containerRect.top).toBe(220);
        expect(containerRect.bottom).toBe(720);
    });

    it('Should align an overlay with the top center of the viewport, offset by the margin.', async () => {
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 500px; height: 500px"></div>,
            positionStrategy: fixedAlignmentStrategy({
                horizontalAlignment: 'center',
                verticalAlignment: 'start',
                margin: '18px 0 0 0'
            })
        }));

        handle.attach();

        await waitToAnimationFrame();

        const overlayElement = handle.componentContainer!.parentElement;

        expect(overlayElement).toBeInstanceOf(HTMLDivElement);

        const overlayRect = overlayElement!.getBoundingClientRect();

        expect(overlayRect.left).toBe(0);
        expect(overlayRect.top).toBe(0);
        expect(overlayRect.right).toBe(1280);
        expect(overlayRect.bottom).toBe(720);
        expect(overlayElement!.style.display).toBe('flex');
        expect(overlayElement!.style.justifyContent).toBe('center');
        expect(overlayElement!.style.alignItems).toBe('flex-start');
        expect(overlayElement!.style.pointerEvents).toBe('none');
        expect(handle.componentContainer!.style.margin).toBe('18px 0px 0px')

        const containerRect = handle.componentContainer!.getBoundingClientRect();
        expect(containerRect.left).toBe(390);
        expect(containerRect.right).toBe(890);
        expect(containerRect.top).toBe(18);
        expect(containerRect.bottom).toBe(518);
    });

    it('Should align an overlay with the bottom center of the viewport, offset by the margin.', async () => {
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 500px; height: 500px"></div>,
            positionStrategy: fixedAlignmentStrategy({
                horizontalAlignment: 'center',
                verticalAlignment: 'end',
                margin: '0 0 14px 0'
            })
        }));

        handle.attach();

        await waitToAnimationFrame();

        const overlayElement = handle.componentContainer!.parentElement;

        expect(overlayElement).toBeInstanceOf(HTMLDivElement);

        const overlayRect = overlayElement!.getBoundingClientRect();

        expect(overlayRect.left).toBe(0);
        expect(overlayRect.top).toBe(0);
        expect(overlayRect.right).toBe(1280);
        expect(overlayRect.bottom).toBe(720);
        expect(overlayElement!.style.display).toBe('flex');
        expect(overlayElement!.style.justifyContent).toBe('center');
        expect(overlayElement!.style.alignItems).toBe('flex-end');
        expect(overlayElement!.style.pointerEvents).toBe('none');
        expect(handle.componentContainer!.style.margin).toBe('0px 0px 14px')

        const containerRect = handle.componentContainer!.getBoundingClientRect();
        expect(containerRect.left).toBe(390);
        expect(containerRect.right).toBe(890);
        expect(containerRect.top).toBe(206);
        expect(containerRect.bottom).toBe(706);
    });

    it('Should align an overlay with the center left of the viewport, offset by the margin.', async () => {
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 500px; height: 500px"></div>,
            positionStrategy: fixedAlignmentStrategy({
                horizontalAlignment: 'start',
                verticalAlignment: 'center',
                margin: '0 0 0 22px'
            })
        }));

        handle.attach();

        await waitToAnimationFrame();

        const overlayElement = handle.componentContainer!.parentElement;

        expect(overlayElement).toBeInstanceOf(HTMLDivElement);

        const overlayRect = overlayElement!.getBoundingClientRect();

        expect(overlayRect.left).toBe(0);
        expect(overlayRect.top).toBe(0);
        expect(overlayRect.right).toBe(1280);
        expect(overlayRect.bottom).toBe(720);
        expect(overlayElement!.style.display).toBe('flex');
        expect(overlayElement!.style.justifyContent).toBe('flex-start');
        expect(overlayElement!.style.alignItems).toBe('center');
        expect(overlayElement!.style.pointerEvents).toBe('none');
        expect(handle.componentContainer!.style.margin).toBe('0px 0px 0px 22px')

        const containerRect = handle.componentContainer!.getBoundingClientRect();
        expect(containerRect.left).toBe(22);
        expect(containerRect.right).toBe(522);
        expect(containerRect.top).toBe(110);
        expect(containerRect.bottom).toBe(610);
    });

    it('Should align an overlay with the center right of the viewport, offset by the margin.', async () => {
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 500px; height: 500px"></div>,
            positionStrategy: fixedAlignmentStrategy({
                horizontalAlignment: 'end',
                verticalAlignment: 'center',
                margin: '0 15px 0 0'
            })
        }));

        handle.attach();

        await waitToAnimationFrame();

        const overlayElement = handle.componentContainer!.parentElement;

        expect(overlayElement).toBeInstanceOf(HTMLDivElement);

        const overlayRect = overlayElement!.getBoundingClientRect();

        expect(overlayRect.left).toBe(0);
        expect(overlayRect.top).toBe(0);
        expect(overlayRect.right).toBe(1280);
        expect(overlayRect.bottom).toBe(720);
        expect(overlayElement!.style.display).toBe('flex');
        expect(overlayElement!.style.justifyContent).toBe('flex-end');
        expect(overlayElement!.style.alignItems).toBe('center');
        expect(overlayElement!.style.pointerEvents).toBe('none');
        expect(handle.componentContainer!.style.margin).toBe('0px 15px 0px 0px')

        const containerRect = handle.componentContainer!.getBoundingClientRect();
        expect(containerRect.left).toBe(765);
        expect(containerRect.right).toBe(1265);
        expect(containerRect.top).toBe(110);
        expect(containerRect.bottom).toBe(610);
    });

    it('Should align an overlay with the top left of the viewport, offset by the margin.', async () => {
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 500px; height: 500px"></div>,
            positionStrategy: fixedAlignmentStrategy({
                horizontalAlignment: 'start',
                verticalAlignment: 'start',
                margin: '11px 0 0 17px'
            })
        }));

        handle.attach();

        await waitToAnimationFrame();

        const overlayElement = handle.componentContainer!.parentElement;

        expect(overlayElement).toBeInstanceOf(HTMLDivElement);

        const overlayRect = overlayElement!.getBoundingClientRect();

        expect(overlayRect.left).toBe(0);
        expect(overlayRect.top).toBe(0);
        expect(overlayRect.right).toBe(1280);
        expect(overlayRect.bottom).toBe(720);
        expect(overlayElement!.style.display).toBe('flex');
        expect(overlayElement!.style.justifyContent).toBe('flex-start');
        expect(overlayElement!.style.alignItems).toBe('flex-start');
        expect(overlayElement!.style.pointerEvents).toBe('none');
        expect(handle.componentContainer!.style.margin).toBe('11px 0px 0px 17px')

        const containerRect = handle.componentContainer!.getBoundingClientRect();
        expect(containerRect.left).toBe(17);
        expect(containerRect.right).toBe(517);
        expect(containerRect.top).toBe(11);
        expect(containerRect.bottom).toBe(511);
    });

    it('Should align an overlay with the top right of the viewport, offset by the margin.', async () => {
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 500px; height: 500px"></div>,
            positionStrategy: fixedAlignmentStrategy({
                horizontalAlignment: 'end',
                verticalAlignment: 'start',
                margin: '13px 21px 0 0'
            })
        }));

        handle.attach();

        await waitToAnimationFrame();

        const overlayElement = handle.componentContainer!.parentElement;

        expect(overlayElement).toBeInstanceOf(HTMLDivElement);

        const overlayRect = overlayElement!.getBoundingClientRect();

        expect(overlayRect.left).toBe(0);
        expect(overlayRect.top).toBe(0);
        expect(overlayRect.right).toBe(1280);
        expect(overlayRect.bottom).toBe(720);
        expect(overlayElement!.style.display).toBe('flex');
        expect(overlayElement!.style.justifyContent).toBe('flex-end');
        expect(overlayElement!.style.alignItems).toBe('flex-start');
        expect(overlayElement!.style.pointerEvents).toBe('none');
        expect(handle.componentContainer!.style.margin).toBe('13px 21px 0px 0px')

        const containerRect = handle.componentContainer!.getBoundingClientRect();
        expect(containerRect.left).toBe(759);
        expect(containerRect.right).toBe(1259);
        expect(containerRect.top).toBe(13);
        expect(containerRect.bottom).toBe(513);
    });

    it('Should align an overlay with the bottom left of the viewport, offset by the margin.', async () => {
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 500px; height: 500px"></div>,
            positionStrategy: fixedAlignmentStrategy({
                horizontalAlignment: 'start',
                verticalAlignment: 'end',
                margin: '0 0 32px 27px'
            })
        }));

        handle.attach();

        await waitToAnimationFrame();

        const overlayElement = handle.componentContainer!.parentElement;

        expect(overlayElement).toBeInstanceOf(HTMLDivElement);

        const overlayRect = overlayElement!.getBoundingClientRect();

        expect(overlayRect.left).toBe(0);
        expect(overlayRect.top).toBe(0);
        expect(overlayRect.right).toBe(1280);
        expect(overlayRect.bottom).toBe(720);
        expect(overlayElement!.style.display).toBe('flex');
        expect(overlayElement!.style.justifyContent).toBe('flex-start');
        expect(overlayElement!.style.alignItems).toBe('flex-end');
        expect(overlayElement!.style.pointerEvents).toBe('none');
        expect(handle.componentContainer!.style.margin).toBe('0px 0px 32px 27px')

        const containerRect = handle.componentContainer!.getBoundingClientRect();
        expect(containerRect.left).toBe(27);
        expect(containerRect.right).toBe(527);
        expect(containerRect.top).toBe(188);
        expect(containerRect.bottom).toBe(688);
    });

    it('Should align an overlay with the bottom right of the viewport, offset by the margin.', async () => {
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 500px; height: 500px"></div>,
            positionStrategy: fixedAlignmentStrategy({
                horizontalAlignment: 'end',
                verticalAlignment: 'end',
                margin: '0 24px 13px 0'
            })
        }));

        handle.attach();

        await waitToAnimationFrame();

        const overlayElement = handle.componentContainer!.parentElement;

        expect(overlayElement).toBeInstanceOf(HTMLDivElement);

        const overlayRect = overlayElement!.getBoundingClientRect();

        expect(overlayRect.left).toBe(0);
        expect(overlayRect.top).toBe(0);
        expect(overlayRect.right).toBe(1280);
        expect(overlayRect.bottom).toBe(720);
        expect(overlayElement!.style.display).toBe('flex');
        expect(overlayElement!.style.justifyContent).toBe('flex-end');
        expect(overlayElement!.style.alignItems).toBe('flex-end');
        expect(overlayElement!.style.pointerEvents).toBe('none');
        expect(handle.componentContainer!.style.margin).toBe('0px 24px 13px 0px');

        const containerRect = handle.componentContainer!.getBoundingClientRect();
        expect(containerRect.left).toBe(756);
        expect(containerRect.right).toBe(1256);
        expect(containerRect.top).toBe(207);
        expect(containerRect.bottom).toBe(707);
    });

    it('Should throw an error when the horizontalAlignment property is change to invalid value.', async () => {
        using flush = installMocQueueMicrotask();
        const errorMessage = 'fixedAlignmentStrategy({ horizontalAlignment }): Invalid argument! Expected an object with a "horizontalAlignment" property set to one of ["start", "center", "end"].'
        const [getHorizontalAlignment, setHorizontalAlignment] = createSignal<any>('start')
        const config: FixedAlignmentStrategyConfig = {
            get horizontalAlignment(): 'start' | 'center' | 'end' {
                return getHorizontalAlignment()
            },
            verticalAlignment: 'start'
        }
        const handle = inRoot(() => createOverlay({
            component: () => <></>,
            positionStrategy: fixedAlignmentStrategy(config)
        }));

        handle.attach();
        await waitToAnimationFrame();
        
        setHorizontalAlignment(0);
        expect(flush.microtaskCount).toBe(1);
        expect(() => flush()).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);
        expect(() => setHorizontalAlignment(1)).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);
        expect(() => setHorizontalAlignment('')).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);
        expect(() => setHorizontalAlignment('A')).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);
        expect(() => setHorizontalAlignment(true)).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);
        expect(() => setHorizontalAlignment(false)).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);
        expect(() => setHorizontalAlignment(undefined)).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);
        expect(() => setHorizontalAlignment(null)).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);
        expect(() => setHorizontalAlignment({})).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);
        expect(() => setHorizontalAlignment([])).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);
        expect(() => setHorizontalAlignment(() => (() => {}))).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);

        expect(() => setHorizontalAlignment('center')).not.toThrow();
        expect(flush.microtaskCount).toBe(0);
        setHorizontalAlignment('end');
        expect(flush.microtaskCount).toBe(1);
        expect(() => flush()).not.toThrow();
        setHorizontalAlignment('start');
        expect(flush.microtaskCount).toBe(1);
        expect(() => flush()).not.toThrow();
    });

    it('Should throw an error when the verticalAlignment property is change to invalid value.', async () => {
        using flush = installMocQueueMicrotask();
        const errorMessage = 'fixedAlignmentStrategy({ verticalAlignment }): Invalid argument! Expected an object with a "verticalAlignment" property set to one of ["start", "center", "end"].'
        const [getVerticalAlignment, setVerticalAlignment] = createSignal<any>('start')
        const config: FixedAlignmentStrategyConfig = {
            get verticalAlignment(): 'start' | 'center' | 'end' {
                return getVerticalAlignment()
            },
            horizontalAlignment: 'start'
        }
        const handle = inRoot(() => createOverlay({
            component: () => <></>,
            positionStrategy: fixedAlignmentStrategy(config)
        }));

        handle.attach();
        await waitToAnimationFrame();
        
        setVerticalAlignment(0);
        expect(flush.microtaskCount).toBe(1);
        expect(() => flush()).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);
        expect(() => setVerticalAlignment(1)).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);
        expect(() => setVerticalAlignment('')).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);
        expect(() => setVerticalAlignment('A')).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);
        expect(() => setVerticalAlignment(true)).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);
        expect(() => setVerticalAlignment(false)).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);
        expect(() => setVerticalAlignment(undefined)).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);
        expect(() => setVerticalAlignment(null)).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);
        expect(() => setVerticalAlignment({})).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);
        expect(() => setVerticalAlignment([])).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);
        expect(() => setVerticalAlignment(() => (() => {}))).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);

        expect(() => setVerticalAlignment('center')).not.toThrow();
        expect(flush.microtaskCount).toBe(0);
        setVerticalAlignment('end');
        expect(flush.microtaskCount).toBe(1);
        expect(() => flush()).not.toThrow();
        setVerticalAlignment('start');
        expect(flush.microtaskCount).toBe(1);
        expect(() => flush()).not.toThrow();
    });

    it('Should throw an error when the margin property is changed to invalid value (no optional string).', async () => {
        using flush = installMocQueueMicrotask();
        const errorMessage = 'fixedAlignmentStrategy({ margin }): Invalid argument! Expected am object with "margin" property of type string or without it.';
        const [getMargin, setMargin] = createSignal<any>('');
        const config: FixedAlignmentStrategyConfig = {
            horizontalAlignment: 'start',
            verticalAlignment: 'start',
            get margin(): string {
                return getMargin();
            }
        }
        const handle = inRoot(() => createOverlay({
            component: () => <></>,
            positionStrategy: fixedAlignmentStrategy(config)
        }))
        
        handle.attach();
        await waitToAnimationFrame();

        setMargin(0)
        expect(flush.microtaskCount).toBe(1);
        expect(() => flush()).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);
        expect(() => setMargin(1)).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);
        expect(() => setMargin(true)).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);
        expect(() => setMargin(false)).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);
        expect(() => setMargin({})).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);
        expect(() => setMargin([])).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);
        expect(() => setMargin((() => (() => {})))).toThrow(errorMessage);
        expect(flush.microtaskCount).toBe(0);
        expect(() => setMargin(undefined)).not.toThrow();
        setMargin(null);
        expect(flush.microtaskCount).toBe(1);
        expect(() => flush()).not.toThrow();
        setMargin('');
        expect(flush.microtaskCount).toBe(1);
        expect(() => flush()).not.toThrow();
        setMargin('A');
        expect(flush.microtaskCount).toBe(1);
        expect(() => flush()).not.toThrow();
    });
});

describe('fixedCoordinateStrategy()', () => {

    it('Should throw an error if used in a server environment.', () => {
        using spy = vitest.spyOn((globalThis as any), '__IS_SERVER__', 'get').mockReturnValue(true);
        const errorMessage = 'fixedCoordinateStrategy(): This function is not available in a server environment!';
        expect(() => fixedCoordinateStrategy({ x: 0, y: 0 })).toThrow(errorMessage);
    });

    it('Should throw an error if the provided argument is not an non-array object.', () => {
        const errorMessage = 'fixedCoordinateStrategy(): Invalid argument! Expected am non-array object.';

        expect(() => fixedCoordinateStrategy(0 as any)).toThrow(errorMessage);
        expect(() => fixedCoordinateStrategy(1 as any)).toThrow(errorMessage);
        expect(() => fixedCoordinateStrategy('' as any)).toThrow(errorMessage);
        expect(() => fixedCoordinateStrategy('A' as any)).toThrow(errorMessage);
        expect(() => fixedCoordinateStrategy(true as any)).toThrow(errorMessage);
        expect(() => fixedCoordinateStrategy(false as any)).toThrow(errorMessage);
        expect(() => fixedCoordinateStrategy(undefined as any)).toThrow(errorMessage);
        expect(() => fixedCoordinateStrategy(null as any)).toThrow(errorMessage);
        expect(() => fixedCoordinateStrategy((() => {}) as any)).toThrow(errorMessage);
    });

    it('Should throw an error if provided argument does not contain the x property.', () => {
        const errorMessage = 'fixedCoordinateStrategy({ x }): Invalid argument! Expected am object with "x" property of type number.';
        
        expect(() => fixedCoordinateStrategy({ y: 0 } as any)).toThrow(errorMessage);
    });

    it('Should throw an error if provided argument does not contain the y property.', () => {
        const errorMessage = 'fixedCoordinateStrategy({ y }): Invalid argument! Expected am object with "y" property of type number.';
        
        expect(() => fixedCoordinateStrategy({ x: 0 } as any)).toThrow(errorMessage);
    });

    it('Should throw an error if the x property is not a number.', () => {
        const errorMessage1 = 'fixedCoordinateStrategy({ x }): Invalid argument! Expected am object with "x" property of type number.';
        const errorMessage2 = 'fixedCoordinateStrategy({ x }): Invalid argument! NaN is not supported.';

        expect(() => fixedCoordinateStrategy({ x: '' as any, y: 0 })).toThrow(errorMessage1);
        expect(() => fixedCoordinateStrategy({ x: 'A' as any, y: 0 })).toThrow(errorMessage1);
        expect(() => fixedCoordinateStrategy({ x: true as any, y: 0 })).toThrow(errorMessage1);
        expect(() => fixedCoordinateStrategy({ x: false as any, y: 0 })).toThrow(errorMessage1);
        expect(() => fixedCoordinateStrategy({ x: undefined as any, y: 0 })).toThrow(errorMessage1);
        expect(() => fixedCoordinateStrategy({ x: null as any, y: 0 })).toThrow(errorMessage1);
        expect(() => fixedCoordinateStrategy({ x: {} as any, y: 0 })).toThrow(errorMessage1);
        expect(() => fixedCoordinateStrategy({ x: [] as any, y: 0 })).toThrow(errorMessage1);
        expect(() => fixedCoordinateStrategy({ x: (() => {}) as any, y: 0 })).toThrow(errorMessage1);
        expect(() => fixedCoordinateStrategy({ x: NaN, y: 0 })).toThrow(errorMessage2);

        expect(() => fixedCoordinateStrategy({ x: 0, y: 0 })).not.toThrow();
        expect(() => fixedCoordinateStrategy({ x: 1, y: 0 })).not.toThrow();
    });

    it('Should throw an error if the y property is not a number.', () => {
        const errorMessage1 = 'fixedCoordinateStrategy({ y }): Invalid argument! Expected am object with "y" property of type number.';
        const errorMessage2 = 'fixedCoordinateStrategy({ y }): Invalid argument! NaN is not supported.';

        expect(() => fixedCoordinateStrategy({ y: '' as any, x: 0 })).toThrow(errorMessage1);
        expect(() => fixedCoordinateStrategy({ y: 'A' as any, x: 0 })).toThrow(errorMessage1);
        expect(() => fixedCoordinateStrategy({ y: true as any, x: 0 })).toThrow(errorMessage1);
        expect(() => fixedCoordinateStrategy({ y: false as any, x: 0 })).toThrow(errorMessage1);
        expect(() => fixedCoordinateStrategy({ y: undefined as any, x: 0 })).toThrow(errorMessage1);
        expect(() => fixedCoordinateStrategy({ y: null as any, x: 0 })).toThrow(errorMessage1);
        expect(() => fixedCoordinateStrategy({ y: {} as any, x: 0 })).toThrow(errorMessage1);
        expect(() => fixedCoordinateStrategy({ y: [] as any, x: 0 })).toThrow(errorMessage1);
        expect(() => fixedCoordinateStrategy({ y: (() => {}) as any, x: 0 })).toThrow(errorMessage1);
        expect(() => fixedCoordinateStrategy({ y: NaN, x: 0 })).toThrow(errorMessage2);

        expect(() => fixedCoordinateStrategy({ y: 0, x: 0 })).not.toThrow();
        expect(() => fixedCoordinateStrategy({ y: 1, x: 0 })).not.toThrow();
    });

    it('Should throw an error if the optional selectedCornerSetter property is not a function.', () => {
        const errorMessage = 'fixedCoordinateStrategy(): Invalid argument! Expected am object with "onCornerSelected" property of type function or without it.';
        
        expect(() => fixedCoordinateStrategy({ x:0, y:0, onCornerSelected: 0 as any })).toThrow(errorMessage);
        expect(() => fixedCoordinateStrategy({ x:0, y:0, onCornerSelected: 1 as any })).toThrow(errorMessage);
        expect(() => fixedCoordinateStrategy({ x:0, y:0, onCornerSelected: '' as any })).toThrow(errorMessage);
        expect(() => fixedCoordinateStrategy({ x:0, y:0, onCornerSelected: 'A' as any })).toThrow(errorMessage);
        expect(() => fixedCoordinateStrategy({ x:0, y:0, onCornerSelected: true as any })).toThrow(errorMessage);
        expect(() => fixedCoordinateStrategy({ x:0, y:0, onCornerSelected: false as any })).toThrow(errorMessage);
        expect(() => fixedCoordinateStrategy({ x:0, y:0, onCornerSelected: {} as any })).toThrow(errorMessage);
        expect(() => fixedCoordinateStrategy({ x:0, y:0, onCornerSelected: [] as any })).toThrow(errorMessage);
        
        expect(() => fixedCoordinateStrategy({ x:0, y:0, onCornerSelected: undefined })).not.toThrow();
        expect(() => fixedCoordinateStrategy({ x:0, y:0, onCornerSelected: null as any })).not.toThrow();
        expect(() => fixedCoordinateStrategy({ x:0, y:0, onCornerSelected: () => {} })).not.toThrow();
    });

    it('Should throw an error if the optional autoAdjustCorner property is not a boolean.', () => {
        const errorMessage = 'fixedCoordinateStrategy({ autoAdjustCorner }): Invalid argument! Expected am object with "autoAdjustCorner" property of type boolean or without it.';

        expect(() => fixedCoordinateStrategy({ x: 0, y: 0, autoAdjustCorner: 0 as any })).toThrow(errorMessage);
        expect(() => fixedCoordinateStrategy({ x: 0, y: 0, autoAdjustCorner: 1 as any })).toThrow(errorMessage);
        expect(() => fixedCoordinateStrategy({ x: 0, y: 0, autoAdjustCorner: '' as any })).toThrow(errorMessage);
        expect(() => fixedCoordinateStrategy({ x: 0, y: 0, autoAdjustCorner: 'A' as any })).toThrow(errorMessage);
        expect(() => fixedCoordinateStrategy({ x: 0, y: 0, autoAdjustCorner: {} as any })).toThrow(errorMessage);
        expect(() => fixedCoordinateStrategy({ x: 0, y: 0, autoAdjustCorner: [] as any })).toThrow(errorMessage);
        expect(() => fixedCoordinateStrategy({ x: 0, y: 0, autoAdjustCorner: (() => {}) as any })).toThrow(errorMessage);

        expect(() => fixedCoordinateStrategy({ x: 0, y: 0, autoAdjustCorner: null as any })).not.toThrow();
        expect(() => fixedCoordinateStrategy({ x: 0, y: 0, autoAdjustCorner: undefined })).not.toThrow();
        expect(() => fixedCoordinateStrategy({ x: 0, y: 0, autoAdjustCorner: true })).not.toThrow();
        expect(() => fixedCoordinateStrategy({ x: 0, y: 0, autoAdjustCorner: false })).not.toThrow();
    })

    it('Should use the top-left corner as the default origin.', async () => {
        let selectedCorner: string = '';
        const config: FixedCoordinateStrategyConfig = {
            x: 540,
            y: 260,
            onCornerSelected(corner) {
                selectedCorner = corner;
            },
        }
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: fixedCoordinateStrategy(config)
        }));

        handle.attach();

        await waitToAnimationFrame();

        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(540);
        expect(rect.top).toBe(260);
        expect(rect.bottom).toBe(460);
        expect(rect.right).toBe(740);
        expect(selectedCorner).toBe('top-left');

        handle.detach();
        await waitToAnimationFrame();
        config.x = 100;
        config.y = 100;
        handle.attach();
        await waitToAnimationFrame();

        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(100);
        expect(rect.top).toBe(100);
        expect(rect.bottom).toBe(300);
        expect(rect.right).toBe(300);
        expect(selectedCorner).toBe('top-left');

        handle.detach();
        await waitToAnimationFrame();
        config.x = 1180;
        config.y = 100;
        handle.attach();
        await waitToAnimationFrame();

        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(100);
        expect(rect.bottom).toBe(300);
        expect(rect.right).toBe(1380);
        expect(selectedCorner).toBe('top-left');

        handle.detach();
        await waitToAnimationFrame();
        config.x = 100;
        config.y = 620;
        handle.attach();
        await waitToAnimationFrame();

        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(100);
        expect(rect.top).toBe(620);
        expect(rect.bottom).toBe(820);
        expect(rect.right).toBe(300);
        expect(selectedCorner).toBe('top-left');

        handle.detach();
        await waitToAnimationFrame();
        config.x = 1180;
        config.y = 620;
        handle.attach();
        await waitToAnimationFrame();

        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(620);
        expect(rect.bottom).toBe(820);
        expect(rect.right).toBe(1380);
        expect(selectedCorner).toBe('top-left');
    });

    it('Should use the top-left corner as the origin if the autoAdjustCorner property is set to false.', async () => {
        let selectedCorner: string = '';
        const config: FixedCoordinateStrategyConfig = {
            x: 540,
            y: 260,
            onCornerSelected(corner) {
                selectedCorner = corner;
            },
            autoAdjustCorner: false
        }
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: fixedCoordinateStrategy(config)
        }));

        handle.attach();

        await waitToAnimationFrame();

        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(540);
        expect(rect.top).toBe(260);
        expect(rect.bottom).toBe(460);
        expect(rect.right).toBe(740);
        expect(selectedCorner).toBe('top-left');

        handle.detach();
        await waitToAnimationFrame();
        config.x = 100;
        config.y = 100;
        handle.attach();
        await waitToAnimationFrame();

        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(100);
        expect(rect.top).toBe(100);
        expect(rect.bottom).toBe(300);
        expect(rect.right).toBe(300);
        expect(selectedCorner).toBe('top-left');

        handle.detach();
        await waitToAnimationFrame();
        config.x = 1180;
        config.y = 100;
        handle.attach();
        await waitToAnimationFrame();

        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(100);
        expect(rect.bottom).toBe(300);
        expect(rect.right).toBe(1380);
        expect(selectedCorner).toBe('top-left');

        handle.detach();
        await waitToAnimationFrame();
        config.x = 100;
        config.y = 620;
        handle.attach();
        await waitToAnimationFrame();

        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(100);
        expect(rect.top).toBe(620);
        expect(rect.bottom).toBe(820);
        expect(rect.right).toBe(300);
        expect(selectedCorner).toBe('top-left');

        handle.detach();
        await waitToAnimationFrame();
        config.x = 1180;
        config.y = 620;
        handle.attach();
        await waitToAnimationFrame();

        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(620);
        expect(rect.bottom).toBe(820);
        expect(rect.right).toBe(1380);
        expect(selectedCorner).toBe('top-left');
    });

    it('Should select the corner as the origin that positions the overlay within the viewport if the autoAdjustCorner property is set to true.', async () => {
        let selectedCorner: string = '';
        const config: FixedCoordinateStrategyConfig = {
            x: 540,
            y: 260,
            onCornerSelected(corner) {
                selectedCorner = corner;
            },
            autoAdjustCorner: true
        }
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: fixedCoordinateStrategy(config)
        }));

        handle.attach();

        await waitToAnimationFrame();

        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(540);
        expect(rect.top).toBe(260);
        expect(rect.bottom).toBe(460);
        expect(rect.right).toBe(740);
        expect(selectedCorner).toBe('top-left');

        handle.detach();
        await waitToAnimationFrame();
        config.x = 100;
        config.y = 100;
        handle.attach();
        await waitToAnimationFrame();

        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(100);
        expect(rect.top).toBe(100);
        expect(rect.bottom).toBe(300);
        expect(rect.right).toBe(300);
        expect(selectedCorner).toBe('top-left');

        handle.detach();
        await waitToAnimationFrame();
        config.x = 1180;
        config.y = 100;
        handle.attach();
        await waitToAnimationFrame();

        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(980);
        expect(rect.top).toBe(100);
        expect(rect.bottom).toBe(300);
        expect(rect.right).toBe(1180);
        expect(selectedCorner).toBe('top-right');

        handle.detach();
        await waitToAnimationFrame();
        config.x = 100;
        config.y = 620;
        handle.attach();
        await waitToAnimationFrame();

        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(100);
        expect(rect.top).toBe(420);
        expect(rect.bottom).toBe(620);
        expect(rect.right).toBe(300);
        expect(selectedCorner).toBe('bottom-left');

        handle.detach();
        await waitToAnimationFrame();
        config.x = 1180;
        config.y = 620;
        handle.attach();
        await waitToAnimationFrame();

        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(980);
        expect(rect.top).toBe(420);
        expect(rect.bottom).toBe(620);
        expect(rect.right).toBe(1180);
        expect(selectedCorner).toBe('bottom-right');
    });

    it('Should coerce the coordinate to the viewport boundaries if the autoAdjustCorner property is set to true.', async () => {
        const config: FixedCoordinateStrategyConfig = {
            x: -50,
            y: -50,
            autoAdjustCorner: true
        }
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: fixedCoordinateStrategy(config)
        }));

        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.top).toBe(0);
        expect(rect.left).toBe(0);
        expect(rect.bottom).toBe(200);
        expect(rect.right).toBe(200);

        handle.detach();
        config.x = 1330;
        config.y = -50;
        handle.attach();
        await waitToAnimationFrame()
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.top).toBe(0);
        expect(rect.left).toBe(1080);
        expect(rect.bottom).toBe(200);
        expect(rect.right).toBe(1280);

        handle.detach();
        config.x = -50;
        config.y = 780;
        handle.attach();
        await waitToAnimationFrame()
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.top).toBe(520);
        expect(rect.left).toBe(0);
        expect(rect.bottom).toBe(720);
        expect(rect.right).toBe(200);

        handle.detach();
        config.x = 1330;
        config.y = 780;
        handle.attach();
        await waitToAnimationFrame()
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.top).toBe(520);
        expect(rect.left).toBe(1080);
        expect(rect.bottom).toBe(720);
        expect(rect.right).toBe(1280);
    });

    it('Should throw an error when the x property is change to invalid value.', async () => {
        const errorMessage1 = 'fixedCoordinateStrategy({ x }): Invalid argument! Expected am object with "x" property of type number.';
        const errorMessage2 = 'fixedCoordinateStrategy({ x }): Invalid argument! NaN is not supported.'
        using flush = installMockRequestAnimationFrame();
        const [getX, setX] = createSignal<any>(0);
        const config: FixedCoordinateStrategyConfig = {
            get x(): number {
                return getX()
            },
            y: 0
        };
        const handle = inRoot(() => createOverlay({
            component: () => <></>,
            positionStrategy: fixedCoordinateStrategy(config)
        }));

        handle.attach();

        await waitToAnimationFrame(flush);

        setX('');
        expect(flush.callbacksCount).toBe(1);
        expect(() => flush()).toThrow(errorMessage1);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setX('A')).toThrow(errorMessage1);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setX(true)).toThrow(errorMessage1);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setX(false)).toThrow(errorMessage1);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setX(undefined)).toThrow(errorMessage1);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setX(null)).toThrow(errorMessage1);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setX({})).toThrow(errorMessage1);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setX([])).toThrow(errorMessage1);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setX(() => {})).toThrow(errorMessage1);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setX((NaN))).toThrow(errorMessage2);
        expect(flush.callbacksCount).toBe(0);

        expect(() => setX(0)).not.toThrow();
        expect(flush.callbacksCount).toBe(0);

        setX(1);
        expect(flush.callbacksCount).toBe(1);
        expect(() => flush()).not.toThrow();

    });

    it('Should throw an error when the y property is change to invalid value.', async () => {
        const errorMessage1 = 'fixedCoordinateStrategy({ y }): Invalid argument! Expected am object with "y" property of type number.';
        const errorMessage2 = 'fixedCoordinateStrategy({ y }): Invalid argument! NaN is not supported.'
        using flush = installMockRequestAnimationFrame();
        const [getY, setY] = createSignal<any>(0);
        const config: FixedCoordinateStrategyConfig = {
            get y(): number {
                return getY()
            },
            x: 0
        };
        const handle = inRoot(() => createOverlay({
            component: () => <></>,
            positionStrategy: fixedCoordinateStrategy(config)
        }));

        handle.attach();

        await waitToAnimationFrame(flush);

        setY('');
        expect(flush.callbacksCount).toBe(1);
        expect(() => flush()).toThrow(errorMessage1);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setY('A')).toThrow(errorMessage1);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setY(true)).toThrow(errorMessage1);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setY(false)).toThrow(errorMessage1);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setY(undefined)).toThrow(errorMessage1);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setY(null)).toThrow(errorMessage1);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setY({})).toThrow(errorMessage1);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setY([])).toThrow(errorMessage1);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setY(() => {})).toThrow(errorMessage1);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setY((NaN))).toThrow(errorMessage2);
        expect(flush.callbacksCount).toBe(0);

        expect(() => setY(0)).not.toThrow();
        expect(flush.callbacksCount).toBe(0);

        setY(1);
        expect(flush.callbacksCount).toBe(1);
        expect(() => flush()).not.toThrow();
    });

    it('Should throw an error when the autoAdjustCorner property is change to invalid value.', async () => {
        const errorMessage = 'fixedCoordinateStrategy({ autoAdjustCorner }): Invalid argument! Expected am object with "autoAdjustCorner" property of type boolean or without it.';
        using flush = installMockRequestAnimationFrame();
        const [getAutoAdjustCorner, setAutoAdjustCorner] = createSignal<any>(false);
        const config: FixedCoordinateStrategyConfig = {
            x: 0,
            y: 0,
            get autoAdjustCorner(): boolean {
                return getAutoAdjustCorner();
            }
        }

        const handle = inRoot(() => createOverlay({
            component: () => <></>,
            positionStrategy: fixedCoordinateStrategy(config)
        }));

        handle.attach();

        await waitToAnimationFrame(flush);

        setAutoAdjustCorner(0);
        expect(flush.callbacksCount).toBe(1);
        expect(() => flush()).toThrow(errorMessage);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setAutoAdjustCorner(1)).toThrow(errorMessage);;
        expect(flush.callbacksCount).toBe(0);
        expect(() => setAutoAdjustCorner('')).toThrow(errorMessage);;
        expect(flush.callbacksCount).toBe(0);
        expect(() => setAutoAdjustCorner('A')).toThrow(errorMessage);;
        expect(flush.callbacksCount).toBe(0);
        expect(() => setAutoAdjustCorner({})).toThrow(errorMessage);;
        expect(flush.callbacksCount).toBe(0);
        expect(() => setAutoAdjustCorner([])).toThrow(errorMessage);;
        expect(flush.callbacksCount).toBe(0);
        expect(() => setAutoAdjustCorner(() => (() => {}))).toThrow(errorMessage);;
        expect(flush.callbacksCount).toBe(0);

        expect(() => setAutoAdjustCorner(true)).not.toThrow();
        expect(flush.callbacksCount).toBe(0);
        setAutoAdjustCorner(false);
        expect(flush.callbacksCount).toBe(1);
        expect(() => flush()).not.toThrow();
        setAutoAdjustCorner(null);
        expect(flush.callbacksCount).toBe(1);
        expect(() => flush()).not.toThrow();
        setAutoAdjustCorner(undefined);
        expect(flush.callbacksCount).toBe(1);
        expect(() => flush()).not.toThrow();
    });

});

describe('connectedEdgesPositionStrategy()', () => {

    let targetElement: HTMLDivElement;

    function centralizeTargetElement(): void {
        targetElement.style.left = '615px';
        targetElement.style.top = '335px';
    }

    function setTargetElementPosition(left: number, top: number): void {
        targetElement.style.left = `${left}px`;
        targetElement.style.top = `${top}px`;
    }

    beforeEach(() => {
        targetElement = document.body.appendChild(document.createElement('div'));
        targetElement.style.position = 'absolute';
        targetElement.style.width = '50px';
        targetElement.style.height = '50px';
        centralizeTargetElement();
    });

    it('Should throw an error if used in a server environment.', () => {
        using spy = vitest.spyOn((globalThis as any), '__IS_SERVER__', 'get').mockReturnValue(true);
        const errorMessage = 'connectedEdgesPositionStrategy(): This function is not available in a server environment!';
        expect(() => connectedEdgesPositionStrategy({ targetGetter: () => targetElement, connections: [] as any })).toThrow(errorMessage);
    });

    it('Should throw an error if provided argument is not an non-array object.', () => {
        const errorMessage = 'connectedEdgesPositionStrategy(): Invalid argument! Expected an non-array object.';

        expect(() => connectedEdgesPositionStrategy(0 as any)).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy(1 as any)).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy('' as any)).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy('A' as any)).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy(true as any)).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy(false as any)).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy(undefined as any)).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy(null as any)).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy([] as any)).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy((() => {}) as any)).toThrow(errorMessage);

        expect(() => connectedEdgesPositionStrategy(({} as any))).not.toThrow(errorMessage);
    });

    it('Should throw an error if the provided argument does not contain a targetGetter property.', () => {
        const errorMessage = 'connectedEdgesPositionStrategy({ targetGetter }): Invalid argument! Expected an object with "targetGetter" property of type function.';
        expect(() => connectedEdgesPositionStrategy({} as any)).toThrow(errorMessage);
    });

    it('Should throw an error if the targetGetter property is not a function.', () => {
        const errorMessage = 'connectedEdgesPositionStrategy({ targetGetter }): Invalid argument! Expected an object with "targetGetter" property of type function.'
        expect(() => connectedEdgesPositionStrategy({ targetGetter: 0 } as any)).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy({ targetGetter: 1 } as any)).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy({ targetGetter: '' } as any)).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy({ targetGetter: 'A' } as any)).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy({ targetGetter: true } as any)).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy({ targetGetter: false } as any)).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy({ targetGetter: undefined } as any)).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy({ targetGetter: null } as any)).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy({ targetGetter: {} } as any)).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy({ targetGetter: [] } as any)).toThrow(errorMessage);

        expect(() => connectedEdgesPositionStrategy({ targetGetter: () => {} } as any)).not.toThrow(errorMessage);
    });

    it('Should throw an error if the provided argument does not contain a connections property.', () => {
        const errorMessage = 'connectedEdgesPositionStrategy({ connections }): Invalid argument! Expected an object with "connections" property of type array.';
        expect(() => connectedEdgesPositionStrategy({ targetGetter: () => targetElement } as any)).toThrow(errorMessage);
    });

    it('Should throw an error if the connections property is not an array.', () => {
        const errorMessage = 'connectedEdgesPositionStrategy({ connections }): Invalid argument! Expected an object with "connections" property of type array.';
        expect(() => connectedEdgesPositionStrategy({ targetGetter: () => targetElement, connections: 0 as any })).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy({ targetGetter: () => targetElement, connections: 1 as any })).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy({ targetGetter: () => targetElement, connections: '' as any })).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy({ targetGetter: () => targetElement, connections: 'A' as any })).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy({ targetGetter: () => targetElement, connections: true as any })).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy({ targetGetter: () => targetElement, connections: false as any })).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy({ targetGetter: () => targetElement, connections: undefined as any })).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy({ targetGetter: () => targetElement, connections: {} as any })).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy({ targetGetter: () => targetElement, connections: (() => {}) as any })).toThrow(errorMessage);

        expect(() => connectedEdgesPositionStrategy({ targetGetter: () => targetElement, connections: [] as any})).not.toThrow(errorMessage);
    });

    it('Should throw an error if the connections property is an empty array.', () => {
        const errorMessage = 'connectedEdgesPositionStrategy({ connections }): Invalid argument! The "connections" property can not be an empty array.'
        expect(() => connectedEdgesPositionStrategy({ targetGetter: () => targetElement, connections: [] as any})).toThrow(errorMessage);
        expect(
            () => connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [{
                    targetEdge: 'top-left',
                    overlayEdge: 'bottom-left'
                }]
            })
        ).not.toThrow();
    });

    it('Should throw an error if the push property is not an optional boolean.', () => {
        const errorMessage = 'connectedEdgesPositionStrategy({ push }): Invalid argument! Expected an object with "push" property of type boolean or without it.';
        const connections: [TargetOrientedEdgeConnection<'top-right'>] = [{ targetEdge: 'top-right', overlayEdge: 'bottom-right' }];
        const targetGetter = () => targetElement;

        expect(() => connectedEdgesPositionStrategy({ targetGetter, connections, push: 0 as any })).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy({ targetGetter, connections, push: 1 as any })).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy({ targetGetter, connections, push: '' as any })).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy({ targetGetter, connections, push: 'A' as any })).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy({ targetGetter, connections, push: {} as any })).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy({ targetGetter, connections, push: [] as any })).toThrow(errorMessage);
        expect(() => connectedEdgesPositionStrategy({ targetGetter, connections, push: (() => {}) as any })).toThrow(errorMessage);

        expect(() => connectedEdgesPositionStrategy({ targetGetter, connections, push: undefined })).not.toThrow();
        expect(() => connectedEdgesPositionStrategy({ targetGetter, connections, push: null as any })).not.toThrow();
        expect(() => connectedEdgesPositionStrategy({ targetGetter, connections, push: true })).not.toThrow();
        expect(() => connectedEdgesPositionStrategy({ targetGetter, connections, push: false })).not.toThrow();
    });

    it('Should throw an error if an invalid edge pair connection is passed to the configuration.', () => {
        let errorMessage = `connectedEdgesPositionStrategy({ connections[0] }): Invalid edge pair! Following are allowed: ${JSON.stringify(_validConnections)}`
        const validConnections: EdgeConnection[] = []

        function expectWithConnection(targetEdge: Edge, overlayEdge: Edge) {
            return expect(() => connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [
                    ...validConnections,
                    {
                        targetEdge,
                        overlayEdge
                    }
                ] as any
            }))
        }

        expectWithConnection('top-left', 'top-left').toThrow(errorMessage);
        expectWithConnection('top-left', 'center-left').toThrow(errorMessage);
        expectWithConnection('top-left', 'top-center').toThrow(errorMessage);
        expectWithConnection('top-center', 'top-right').toThrow(errorMessage);
        expectWithConnection('top-center', 'top-center').toThrow(errorMessage);
        expectWithConnection('top-center', 'top-left').toThrow(errorMessage);
        expectWithConnection('top-center', 'center-left').toThrow(errorMessage);
        expectWithConnection('top-center', 'center-right').toThrow(errorMessage);
        expectWithConnection('top-right', 'top-right').toThrow(errorMessage);
        expectWithConnection('top-right', 'top-center').toThrow(errorMessage);
        expectWithConnection('top-right', 'center-right').toThrow(errorMessage);
        expectWithConnection('center-right', 'center-right').toThrow(errorMessage);
        expectWithConnection('center-right', 'top-right').toThrow(errorMessage);
        expectWithConnection('center-right', 'bottom-right').toThrow(errorMessage);
        expectWithConnection('center-right', 'top-center').toThrow(errorMessage);
        expectWithConnection('center-right', 'bottom-center').toThrow(errorMessage);
        expectWithConnection('bottom-right', 'center-right').toThrow(errorMessage);
        expectWithConnection('bottom-right', 'bottom-right').toThrow(errorMessage);
        expectWithConnection('bottom-right', 'bottom-center').toThrow(errorMessage);
        expectWithConnection('bottom-center', 'bottom-right').toThrow(errorMessage);
        expectWithConnection('bottom-center', 'bottom-center').toThrow(errorMessage);
        expectWithConnection('bottom-center', 'bottom-left').toThrow(errorMessage);
        expectWithConnection('bottom-center', 'center-left').toThrow(errorMessage);
        expectWithConnection('bottom-center', 'center-right').toThrow(errorMessage);
        expectWithConnection('bottom-left', 'bottom-left').toThrow(errorMessage);
        expectWithConnection('bottom-left', 'bottom-center').toThrow(errorMessage);
        expectWithConnection('bottom-left', 'center-left').toThrow(errorMessage);
        expectWithConnection('center-left', 'top-left').toThrow(errorMessage);
        expectWithConnection('center-left', 'center-left').toThrow(errorMessage);
        expectWithConnection('center-left', 'bottom-left').toThrow(errorMessage);
        expectWithConnection('center-left', 'top-center').toThrow(errorMessage);
        expectWithConnection('center-left', 'bottom-center').toThrow(errorMessage);

        errorMessage = `connectedEdgesPositionStrategy({ connections[1] }): Invalid edge pair! Following are allowed: ${JSON.stringify(_validConnections)}`
        validConnections.push({
            targetEdge: 'top-left',
            overlayEdge: 'bottom-right'
        });

        expectWithConnection('top-left', 'top-left').toThrow(errorMessage);
        expectWithConnection('top-left', 'center-left').toThrow(errorMessage);
        expectWithConnection('top-left', 'top-center').toThrow(errorMessage);
        expectWithConnection('top-center', 'top-right').toThrow(errorMessage);
        expectWithConnection('top-center', 'top-center').toThrow(errorMessage);
        expectWithConnection('top-center', 'top-left').toThrow(errorMessage);
        expectWithConnection('top-center', 'center-left').toThrow(errorMessage);
        expectWithConnection('top-center', 'center-right').toThrow(errorMessage);
        expectWithConnection('top-right', 'top-right').toThrow(errorMessage);
        expectWithConnection('top-right', 'top-center').toThrow(errorMessage);
        expectWithConnection('top-right', 'center-right').toThrow(errorMessage);
        expectWithConnection('center-right', 'center-right').toThrow(errorMessage);
        expectWithConnection('center-right', 'top-right').toThrow(errorMessage);
        expectWithConnection('center-right', 'bottom-right').toThrow(errorMessage);
        expectWithConnection('center-right', 'top-center').toThrow(errorMessage);
        expectWithConnection('center-right', 'bottom-center').toThrow(errorMessage);
        expectWithConnection('bottom-right', 'center-right').toThrow(errorMessage);
        expectWithConnection('bottom-right', 'bottom-right').toThrow(errorMessage);
        expectWithConnection('bottom-right', 'bottom-center').toThrow(errorMessage);
        expectWithConnection('bottom-center', 'bottom-right').toThrow(errorMessage);
        expectWithConnection('bottom-center', 'bottom-center').toThrow(errorMessage);
        expectWithConnection('bottom-center', 'bottom-left').toThrow(errorMessage);
        expectWithConnection('bottom-center', 'center-left').toThrow(errorMessage);
        expectWithConnection('bottom-center', 'center-right').toThrow(errorMessage);
        expectWithConnection('bottom-left', 'bottom-left').toThrow(errorMessage);
        expectWithConnection('bottom-left', 'bottom-center').toThrow(errorMessage);
        expectWithConnection('bottom-left', 'center-left').toThrow(errorMessage);
        expectWithConnection('center-left', 'top-left').toThrow(errorMessage);
        expectWithConnection('center-left', 'center-left').toThrow(errorMessage);
        expectWithConnection('center-left', 'bottom-left').toThrow(errorMessage);
        expectWithConnection('center-left', 'top-center').toThrow(errorMessage);
        expectWithConnection('center-left', 'bottom-center').toThrow(errorMessage);
    })

    it('Should position the overlay according to the provided connection to the target\'s top-left edge.', async () => {
        const edgeConnection: EdgeConnection = {
            targetEdge: 'top-left',
            overlayEdge: 'bottom-right',
            offsetX: 0,
            offsetY: 0
        };
        const config: ConnectedEdgesStrategyConfig = {
            targetGetter: () => targetElement,
            connections: [edgeConnection]
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy(config as any)
        }));

        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(415);
        expect(rect.top).toBe(135);
        expect(rect.right).toBe(615);
        expect(rect.bottom).toBe(335);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(410);
        expect(rect.top).toBe(135);
        expect(rect.right).toBe(610);
        expect(rect.bottom).toBe(335);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(415);
        expect(rect.top).toBe(130);
        expect(rect.right).toBe(615);
        expect(rect.bottom).toBe(330);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(410);
        expect(rect.top).toBe(130);
        expect(rect.right).toBe(610);
        expect(rect.bottom).toBe(330);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(420);
        expect(rect.top).toBe(135);
        expect(rect.right).toBe(620);
        expect(rect.bottom).toBe(335);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(415);
        expect(rect.top).toBe(140);
        expect(rect.right).toBe(615);
        expect(rect.bottom).toBe(340);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(420);
        expect(rect.top).toBe(140);
        expect(rect.right).toBe(620);
        expect(rect.bottom).toBe(340);

        handle.detach();
        edgeConnection.overlayEdge = 'bottom-center';
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(515);
        expect(rect.top).toBe(135);
        expect(rect.right).toBe(715);
        expect(rect.bottom).toBe(335);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(510);
        expect(rect.top).toBe(135);
        expect(rect.right).toBe(710);
        expect(rect.bottom).toBe(335);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(515);
        expect(rect.top).toBe(130);
        expect(rect.right).toBe(715);
        expect(rect.bottom).toBe(330);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(510);
        expect(rect.top).toBe(130);
        expect(rect.right).toBe(710);
        expect(rect.bottom).toBe(330);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(520);
        expect(rect.top).toBe(135);
        expect(rect.right).toBe(720);
        expect(rect.bottom).toBe(335);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(515);
        expect(rect.top).toBe(140);
        expect(rect.right).toBe(715);
        expect(rect.bottom).toBe(340);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(520);
        expect(rect.top).toBe(140);
        expect(rect.right).toBe(720);
        expect(rect.bottom).toBe(340);

        handle.detach();
        edgeConnection.overlayEdge = 'bottom-left';
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(615);
        expect(rect.top).toBe(135);
        expect(rect.right).toBe(815);
        expect(rect.bottom).toBe(335);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(610);
        expect(rect.top).toBe(135);
        expect(rect.right).toBe(810);
        expect(rect.bottom).toBe(335);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(615);
        expect(rect.top).toBe(130);
        expect(rect.right).toBe(815);
        expect(rect.bottom).toBe(330);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(610);
        expect(rect.top).toBe(130);
        expect(rect.right).toBe(810);
        expect(rect.bottom).toBe(330);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(620);
        expect(rect.top).toBe(135);
        expect(rect.right).toBe(820);
        expect(rect.bottom).toBe(335);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(615);
        expect(rect.top).toBe(140);
        expect(rect.right).toBe(815);
        expect(rect.bottom).toBe(340);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(620);
        expect(rect.top).toBe(140);
        expect(rect.right).toBe(820);
        expect(rect.bottom).toBe(340);

        handle.detach();
        edgeConnection.overlayEdge = 'center-right';
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(415);
        expect(rect.top).toBe(235);
        expect(rect.right).toBe(615);
        expect(rect.bottom).toBe(435);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(410);
        expect(rect.top).toBe(235);
        expect(rect.right).toBe(610);
        expect(rect.bottom).toBe(435);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(415);
        expect(rect.top).toBe(230);
        expect(rect.right).toBe(615);
        expect(rect.bottom).toBe(430);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(410);
        expect(rect.top).toBe(230);
        expect(rect.right).toBe(610);
        expect(rect.bottom).toBe(430);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(420);
        expect(rect.top).toBe(235);
        expect(rect.right).toBe(620);
        expect(rect.bottom).toBe(435);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(415);
        expect(rect.top).toBe(240);
        expect(rect.right).toBe(615);
        expect(rect.bottom).toBe(440);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(420);
        expect(rect.top).toBe(240);
        expect(rect.right).toBe(620);
        expect(rect.bottom).toBe(440);

        handle.detach();
        edgeConnection.overlayEdge = 'top-right';
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(415);
        expect(rect.top).toBe(335);
        expect(rect.right).toBe(615);
        expect(rect.bottom).toBe(535);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(410);
        expect(rect.top).toBe(335);
        expect(rect.right).toBe(610);
        expect(rect.bottom).toBe(535);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(415);
        expect(rect.top).toBe(330);
        expect(rect.right).toBe(615);
        expect(rect.bottom).toBe(530);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(410);
        expect(rect.top).toBe(330);
        expect(rect.right).toBe(610);
        expect(rect.bottom).toBe(530);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(420);
        expect(rect.top).toBe(335);
        expect(rect.right).toBe(620);
        expect(rect.bottom).toBe(535);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(415);
        expect(rect.top).toBe(340);
        expect(rect.right).toBe(615);
        expect(rect.bottom).toBe(540);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(420);
        expect(rect.top).toBe(340);
        expect(rect.right).toBe(620);
        expect(rect.bottom).toBe(540);
    });

    it('Should position the overlay according to the provided connection to the target\'s top-center edge.', async () => {
        const edgeConnection: EdgeConnection = {
            targetEdge: 'top-center',
            overlayEdge: 'bottom-right',
            offsetX: 0,
            offsetY: 0
        };
        const config: ConnectedEdgesStrategyConfig = {
            targetGetter: () => targetElement,
            connections: [edgeConnection]
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy(config as any)
        }));

        handle.attach()
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(440);
        expect(rect.top).toBe(135);
        expect(rect.right).toBe(640);
        expect(rect.bottom).toBe(335);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(435);
        expect(rect.top).toBe(135);
        expect(rect.right).toBe(635);
        expect(rect.bottom).toBe(335);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(440);
        expect(rect.top).toBe(130);
        expect(rect.right).toBe(640);
        expect(rect.bottom).toBe(330);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(435);
        expect(rect.top).toBe(130);
        expect(rect.right).toBe(635);
        expect(rect.bottom).toBe(330);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(445);
        expect(rect.top).toBe(135);
        expect(rect.right).toBe(645);
        expect(rect.bottom).toBe(335);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(440);
        expect(rect.top).toBe(140);
        expect(rect.right).toBe(640);
        expect(rect.bottom).toBe(340);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(445);
        expect(rect.top).toBe(140);
        expect(rect.right).toBe(645);
        expect(rect.bottom).toBe(340);

        handle.detach();
        edgeConnection.overlayEdge = 'bottom-center';
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(540);
        expect(rect.top).toBe(135);
        expect(rect.right).toBe(740);
        expect(rect.bottom).toBe(335);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(535);
        expect(rect.top).toBe(135);
        expect(rect.right).toBe(735);
        expect(rect.bottom).toBe(335);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(540);
        expect(rect.top).toBe(130);
        expect(rect.right).toBe(740);
        expect(rect.bottom).toBe(330);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(535);
        expect(rect.top).toBe(130);
        expect(rect.right).toBe(735);
        expect(rect.bottom).toBe(330);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(545);
        expect(rect.top).toBe(135);
        expect(rect.right).toBe(745);
        expect(rect.bottom).toBe(335);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(540);
        expect(rect.top).toBe(140);
        expect(rect.right).toBe(740);
        expect(rect.bottom).toBe(340);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(545);
        expect(rect.top).toBe(140);
        expect(rect.right).toBe(745);
        expect(rect.bottom).toBe(340);

        handle.detach();
        edgeConnection.overlayEdge = 'bottom-left';
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(640);
        expect(rect.top).toBe(135);
        expect(rect.right).toBe(840);
        expect(rect.bottom).toBe(335);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(635);
        expect(rect.top).toBe(135);
        expect(rect.right).toBe(835);
        expect(rect.bottom).toBe(335);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(640);
        expect(rect.top).toBe(130);
        expect(rect.right).toBe(840);
        expect(rect.bottom).toBe(330);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(635);
        expect(rect.top).toBe(130);
        expect(rect.right).toBe(835);
        expect(rect.bottom).toBe(330);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(645);
        expect(rect.top).toBe(135);
        expect(rect.right).toBe(845);
        expect(rect.bottom).toBe(335);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(640);
        expect(rect.top).toBe(140);
        expect(rect.right).toBe(840);
        expect(rect.bottom).toBe(340);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(645);
        expect(rect.top).toBe(140);
        expect(rect.right).toBe(845);
        expect(rect.bottom).toBe(340);
    });

    it('Should position the overlay according to the provided connection to the target\'s top-right edge.', async () => {
        const edgeConnection: EdgeConnection = {
            targetEdge: 'top-right',
            overlayEdge: 'bottom-right',
            offsetX: 0,
            offsetY: 0
        };
        const config: ConnectedEdgesStrategyConfig = {
            targetGetter: () => targetElement,
            connections: [edgeConnection]
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy(config as any)
        }));

        handle.attach()
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(465);
        expect(rect.top).toBe(135);
        expect(rect.right).toBe(665);
        expect(rect.bottom).toBe(335);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(460);
        expect(rect.top).toBe(135);
        expect(rect.right).toBe(660);
        expect(rect.bottom).toBe(335);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(465);
        expect(rect.top).toBe(130);
        expect(rect.right).toBe(665);
        expect(rect.bottom).toBe(330);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(460);
        expect(rect.top).toBe(130);
        expect(rect.right).toBe(660);
        expect(rect.bottom).toBe(330);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(470);
        expect(rect.top).toBe(135);
        expect(rect.right).toBe(670);
        expect(rect.bottom).toBe(335);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(465);
        expect(rect.top).toBe(140);
        expect(rect.right).toBe(665);
        expect(rect.bottom).toBe(340);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(470);
        expect(rect.top).toBe(140);
        expect(rect.right).toBe(670);
        expect(rect.bottom).toBe(340);

        handle.detach();
        edgeConnection.overlayEdge = 'bottom-center';
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(565);
        expect(rect.top).toBe(135);
        expect(rect.right).toBe(765);
        expect(rect.bottom).toBe(335);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(560);
        expect(rect.top).toBe(135);
        expect(rect.right).toBe(760);
        expect(rect.bottom).toBe(335);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(565);
        expect(rect.top).toBe(130);
        expect(rect.right).toBe(765);
        expect(rect.bottom).toBe(330);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(560);
        expect(rect.top).toBe(130);
        expect(rect.right).toBe(760);
        expect(rect.bottom).toBe(330);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(570);
        expect(rect.top).toBe(135);
        expect(rect.right).toBe(770);
        expect(rect.bottom).toBe(335);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(565);
        expect(rect.top).toBe(140);
        expect(rect.right).toBe(765);
        expect(rect.bottom).toBe(340);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(570);
        expect(rect.top).toBe(140);
        expect(rect.right).toBe(770);
        expect(rect.bottom).toBe(340);

        handle.detach();
        edgeConnection.overlayEdge = 'bottom-left';
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(665);
        expect(rect.top).toBe(135);
        expect(rect.right).toBe(865);
        expect(rect.bottom).toBe(335);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(660);
        expect(rect.top).toBe(135);
        expect(rect.right).toBe(860);
        expect(rect.bottom).toBe(335);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(665);
        expect(rect.top).toBe(130);
        expect(rect.right).toBe(865);
        expect(rect.bottom).toBe(330);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(660);
        expect(rect.top).toBe(130);
        expect(rect.right).toBe(860);
        expect(rect.bottom).toBe(330);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(670);
        expect(rect.top).toBe(135);
        expect(rect.right).toBe(870);
        expect(rect.bottom).toBe(335);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(665);
        expect(rect.top).toBe(140);
        expect(rect.right).toBe(865);
        expect(rect.bottom).toBe(340);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(670);
        expect(rect.top).toBe(140);
        expect(rect.right).toBe(870);
        expect(rect.bottom).toBe(340);

        handle.detach();
        edgeConnection.overlayEdge = 'center-left';
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(665);
        expect(rect.top).toBe(235);
        expect(rect.right).toBe(865);
        expect(rect.bottom).toBe(435);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(660);
        expect(rect.top).toBe(235);
        expect(rect.right).toBe(860);
        expect(rect.bottom).toBe(435);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(665);
        expect(rect.top).toBe(230);
        expect(rect.right).toBe(865);
        expect(rect.bottom).toBe(430);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(660);
        expect(rect.top).toBe(230);
        expect(rect.right).toBe(860);
        expect(rect.bottom).toBe(430);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(670);
        expect(rect.top).toBe(235);
        expect(rect.right).toBe(870);
        expect(rect.bottom).toBe(435);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(665);
        expect(rect.top).toBe(240);
        expect(rect.right).toBe(865);
        expect(rect.bottom).toBe(440);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(670);
        expect(rect.top).toBe(240);
        expect(rect.right).toBe(870);
        expect(rect.bottom).toBe(440);

        handle.detach();
        edgeConnection.overlayEdge = 'top-left';
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(665);
        expect(rect.top).toBe(335);
        expect(rect.right).toBe(865);
        expect(rect.bottom).toBe(535);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(660);
        expect(rect.top).toBe(335);
        expect(rect.right).toBe(860);
        expect(rect.bottom).toBe(535);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(665);
        expect(rect.top).toBe(330);
        expect(rect.right).toBe(865);
        expect(rect.bottom).toBe(530);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(660);
        expect(rect.top).toBe(330);
        expect(rect.right).toBe(860);
        expect(rect.bottom).toBe(530);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(670);
        expect(rect.top).toBe(335);
        expect(rect.right).toBe(870);
        expect(rect.bottom).toBe(535);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(665);
        expect(rect.top).toBe(340);
        expect(rect.right).toBe(865);
        expect(rect.bottom).toBe(540);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(670);
        expect(rect.top).toBe(340);
        expect(rect.right).toBe(870);
        expect(rect.bottom).toBe(540);
    });

    it('Should position the overlay according to the provided connection to the target\'s center-right edge.', async () => {
        const edgeConnection: EdgeConnection = {
            targetEdge: 'center-right',
            overlayEdge: 'bottom-left',
            offsetX: 0,
            offsetY: 0
        };
        const config: ConnectedEdgesStrategyConfig = {
            targetGetter: () => targetElement,
            connections: [edgeConnection]
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy(config as any)
        }));

        handle.attach()
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(665);
        expect(rect.top).toBe(160);
        expect(rect.right).toBe(865);
        expect(rect.bottom).toBe(360);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(660);
        expect(rect.top).toBe(160);
        expect(rect.right).toBe(860);
        expect(rect.bottom).toBe(360);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(665);
        expect(rect.top).toBe(155);
        expect(rect.right).toBe(865);
        expect(rect.bottom).toBe(355);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(660);
        expect(rect.top).toBe(155);
        expect(rect.right).toBe(860);
        expect(rect.bottom).toBe(355);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(670);
        expect(rect.top).toBe(160);
        expect(rect.right).toBe(870);
        expect(rect.bottom).toBe(360);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(665);
        expect(rect.top).toBe(165);
        expect(rect.right).toBe(865);
        expect(rect.bottom).toBe(365);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(670);
        expect(rect.top).toBe(165);
        expect(rect.right).toBe(870);
        expect(rect.bottom).toBe(365);

        handle.detach();
        edgeConnection.overlayEdge = 'center-left';
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(665);
        expect(rect.top).toBe(260);
        expect(rect.right).toBe(865);
        expect(rect.bottom).toBe(460);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(660);
        expect(rect.top).toBe(260);
        expect(rect.right).toBe(860);
        expect(rect.bottom).toBe(460);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(665);
        expect(rect.top).toBe(255);
        expect(rect.right).toBe(865);
        expect(rect.bottom).toBe(455);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(660);
        expect(rect.top).toBe(255);
        expect(rect.right).toBe(860);
        expect(rect.bottom).toBe(455);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(670);
        expect(rect.top).toBe(260);
        expect(rect.right).toBe(870);
        expect(rect.bottom).toBe(460);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(665);
        expect(rect.top).toBe(265);
        expect(rect.right).toBe(865);
        expect(rect.bottom).toBe(465);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(670);
        expect(rect.top).toBe(265);
        expect(rect.right).toBe(870);
        expect(rect.bottom).toBe(465);

        handle.detach();
        edgeConnection.overlayEdge = 'top-left';
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(665);
        expect(rect.top).toBe(360);
        expect(rect.right).toBe(865);
        expect(rect.bottom).toBe(560);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(660);
        expect(rect.top).toBe(360);
        expect(rect.right).toBe(860);
        expect(rect.bottom).toBe(560);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(665);
        expect(rect.top).toBe(355);
        expect(rect.right).toBe(865);
        expect(rect.bottom).toBe(555);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(660);
        expect(rect.top).toBe(355);
        expect(rect.right).toBe(860);
        expect(rect.bottom).toBe(555);
    });

    it('Should position the overlay according to the provided connection to the target\'s bottom-right edge.', async () => {
        const edgeConnection: EdgeConnection = {
            targetEdge: 'bottom-right',
            overlayEdge: 'bottom-left',
            offsetX: 0,
            offsetY: 0
        };
        const config: ConnectedEdgesStrategyConfig = {
            targetGetter: () => targetElement,
            connections: [edgeConnection]
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy(config as any)
        }));

        handle.attach()
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(665);
        expect(rect.top).toBe(185);
        expect(rect.right).toBe(865);
        expect(rect.bottom).toBe(385);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(660);
        expect(rect.top).toBe(185);
        expect(rect.right).toBe(860);
        expect(rect.bottom).toBe(385);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(665);
        expect(rect.top).toBe(180);
        expect(rect.right).toBe(865);
        expect(rect.bottom).toBe(380);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(660);
        expect(rect.top).toBe(180);
        expect(rect.right).toBe(860);
        expect(rect.bottom).toBe(380);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(670);
        expect(rect.top).toBe(185);
        expect(rect.right).toBe(870);
        expect(rect.bottom).toBe(385);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(665);
        expect(rect.top).toBe(190);
        expect(rect.right).toBe(865);
        expect(rect.bottom).toBe(390);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(670);
        expect(rect.top).toBe(190);
        expect(rect.right).toBe(870);
        expect(rect.bottom).toBe(390);

        handle.detach();
        edgeConnection.overlayEdge = 'center-left';
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(665);
        expect(rect.top).toBe(285);
        expect(rect.right).toBe(865);
        expect(rect.bottom).toBe(485);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(660);
        expect(rect.top).toBe(285);
        expect(rect.right).toBe(860);
        expect(rect.bottom).toBe(485);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(665);
        expect(rect.top).toBe(280);
        expect(rect.right).toBe(865);
        expect(rect.bottom).toBe(480);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(660);
        expect(rect.top).toBe(280);
        expect(rect.right).toBe(860);
        expect(rect.bottom).toBe(480);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(670);
        expect(rect.top).toBe(285);
        expect(rect.right).toBe(870);
        expect(rect.bottom).toBe(485);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(665);
        expect(rect.top).toBe(290);
        expect(rect.right).toBe(865);
        expect(rect.bottom).toBe(490);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(670);
        expect(rect.top).toBe(290);
        expect(rect.right).toBe(870);
        expect(rect.bottom).toBe(490);

        handle.detach();
        edgeConnection.overlayEdge = 'top-left';
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(665);
        expect(rect.top).toBe(385);
        expect(rect.right).toBe(865);
        expect(rect.bottom).toBe(585);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(660);
        expect(rect.top).toBe(385);
        expect(rect.right).toBe(860);
        expect(rect.bottom).toBe(585);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(665);
        expect(rect.top).toBe(380);
        expect(rect.right).toBe(865);
        expect(rect.bottom).toBe(580);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(660);
        expect(rect.top).toBe(380);
        expect(rect.right).toBe(860);
        expect(rect.bottom).toBe(580);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(670);
        expect(rect.top).toBe(385);
        expect(rect.right).toBe(870);
        expect(rect.bottom).toBe(585);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(665);
        expect(rect.top).toBe(390);
        expect(rect.right).toBe(865);
        expect(rect.bottom).toBe(590);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(670);
        expect(rect.top).toBe(390);
        expect(rect.right).toBe(870);
        expect(rect.bottom).toBe(590);

        handle.detach();
        edgeConnection.overlayEdge = 'top-center';
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(565);
        expect(rect.top).toBe(385);
        expect(rect.right).toBe(765);
        expect(rect.bottom).toBe(585);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(560);
        expect(rect.top).toBe(385);
        expect(rect.right).toBe(760);
        expect(rect.bottom).toBe(585);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(565);
        expect(rect.top).toBe(380);
        expect(rect.right).toBe(765);
        expect(rect.bottom).toBe(580);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(560);
        expect(rect.top).toBe(380);
        expect(rect.right).toBe(760);
        expect(rect.bottom).toBe(580);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(570);
        expect(rect.top).toBe(385);
        expect(rect.right).toBe(770);
        expect(rect.bottom).toBe(585);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(565);
        expect(rect.top).toBe(390);
        expect(rect.right).toBe(765);
        expect(rect.bottom).toBe(590);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(570);
        expect(rect.top).toBe(390);
        expect(rect.right).toBe(770);
        expect(rect.bottom).toBe(590);

        handle.detach();
        edgeConnection.overlayEdge = 'top-right';
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(465);
        expect(rect.top).toBe(385);
        expect(rect.right).toBe(665);
        expect(rect.bottom).toBe(585);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(460);
        expect(rect.top).toBe(385);
        expect(rect.right).toBe(660);
        expect(rect.bottom).toBe(585);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(465);
        expect(rect.top).toBe(380);
        expect(rect.right).toBe(665);
        expect(rect.bottom).toBe(580);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(470);
        expect(rect.top).toBe(385);
        expect(rect.right).toBe(670);
        expect(rect.bottom).toBe(585);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(465);
        expect(rect.top).toBe(390);
        expect(rect.right).toBe(665);
        expect(rect.bottom).toBe(590);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(470);
        expect(rect.top).toBe(390);
        expect(rect.right).toBe(670);
        expect(rect.bottom).toBe(590);
    });

    it('Should position the overlay according to the provided connection to the target\'s bottom-right edge.', async () => {
        const edgeConnection: EdgeConnection = {
            targetEdge: 'bottom-center',
            overlayEdge: 'top-left',
            offsetX: 0,
            offsetY: 0
        };
        const config: ConnectedEdgesStrategyConfig = {
            targetGetter: () => targetElement,
            connections: [edgeConnection]
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy(config as any)
        }));

        handle.attach()
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(640);
        expect(rect.top).toBe(385);
        expect(rect.right).toBe(840);
        expect(rect.bottom).toBe(585);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(635);
        expect(rect.top).toBe(385);
        expect(rect.right).toBe(835);
        expect(rect.bottom).toBe(585);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(640);
        expect(rect.top).toBe(380);
        expect(rect.right).toBe(840);
        expect(rect.bottom).toBe(580);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(635);
        expect(rect.top).toBe(380);
        expect(rect.right).toBe(835);
        expect(rect.bottom).toBe(580);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(645);
        expect(rect.top).toBe(385);
        expect(rect.right).toBe(845);
        expect(rect.bottom).toBe(585);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(640);
        expect(rect.top).toBe(390);
        expect(rect.right).toBe(840);
        expect(rect.bottom).toBe(590);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(645);
        expect(rect.top).toBe(390);
        expect(rect.right).toBe(845);
        expect(rect.bottom).toBe(590);

        handle.detach();
        edgeConnection.overlayEdge = 'top-center';
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(540);
        expect(rect.top).toBe(385);
        expect(rect.right).toBe(740);
        expect(rect.bottom).toBe(585);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(535);
        expect(rect.top).toBe(385);
        expect(rect.right).toBe(735);
        expect(rect.bottom).toBe(585);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(540);
        expect(rect.top).toBe(380);
        expect(rect.right).toBe(740);
        expect(rect.bottom).toBe(580);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(535);
        expect(rect.top).toBe(380);
        expect(rect.right).toBe(735);
        expect(rect.bottom).toBe(580);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(545);
        expect(rect.top).toBe(385);
        expect(rect.right).toBe(745);
        expect(rect.bottom).toBe(585);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(540);
        expect(rect.top).toBe(390);
        expect(rect.right).toBe(740);
        expect(rect.bottom).toBe(590);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(545);
        expect(rect.top).toBe(390);
        expect(rect.right).toBe(745);
        expect(rect.bottom).toBe(590);

        handle.detach();
        edgeConnection.overlayEdge = 'top-right';
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(440);
        expect(rect.top).toBe(385);
        expect(rect.right).toBe(640);
        expect(rect.bottom).toBe(585);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(435);
        expect(rect.top).toBe(385);
        expect(rect.right).toBe(635);
        expect(rect.bottom).toBe(585);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(440);
        expect(rect.top).toBe(380);
        expect(rect.right).toBe(640);
        expect(rect.bottom).toBe(580);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(435);
        expect(rect.top).toBe(380);
        expect(rect.right).toBe(635);
        expect(rect.bottom).toBe(580);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(445);
        expect(rect.top).toBe(385);
        expect(rect.right).toBe(645);
        expect(rect.bottom).toBe(585);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(440);
        expect(rect.top).toBe(390);
        expect(rect.right).toBe(640);
        expect(rect.bottom).toBe(590);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(445);
        expect(rect.top).toBe(390);
        expect(rect.right).toBe(645);
        expect(rect.bottom).toBe(590);
    });

    it('Should position the overlay according to the provided connection to the target\'s bottom-right edge.', async () => {
        const edgeConnection: EdgeConnection = {
            targetEdge: 'bottom-left',
            overlayEdge: 'top-left',
            offsetX: 0,
            offsetY: 0
        };
        const config: ConnectedEdgesStrategyConfig = {
            targetGetter: () => targetElement,
            connections: [edgeConnection]
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy(config as any)
        }));

        handle.attach()
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();
        
        expect(rect.left).toBe(615);
        expect(rect.top).toBe(385);
        expect(rect.right).toBe(815);
        expect(rect.bottom).toBe(585);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(610);
        expect(rect.top).toBe(385);
        expect(rect.right).toBe(810);
        expect(rect.bottom).toBe(585);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(615);
        expect(rect.top).toBe(380);
        expect(rect.right).toBe(815);
        expect(rect.bottom).toBe(580);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(610);
        expect(rect.top).toBe(380);
        expect(rect.right).toBe(810);
        expect(rect.bottom).toBe(580);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(620);
        expect(rect.top).toBe(385);
        expect(rect.right).toBe(820);
        expect(rect.bottom).toBe(585);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(615);
        expect(rect.top).toBe(390);
        expect(rect.right).toBe(815);
        expect(rect.bottom).toBe(590);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(620);
        expect(rect.top).toBe(390);
        expect(rect.right).toBe(820);
        expect(rect.bottom).toBe(590);

        handle.detach();
        edgeConnection.overlayEdge = 'top-center';
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(515);
        expect(rect.top).toBe(385);
        expect(rect.right).toBe(715);
        expect(rect.bottom).toBe(585);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(510);
        expect(rect.top).toBe(385);
        expect(rect.right).toBe(710);
        expect(rect.bottom).toBe(585);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(515);
        expect(rect.top).toBe(380);
        expect(rect.right).toBe(715);
        expect(rect.bottom).toBe(580);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(510);
        expect(rect.top).toBe(380);
        expect(rect.right).toBe(710);
        expect(rect.bottom).toBe(580);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(520);
        expect(rect.top).toBe(385);
        expect(rect.right).toBe(720);
        expect(rect.bottom).toBe(585);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(515);
        expect(rect.top).toBe(390);
        expect(rect.right).toBe(715);
        expect(rect.bottom).toBe(590);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(520);
        expect(rect.top).toBe(390);
        expect(rect.right).toBe(720);
        expect(rect.bottom).toBe(590);

        handle.detach();
        edgeConnection.overlayEdge = 'top-right';
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(415);
        expect(rect.top).toBe(385);
        expect(rect.right).toBe(615);
        expect(rect.bottom).toBe(585);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(410);
        expect(rect.top).toBe(385);
        expect(rect.right).toBe(610);
        expect(rect.bottom).toBe(585);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(415);
        expect(rect.top).toBe(380);
        expect(rect.right).toBe(615);
        expect(rect.bottom).toBe(580);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(410);
        expect(rect.top).toBe(380);
        expect(rect.right).toBe(610);
        expect(rect.bottom).toBe(580);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(420);
        expect(rect.top).toBe(385);
        expect(rect.right).toBe(620);
        expect(rect.bottom).toBe(585);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(415);
        expect(rect.top).toBe(390);
        expect(rect.right).toBe(615);
        expect(rect.bottom).toBe(590);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(420);
        expect(rect.top).toBe(390);
        expect(rect.right).toBe(620);
        expect(rect.bottom).toBe(590);

        handle.detach();
        edgeConnection.overlayEdge = 'center-right';
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(415);
        expect(rect.top).toBe(285);
        expect(rect.right).toBe(615);
        expect(rect.bottom).toBe(485);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(410);
        expect(rect.top).toBe(285);
        expect(rect.right).toBe(610);
        expect(rect.bottom).toBe(485);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(415);
        expect(rect.top).toBe(280);
        expect(rect.right).toBe(615);
        expect(rect.bottom).toBe(480);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(410);
        expect(rect.top).toBe(280);
        expect(rect.right).toBe(610);
        expect(rect.bottom).toBe(480);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(420);
        expect(rect.top).toBe(285);
        expect(rect.right).toBe(620);
        expect(rect.bottom).toBe(485);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(415);
        expect(rect.top).toBe(290);
        expect(rect.right).toBe(615);
        expect(rect.bottom).toBe(490);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(420);
        expect(rect.top).toBe(290);
        expect(rect.right).toBe(620);
        expect(rect.bottom).toBe(490);

        handle.detach();
        edgeConnection.overlayEdge = 'bottom-right';
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(415);
        expect(rect.top).toBe(185);
        expect(rect.right).toBe(615);
        expect(rect.bottom).toBe(385);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(410);
        expect(rect.top).toBe(185);
        expect(rect.right).toBe(610);
        expect(rect.bottom).toBe(385);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(415);
        expect(rect.top).toBe(180);
        expect(rect.right).toBe(615);
        expect(rect.bottom).toBe(380);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(410);
        expect(rect.top).toBe(180);
        expect(rect.right).toBe(610);
        expect(rect.bottom).toBe(380);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(420);
        expect(rect.top).toBe(185);
        expect(rect.right).toBe(620);
        expect(rect.bottom).toBe(385);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(415);
        expect(rect.top).toBe(190);
        expect(rect.right).toBe(615);
        expect(rect.bottom).toBe(390);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(420);
        expect(rect.top).toBe(190);
        expect(rect.right).toBe(620);
        expect(rect.bottom).toBe(390);
    });

    it('Should position the overlay according to the provided connection to the target\'s bottom-right edge.', async () => {
        const edgeConnection: EdgeConnection = {
            targetEdge: 'center-left',
            overlayEdge: 'top-right',
            offsetX: 0,
            offsetY: 0
        };
        const config: ConnectedEdgesStrategyConfig = {
            targetGetter: () => targetElement,
            connections: [edgeConnection]
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy(config as any)
        }));

        handle.attach()
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(415);
        expect(rect.top).toBe(360);
        expect(rect.right).toBe(615);
        expect(rect.bottom).toBe(560);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(410);
        expect(rect.top).toBe(360);
        expect(rect.right).toBe(610);
        expect(rect.bottom).toBe(560);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(415);
        expect(rect.top).toBe(355);
        expect(rect.right).toBe(615);
        expect(rect.bottom).toBe(555);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(410);
        expect(rect.top).toBe(355);
        expect(rect.right).toBe(610);
        expect(rect.bottom).toBe(555);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(420);
        expect(rect.top).toBe(360);
        expect(rect.right).toBe(620);
        expect(rect.bottom).toBe(560);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(415);
        expect(rect.top).toBe(365);
        expect(rect.right).toBe(615);
        expect(rect.bottom).toBe(565);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(420);
        expect(rect.top).toBe(365);
        expect(rect.right).toBe(620);
        expect(rect.bottom).toBe(565);

        handle.detach();
        edgeConnection.overlayEdge = 'center-right';
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(415);
        expect(rect.top).toBe(260);
        expect(rect.right).toBe(615);
        expect(rect.bottom).toBe(460);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(410);
        expect(rect.top).toBe(260);
        expect(rect.right).toBe(610);
        expect(rect.bottom).toBe(460);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(415);
        expect(rect.top).toBe(255);
        expect(rect.right).toBe(615);
        expect(rect.bottom).toBe(455);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(410);
        expect(rect.top).toBe(255);
        expect(rect.right).toBe(610);
        expect(rect.bottom).toBe(455);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(420);
        expect(rect.top).toBe(260);
        expect(rect.right).toBe(620);
        expect(rect.bottom).toBe(460);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(415);
        expect(rect.top).toBe(265);
        expect(rect.right).toBe(615);
        expect(rect.bottom).toBe(465);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(420);
        expect(rect.top).toBe(265);
        expect(rect.right).toBe(620);
        expect(rect.bottom).toBe(465);

        handle.detach();
        edgeConnection.overlayEdge = 'bottom-right';
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(415);
        expect(rect.top).toBe(160);
        expect(rect.right).toBe(615);
        expect(rect.bottom).toBe(360);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(410);
        expect(rect.top).toBe(160);
        expect(rect.right).toBe(610);
        expect(rect.bottom).toBe(360);
        
        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(415);
        expect(rect.top).toBe(155);
        expect(rect.right).toBe(615);
        expect(rect.bottom).toBe(355);

        handle.detach();
        edgeConnection.offsetX = -5;
        edgeConnection.offsetY = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(410);
        expect(rect.top).toBe(155);
        expect(rect.right).toBe(610);
        expect(rect.bottom).toBe(355);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 0;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(420);
        expect(rect.top).toBe(160);
        expect(rect.right).toBe(620);
        expect(rect.bottom).toBe(360);

        handle.detach();
        edgeConnection.offsetX = 0;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(415);
        expect(rect.top).toBe(165);
        expect(rect.right).toBe(615);
        expect(rect.bottom).toBe(365);

        handle.detach();
        edgeConnection.offsetX = 5;
        edgeConnection.offsetY = 5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(420);
        expect(rect.top).toBe(165);
        expect(rect.right).toBe(620);
        expect(rect.bottom).toBe(365);
    });

    it('Should render the overlay using the first connection where the overlay fits within the viewport.', async () => {
        let selectedConnection: EdgeConnection | null = null;
        const connections: EdgeConnection[] = [
            {
                targetEdge: 'center-left',
                overlayEdge: 'center-right'
            },
            {
                targetEdge: 'top-left',
                overlayEdge: 'bottom-right',
            },
            {
                targetEdge: 'top-center',
                overlayEdge: 'bottom-center'
            },
            {
                targetEdge: 'center-right',
                overlayEdge: 'top-left'
            },
            {
                targetEdge: 'bottom-center',
                overlayEdge: 'top-left'
            }
        ];
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: connections as any,
                onEdgeConnectionSelected(connection) {
                    selectedConnection = connection;
                },
            })
        }));
        setTargetElementPosition(100, 100);
        handle.attach();
        await waitToAnimationFrame();
        const { left, top, right, bottom } = handle.componentContainer!.getBoundingClientRect();

        expect(left).toBe(150);
        expect(top).toBe(125);
        expect(right).toBe(350);
        expect(bottom).toBe(325);
        expect(selectedConnection).toBe(connections[3])
    });

    it('Should select the target edge where the overlay has the largest visible area.', async () => {
        let selectedConnection: EdgeConnection | null = null;
        const connections: EdgeConnection[] = [
            {
                targetEdge: 'center-left',
                overlayEdge: 'bottom-right'
            },
            {
                targetEdge: 'top-left',
                overlayEdge: 'bottom-right',
            },
            {
                targetEdge: 'top-center',
                overlayEdge: 'bottom-center'
            }
        ]
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: connections as any,
                onEdgeConnectionSelected(connection) {
                    selectedConnection = connection;
                },
            })
        }));

        setTargetElementPosition(100, 100);
        handle.attach();
        await waitToAnimationFrame();
        const { left, top, right, bottom } = handle.componentContainer!.getBoundingClientRect();

        expect(left).toBe(25);
        expect(top).toBe(-100);
        expect(right).toBe(225);
        expect(bottom).toBe(100);
        expect(selectedConnection).toBe(connections[2])
    });

    it('Should select the target edge where the overlay has the highest score.', async () => {
        let selectedConnection: EdgeConnection | null = null;
        const connections: EdgeConnection[] = [
            {
                targetEdge: 'center-left',
                overlayEdge: 'bottom-right'
            },
            {
                targetEdge: 'top-left',
                overlayEdge: 'bottom-right',
                weight: 3
            },
            {
                targetEdge: 'top-center',
                overlayEdge: 'bottom-center'
            }
        ]
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: connections as any,
                onEdgeConnectionSelected(connection) {
                    selectedConnection = connection;
                },
            })
        }));

        setTargetElementPosition(100, 100);
        handle.attach();
        await waitToAnimationFrame();
        const { left, top, right, bottom } = handle.componentContainer!.getBoundingClientRect();

        expect(left).toBe(-100);
        expect(top).toBe(-100);
        expect(right).toBe(100);
        expect(bottom).toBe(100);
        expect(selectedConnection).toBe(connections[1]);
    });

    it('Should push the overlay toward the target edge and correct its position on the opposite axis for the target top-left to overlay bottom-right connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'top-left',
            overlayEdge: 'bottom-right',
            offsetX: -20,
            offsetY: -20
        }
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));
        setTargetElementPosition(100, 100);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();
        
        expect(rect.left).toBe(-100)
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(50, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0)
        expect(rect.top).toBe(-100);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(100);

        handle.detach();
        setTargetElementPosition(100, 50);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(-100)
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(210, 210);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0)
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(200);

        handle.detach();
        connection.offsetY = 20;
        setTargetElementPosition(50, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(-150)
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(50);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(100, 50);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(-100)
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(100, 335)
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(-100)
        expect(rect.top).toBe(155);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(355);

        handle.detach();
        connection.offsetX = 20;
        connection.offsetY = -20;
        setTargetElementPosition(50, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0)
        expect(rect.top).toBe(-100);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(100);

        handle.detach();
        setTargetElementPosition(100, 50);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0)
        expect(rect.top).toBe(-150);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(50);

        handle.detach();
        setTargetElementPosition(615, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();
        expect(rect.left).toBe(435)
        expect(rect.top).toBe(-100);
        expect(rect.right).toBe(635);
        expect(rect.bottom).toBe(100);

        handle.detach();
        connection.offsetX = 5;
        connection.offsetY = 5;
        setTargetElementPosition(-25, -25);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0)
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(200);
    });

    it('Should push the overlay toward the target edge and correct its position on the opposite axis for the target top-right to overlay bottom-left connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'top-right',
            overlayEdge: 'bottom-left',
            offsetX: 20,
            offsetY: -20
        }
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));
        setTargetElementPosition(1130, 100);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180)
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(1180, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080)
        expect(rect.top).toBe(-100);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(100);

        handle.detach();
        setTargetElementPosition(1130, 50);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180)
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(1070, 210);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080)
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(200);

        handle.detach();
        connection.offsetY = 20;
        handle.detach();
        setTargetElementPosition(1180, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1230)
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(1430);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(1130, 50);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180)
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(1130, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180)
        expect(rect.top).toBe(155);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(355);

        handle.detach();
        connection.offsetX = -20
        connection.offsetY = -20;
        handle.detach();
        setTargetElementPosition(1180, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080)
        expect(rect.top).toBe(-100);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(100);

        handle.detach();
        handle.detach();
        setTargetElementPosition(1130, 50);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080)
        expect(rect.top).toBe(-150);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(50);

        handle.detach();
        handle.detach();
        setTargetElementPosition(615, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(645)
        expect(rect.top).toBe(-100);
        expect(rect.right).toBe(845);
        expect(rect.bottom).toBe(100);

        handle.detach();
        connection.offsetX = -5
        connection.offsetY = 5;
        setTargetElementPosition(1255, -25);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080)
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(200);
    });

    it('Should push the overlay toward the target edge and correct its position on the opposite axis for the target bottom-right to overlay top-left connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'bottom-right',
            overlayEdge: 'top-left',
            offsetX: 20,
            offsetY: 20
        }
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));
        setTargetElementPosition(1130, 570);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(1180, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(620);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(820);

        handle.detach();
        setTargetElementPosition(1130, 620);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(1020, 460);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(720);

        handle.detach();
        connection.offsetY = -20;
        setTargetElementPosition(1180, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();
    
        expect(rect.left).toBe(1230);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(1430);
        expect(rect.bottom).toBe(720);
    
        handle.detach();
        setTargetElementPosition(1130, 620);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();
    
        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(1130, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();
    
        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(365);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(565);

        handle.detach();
        connection.offsetX = -20;
        connection.offsetY = 20
        setTargetElementPosition(1180, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(620);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(820);

        handle.detach();
        setTargetElementPosition(1130, 620);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(670);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(870);

        handle.detach();
        setTargetElementPosition(615, 620);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(645);
        expect(rect.top).toBe(670);
        expect(rect.right).toBe(845);
        expect(rect.bottom).toBe(870);
    
        handle.detach();
        connection.offsetX = -5;
        connection.offsetY = -5;
        setTargetElementPosition(1255, 695);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(720);
    });

    it('Should push the overlay toward the target edge and correct its position on the opposite axis for the target bottom-left to overlay top-right connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'bottom-left',
            overlayEdge: 'top-right',
            offsetX: -20,
            offsetY: 20
        }
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));
        setTargetElementPosition(100, 570);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(-100);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(50, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(620);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(820);

        handle.detach();
        setTargetElementPosition(100, 620);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(-100);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(210, 460);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(720);

        handle.detach();
        connection.offsetY = -20;
        setTargetElementPosition(50, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();
    
        expect(rect.left).toBe(-150);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(50);
        expect(rect.bottom).toBe(720);
    
        handle.detach();
        setTargetElementPosition(100, 620);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();
    
        expect(rect.left).toBe(-100);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(100, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();
    
        expect(rect.left).toBe(-100);
        expect(rect.top).toBe(365);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(565);

        handle.detach();
        connection.offsetX = 20;
        connection.offsetY = 20
        setTargetElementPosition(50, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(620);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(820);

        handle.detach();
        setTargetElementPosition(100, 620);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(670);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(870);

        handle.detach();
        setTargetElementPosition(615, 620);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(435);
        expect(rect.top).toBe(670);
        expect(rect.right).toBe(635);
        expect(rect.bottom).toBe(870);
    
        handle.detach();
        connection.offsetX = 5;
        connection.offsetY = -5;
        setTargetElementPosition(-25, 695);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(720);
    });

    it('Should push the overlay toward the target top edge and correct its position on the opposite axis for the target top-left to overlay bottom-center connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'top-left',
            overlayEdge: 'bottom-center',
            offsetY: -20,
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));

        setTargetElementPosition(615, 100);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();
        
        expect(rect.left).toBe(515);
        expect(rect.top).toBe(-100);
        expect(rect.right).toBe(715);
        expect(rect.bottom).toBe(100);

        handle.detach();
        setTargetElementPosition(50, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(115);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(315);

        handle.detach();
        setTargetElementPosition(1230, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(115);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(315);

        handle.detach();
        setTargetElementPosition(50, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(-100);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(100);

        handle.detach();
        setTargetElementPosition(1230, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(-100);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(100);

        handle.detach();
        connection.offsetY = 5;
        setTargetElementPosition(615, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();
        expect(rect.left).toBe(515);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(715);
        expect(rect.bottom).toBe(200);
    });

    it('Should push the overlay toward the target top edge and correct its position on the opposite axis for the target top-left to overlay bottom-left connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'top-left',
            overlayEdge: 'bottom-left',
            offsetY: -20,
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));

        setTargetElementPosition(615, 100);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();
        
        expect(rect.left).toBe(615);
        expect(rect.top).toBe(-100);
        expect(rect.right).toBe(815);
        expect(rect.bottom).toBe(100);

        handle.detach();
        setTargetElementPosition(-25, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(115);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(315);

        handle.detach();
        setTargetElementPosition(1230, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(115);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(315);

        handle.detach();
        setTargetElementPosition(-25, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(-100);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(100);

        handle.detach();
        setTargetElementPosition(1230, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(-100);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(100);

        handle.detach();
        connection.offsetY = 5;
        setTargetElementPosition(615, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(615);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(815);
        expect(rect.bottom).toBe(200);
    });

    it('Should push the overlay toward the target top edge and correct its position on the opposite axis for the target top-center to overlay bottom-right connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'top-center',
            overlayEdge: 'bottom-right',
            offsetY: -20,
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));

        setTargetElementPosition(615, 100);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();
        
        expect(rect.left).toBe(440);
        expect(rect.top).toBe(-100);
        expect(rect.right).toBe(640);
        expect(rect.bottom).toBe(100);

        handle.detach();
        setTargetElementPosition(0, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(115);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(315);

        handle.detach();
        setTargetElementPosition(1330, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(115);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(315);

        handle.detach();
        setTargetElementPosition(0, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(-100);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(100);

        handle.detach();
        setTargetElementPosition(1330, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(-100);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(100);

        handle.detach();
        connection.offsetY = 5;
        setTargetElementPosition(615, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(440);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(640);
        expect(rect.bottom).toBe(200);
    });

    it('Should push the overlay toward the target top edge and correct its position on the opposite axis for the target top-center to overlay bottom-center connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'top-center',
            overlayEdge: 'bottom-center',
            offsetY: -20,
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));

        setTargetElementPosition(615, 100);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();
        
        expect(rect.left).toBe(540);
        expect(rect.top).toBe(-100);
        expect(rect.right).toBe(740);
        expect(rect.bottom).toBe(100);

        handle.detach();
        setTargetElementPosition(0, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(115);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(315);

        handle.detach();
        setTargetElementPosition(1255, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(115);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(315);

        handle.detach();
        setTargetElementPosition(0, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(-100);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(100);

        handle.detach();
        setTargetElementPosition(1255, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(-100);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(100);

        handle.detach();
        connection.offsetY = 5;
        setTargetElementPosition(615, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(540);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(740);
        expect(rect.bottom).toBe(200);
    });

    it('Should push the overlay toward the target top edge and correct its position on the opposite axis for the target top-center to overlay bottom-left connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'top-center',
            overlayEdge: 'bottom-left',
            offsetY: -20,
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));

        setTargetElementPosition(615, 100);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();
        
        expect(rect.left).toBe(640);
        expect(rect.top).toBe(-100);
        expect(rect.right).toBe(840);
        expect(rect.bottom).toBe(100);

        handle.detach();
        setTargetElementPosition(-50, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(115);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(315);

        handle.detach();
        setTargetElementPosition(1230, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(115);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(315);

        handle.detach();
        setTargetElementPosition(-50, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(-100);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(100);

        handle.detach();
        setTargetElementPosition(1230, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(-100);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(100);

        handle.detach();
        connection.offsetY = 5;
        setTargetElementPosition(615, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(640);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(840);
        expect(rect.bottom).toBe(200);
    });

    it('Should push the overlay toward the target top edge and correct its position on the opposite axis for the target top-right to overlay bottom-right connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'top-right',
            overlayEdge: 'bottom-right',
            offsetY: -20,
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));

        setTargetElementPosition(615, 100);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();
        
        expect(rect.left).toBe(465);
        expect(rect.top).toBe(-100);
        expect(rect.right).toBe(665);
        expect(rect.bottom).toBe(100);

        handle.detach();
        setTargetElementPosition(0, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(115);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(315);

        handle.detach();
        setTargetElementPosition(1255, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(115);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(315);

        handle.detach();
        setTargetElementPosition(0, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(-100);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(100);

        handle.detach();
        setTargetElementPosition(1255, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(-100);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(100);

        handle.detach();
        connection.offsetY = 5;
        setTargetElementPosition(615, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(465);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(665);
        expect(rect.bottom).toBe(200);
    });

    it('Should push the overlay toward the target top edge and correct its position on the opposite axis for the target top-right to overlay bottom-center connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'top-right',
            overlayEdge: 'bottom-center',
            offsetY: -20,
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));

        setTargetElementPosition(615, 100);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();
        
        expect(rect.left).toBe(565);
        expect(rect.top).toBe(-100);
        expect(rect.right).toBe(765);
        expect(rect.bottom).toBe(100);

        handle.detach();
        setTargetElementPosition(0, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(115);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(315);

        handle.detach();
        setTargetElementPosition(1230, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(115);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(315);

        handle.detach();
        setTargetElementPosition(0, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(-100);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(100);

        handle.detach();
        setTargetElementPosition(1230, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(-100);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(100);

        handle.detach();
        connection.offsetY = 5;
        setTargetElementPosition(615, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(565);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(765);
        expect(rect.bottom).toBe(200);
    });

    it('Should push the overlay toward the target top edge and correct its position on the opposite axis for the target top-right to overlay center-left connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'top-right',
            overlayEdge: 'center-left',
            offsetX: 20,
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));

        setTargetElementPosition(1130, 335);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(235);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(435);

        handle.detach();
        setTargetElementPosition(615, 50);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(685);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(885);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(615, 670);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(685);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(885);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(1130, 50);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(1130, 670);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(1130, 335);
        connection.offsetX = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(235);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(435);
    });

    it('Should push the overlay toward the target top edge and correct its position on the opposite axis for the target top-right to overlay top-left connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'top-right',
            overlayEdge: 'top-left',
            offsetX: 20,
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));

        setTargetElementPosition(1130, 335);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(335);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(535);

        handle.detach();
        setTargetElementPosition(615, -50);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(685);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(885);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(615, 670);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(685);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(885);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(1130, -50);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(1130, 670);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(1130, 335);
        connection.offsetX = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(335);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(535);
    });

    it('Should push the overlay toward the target top edge and correct its position on the opposite axis for the target center-right to overlay bottom-left connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'center-right',
            overlayEdge: 'bottom-left',
            offsetX: 20,
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));

        setTargetElementPosition(1130, 335);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(160);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(360);

        handle.detach();
        setTargetElementPosition(615, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(685);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(885);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(615, 720);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(685);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(885);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(1130, 100);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(1130, 720);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(1130, 335);
        connection.offsetX = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(160);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(360);
    });

    it('Should push the overlay toward the target top edge and correct its position on the opposite axis for the target center-right to overlay center-left connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'center-right',
            overlayEdge: 'center-left',
            offsetX: 20,
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));

        setTargetElementPosition(1130, 335);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(260);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(460);

        handle.detach();
        setTargetElementPosition(615, 50);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(685);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(885);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(615, 670);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(685);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(885);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(1130, 50);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(1130, 670);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(1130, 335);
        connection.offsetX = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(260);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(460);
    });

    it('Should push the overlay toward the target top edge and correct its position on the opposite axis for the target center-right to overlay top-left connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'center-right',
            overlayEdge: 'top-left',
            offsetX: 20,
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));

        setTargetElementPosition(1130, 335);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(360);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(560);

        handle.detach();
        setTargetElementPosition(615, -50);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(685);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(885);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(615, 670);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(685);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(885);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(1130, -50);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(1130, 670);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(1130, 335);
        connection.offsetX = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(360);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(560);
    });

    it('Should push the overlay toward the target top edge and correct its position on the opposite axis for the target bottom-right to overlay bottom-left connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'bottom-right',
            overlayEdge: 'bottom-left',
            offsetX: 20,
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));

        setTargetElementPosition(1130, 335);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(185);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(385);

        handle.detach();
        setTargetElementPosition(615, 0);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(685);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(885);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(615, 780);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(685);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(885);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(1130, 0);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(1130, 780);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(1130, 335);
        connection.offsetX = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(185);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(385);
    });

    it('Should push the overlay toward the target top edge and correct its position on the opposite axis for the target bottom-right to overlay center-left connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'bottom-right',
            overlayEdge: 'center-left',
            offsetX: 20,
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));

        setTargetElementPosition(1130, 335);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(285);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(485);

        handle.detach();
        setTargetElementPosition(615, 0);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(685);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(885);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(615, 670);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(685);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(885);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(1130, 0);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(1130, 670);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1180);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(1380);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(1130, 335);
        connection.offsetX = -5;
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(285);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(485);
    });

    it('Should push the overlay toward the target top edge and correct its position on the opposite axis for the target bottom-right to overlay top-right connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'bottom-right',
            overlayEdge: 'top-right',
            offsetY: 20,
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));

        setTargetElementPosition(615, 570);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(465);
        expect(rect.top).toBe(620);
        expect(rect.right).toBe(665);
        expect(rect.bottom).toBe(820);

        handle.detach();
        setTargetElementPosition(50, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(405);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(605);

        handle.detach();
        setTargetElementPosition(1330, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(405);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(605);

        handle.detach();
        setTargetElementPosition(50, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(620);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(820);

        handle.detach();
        setTargetElementPosition(1330, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(620);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(820);

        handle.detach();
        connection.offsetY = -5;
        setTargetElementPosition(615, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(465);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(665);
        expect(rect.bottom).toBe(720);
        
    });

    it('Should push the overlay toward the target top edge and correct its position on the opposite axis for the target bottom-right to overlay top-center connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'bottom-right',
            overlayEdge: 'top-center',
            offsetY: 20,
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));

        setTargetElementPosition(615, 570);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(565);
        expect(rect.top).toBe(620);
        expect(rect.right).toBe(765);
        expect(rect.bottom).toBe(820);

        handle.detach();
        setTargetElementPosition(0, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(405);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(605);

        handle.detach();
        setTargetElementPosition(1230, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(405);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(605);

        handle.detach();
        setTargetElementPosition(0, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(620);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(820);

        handle.detach();
        setTargetElementPosition(1230, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(620);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(820);

        handle.detach();
        connection.offsetY = -5;
        setTargetElementPosition(615, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(565);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(765);
        expect(rect.bottom).toBe(720);
    });

    it('Should push the overlay toward the target top edge and correct its position on the opposite axis for the target bottom-center to overlay top-right connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'bottom-center',
            overlayEdge: 'top-right',
            offsetY: 20,
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));

        setTargetElementPosition(615, 570);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(440);
        expect(rect.top).toBe(620);
        expect(rect.right).toBe(640);
        expect(rect.bottom).toBe(820);

        handle.detach();
        setTargetElementPosition(50, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(405);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(605);

        handle.detach();
        setTargetElementPosition(1330, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(405);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(605);

        handle.detach();
        setTargetElementPosition(50, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(620);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(820);

        handle.detach();
        setTargetElementPosition(1330, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(620);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(820);

        handle.detach();
        connection.offsetY = -5;
        setTargetElementPosition(615, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(440);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(640);
        expect(rect.bottom).toBe(720);
    });

    it('Should push the overlay toward the target top edge and correct its position on the opposite axis for the target bottom-center to overlay top-center connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'bottom-center',
            overlayEdge: 'top-center',
            offsetY: 20,
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));

        setTargetElementPosition(615, 570);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(540);
        expect(rect.top).toBe(620);
        expect(rect.right).toBe(740);
        expect(rect.bottom).toBe(820);

        handle.detach();
        setTargetElementPosition(50, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(405);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(605);

        handle.detach();
        setTargetElementPosition(1230, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(405);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(605);

        handle.detach();
        setTargetElementPosition(50, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(620);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(820);

        handle.detach();
        setTargetElementPosition(1230, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(620);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(820);

        handle.detach();
        connection.offsetY = -5;
        setTargetElementPosition(615, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(540);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(740);
        expect(rect.bottom).toBe(720);
    });

    it('Should push the overlay toward the target top edge and correct its position on the opposite axis for the target bottom-center to overlay top-left connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'bottom-center',
            overlayEdge: 'top-left',
            offsetY: 20,
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));

        setTargetElementPosition(615, 570);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(640);
        expect(rect.top).toBe(620);
        expect(rect.right).toBe(840);
        expect(rect.bottom).toBe(820);

        handle.detach();
        setTargetElementPosition(-50, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(405);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(605);

        handle.detach();
        setTargetElementPosition(1230, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(405);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(605);

        handle.detach();
        setTargetElementPosition(-50, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(620);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(820);

        handle.detach();
        setTargetElementPosition(1230, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(620);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(820);

        handle.detach();
        connection.offsetY = -5;
        setTargetElementPosition(615, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(640);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(840);
        expect(rect.bottom).toBe(720);
    });

    it('Should push the overlay toward the target top edge and correct its position on the opposite axis for the target bottom-left to overlay top-center connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'bottom-left',
            overlayEdge: 'top-center',
            offsetY: 20,
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));

        setTargetElementPosition(615, 570);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(515);
        expect(rect.top).toBe(620);
        expect(rect.right).toBe(715);
        expect(rect.bottom).toBe(820);

        handle.detach();
        setTargetElementPosition(50, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(405);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(605);

        handle.detach();
        setTargetElementPosition(1230, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(405);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(605);

        handle.detach();
        setTargetElementPosition(50, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(620);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(820);

        handle.detach();
        setTargetElementPosition(1230, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(620);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(820);

        handle.detach();
        connection.offsetY = -5;
        setTargetElementPosition(615, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(515);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(715);
        expect(rect.bottom).toBe(720);
    });

    it('Should push the overlay toward the target top edge and correct its position on the opposite axis for the target bottom-left to overlay top-left connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'bottom-left',
            overlayEdge: 'top-left',
            offsetY: 20,
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));

        setTargetElementPosition(615, 570);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(615);
        expect(rect.top).toBe(620);
        expect(rect.right).toBe(815);
        expect(rect.bottom).toBe(820);

        handle.detach();
        setTargetElementPosition(-50, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(405);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(605);

        handle.detach();
        setTargetElementPosition(1230, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(405);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(605);

        handle.detach();
        setTargetElementPosition(-50, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(620);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(820);

        handle.detach();
        setTargetElementPosition(1230, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(1080);
        expect(rect.top).toBe(620);
        expect(rect.right).toBe(1280);
        expect(rect.bottom).toBe(820);

        handle.detach();
        connection.offsetY = -5;
        setTargetElementPosition(615, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(615);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(815);
        expect(rect.bottom).toBe(720);
    });

    it('Should push the overlay toward the target top edge and correct its position on the opposite axis for the target bottom-left to overlay center-right connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'bottom-left',
            overlayEdge: 'center-right',
            offsetX: -20,
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));

        setTargetElementPosition(100, 335);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(-100);
        expect(rect.top).toBe(285);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(485);

        handle.detach();
        setTargetElementPosition(615, 620);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(395);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(595);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(615, 0);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(395);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(595);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(100, 620);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(-100);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(100, 0);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(-100);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(200);

        handle.detach();
        connection.offsetX = 5;
        setTargetElementPosition(100, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(285);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(485);
    });

    it('Should push the overlay toward the target top edge and correct its position on the opposite axis for the target bottom-left to overlay bottom-right connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'bottom-left',
            overlayEdge: 'bottom-right',
            offsetX: -20,
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));

        setTargetElementPosition(100, 335);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(-100);
        expect(rect.top).toBe(185);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(385);

        handle.detach();
        setTargetElementPosition(615, 770);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(395);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(595);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(615, 0);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(395);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(595);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(100, 770);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(-100);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(100, 0);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(-100);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(200);

        handle.detach();
        connection.offsetX = 5;
        setTargetElementPosition(100, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(185);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(385);
    });

    it('Should push the overlay toward the target top edge and correct its position on the opposite axis for the target center-left to overlay top-right connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'center-left',
            overlayEdge: 'top-right',
            offsetX: -20,
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));

        setTargetElementPosition(100, 335);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(-100);
        expect(rect.top).toBe(360);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(560);

        handle.detach();
        setTargetElementPosition(615, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(395);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(595);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(615, -50);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(395);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(595);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(100, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(-100);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(100, -50);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(-100);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(200);

        handle.detach();
        connection.offsetX = 5;
        setTargetElementPosition(100, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(360);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(560);
    });

    it('Should push the overlay toward the target top edge and correct its position on the opposite axis for the target center-left to overlay center-right connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'center-left',
            overlayEdge: 'center-right',
            offsetX: -20,
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));

        setTargetElementPosition(100, 335);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(-100);
        expect(rect.top).toBe(260);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(460);

        handle.detach();
        setTargetElementPosition(615, 620);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(395);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(595);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(615, 0);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(395);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(595);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(100, 620);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(-100);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(100, 0);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(-100);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(200);

        handle.detach();
        connection.offsetX = 5;
        setTargetElementPosition(100, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(260);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(460);
    });

    it('Should push the overlay toward the target top edge and correct its position on the opposite axis for the target center-left to overlay bottom-right connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'center-left',
            overlayEdge: 'bottom-right',
            offsetX: -20,
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));

        setTargetElementPosition(100, 335);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(-100);
        expect(rect.top).toBe(160);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(360);

        handle.detach();
        setTargetElementPosition(615, 770);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(395);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(595);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(615, 50);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(395);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(595);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(100, 770);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(-100);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(100, 50);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(-100);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(200);

        handle.detach();
        connection.offsetX = 5;
        setTargetElementPosition(100, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(160);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(360);
    });

    it('Should push the overlay toward the target top edge and correct its position on the opposite axis for the target top-left to overlay top-right connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'top-left',
            overlayEdge: 'top-right',
            offsetX: -20,
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));

        setTargetElementPosition(100, 335);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(-100);
        expect(rect.top).toBe(335);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(535);

        handle.detach();
        setTargetElementPosition(615, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(395);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(595);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(615, -50);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(395);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(595);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(100, 570);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(-100);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(100, -50);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(-100);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(200);

        handle.detach();
        connection.offsetX = 5;
        setTargetElementPosition(100, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(335);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(535);
    });

    it('Should push the overlay toward the target top edge and correct its position on the opposite axis for the target top-left to overlay center-right connection.', async () => {
        const connection: EdgeConnection = {
            targetEdge: 'top-left',
            overlayEdge: 'center-right',
            offsetX: -20,
        };
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [connection as any],
                push: true
            })
        }));

        setTargetElementPosition(100, 335);
        handle.attach();
        await waitToAnimationFrame();
        let rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(-100);
        expect(rect.top).toBe(235);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(435);

        handle.detach();
        setTargetElementPosition(615, 670);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(395);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(595);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(615, 0);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(395);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(595);
        expect(rect.bottom).toBe(200);

        handle.detach();
        setTargetElementPosition(100, 670);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(-100);
        expect(rect.top).toBe(520);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(720);

        handle.detach();
        setTargetElementPosition(100, 0);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(-100);
        expect(rect.top).toBe(0);
        expect(rect.right).toBe(100);
        expect(rect.bottom).toBe(200);

        handle.detach();
        connection.offsetX = 5;
        setTargetElementPosition(100, 335);
        handle.attach();
        await waitToAnimationFrame();
        rect = handle.componentContainer!.getBoundingClientRect();

        expect(rect.left).toBe(0);
        expect(rect.top).toBe(235);
        expect(rect.right).toBe(200);
        expect(rect.bottom).toBe(435);
    });

    it('Should throw an error when the targetGetter property is change to invalid value.', async () => {
        const errorMessage = 'connectedEdgesPositionStrategy({ targetGetter }): Invalid argument! Expected an object with "targetGetter" property of type function.';
        const [getTargetGetter, setTargetGetter] = createSignal<any>(() => targetElement);
        using flush = installMockRequestAnimationFrame();
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                get targetGetter(): () => Element {
                    return getTargetGetter()
                },
                connections: [{
                    targetEdge: 'top-left',
                    overlayEdge: 'bottom-left'
                }]
            })
        }));
        const reset = () => {
            setTargetGetter(() => () => targetElement);
            handle.detach();
        }

        handle.attach();
        await waitToAnimationFrame(flush);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setTargetGetter(0)).toThrow(errorMessage);

        reset()
        handle.attach();
        await waitToAnimationFrame(flush);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setTargetGetter(1)).toThrow(errorMessage);

        reset()
        handle.attach();
        await waitToAnimationFrame(flush);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setTargetGetter('')).toThrow(errorMessage);

        reset()
        handle.attach();
        await waitToAnimationFrame(flush);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setTargetGetter('A')).toThrow(errorMessage);

        reset()
        handle.attach();
        await waitToAnimationFrame(flush);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setTargetGetter(true)).toThrow(errorMessage);

        reset()
        handle.attach();
        await waitToAnimationFrame(flush);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setTargetGetter(false)).toThrow(errorMessage);

        reset()
        handle.attach();
        await waitToAnimationFrame(flush);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setTargetGetter(undefined)).toThrow(errorMessage);

        reset()
        handle.attach();
        await waitToAnimationFrame(flush);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setTargetGetter(null)).toThrow(errorMessage);

        reset()
        handle.attach();
        await waitToAnimationFrame(flush);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setTargetGetter({})).toThrow(errorMessage);

        reset()
        handle.attach();
        await waitToAnimationFrame(flush);
        expect(flush.callbacksCount).toBe(0);
        expect(() => setTargetGetter([])).toThrow(errorMessage);
    });

    it('Should throw an error when the push property is change to invalid value.', async () => {
        const errorMessage = 'connectedEdgesPositionStrategy({ push }): Invalid argument! Expected an object with "push" property of type boolean or without it.';
        const [getPush, setPush] = createSignal<any>(undefined);
        using flush = installMockRequestAnimationFrame();
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                connections: [{
                    targetEdge: 'top-left',
                    overlayEdge: 'bottom-left'
                }],
                get push(): boolean | undefined {
                    return getPush()
                }
            })
        }));
        
        handle.attach();
        await waitToAnimationFrame(flush);
        
        expect(flush.callbacksCount).toBe(0);
        setPush(0);
        expect(flush.callbacksCount).toBe(1);
        expect(() => flush()).toThrow(errorMessage);
        expect(() => setPush(1)).toThrow(errorMessage)
        expect(() => setPush('')).toThrow(errorMessage)
        expect(() => setPush('a')).toThrow(errorMessage)
        expect(() => setPush({})).toThrow(errorMessage)
        expect(() => setPush([])).toThrow(errorMessage)
        expect(() => setPush(() => () => {})).toThrow(errorMessage)

        expect(() => setPush(true)).not.toThrow();
        expect(flush.callbacksCount).toBe(0);
        setPush(false);
        expect(flush.callbacksCount).toBe(1);
        expect(() => flush()).not.toThrow();
        setPush(null);
        expect(flush.callbacksCount).toBe(1);
        expect(() => flush()).not.toThrow();
        setPush(undefined);
        expect(flush.callbacksCount).toBe(1);
        expect(() => flush()).not.toThrow();
    });

    it('Should throw an error when the connections property is change to invalid value', async () => {
        const errorMessage1 = 'connectedEdgesPositionStrategy({ connections }): Invalid argument! Expected an object with "connections" property of type array.'
        const errorMessage2 = 'connectedEdgesPositionStrategy({ connections }): Invalid argument! The "connections" property can not be an empty array.';
        const errorMessage3 = `connectedEdgesPositionStrategy({ connections[0] }): Invalid edge pair! Following are allowed: ${JSON.stringify(_validConnections)}`;
        const errorMessage4 = `connectedEdgesPositionStrategy({ connections[1] }): Invalid edge pair! Following are allowed: ${JSON.stringify(_validConnections)}`;
        const [getConnections, setConnections] = createSignal<any>([{ targetEdge: 'top-left', overlayEdge: 'bottom-right' }]);
        using flush = installMockRequestAnimationFrame();
        const handle = inRoot(() => createOverlay({
            component: () => <div style="width: 200px; height: 200px"></div>,
            positionStrategy: connectedEdgesPositionStrategy({
                targetGetter: () => targetElement,
                get connections() {
                    return getConnections()
                }
            })
        }));

        handle.attach();
        await waitToAnimationFrame(flush);
        expect(flush.callbacksCount).toBe(0);
        setConnections(0);
        expect(flush.callbacksCount).toBe(1);
        expect(() => flush()).toThrow(errorMessage1);
        expect(() => setConnections(1)).toThrow(errorMessage1);
        expect(() => setConnections('')).toThrow(errorMessage1);
        expect(() => setConnections('A')).toThrow(errorMessage1);
        expect(() => setConnections(true)).toThrow(errorMessage1);
        expect(() => setConnections(false)).toThrow(errorMessage1);
        expect(() => setConnections(undefined)).toThrow(errorMessage1);
        expect(() => setConnections(null)).toThrow(errorMessage1);
        expect(() => setConnections({})).toThrow(errorMessage1);
        expect(() => setConnections(() => () => {})).toThrow(errorMessage1);
        
        expect(() => setConnections([])).toThrow(errorMessage2);

        expect(() => setConnections([{ targetEdge: 'top-left', overlayEdge: 'top-left' }])).toThrow(errorMessage3);

        expect(() => setConnections([{ targetEdge: 'top-left', overlayEdge: 'bottom-right' }])).not.toThrow();

        handle.detach();
        setTargetElementPosition(100, 100);
        handle.attach();
        await waitToAnimationFrame(flush);
        expect(flush.callbacksCount).toBe(0);
        setConnections([
            { targetEdge: 'top-left', overlayEdge: 'bottom-right' },
            { targetEdge: 'top-left', overlayEdge: 'top-left' },
        ]);

        expect(flush.callbacksCount).toBe(1);
        expect(() => flush()).toThrow(errorMessage4);
    })
});
