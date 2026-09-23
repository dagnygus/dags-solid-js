import { createRoot } from 'solid-js';
import { createOverlay as ogCreateOverlay } from '../overlay';
import { blockInteractions, detachAfterDisposeAndAnimation, detachOnOutsideClick, detachOnScrollOutside, disposeOnOutsideClick, disposeOnScrollOutside } from './underlying-interaction-strategy';

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

afterEach(() => {
    dispose();
    document.body.replaceChildren();
});

afterAll(() => {
    vitest.doUnmock('../overlay');
    delete (globalThis as any).__IS_SERVER__;
});


describe('blockInteractions', () => {

    it('Should throw an error in a server environment.', () => {
        const errorMessage = 'blockInteractions(): This function is not available in a server environment.';
        using spy = vitest.spyOn((globalThis as any), '__IS_SERVER__', 'get').mockReturnValue(true);
        const handle = createOverlay({ component: () => <></>, positionStrategy: (el) => el });
        const element = document.createElement('div');

        expect(() => blockInteractions.call(handle as any, element, element)).toThrow(errorMessage);
    });

    it('Should throw an error if this argument is not an _OverlayHandleImpl instance.', () => {
        const errorMessage = 'blockInteractions(): Underlying interaction strategy must be executed with an OverlayHandle as its "this" value!';
        const divElement = document.createElement('div');
        const pElement = document.createElement('p');
        //@ts-expect-error
        expect(() => blockInteractions(divElement, pElement)).toThrow(errorMessage);
    });

    it('Should throw an error if the first argument is not na HTMLDivElement instance.', () => {
        const errorMessage = 'blockInteractions(): Invalid first argument! Expected an HTMLDivElement instance.';
        const handle = createOverlay({component: () => <></>, positionStrategy: (el) => el});
        const divElement = document.createElement('div');
        const pElement = document.createElement('p');

        expect(() => (blockInteractions as any).call(handle, 0, pElement)).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, 1, pElement)).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, '', pElement)).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, 'A', pElement)).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, true, pElement)).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, false, pElement)).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, undefined, pElement)).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, null, pElement)).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, {}, pElement)).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, [], pElement)).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, () => {}, pElement)).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, pElement, pElement)).toThrow(errorMessage);

        expect(() => (blockInteractions as any).call(handle, divElement, pElement)).not.toThrow();
    });

    it('Should throw an error if the second argument is not an HTMLElement instance.', () => {
        const errorMessage = 'blockInteractions(): Invalid second argument! Expected an HTMLElement instance.';
        const handle = createOverlay({component: () => <></>, positionStrategy: (el) => el});
        const divElement = document.createElement('div');
        const pElement = document.createElement('p');

        expect(() => (blockInteractions as any).call(handle, divElement, 0)).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, divElement, 1)).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, divElement, '')).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, divElement, 'A')).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, divElement, true)).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, divElement, false)).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, divElement, undefined)).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, divElement, null)).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, divElement, {})).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, divElement, [])).toThrow(errorMessage);
        expect(() => (blockInteractions as any).call(handle, divElement, () => {})).toThrow(errorMessage);

        expect(() => (blockInteractions as any).call(handle, divElement, divElement)).not.toThrow();
        expect(() => (blockInteractions as any).call(handle, divElement, pElement)).not.toThrow();
    });
});

