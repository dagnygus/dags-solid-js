import { createRoot } from 'solid-js';
import { _OverlayHandleImpl, createOverlay as ogCreateOverlay } from '../overlay';
import { blockInteractions, detachOnOutsideClick } from './underlying-interaction-strategy';

const disposeBag: (() => void)[] = [];
const createOverlay: typeof ogCreateOverlay = (config) => {
    return createRoot((dispose) => {
        disposeBag.push(dispose);
        return ogCreateOverlay(config) as any;
    })
}

function dispose(): void {
    while (disposeBag.length) {
        disposeBag.shift()!();
    }
}


vitest.mock(import('../overlay'), (importOgModule) => {
    (globalThis as any).__IS_SERVER__ = false;
    return importOgModule();
});

afterEach(() => dispose());

afterAll(() => {
    vitest.doUnmock('../overlay');
    delete (globalThis as any).__IS_SERVER__;
});


describe('blockInteractions', () => {

    it('Should throw an error if this argument is not an _OverlayHandleImpl instance.', () => {
        const errorMessage = 'blockInteractions(): Underlying interaction strategy must be executed with an OverlayHandle as its "this" value!';
        const element = document.createElement('div');
        //@ts-expect-error
        expect(() => blockInteractions(element)).toThrow(errorMessage);
    });

    it('Should throw an error if provided argument is not na HTMLElement instance.', () => {
        const errorMessage = 'blockInteraction(): Invalid argument! Expected an HTMLElement instance.';
        const handle = createOverlay({component: () => <></>, positionStrategy: (el) => el});
        const element = document.createElement('div');

        expect(() => (blockInteractions as any).call(handle, 0)).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, 1)).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, '')).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, 'A')).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, true)).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, false)).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, undefined)).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, null)).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, {})).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, [])).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, () => {})).toThrow(errorMessage);

        expect(() => (blockInteractions as any).call(handle, element)).not.toThrow();
    });
});

describe('detachOnOutsideClick()', () => {

    it('Should throw an error if this argument is not an _OverlayHandleImpl instance.', () => {
        const errorMessage = 'detachOnOutsideClick(): Underlying interaction strategy must be executed with an OverlayHandle as its "this" value!';
        const element = document.createElement('div');
        //@ts-expect-error
        expect(() => detachOnOutsideClick(element)).toThrow(errorMessage);
    });

    it('Should throw an error if the first argument is not na HTMLElement instance.', () => {
        const errorMessage = 'detachOnOutsideClick(): Invalid first argument! Expected an HTMLElement instance.';
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const math = document.createElementNS('http://www.w3.org/1998/Math/MathML', 'math');
        const div = document.createElement('div');
        const handle = createOverlay({ component: () => <></>, positionStrategy: (el) => el });

        expect(() => (detachOnOutsideClick as any).call(handle, 0, div)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, 1, div)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, '', div)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, 'A', div)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, true, div)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, false, div)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, undefined, div)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, null, div)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, {}, div)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, [], div)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, () => {}, div)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, svg, div)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, math, div)).toThrow(errorMessage);

        expect(() => (detachOnOutsideClick as any).call(handle, div, div)).not.toThrow();
    });

    it('Should throw an error if the second argument is not na LElement instance', () => {
        const errorMessage = 'detachOnOutsideClick(): Invalid second argument! Expected an Element instance.';
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const math = document.createElementNS('http://www.w3.org/1998/Math/MathML', 'math');
        const div = document.createElement('div');
        const handle = createOverlay({ component: () => <></>, positionStrategy: (el) => el });

        expect(() => (detachOnOutsideClick as any).call(handle, div, 0)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, div, 1)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, div, '')).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, div, 'A')).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, div, true)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, div, false)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, div, undefined)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, div, null)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, div, {})).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, div, [])).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, div, () => {})).toThrow(errorMessage);

        expect(() => (detachOnOutsideClick as any).call(handle, div, svg)).not.toThrow();
        expect(() => (detachOnOutsideClick as any).call(handle, div, math)).not.toThrow();
        expect(() => (detachOnOutsideClick as any).call(handle, div, div)).not.toThrow();
    });

})