describe('detachOnOutsideClick()', () => {

    it('Should throw an error in a server environment.', () => {
        const errorMessage = 'detachOnOutsideClick(): This function is not available in a server environment.';
        using spy = vitest.spyOn((globalThis as any), '__IS_SERVER__', 'get').mockReturnValue(true);
        const handle = createOverlay({ component: () => <></>, positionStrategy: (el) => el });
        const element = document.createElement('div');

        expect(() => detachOnOutsideClick.call(handle as any, element, element)).toThrow(errorMessage);
    });

    it('Should throw an error if this argument is not an _OverlayHandleImpl instance.', () => {
        const errorMessage = 'detachOnOutsideClick(): Underlying interaction strategy must be executed with an OverlayHandle as its "this" value!';
        const divElement = document.createElement('div');
        const pElement = document.createElement('p');
        //@ts-expect-error
        expect(() => detachOnOutsideClick(divElement, pElement)).toThrow(errorMessage);
    });

    it('Should throw an error if the first argument is not na HTMLDivElement instance.', () => {
        const errorMessage = 'detachOnOutsideClick(): Invalid first argument! Expected an HTMLDivElement instance.';
        const handle = createOverlay({component: () => <></>, positionStrategy: (el) => el});
        const divElement = document.createElement('div');
        const pElement = document.createElement('p');

        expect(() => (detachOnOutsideClick as any).call(handle, 0, pElement)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, 1, pElement)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, '', pElement)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, 'A', pElement)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, true, pElement)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, false, pElement)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, undefined, pElement)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, null, pElement)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, {}, pElement)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, [], pElement)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, () => {}, pElement)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, pElement, pElement)).toThrow(errorMessage);

        expect(() => (detachOnOutsideClick as any).call(handle, divElement, pElement)).not.toThrow();
    });

    it('Should throw an error if the second argument is not an HTMLElement instance.', () => {
        const errorMessage = 'detachOnOutsideClick(): Invalid second argument! Expected an HTMLElement instance.';
        const handle = createOverlay({component: () => <></>, positionStrategy: (el) => el});
        const divElement = document.createElement('div');
        const pElement = document.createElement('p');

        expect(() => (detachOnOutsideClick as any).call(handle, divElement, 0)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, divElement, 1)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, divElement, '')).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, divElement, 'A')).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, divElement, true)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, divElement, false)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, divElement, undefined)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, divElement, null)).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, divElement, {})).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, divElement, [])).toThrow(errorMessage);
        expect(() => (detachOnOutsideClick as any).call(handle, divElement, () => {})).toThrow(errorMessage);

        expect(() => (detachOnOutsideClick as any).call(handle, divElement, divElement)).not.toThrow();
        expect(() => (detachOnOutsideClick as any).call(handle, divElement, pElement)).not.toThrow();
    });

    it('Should detach an overlay when a click event occurs outside the component container.', () => {
        const handle = createOverlay({
            component: () => <></>,
            positionStrategy: (el) => el,
            underlyingInteractionStrategies: detachOnOutsideClick,
            withBackdrop: true
        });

        const appRoot = document.body.appendChild(document.createElement('div'));

        handle.attach();
        appRoot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(handle.attached).toBe(false);

        handle.attach();
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(handle.attached).toBe(false);

        handle.attach();
        handle.componentContainer!.parentElement!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(handle.attached).toBe(false);

        handle.attach();
        handle.backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(handle.attached).toBe(false);

        handle.attach();
        handle.componentContainer!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(handle.attached).toBe(true);
    });

});

describe('disposeOnOutsideClick()', () => {

    it('Should throw an error in a server environment.', () => {
        const errorMessage = 'disposeOnOutsideClick(): This function is not available in a server environment.';
        using spy = vitest.spyOn((globalThis as any), '__IS_SERVER__', 'get').mockReturnValue(true);
        const handle = createOverlay({ component: () => <></>, positionStrategy: (el) => el });
        const element = document.createElement('div');

        expect(() => disposeOnOutsideClick.call(handle as any, element, element)).toThrow(errorMessage);
    });

    it('Should throw an error if this argument is not an _OverlayHandleImpl instance.', () => {
        const errorMessage = 'disposeOnOutsideClick(): Underlying interaction strategy must be executed with an OverlayHandle as its "this" value!';
        const divElement = document.createElement('div');
        const pElement = document.createElement('p');
        //@ts-expect-error
        expect(() => disposeOnOutsideClick(divElement, pElement)).toThrow(errorMessage);
    });

    it('Should throw an error if the first argument is not na HTMLDivElement instance.', () => {
        const errorMessage = 'disposeOnOutsideClick(): Invalid first argument! Expected an HTMLDivElement instance.';
        const handle = createOverlay({component: () => <></>, positionStrategy: (el) => el});
        const divElement = document.createElement('div');
        const pElement = document.createElement('p');

        expect(() => (disposeOnOutsideClick as any).call(handle, 0, pElement)).toThrow(errorMessage);
        expect(() => (disposeOnOutsideClick as any).call(handle, 1, pElement)).toThrow(errorMessage);
        expect(() => (disposeOnOutsideClick as any).call(handle, '', pElement)).toThrow(errorMessage);
        expect(() => (disposeOnOutsideClick as any).call(handle, 'A', pElement)).toThrow(errorMessage);
        expect(() => (disposeOnOutsideClick as any).call(handle, true, pElement)).toThrow(errorMessage);
        expect(() => (disposeOnOutsideClick as any).call(handle, false, pElement)).toThrow(errorMessage);
        expect(() => (disposeOnOutsideClick as any).call(handle, undefined, pElement)).toThrow(errorMessage);
        expect(() => (disposeOnOutsideClick as any).call(handle, null, pElement)).toThrow(errorMessage);
        expect(() => (disposeOnOutsideClick as any).call(handle, {}, pElement)).toThrow(errorMessage);
        expect(() => (disposeOnOutsideClick as any).call(handle, [], pElement)).toThrow(errorMessage);
        expect(() => (disposeOnOutsideClick as any).call(handle, () => {}, pElement)).toThrow(errorMessage);
        expect(() => (disposeOnOutsideClick as any).call(handle, pElement, pElement)).toThrow(errorMessage);

        expect(() => (disposeOnOutsideClick as any).call(handle, divElement, pElement)).not.toThrow();
    });

    it('Should throw an error if the second argument is not an HTMLElement instance.', () => {
        const errorMessage = 'disposeOnOutsideClick(): Invalid second argument! Expected an HTMLElement instance.';
        const handle = createOverlay({component: () => <></>, positionStrategy: (el) => el});
        const divElement = document.createElement('div');
        const pElement = document.createElement('p');

        expect(() => (disposeOnOutsideClick as any).call(handle, divElement, 0)).toThrow(errorMessage);
        expect(() => (disposeOnOutsideClick as any).call(handle, divElement, 1)).toThrow(errorMessage);
        expect(() => (disposeOnOutsideClick as any).call(handle, divElement, '')).toThrow(errorMessage);
        expect(() => (disposeOnOutsideClick as any).call(handle, divElement, 'A')).toThrow(errorMessage);
        expect(() => (disposeOnOutsideClick as any).call(handle, divElement, true)).toThrow(errorMessage);
        expect(() => (disposeOnOutsideClick as any).call(handle, divElement, false)).toThrow(errorMessage);
        expect(() => (disposeOnOutsideClick as any).call(handle, divElement, undefined)).toThrow(errorMessage);
        expect(() => (disposeOnOutsideClick as any).call(handle, divElement, null)).toThrow(errorMessage);
        expect(() => (disposeOnOutsideClick as any).call(handle, divElement, {})).toThrow(errorMessage);
        expect(() => (disposeOnOutsideClick as any).call(handle, divElement, [])).toThrow(errorMessage);
        expect(() => (disposeOnOutsideClick as any).call(handle, divElement, () => {})).toThrow(errorMessage);

        expect(() => (disposeOnOutsideClick as any).call(handle, divElement, divElement)).not.toThrow();
        expect(() => (disposeOnOutsideClick as any).call(handle, divElement, pElement)).not.toThrow();
    });

    it('Should dispose an overlay when a click event occurs outside the component container.', () => {
        const handle = createOverlay({
            component: () => <></>,
            positionStrategy: (el) => el,
            underlyingInteractionStrategies: disposeOnOutsideClick,
            withBackdrop: true
        });

        const appRoot = document.body.appendChild(document.createElement('div'));

        handle.attach();
        appRoot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(handle.disposed).toBe(true);

        handle.detach();
        handle.attach();
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(handle.disposed).toBe(true);

        handle.detach();
        handle.attach();
        handle.componentContainer!.parentElement!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(handle.disposed).toBe(true);

        handle.detach();
        handle.attach();
        handle.backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(handle.disposed).toBe(true);

        handle.detach();
        handle.attach();
        handle.componentContainer!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(handle.disposed).toBe(false);
    });

});

describe('detachOnScrollOutside()', () => {

    it('Should throw an error in a server environment.', () => {
        const errorMessage = 'detachOnScrollOutside(): This function is not available in a server environment.';
        using spy = vitest.spyOn((globalThis as any), '__IS_SERVER__', 'get').mockReturnValue(true);
        const handle = createOverlay({ component: () => <></>, positionStrategy: (el) => el });
        const element = document.createElement('div');

        expect(() => detachOnScrollOutside.call(handle as any, element, element)).toThrow(errorMessage);
    });

    it('Should throw an error if this argument is not an _OverlayHandleImpl instance.', () => {
        const errorMessage = 'detachOnScrollOutside(): Underlying interaction strategy must be executed with an OverlayHandle as its "this" value!';
        const divElement = document.createElement('div');
        const pElement = document.createElement('p');
        //@ts-expect-error
        expect(() => detachOnScrollOutside(divElement, pElement)).toThrow(errorMessage);
    });

    it('Should throw an error if the first argument is not na HTMLDivElement instance.', () => {
        const errorMessage = 'detachOnScrollOutside(): Invalid first argument! Expected an HTMLDivElement instance.';
        const handle = createOverlay({component: () => <></>, positionStrategy: (el) => el});
        const divElement = document.createElement('div');
        const pElement = document.createElement('p');

        expect(() => (detachOnScrollOutside as any).call(handle, 0, pElement)).toThrow(errorMessage);
        expect(() => (detachOnScrollOutside as any).call(handle, 1, pElement)).toThrow(errorMessage);
        expect(() => (detachOnScrollOutside as any).call(handle, '', pElement)).toThrow(errorMessage);
        expect(() => (detachOnScrollOutside as any).call(handle, 'A', pElement)).toThrow(errorMessage);
        expect(() => (detachOnScrollOutside as any).call(handle, true, pElement)).toThrow(errorMessage);
        expect(() => (detachOnScrollOutside as any).call(handle, false, pElement)).toThrow(errorMessage);
        expect(() => (detachOnScrollOutside as any).call(handle, undefined, pElement)).toThrow(errorMessage);
        expect(() => (detachOnScrollOutside as any).call(handle, null, pElement)).toThrow(errorMessage);
        expect(() => (detachOnScrollOutside as any).call(handle, {}, pElement)).toThrow(errorMessage);
        expect(() => (detachOnScrollOutside as any).call(handle, [], pElement)).toThrow(errorMessage);
        expect(() => (detachOnScrollOutside as any).call(handle, () => {}, pElement)).toThrow(errorMessage);
        expect(() => (detachOnScrollOutside as any).call(handle, pElement, pElement)).toThrow(errorMessage);

        expect(() => (detachOnScrollOutside as any).call(handle, divElement, pElement)).not.toThrow();
    });

    it('Should throw an error if the second argument is not an HTMLElement instance.', () => {
        const errorMessage = 'detachOnScrollOutside(): Invalid second argument! Expected an HTMLElement instance.';
        const handle = createOverlay({component: () => <></>, positionStrategy: (el) => el});
        const divElement = document.createElement('div');
        const pElement = document.createElement('p');

        expect(() => (detachOnScrollOutside as any).call(handle, divElement, 0)).toThrow(errorMessage);
        expect(() => (detachOnScrollOutside as any).call(handle, divElement, 1)).toThrow(errorMessage);
        expect(() => (detachOnScrollOutside as any).call(handle, divElement, '')).toThrow(errorMessage);
        expect(() => (detachOnScrollOutside as any).call(handle, divElement, 'A')).toThrow(errorMessage);
        expect(() => (detachOnScrollOutside as any).call(handle, divElement, true)).toThrow(errorMessage);
        expect(() => (detachOnScrollOutside as any).call(handle, divElement, false)).toThrow(errorMessage);
        expect(() => (detachOnScrollOutside as any).call(handle, divElement, undefined)).toThrow(errorMessage);
        expect(() => (detachOnScrollOutside as any).call(handle, divElement, null)).toThrow(errorMessage);
        expect(() => (detachOnScrollOutside as any).call(handle, divElement, {})).toThrow(errorMessage);
        expect(() => (detachOnScrollOutside as any).call(handle, divElement, [])).toThrow(errorMessage);
        expect(() => (detachOnScrollOutside as any).call(handle, divElement, () => {})).toThrow(errorMessage);

        expect(() => (detachOnScrollOutside as any).call(handle, divElement, divElement)).not.toThrow();
        expect(() => (detachOnScrollOutside as any).call(handle, divElement, pElement)).not.toThrow();
    });

    it('Should detach an overlay when a click event occurs outside the component container.', () => {
        const handle = createOverlay({
            component: () => <></>,
            positionStrategy: (el) => el,
            underlyingInteractionStrategies: detachOnScrollOutside,
            withBackdrop: true
        });

        const appRoot = document.body.appendChild(document.createElement('div'));

        handle.attach();
        appRoot.dispatchEvent(new MouseEvent('scroll', { bubbles: true }));
        expect(handle.attached).toBe(false);

        handle.attach();
        document.body.dispatchEvent(new MouseEvent('scroll', { bubbles: true }));
        expect(handle.attached).toBe(false);

        handle.attach();
        handle.componentContainer!.parentElement!.dispatchEvent(new MouseEvent('scroll', { bubbles: true }));
        expect(handle.attached).toBe(false);

        handle.attach();
        handle.backdrop.dispatchEvent(new MouseEvent('scroll', { bubbles: true }));
        expect(handle.attached).toBe(false);

        handle.attach();
        handle.componentContainer!.dispatchEvent(new MouseEvent('scroll', { bubbles: true }));
        expect(handle.attached).toBe(true);
    });

});

describe('disposeOnScrollOutside()', () => {

    it('Should throw an error in a server environment.', () => {
        const errorMessage = 'disposeOnScrollOutside(): This function is not available in a server environment.';
        using spy = vitest.spyOn((globalThis as any), '__IS_SERVER__', 'get').mockReturnValue(true);
        const handle = createOverlay({ component: () => <></>, positionStrategy: (el) => el });
        const element = document.createElement('div');

        expect(() => disposeOnScrollOutside.call(handle as any, element, element)).toThrow(errorMessage);
    });

    it('Should throw an error if this argument is not an _OverlayHandleImpl instance.', () => {
        const errorMessage = 'disposeOnScrollOutside(): Underlying interaction strategy must be executed with an OverlayHandle as its "this" value!';
        const divElement = document.createElement('div');
        const pElement = document.createElement('p');
        //@ts-expect-error
        expect(() => disposeOnScrollOutside(divElement, pElement)).toThrow(errorMessage);
    });

    it('Should throw an error if the first argument is not na HTMLDivElement instance.', () => {
        const errorMessage = 'disposeOnScrollOutside(): Invalid first argument! Expected an HTMLDivElement instance.';
        const handle = createOverlay({component: () => <></>, positionStrategy: (el) => el});
        const divElement = document.createElement('div');
        const pElement = document.createElement('p');

        expect(() => (disposeOnScrollOutside as any).call(handle, 0, pElement)).toThrow(errorMessage);
        expect(() => (disposeOnScrollOutside as any).call(handle, 1, pElement)).toThrow(errorMessage);
        expect(() => (disposeOnScrollOutside as any).call(handle, '', pElement)).toThrow(errorMessage);
        expect(() => (disposeOnScrollOutside as any).call(handle, 'A', pElement)).toThrow(errorMessage);
        expect(() => (disposeOnScrollOutside as any).call(handle, true, pElement)).toThrow(errorMessage);
        expect(() => (disposeOnScrollOutside as any).call(handle, false, pElement)).toThrow(errorMessage);
        expect(() => (disposeOnScrollOutside as any).call(handle, undefined, pElement)).toThrow(errorMessage);
        expect(() => (disposeOnScrollOutside as any).call(handle, null, pElement)).toThrow(errorMessage);
        expect(() => (disposeOnScrollOutside as any).call(handle, {}, pElement)).toThrow(errorMessage);
        expect(() => (disposeOnScrollOutside as any).call(handle, [], pElement)).toThrow(errorMessage);
        expect(() => (disposeOnScrollOutside as any).call(handle, () => {}, pElement)).toThrow(errorMessage);
        expect(() => (disposeOnScrollOutside as any).call(handle, pElement, pElement)).toThrow(errorMessage);

        expect(() => (disposeOnScrollOutside as any).call(handle, divElement, pElement)).not.toThrow();
    });

    it('Should throw an error if the second argument is not an HTMLElement instance.', () => {
        const errorMessage = 'disposeOnScrollOutside(): Invalid second argument! Expected an HTMLElement instance.';
        const handle = createOverlay({component: () => <></>, positionStrategy: (el) => el});
        const divElement = document.createElement('div');
        const pElement = document.createElement('p');

        expect(() => (disposeOnScrollOutside as any).call(handle, divElement, 0)).toThrow(errorMessage);
        expect(() => (disposeOnScrollOutside as any).call(handle, divElement, 1)).toThrow(errorMessage);
        expect(() => (disposeOnScrollOutside as any).call(handle, divElement, '')).toThrow(errorMessage);
        expect(() => (disposeOnScrollOutside as any).call(handle, divElement, 'A')).toThrow(errorMessage);
        expect(() => (disposeOnScrollOutside as any).call(handle, divElement, true)).toThrow(errorMessage);
        expect(() => (disposeOnScrollOutside as any).call(handle, divElement, false)).toThrow(errorMessage);
        expect(() => (disposeOnScrollOutside as any).call(handle, divElement, undefined)).toThrow(errorMessage);
        expect(() => (disposeOnScrollOutside as any).call(handle, divElement, null)).toThrow(errorMessage);
        expect(() => (disposeOnScrollOutside as any).call(handle, divElement, {})).toThrow(errorMessage);
        expect(() => (disposeOnScrollOutside as any).call(handle, divElement, [])).toThrow(errorMessage);
        expect(() => (disposeOnScrollOutside as any).call(handle, divElement, () => {})).toThrow(errorMessage);

        expect(() => (disposeOnScrollOutside as any).call(handle, divElement, divElement)).not.toThrow();
        expect(() => (disposeOnScrollOutside as any).call(handle, divElement, pElement)).not.toThrow();
    });

    it('Should dispose an overlay when a click event occurs outside the component container.', () => {
        const handle = createOverlay({
            component: () => <></>,
            positionStrategy: (el) => el,
            underlyingInteractionStrategies: disposeOnScrollOutside,
            withBackdrop: true
        });

        const appRoot = document.body.appendChild(document.createElement('div'));

        handle.attach();
        appRoot.dispatchEvent(new MouseEvent('scroll', { bubbles: true }));
        expect(handle.disposed).toBe(true);

        handle.detach();
        handle.attach();
        document.body.dispatchEvent(new MouseEvent('scroll', { bubbles: true }));
        expect(handle.disposed).toBe(true);

        handle.detach();
        handle.attach();
        handle.componentContainer!.parentElement!.dispatchEvent(new MouseEvent('scroll', { bubbles: true }));
        expect(handle.disposed).toBe(true);

        handle.detach();
        handle.attach();
        handle.backdrop.dispatchEvent(new MouseEvent('scroll', { bubbles: true }));
        expect(handle.disposed).toBe(true);

        handle.detach();
        handle.attach();
        handle.componentContainer!.dispatchEvent(new MouseEvent('scroll', { bubbles: true }));
        expect(handle.disposed).toBe(false);
    });

});

describe('detachAfterDisposeAndAnimation()', () => {

    it('Should throw an error in a server environment.', () => {
        const errorMessage = 'detachAfterDisposeAndAnimation(): This function is not available in a server environment.';
        using spy = vitest.spyOn((globalThis as any), '__IS_SERVER__', 'get').mockReturnValue(true);
        const handle = createOverlay({ component: () => <></>, positionStrategy: (el) => el });
        const element = document.createElement('div');

        expect(() => detachAfterDisposeAndAnimation.call(handle as any, element, element)).toThrow(errorMessage);
    });

    it('Should throw an error if this argument is not an _OverlayHandleImpl instance.', () => {
        const errorMessage = 'detachAfterDisposeAndAnimation(): Underlying interaction strategy must be executed with an OverlayHandle as its "this" value!';
        const divElement = document.createElement('div');
        const pElement = document.createElement('p');
        //@ts-expect-error
        expect(() => detachAfterDisposeAndAnimation(divElement, pElement)).toThrow(errorMessage);
    });

    it('Should throw an error if the first argument is not na HTMLDivElement instance.', () => {
        const errorMessage = 'detachAfterDisposeAndAnimation(): Invalid first argument! Expected an HTMLDivElement instance.';
        const handle = createOverlay({component: () => <></>, positionStrategy: (el) => el});
        const divElement = document.createElement('div');
        const pElement = document.createElement('p');

        expect(() => (detachAfterDisposeAndAnimation as any).call(handle, 0, pElement)).toThrow(errorMessage);
        expect(() => (detachAfterDisposeAndAnimation as any).call(handle, 1, pElement)).toThrow(errorMessage);
        expect(() => (detachAfterDisposeAndAnimation as any).call(handle, '', pElement)).toThrow(errorMessage);
        expect(() => (detachAfterDisposeAndAnimation as any).call(handle, 'A', pElement)).toThrow(errorMessage);
        expect(() => (detachAfterDisposeAndAnimation as any).call(handle, true, pElement)).toThrow(errorMessage);
        expect(() => (detachAfterDisposeAndAnimation as any).call(handle, false, pElement)).toThrow(errorMessage);
        expect(() => (detachAfterDisposeAndAnimation as any).call(handle, undefined, pElement)).toThrow(errorMessage);
        expect(() => (detachAfterDisposeAndAnimation as any).call(handle, null, pElement)).toThrow(errorMessage);
        expect(() => (detachAfterDisposeAndAnimation as any).call(handle, {}, pElement)).toThrow(errorMessage);
        expect(() => (detachAfterDisposeAndAnimation as any).call(handle, [], pElement)).toThrow(errorMessage);
        expect(() => (detachAfterDisposeAndAnimation as any).call(handle, () => {}, pElement)).toThrow(errorMessage);
        expect(() => (detachAfterDisposeAndAnimation as any).call(handle, pElement, pElement)).toThrow(errorMessage);

        expect(() => (detachAfterDisposeAndAnimation as any).call(handle, divElement, pElement)).not.toThrow();
    });

    it('Should throw an error if the second argument is not an HTMLElement instance.', () => {
        const errorMessage = 'detachAfterDisposeAndAnimation(): Invalid second argument! Expected an HTMLElement instance.';
        const handle = createOverlay({component: () => <></>, positionStrategy: (el) => el});
        const divElement = document.createElement('div');
        const pElement = document.createElement('p');

        expect(() => (detachAfterDisposeAndAnimation as any).call(handle, divElement, 0)).toThrow(errorMessage);
        expect(() => (detachAfterDisposeAndAnimation as any).call(handle, divElement, 1)).toThrow(errorMessage);
        expect(() => (detachAfterDisposeAndAnimation as any).call(handle, divElement, '')).toThrow(errorMessage);
        expect(() => (detachAfterDisposeAndAnimation as any).call(handle, divElement, 'A')).toThrow(errorMessage);
        expect(() => (detachAfterDisposeAndAnimation as any).call(handle, divElement, true)).toThrow(errorMessage);
        expect(() => (detachAfterDisposeAndAnimation as any).call(handle, divElement, false)).toThrow(errorMessage);
        expect(() => (detachAfterDisposeAndAnimation as any).call(handle, divElement, undefined)).toThrow(errorMessage);
        expect(() => (detachAfterDisposeAndAnimation as any).call(handle, divElement, null)).toThrow(errorMessage);
        expect(() => (detachAfterDisposeAndAnimation as any).call(handle, divElement, {})).toThrow(errorMessage);
        expect(() => (detachAfterDisposeAndAnimation as any).call(handle, divElement, [])).toThrow(errorMessage);
        expect(() => (detachAfterDisposeAndAnimation as any).call(handle, divElement, () => {})).toThrow(errorMessage);

        expect(() => (detachAfterDisposeAndAnimation as any).call(handle, divElement, divElement)).not.toThrow();
        expect(() => (detachAfterDisposeAndAnimation as any).call(handle, divElement, pElement)).not.toThrow();
    });

    it('Should detach the overlay after it is disposed and the component container fires an animationend event.', () => {
        const  handle = createOverlay({
            component: () => <div id="child"></div>,
            positionStrategy: (el) => el,
            underlyingInteractionStrategies: detachAfterDisposeAndAnimation
        });

        handle.attach();
        expect(handle.attached).toBe(true);
        handle.dispose();
        expect(handle.disposed).toBe(true);
        expect(handle.attached).toBe(true);
        document.getElementById('child')!.dispatchEvent(new Event('animationend', { bubbles: true }));
        expect(handle.disposed).toBe(true);
        expect(handle.attached).toBe(true);
        handle.componentContainer!.dispatchEvent(new Event('animationend', { bubbles: true }));
        expect(handle.attached).toBe(false);
    });

    it('Should detach the overlay after it is disposed and the component container fires an animationcancel event.', () => {
        const  handle = createOverlay({
            component: () => <div id="child"></div>,
            positionStrategy: (el) => el,
            underlyingInteractionStrategies: detachAfterDisposeAndAnimation
        });

        handle.attach();
        expect(handle.attached).toBe(true);
        handle.dispose();
        expect(handle.disposed).toBe(true);
        expect(handle.attached).toBe(true);
        document.getElementById('child')!.dispatchEvent(new Event('animationcancel', { bubbles: true }));
        expect(handle.disposed).toBe(true);
        expect(handle.attached).toBe(true);
        handle.componentContainer!.dispatchEvent(new Event('animationcancel', { bubbles: true }));
        expect(handle.attached).toBe(false);
    });

    it('Should detach the overlay after it is disposed and the component container fires an transitionend event.', () => {
        const  handle = createOverlay({
            component: () => <div id="child"></div>,
            positionStrategy: (el) => el,
            underlyingInteractionStrategies: detachAfterDisposeAndAnimation
        });

        handle.attach();
        expect(handle.attached).toBe(true);
        handle.dispose();
        expect(handle.disposed).toBe(true);
        expect(handle.attached).toBe(true);
        document.getElementById('child')!.dispatchEvent(new TransitionEvent('transitionend', { bubbles: true }));
        expect(handle.disposed).toBe(true);
        expect(handle.attached).toBe(true);
        handle.componentContainer!.dispatchEvent(new TransitionEvent('transitionend', { bubbles: true }));
        expect(handle.attached).toBe(false);
    });

    it('Should detach the overlay after it is disposed and the component container fires an transitioncancel event.', () => {
        const  handle = createOverlay({
            component: () => <div id="child"></div>,
            positionStrategy: (el) => el,
            underlyingInteractionStrategies: detachAfterDisposeAndAnimation
        });

        handle.attach();
        expect(handle.attached).toBe(true);
        handle.dispose();
        expect(handle.disposed).toBe(true);
        expect(handle.attached).toBe(true);
        document.getElementById('child')!.dispatchEvent(new TransitionEvent('transitioncancel', { bubbles: true }));
        expect(handle.disposed).toBe(true);
        expect(handle.attached).toBe(true);
        handle.componentContainer!.dispatchEvent(new TransitionEvent('transitioncancel', { bubbles: true }));
        expect(handle.attached).toBe(false);
    });
});