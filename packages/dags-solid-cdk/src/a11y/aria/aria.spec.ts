import { createRoot, getOwner } from "solid-js";
import { _cloneSanitized, _blacklistedElements, _elementsToUnwrap, _sanitize, _resetInternals, liveAnnounce, _getInternals, getLiveAnnouncerId, ariaDescribe } from "./aria";

const disposeBag: (() => void)[] = [];
const pendingEffects: (() => void)[] = vitest.hoisted(() => []);

function dispose(assertNoPendingEffects = false): void {
    while (disposeBag.length) {
        disposeBag.shift()!();
    }
    if (assertNoPendingEffects && pendingEffects.length) {
        throw new Error('There are still pending effect! Count: ' + pendingEffects.length);
    }
}

function inRoot<T>(fn: () => T): T {
    return createRoot((dispose) => {
        disposeBag.push(dispose);
        return fn();
    });
}

function fireEffects(): void {
    while (pendingEffects.length) {
        pendingEffects.shift()!();
    }
}

function discardPendingEffects(): void {
    pendingEffects.splice(0);
}

function assertPendingEffectsCount(expectedCount: number): void {
    expect(pendingEffects.length).toBe(expectedCount);
}

vitest.mock(import('solid-js'), async (importOgModule) => {
    const ogModule = await importOgModule();
    const ogOnMount = ogModule.onMount;
    const runWithOwner = ogModule.runWithOwner

    const fakeOnMount: typeof ogOnMount = (fn) => {
        const owner = getOwner()
        pendingEffects.push(() => runWithOwner(owner, () => ogOnMount(fn)))
    }

    return {
        ...ogModule,
        onMount: fakeOnMount
    }
});

vitest.mock(import('./aria'), (importOgModule) => {
    (globalThis as any).__IS_SERVER__ = false;
    return importOgModule()
})

afterEach(() => {
    document.body.replaceChildren();
    dispose(true);
    _resetInternals();
});

afterAll(() => {
    vitest.doUnmock('solid-js');
    vitest.doUnmock('./aria');
    delete (globalThis as any).__IS_SERVER__
})

describe('_cloneSanitized()', () => {

    it('Should exclude blacklisted elements and their descendants from sanitized clones.', () => {
        for (const tagName of _blacklistedElements) {
            const el = document.createElement(tagName.toLowerCase());
            expect(_cloneSanitized(el)).toBeNull();

            const container = document.createElement('div');
            container.appendChild(el);
            const sanitized = _cloneSanitized(container);
            expect(sanitized instanceof HTMLDivElement).toBe(true);
            expect(sanitized!.hasChildNodes()).toBe(false);
        }
    });

    it('Should unwrap elements configured to be unwrapped during sanitization.', () => {
        for (const tagName of _elementsToUnwrap) {
            const el = document.createElement(tagName.toLowerCase());
            expect(_cloneSanitized(el) instanceof DocumentFragment).toBe(true);

            const container = document.createElement('div');
            container.appendChild(el);
            const sanitized = _cloneSanitized(container);
            expect(sanitized instanceof HTMLDivElement).toBe(true);
            expect(sanitized!.hasChildNodes()).toBe(false);
        }
    });

    it('Should preserve allowed child elements when sanitizing.', () => {
        const parent = document.createElement('div');
        parent.appendChild(document.createElement('div'));
        parent.appendChild(document.createElement('div'));
        const sanitized = _cloneSanitized(parent);
        
        expect(sanitized instanceof HTMLDivElement).toBe(true);
        expect(sanitized!.childNodes.length).toBe(2);
        expect(sanitized!.childNodes[0] instanceof HTMLDivElement).toBe(true);
        expect(sanitized!.childNodes[1] instanceof HTMLDivElement).toBe(true);
    });

    it('Should clone text nodes.', () => {
        const text = document.createTextNode('Hello');
        const cloned = _cloneSanitized(text);

        expect(cloned instanceof Text).toBe(true);
        expect((cloned as Text).data).toBe('Hello');
    });

    it('Should recursively clone nested elements.', () => {
        const parent = document.createElement('div');
        const child = parent.appendChild(document.createElement('span'));
        const grandchild = child.appendChild(document.createElement('strong'));
        grandchild.appendChild(document.createTextNode('Hello'));

        const sanitized = _cloneSanitized(parent);

        expect(sanitized instanceof HTMLDivElement).toBe(true);

        const sanitizedChild = sanitized!.firstChild;
        expect(sanitizedChild instanceof HTMLSpanElement).toBe(true);

        const sanitizedGrandchild = sanitizedChild!.firstChild;
        expect(sanitizedGrandchild instanceof HTMLElement).toBe(true);
        expect((sanitizedGrandchild as any).tagName).toBe('STRONG');

        expect(sanitizedGrandchild!.firstChild instanceof Text).toBe(true);
        expect(sanitizedGrandchild!.textContent).toBe('Hello');
    });

    it('Should sanitize nested blacklisted and unwrapped elements.', () => {
        const parent = document.createElement('div');

        const allowed = parent.appendChild(document.createElement('span'));

        const blacklisted = allowed.appendChild(
            document.createElement([..._blacklistedElements][0].toLowerCase())
        );

        const unwrapped = allowed.appendChild(
            document.createElement([..._elementsToUnwrap][0].toLowerCase())
        );

        unwrapped.appendChild(document.createTextNode('Hello'));

        const sanitized = _cloneSanitized(parent);

        expect(sanitized instanceof HTMLDivElement).toBe(true);

        const sanitizedAllowed = sanitized!.firstChild;
        expect(sanitizedAllowed instanceof HTMLSpanElement).toBe(true);

        expect(sanitizedAllowed!.childNodes.length).toBe(1);

        const sanitizedUnwrapped = sanitizedAllowed!.firstChild;
        expect(sanitizedUnwrapped instanceof Text).toBe(true);
        expect(sanitizedUnwrapped!.textContent).toBe('Hello');

        expect(blacklisted).not.toBe(sanitizedAllowed!.firstChild);
    });
});

describe('_sanitize()', () => {

    it('Should sanitize an HTML string.', () => {
        const sanitized = _sanitize('<div><span>Hello</span></div>');

        expect(sanitized instanceof DocumentFragment).toBe(true);
        expect(sanitized!.firstChild instanceof HTMLDivElement).toBe(true);
        expect(sanitized!.firstChild!.firstChild instanceof HTMLSpanElement).toBe(true);
        expect(sanitized!.textContent).toBe('Hello');
    });

    it('Should sanitize a DOM node.', () => {
        const element = document.createElement('div');
        const child = element.appendChild(document.createElement('span'));
        child.appendChild(document.createTextNode('Hello'));

        const sanitized = _sanitize(element);

        expect(sanitized instanceof HTMLDivElement).toBe(true);
        expect(sanitized).not.toBe(element);
        expect(sanitized!.firstChild instanceof HTMLSpanElement).toBe(true);
        expect(sanitized!.textContent).toBe('Hello');
    });

    it('Should sanitize blacklisted elements from an HTML string.', () => {
        const sanitized = _sanitize('<div>Hello<script>alert("x")</script>World</div>')!.firstChild;

        expect(sanitized instanceof HTMLDivElement).toBe(true);
        expect(sanitized!.childNodes.length).toBe(2);
        expect(sanitized!.textContent).toBe('HelloWorld');
        expect((sanitized as any).querySelector('script')).toBeNull();
    });

    it('Should unwrap configured elements from an HTML string.', () => {
        const tagName = [..._elementsToUnwrap][0].toLowerCase();
        const sanitized = _sanitize(`<div><${tagName}>Hello</${tagName}></div>`)!.firstChild;

        expect(sanitized instanceof HTMLDivElement).toBe(true);
        expect(sanitized!.textContent).toBe('Hello');
        expect(sanitized!.childNodes.length).toBe(1);
        expect(sanitized!.firstChild instanceof Text).toBe(true);
    });

    it('Should sanitize a document fragment.', () => {
        const fragment = document.createDocumentFragment();
        const div = fragment.appendChild(document.createElement('div'));
        div.appendChild(document.createTextNode('Hello'));

        const sanitized = _sanitize(fragment);

        expect(sanitized instanceof DocumentFragment).toBe(true);
        expect(sanitized!.childNodes.length).toBe(1);
        expect(sanitized!.firstChild instanceof HTMLDivElement).toBe(true);
    });

    it('Should return null if the provided string is empty or contains only whitespace.', () => {
        expect(_sanitize('')).toBeNull();
        expect(_sanitize(' ')).toBeNull();
        expect(_sanitize('  ')).toBeNull();
        expect(_sanitize('   ')).toBeNull();
        expect(_sanitize('\t')).toBeNull();
        expect(_sanitize(' \t')).toBeNull();
        expect(_sanitize('\t ')).toBeNull();
        expect(_sanitize(' \t ')).toBeNull();
        expect(_sanitize('\n')).toBeNull();
        expect(_sanitize(' \n')).toBeNull();
        expect(_sanitize('\n ')).toBeNull();
        expect(_sanitize(' \n ')).toBeNull();
        expect(_sanitize('\n\t')).toBeNull();
        expect(_sanitize(' \n\t')).toBeNull();
        expect(_sanitize('\n\t ')).toBeNull();
        expect(_sanitize(' \n\t ')).toBeNull();
        expect(_sanitize('\t\n')).toBeNull();
        expect(_sanitize(' \t\n')).toBeNull();
        expect(_sanitize('\t\n ')).toBeNull();
        expect(_sanitize(' \t\n ')).toBeNull();
        expect(_sanitize('\n \t')).toBeNull();
        expect(_sanitize(' \n \t')).toBeNull();
        expect(_sanitize('\n \t ')).toBeNull();
        expect(_sanitize(' \n \t ')).toBeNull();
        expect(_sanitize('\t \n')).toBeNull();
        expect(_sanitize(' \t \n')).toBeNull();
        expect(_sanitize('\t \n ')).toBeNull();
        expect(_sanitize(' \t \n ')).toBeNull();
    });

});

describe('liveAnnounce()', () => {
    beforeAll(() => {
        vitest.useFakeTimers();
    });

    afterAll(() => {
        vitest.useRealTimers();
    });

    it('Should throw an error if the first argument is not a string or an HTMLElement instance.', () => {
        let errorMessage = 'liveAnnounce(): Invalid argument! Expected a string or an HTMLElement instance.';

        expect(() => liveAnnounce(0 as any)).toThrow(errorMessage);
        expect(() => liveAnnounce(1 as any)).toThrow(errorMessage);
        expect(() => liveAnnounce(true as any)).toThrow(errorMessage);
        expect(() => liveAnnounce(false as any)).toThrow(errorMessage);
        expect(() => liveAnnounce(undefined as any)).toThrow(errorMessage);
        expect(() => liveAnnounce(null as any)).toThrow(errorMessage);
        expect(() => liveAnnounce({} as any)).toThrow(errorMessage);
        expect(() => liveAnnounce([] as any)).toThrow(errorMessage);
        expect(() => liveAnnounce((() => {}) as any)).toThrow(errorMessage);

        errorMessage = 'liveAnnounce(): Invalid first argument! Expected a string or an HTMLElement instance.';

        expect(() => liveAnnounce(0 as any, 'off')).toThrow(errorMessage);
        expect(() => liveAnnounce(0 as any, 0)).toThrow(errorMessage);
        expect(() => liveAnnounce(1 as any, 'off')).toThrow(errorMessage);
        expect(() => liveAnnounce(1 as any, 1)).toThrow(errorMessage);
        expect(() => liveAnnounce(true as any, 'off')).toThrow(errorMessage);
        expect(() => liveAnnounce(true as any, 1)).toThrow(errorMessage);
        expect(() => liveAnnounce(false as any, 'off')).toThrow(errorMessage);
        expect(() => liveAnnounce(false as any, 1)).toThrow(errorMessage);
        expect(() => liveAnnounce(undefined as any, 'off')).toThrow(errorMessage);
        expect(() => liveAnnounce(undefined as any, 1)).toThrow(errorMessage);
        expect(() => liveAnnounce(null as any, 'off')).toThrow(errorMessage);
        expect(() => liveAnnounce(null as any, 1)).toThrow(errorMessage);
        expect(() => liveAnnounce({} as any, 'off')).toThrow(errorMessage);
        expect(() => liveAnnounce({} as any, 1)).toThrow(errorMessage);
        expect(() => liveAnnounce([] as any, 'off')).toThrow(errorMessage);
        expect(() => liveAnnounce([] as any, 1)).toThrow(errorMessage);
        expect(() => liveAnnounce((() => {}) as any, 'off')).toThrow(errorMessage);
        expect(() => liveAnnounce((() => {}) as any, 1)).toThrow(errorMessage);
        
        expect(() => liveAnnounce(0 as any, 'off', 0)).toThrow(errorMessage);
        expect(() => liveAnnounce(1 as any, 'off', 0)).toThrow(errorMessage);
        expect(() => liveAnnounce(true as any, 'off', 0)).toThrow(errorMessage);
        expect(() => liveAnnounce(false as any, 'off', 0)).toThrow(errorMessage);
        expect(() => liveAnnounce(undefined as any, 'off', 0)).toThrow(errorMessage);
        expect(() => liveAnnounce(null as any, 'off', 0)).toThrow(errorMessage);
        expect(() => liveAnnounce({} as any, 'off', 0)).toThrow(errorMessage);
        expect(() => liveAnnounce([] as any, 'off', 0)).toThrow(errorMessage);
        expect(() => liveAnnounce((() => {}) as any, 'off', 0)).toThrow(errorMessage);

        expect(() => liveAnnounce('')).not.toThrow();
        expect(() => liveAnnounce('A')).not.toThrow();
        expect(() => liveAnnounce(document.createElement('div'))).not.toThrow();
    });

    it('Should throw an error if the second argument is not a number or a politeness level', () => {
        let errorMessage = 'liveAnnounce(): Invalid second argument! Expected one of [ "off", "polite", "assertive" ] or a number.';

        expect(() => liveAnnounce('', '' as any)).toThrow(errorMessage);
        expect(() => liveAnnounce('', 'A' as any)).toThrow(errorMessage);
        expect(() => liveAnnounce('', true as any)).toThrow(errorMessage);
        expect(() => liveAnnounce('', false as any)).toThrow(errorMessage);
        expect(() => liveAnnounce('', undefined as any)).toThrow(errorMessage);
        expect(() => liveAnnounce('', null as any)).toThrow(errorMessage);
        expect(() => liveAnnounce('', {} as any)).toThrow(errorMessage);
        expect(() => liveAnnounce('', [] as any)).toThrow(errorMessage);
        expect(() => liveAnnounce('', (() => {}) as any)).toThrow(errorMessage);

        errorMessage = 'liveAnnounce(): Invalid second argument! NaN is not supported.';
        expect(() => liveAnnounce('', NaN)).toThrow(errorMessage);

        errorMessage = 'liveAnnounce(): Invalid second argument! Infinite numbers are not supported.';
        expect(() => liveAnnounce('', Number.POSITIVE_INFINITY)).toThrow(errorMessage);
        expect(() => liveAnnounce('', Number.NEGATIVE_INFINITY)).toThrow(errorMessage);

        expect(() => liveAnnounce('', 0)).not.toThrow();
        expect(() => liveAnnounce('', 1)).not.toThrow();
        expect(() => liveAnnounce('', 'off')).not.toThrow();
        expect(() => liveAnnounce('', 'assertive')).not.toThrow();
        expect(() => liveAnnounce('', 'polite')).not.toThrow();
    });

    it('Should throw an error if the second argument is not a politeness level when all arguments are provided.', () => {
        const errorMessage = 'liveAnnounce(): Invalid second argument! Expected one of [ "off", "polite", "assertive" ].';

        expect(() => liveAnnounce('', 0 as any, 0)).toThrow(errorMessage);
        expect(() => liveAnnounce('', 1 as any, 0)).toThrow(errorMessage);
        expect(() => liveAnnounce('', '' as any, 0)).toThrow(errorMessage);
        expect(() => liveAnnounce('', 'A' as any, 0)).toThrow(errorMessage);
        expect(() => liveAnnounce('', true as any, 0)).toThrow(errorMessage);
        expect(() => liveAnnounce('', false as any, 0)).toThrow(errorMessage);
        expect(() => liveAnnounce('', undefined as any, 0)).toThrow(errorMessage);
        expect(() => liveAnnounce('', null as any, 0)).toThrow(errorMessage);
        expect(() => liveAnnounce('', {} as any, 0)).toThrow(errorMessage);
        expect(() => liveAnnounce('', [] as any, 0)).toThrow(errorMessage);
        expect(() => liveAnnounce('', (() => {}) as any, 0)).toThrow(errorMessage);

        expect(() => liveAnnounce('', 'off', 0)).not.toThrow();
        expect(() => liveAnnounce('', 'assertive', 0)).not.toThrow();
        expect(() => liveAnnounce('', 'polite', 0)).not.toThrow();
    });

    it('Should throw an error if the third argument is not a number when all arguments are provided', () => {
        let errorMessage = 'liveAnnounce(): Invalid third argument! Expected a number.';

        expect(() => liveAnnounce('', 'off', '' as any)).toThrow(errorMessage);
        expect(() => liveAnnounce('', 'off', 'A' as any)).toThrow(errorMessage);
        expect(() => liveAnnounce('', 'off', true as any)).toThrow(errorMessage);
        expect(() => liveAnnounce('', 'off', false as any)).toThrow(errorMessage);
        expect(() => liveAnnounce('', 'off', undefined as any)).toThrow(errorMessage);
        expect(() => liveAnnounce('', 'off', null as any)).toThrow(errorMessage);
        expect(() => liveAnnounce('', 'off', {} as any)).toThrow(errorMessage);
        expect(() => liveAnnounce('', 'off', [] as any)).toThrow(errorMessage);
        expect(() => liveAnnounce('', 'off', (() => {}) as any)).toThrow(errorMessage);

        errorMessage = 'liveAnnounce(): Invalid third argument! NaN is not supported.';
        expect(() => liveAnnounce('', 'off', NaN)).toThrow(errorMessage);

        errorMessage = 'liveAnnounce(): Invalid third argument! Infinite numbers are not supported.';
        expect(() => liveAnnounce('', 'off', Number.POSITIVE_INFINITY)).toThrow(errorMessage);
        expect(() => liveAnnounce('', 'off', Number.NEGATIVE_INFINITY)).toThrow(errorMessage);

        expect(() => liveAnnounce('', 'off', 0)).not.toThrow();
        expect(() => liveAnnounce('', 'off', 1)).not.toThrow();
    });

    it('Should create a live element once.', () => {
        expect(_getInternals().liveElement).toBeNull();

        liveAnnounce('');
        const liveElement = _getInternals().liveElement;

        expect(liveElement).not.toBeNull()
        expect(liveElement).toBe(document.getElementById(getLiveAnnouncerId()));

        liveAnnounce('');
        expect(_getInternals().liveElement).toBe(liveElement);
    });

    it('Should update liveElement after 100 milliseconds have elapsed.', () => {
        liveAnnounce('Hello');
        const liveElement = document.getElementById(getLiveAnnouncerId()) as HTMLDivElement;

        expect(liveElement.hasChildNodes()).toBe(false);
        vitest.advanceTimersByTime(20);
        expect(liveElement.hasChildNodes()).toBe(false);
        vitest.advanceTimersByTime(20);
        expect(liveElement.hasChildNodes()).toBe(false);
        vitest.advanceTimersByTime(20);
        expect(liveElement.hasChildNodes()).toBe(false);
        vitest.advanceTimersByTime(20);
        expect(liveElement.hasChildNodes()).toBe(false);
        vitest.advanceTimersByTime(20);
        expect(liveElement.hasChildNodes()).toBe(true);
        expect(liveElement.childNodes.length).toBe(1);
        expect(liveElement.firstChild instanceof Text).toBe(true);
        expect(liveElement.textContent).toBe('Hello');

        liveAnnounce('<span>World</span>');
        expect(liveElement.hasChildNodes()).toBe(false);
        vitest.advanceTimersByTime(20);
        expect(liveElement.hasChildNodes()).toBe(false);
        vitest.advanceTimersByTime(20);
        expect(liveElement.hasChildNodes()).toBe(false);
        vitest.advanceTimersByTime(20);
        expect(liveElement.hasChildNodes()).toBe(false);
        vitest.advanceTimersByTime(20);
        expect(liveElement.hasChildNodes()).toBe(false);
        vitest.advanceTimersByTime(20);
        expect(liveElement.hasChildNodes()).toBe(true);
        expect(liveElement.childNodes.length).toBe(1);
        expect(liveElement.firstChild instanceof HTMLSpanElement).toBe(true);
        expect(liveElement.textContent).toBe('World');

        const div = document.createElement('div');
        div.textContent = 'Hello again';
        liveAnnounce(div);
        expect(liveElement.hasChildNodes()).toBe(false);
        vitest.advanceTimersByTime(20);
        expect(liveElement.hasChildNodes()).toBe(false);
        vitest.advanceTimersByTime(20);
        expect(liveElement.hasChildNodes()).toBe(false);
        vitest.advanceTimersByTime(20);
        expect(liveElement.hasChildNodes()).toBe(false);
        vitest.advanceTimersByTime(20);
        expect(liveElement.hasChildNodes()).toBe(false);
        vitest.advanceTimersByTime(20);
        expect(liveElement.hasChildNodes()).toBe(true);
        expect(liveElement.childNodes.length).toBe(1);
        expect(liveElement.firstChild instanceof HTMLDivElement).toBe(true);
        expect(liveElement.textContent).toBe('Hello again');
    });

    it('Should not update liveElement for empty or whitespace-only messages.', () => {
        using spy = vitest.spyOn(globalThis, 'setTimeout');
        liveAnnounce('Hello');
        const liveElement = _getInternals().liveElement!;
        expect(spy).toHaveBeenCalledTimes(1);
        vitest.advanceTimersByTime(100);
        expect(liveElement.textContent).toBe('Hello');

        liveAnnounce('');
        expect(spy).toHaveBeenCalledTimes(1);
        expect(liveElement.textContent).toBe('');

        liveAnnounce(' ');
        expect(spy).toHaveBeenCalledTimes(1);
        expect(liveElement.textContent).toBe('');

        liveAnnounce('\t');
        expect(spy).toHaveBeenCalledTimes(1);
        expect(liveElement.textContent).toBe('');

        liveAnnounce('\n');
        expect(spy).toHaveBeenCalledTimes(1);
        expect(liveElement.textContent).toBe('');

        liveAnnounce('\n\t');
        expect(spy).toHaveBeenCalledTimes(1);
        expect(liveElement.textContent).toBe('');

        liveAnnounce('\t\n');
        expect(spy).toHaveBeenCalledTimes(1);
        expect(liveElement.textContent).toBe('');
    });

    it('Should not schedule a liveElement update for empty or whitespace-only messages.', () => {
        using spy = vitest.spyOn(globalThis, 'setTimeout');
        liveAnnounce('Hello');
        const liveElement = _getInternals().liveElement!;
        expect(spy).toHaveBeenCalledTimes(1);
        vitest.advanceTimersByTime(100);
        expect(liveElement.textContent).toBe('Hello');

        liveAnnounce('<script>Hello</script>');
        expect(spy).toHaveBeenCalledTimes(1);
        expect(liveElement.textContent).toBe('');

        const message = document.createElement('script');
        message.textContent = 'Hello';
        liveAnnounce(message);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(liveElement.textContent).toBe('');
    });

    it('Should update liveElement with provided politeness level.', () => {
        liveAnnounce('A', 'off');
        const liveElement = _getInternals().liveElement!;
        vitest.advanceTimersByTime(100);
        expect(liveElement.textContent).toBe('A');
        expect(liveElement.ariaLive).toBe('off');

        liveAnnounce('B', 'assertive');
        vitest.advanceTimersByTime(100);
        expect(liveElement.textContent).toBe('B');
        expect(liveElement.ariaLive).toBe('assertive');

        liveAnnounce('C', 'polite');
        vitest.advanceTimersByTime(100);
        expect(liveElement.textContent).toBe('C');
        expect(liveElement.ariaLive).toBe('polite');
    });

    it('Should update liveElement with "polite" politeness if no politeness level is provided.', () => {
        liveAnnounce('A', 'off');
        const liveElement = _getInternals().liveElement!;
        vitest.advanceTimersByTime(100);
        expect(liveElement.textContent).toBe('A');
        expect(liveElement.ariaLive).toBe('off');

        liveAnnounce('B');
        vitest.advanceTimersByTime(100);
        expect(liveElement.textContent).toBe('B');
        expect(liveElement.ariaLive).toBe('polite');
    });

    it('Should remove the message after the given duration.', () => {
        liveAnnounce('A', 100);
        const liveElement = _getInternals().liveElement!;
        vitest.advanceTimersByTime(100);
        expect(liveElement.textContent).toBe('A');
        vitest.advanceTimersByTime(50);
        expect(liveElement.textContent).toBe('A');
        vitest.advanceTimersByTime(50);
        expect(liveElement.hasChildNodes()).toBe(false);

        liveAnnounce('B', 'assertive', 200);
        vitest.advanceTimersByTime(100);
        expect(liveElement.textContent).toBe('B');
        vitest.advanceTimersByTime(100);
        expect(liveElement.textContent).toBe('B');
        vitest.advanceTimersByTime(100);
        expect(liveElement.hasChildNodes()).toBe(false);
    });

    it('Should throw an error in a server environment.', () => {
        const errorMessage = 'liveAnnounce(): This function cannot be used in a server environment!'
        using spy = vitest.spyOn((globalThis as any), '__IS_SERVER__', 'get').mockReturnValue(true);
        expect(() => liveAnnounce('Hello')).toThrow(errorMessage);
    });

});

describe('ariaDescribe()', () => {

    it('Should throw an error if the first argument is not an Element instance or a function.', () => {
        const errorMessage = 'ariaDescribe(): Invalid first argument! It must be a function returning a DOM Element or a DOM Element instance (e.g. HTMLElement, SVGElement, etc.).';

        expect(() => inRoot(() => ariaDescribe(0 as any, ''))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(1 as any, ''))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe('' as any, ''))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe('A' as any, ''))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(true as any, ''))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(false as any, ''))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(undefined as any, ''))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(null as any, ''))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe({} as any, ''))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe([] as any, ''))).toThrow(errorMessage);

        expect(() => inRoot(() => ariaDescribe(document.createElement('div'), ''))).not.toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(document.createElement('div'), 'A'))).not.toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(document.createElementNS('http://www.w3.org/2000/svg','svg'), ''))).not.toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(document.createElementNS('http://www.w3.org/2000/svg','svg'), 'A'))).not.toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(document.createElementNS('http://www.w3.org/1998/Math/MathML','math'), ''))).not.toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(document.createElementNS('http://www.w3.org/1998/Math/MathML','math'), 'A'))).not.toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(document.createElementNS('http://www.w3.org/1998/Math/MathML','math'), ''))).not.toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(document.createElementNS('http://www.w3.org/1998/Math/MathML','math'), 'A'))).not.toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe((() => {}) as any, ''))).not.toThrow(errorMessage);
        discardPendingEffects();
    });

    it('Should throw an error if the second argument is not a string or an HTMLElement instance.', () => {
        const errorMessage = 'ariaDescribe(): Invalid second argument! Expected an HTMLElement instance or string.';
        const div = document.createElement('div');

        expect(() => inRoot(() => ariaDescribe(div, 0 as any))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(div, 1 as any))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(div, true as any))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(div, false as any))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(div, undefined as any))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(div, null as any))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(div, {} as any))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(div, [] as any))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(div, (() => {}) as any))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(div, document.createElementNS('http://www.w3.org/2000/svg', 'svg') as any))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(div, document.createElementNS('http://www.w3.org/1998/Math/MathML', 'math') as any))).toThrow(errorMessage);

        expect(() => inRoot(() => ariaDescribe(div, ''))).not.toThrow();
        expect(() => inRoot(() => ariaDescribe(div, 'A'))).not.toThrow();
        expect(() => inRoot(() => ariaDescribe(div, document.createElement('div')))).not.toThrow();
        expect(() => inRoot(() => ariaDescribe(div, document.createElement('span')))).not.toThrow();
    });

    it('Should throw an error if the second argument is not a string when all arguments all provided', () => {
        const errorMessage = 'ariaDescribe(): Invalid second argument! Expected a string.';
        const div = document.createElement('div');

        expect(() => inRoot(() => ariaDescribe(div, 0 as any, 'custom'))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(div, 1 as any, 'custom'))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(div, true as any, 'custom'))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(div, false as any, 'custom'))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(div, undefined as any, 'custom'))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(div, null as any, 'custom'))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(div, {} as any, 'custom'))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(div, [] as any, 'custom'))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(div, (() => {}) as any, 'custom'))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(div, document.createElementNS('http://www.w3.org/2000/svg', 'svg') as any, 'custom'))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(div, document.createElementNS('http://www.1998.org/2000/svg', 'math') as any, 'custom'))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(div, document.createElement('span') as any, 'custom'))).toThrow(errorMessage);
        expect(() => inRoot(() => ariaDescribe(div, document.createElement('div') as any, 'custom'))).toThrow(errorMessage);

        expect(() => inRoot(() => ariaDescribe(div, '', 'custom'))).not.toThrow()
        expect(() => inRoot(() => ariaDescribe(div, 'A', 'custom'))).not.toThrow()
    });

    it('Should throw an error if used outside an owning context.', () => {
        const errorMessage = 'ariaDescribe(): An owning context is required!'
        expect(() => ariaDescribe(document.createElement('div'), 'A')).toThrow(errorMessage)
    });

    it('Should create descriptions for a directly provided element.', () => {
        const div = document.body.appendChild(document.createElement('div'));

        inRoot(() => ariaDescribe(div, 'Fiz'));
        inRoot(() => ariaDescribe(div, 'Baz', 'custom1'));
        inRoot(() => ariaDescribe(div, '<span>Hello</span>'));
        inRoot(() => ariaDescribe(div, '<p>World</p>', 'custom2'));
        inRoot(() => ariaDescribe(div, '<p>Hello</p><span>World</span>'));
        inRoot(() => ariaDescribe(div, '<p>Fiz</p><span>Baz</span>', 'custom3'));
        const descEl1 = document.createElement('h3');
        const descEl2 = document.createElement('li');
        descEl1.textContent = 'Foo'
        descEl2.textContent = 'Bar'
        descEl2.role = 'custom4'
        inRoot(() => ariaDescribe(div, descEl1));
        inRoot(() => ariaDescribe(div, descEl2));

        assertPendingEffectsCount(0);

        let { descriptionsElement: descriptionsEl, descriptions } = _getInternals();

        expect(descriptionsEl!.children.length).toBe(8);
        expect(descriptions instanceof Map).toBe(true);
        expect(descriptions!.size).toBe(8)

        const ids = div.getAttribute('aria-describedby')!.split(/s+/);
        for (const element of descriptionsEl!.children) {
            ids.includes(element.id);
        }

        expect(descriptionsEl!.children[0] instanceof HTMLDivElement).toBe(true);
        expect(descriptionsEl!.children[1] instanceof HTMLDivElement).toBe(true);
        expect(descriptionsEl!.children[2] instanceof HTMLSpanElement).toBe(true);
        expect(descriptionsEl!.children[3] instanceof HTMLParagraphElement).toBe(true);
        expect(descriptionsEl!.children[4] instanceof HTMLDivElement).toBe(true);
        expect(descriptionsEl!.children[5] instanceof HTMLDivElement).toBe(true);
        expect(descriptionsEl!.children[6] instanceof HTMLHeadingElement).toBe(true);
        expect(descriptionsEl!.children[7] instanceof HTMLLIElement).toBe(true);

        expect(descriptionsEl!.children[0].role).toBe(null);
        expect(descriptionsEl!.children[1].role).toBe('custom1');
        expect(descriptionsEl!.children[2].role).toBe(null);
        expect(descriptionsEl!.children[3].role).toBe('custom2');
        expect(descriptionsEl!.children[4].role).toBe(null);
        expect(descriptionsEl!.children[5].role).toBe('custom3');
        expect(descriptionsEl!.children[6].role).toBe(null);
        expect(descriptionsEl!.children[7].role).toBe('custom4');

        expect(descriptionsEl!.children[0].textContent).toBe('Fiz');
        expect(descriptionsEl!.children[1].textContent).toBe('Baz');
        expect(descriptionsEl!.children[2].textContent).toBe('Hello');
        expect(descriptionsEl!.children[3].textContent).toBe('World');
        expect(descriptionsEl!.children[6].textContent).toBe('Foo');
        expect(descriptionsEl!.children[7].textContent).toBe('Bar');

        disposeBag[3]();
        expect(descriptionsEl!.children.length).toBe(7);
        disposeBag[5]();
        expect(descriptionsEl!.children.length).toBe(6);
        disposeBag[0]();
        expect(descriptionsEl!.children.length).toBe(5);
        disposeBag[4]();
        expect(descriptionsEl!.children.length).toBe(4);
        disposeBag[1]();
        expect(descriptionsEl!.children.length).toBe(3);
        disposeBag[2]();
        expect(descriptionsEl!.children.length).toBe(2);
        disposeBag[7]();
        expect(descriptionsEl!.children.length).toBe(1);
        disposeBag[6]();

        descriptionsEl = _getInternals().descriptionsElement;
        descriptions = _getInternals().descriptions;
        expect(descriptionsEl).toBeNull();
        expect(descriptions).toBeNull();
    });

    it('Should create descriptions for an eagerly resolved element.', () => {
        const div = document.body.appendChild(document.createElement('div'));
        const elGetter = () => div

        inRoot(() => ariaDescribe(elGetter, 'Fiz'));
        inRoot(() => ariaDescribe(elGetter, 'Baz', 'custom1'));
        inRoot(() => ariaDescribe(elGetter, '<span>Hello</span>'));
        inRoot(() => ariaDescribe(elGetter, '<p>World</p>', 'custom2'));
        inRoot(() => ariaDescribe(elGetter, '<p>Hello</p><span>World</span>'));
        inRoot(() => ariaDescribe(elGetter, '<p>Fiz</p><span>Baz</span>', 'custom3'));
        const descEl1 = document.createElement('h3');
        const descEl2 = document.createElement('li');
        descEl1.textContent = 'Foo'
        descEl2.textContent = 'Bar'
        descEl2.role = 'custom4'
        inRoot(() => ariaDescribe(elGetter, descEl1));
        inRoot(() => ariaDescribe(elGetter, descEl2));
        
        assertPendingEffectsCount(0);

        let { descriptionsElement: descriptionsEl, descriptions } = _getInternals();

        expect(descriptionsEl!.children.length).toBe(8);
        expect(descriptions instanceof Map).toBe(true);
        expect(descriptions!.size).toBe(8)

        const ids = div.getAttribute('aria-describedby')!.split(/s+/);
        for (const element of descriptionsEl!.children) {
            ids.includes(element.id);
        }

        expect(descriptionsEl!.children[0] instanceof HTMLDivElement).toBe(true);
        expect(descriptionsEl!.children[1] instanceof HTMLDivElement).toBe(true);
        expect(descriptionsEl!.children[2] instanceof HTMLSpanElement).toBe(true);
        expect(descriptionsEl!.children[3] instanceof HTMLParagraphElement).toBe(true);
        expect(descriptionsEl!.children[4] instanceof HTMLDivElement).toBe(true);
        expect(descriptionsEl!.children[5] instanceof HTMLDivElement).toBe(true);
        expect(descriptionsEl!.children[6] instanceof HTMLHeadingElement).toBe(true);
        expect(descriptionsEl!.children[7] instanceof HTMLLIElement).toBe(true);

        expect(descriptionsEl!.children[0].role).toBe(null);
        expect(descriptionsEl!.children[1].role).toBe('custom1');
        expect(descriptionsEl!.children[2].role).toBe(null);
        expect(descriptionsEl!.children[3].role).toBe('custom2');
        expect(descriptionsEl!.children[4].role).toBe(null);
        expect(descriptionsEl!.children[5].role).toBe('custom3');
        expect(descriptionsEl!.children[6].role).toBe(null);
        expect(descriptionsEl!.children[7].role).toBe('custom4');

        expect(descriptionsEl!.children[0].textContent).toBe('Fiz');
        expect(descriptionsEl!.children[1].textContent).toBe('Baz');
        expect(descriptionsEl!.children[2].textContent).toBe('Hello');
        expect(descriptionsEl!.children[3].textContent).toBe('World');
        expect(descriptionsEl!.children[6].textContent).toBe('Foo');
        expect(descriptionsEl!.children[7].textContent).toBe('Bar');

        disposeBag[3]();
        expect(descriptionsEl!.children.length).toBe(7);
        disposeBag[5]();
        expect(descriptionsEl!.children.length).toBe(6);
        disposeBag[0]();
        expect(descriptionsEl!.children.length).toBe(5);
        disposeBag[4]();
        expect(descriptionsEl!.children.length).toBe(4);
        disposeBag[1]();
        expect(descriptionsEl!.children.length).toBe(3);
        disposeBag[2]();
        expect(descriptionsEl!.children.length).toBe(2);
        disposeBag[7]();
        expect(descriptionsEl!.children.length).toBe(1);
        disposeBag[6]();

        descriptionsEl = _getInternals().descriptionsElement;
        descriptions = _getInternals().descriptions;
        expect(descriptionsEl).toBeNull();
        expect(descriptions).toBeNull();
    });

    it('Should create descriptions for an lazily resolved element.', () => {
        let div: HTMLDivElement = null!;
        const elGetter = () => div

        inRoot(() => ariaDescribe(elGetter, 'Fiz'));
        inRoot(() => ariaDescribe(elGetter, 'Baz', 'custom1'));
        inRoot(() => ariaDescribe(elGetter, '<span>Hello</span>'));
        inRoot(() => ariaDescribe(elGetter, '<p>World</p>', 'custom2'));
        inRoot(() => ariaDescribe(elGetter, '<p>Hello</p><span>World</span>'));
        inRoot(() => ariaDescribe(elGetter, '<p>Fiz</p><span>Baz</span>', 'custom3'));
        const descEl1 = document.createElement('h3');
        const descEl2 = document.createElement('li');
        descEl1.textContent = 'Foo'
        descEl2.textContent = 'Bar'
        descEl2.role = 'custom4'
        inRoot(() => ariaDescribe(elGetter, descEl1));
        inRoot(() => ariaDescribe(elGetter, descEl2));

        div = document.body.appendChild(document.createElement('div'));
        
        assertPendingEffectsCount(8);
        expect(_getInternals().descriptionsElement).toBeNull();
        expect(_getInternals().descriptions).toBeNull();

        fireEffects();

        let { descriptionsElement: descriptionsEl, descriptions } = _getInternals();

        expect(descriptionsEl!.children.length).toBe(8);
        expect(descriptions instanceof Map).toBe(true);
        expect(descriptions!.size).toBe(8)

        const ids = div.getAttribute('aria-describedby')!.split(/s+/);
        for (const element of descriptionsEl!.children) {
            ids.includes(element.id);
        }

        expect(descriptionsEl!.children[0] instanceof HTMLDivElement).toBe(true);
        expect(descriptionsEl!.children[1] instanceof HTMLDivElement).toBe(true);
        expect(descriptionsEl!.children[2] instanceof HTMLSpanElement).toBe(true);
        expect(descriptionsEl!.children[3] instanceof HTMLParagraphElement).toBe(true);
        expect(descriptionsEl!.children[4] instanceof HTMLDivElement).toBe(true);
        expect(descriptionsEl!.children[5] instanceof HTMLDivElement).toBe(true);
        expect(descriptionsEl!.children[6] instanceof HTMLHeadingElement).toBe(true);
        expect(descriptionsEl!.children[7] instanceof HTMLLIElement).toBe(true);

        expect(descriptionsEl!.children[0].role).toBe(null);
        expect(descriptionsEl!.children[1].role).toBe('custom1');
        expect(descriptionsEl!.children[2].role).toBe(null);
        expect(descriptionsEl!.children[3].role).toBe('custom2');
        expect(descriptionsEl!.children[4].role).toBe(null);
        expect(descriptionsEl!.children[5].role).toBe('custom3');
        expect(descriptionsEl!.children[6].role).toBe(null);
        expect(descriptionsEl!.children[7].role).toBe('custom4');

        expect(descriptionsEl!.children[0].textContent).toBe('Fiz');
        expect(descriptionsEl!.children[1].textContent).toBe('Baz');
        expect(descriptionsEl!.children[2].textContent).toBe('Hello');
        expect(descriptionsEl!.children[3].textContent).toBe('World');
        expect(descriptionsEl!.children[6].textContent).toBe('Foo');
        expect(descriptionsEl!.children[7].textContent).toBe('Bar');

        disposeBag[3]();
        expect(descriptionsEl!.children.length).toBe(7);
        disposeBag[5]();
        expect(descriptionsEl!.children.length).toBe(6);
        disposeBag[0]();
        expect(descriptionsEl!.children.length).toBe(5);
        disposeBag[4]();
        expect(descriptionsEl!.children.length).toBe(4);
        disposeBag[1]();
        expect(descriptionsEl!.children.length).toBe(3);
        disposeBag[2]();
        expect(descriptionsEl!.children.length).toBe(2);
        disposeBag[7]();
        expect(descriptionsEl!.children.length).toBe(1);
        disposeBag[6]();

        descriptionsEl = _getInternals().descriptionsElement;
        descriptions = _getInternals().descriptions;
        expect(descriptionsEl).toBeNull();
        expect(descriptions).toBeNull();
    });

    it('Should create descriptions for multiple elements and associate them with the corresponding targets.', () => {
        const div1 = document.body.appendChild(document.createElement('div'));
        const div2 = document.body.appendChild(document.createElement('div'));

        inRoot(() => {
            ariaDescribe(div1, 'Hello');
            ariaDescribe(div2, 'World');
            ariaDescribe(div1, 'Fiz');
            ariaDescribe(div2, 'Baz');
        });

        const descriptionsEl = _getInternals().descriptionsElement!;

        expect(descriptionsEl.children.length).toBe(4);
        expect(descriptionsEl.children[0].textContent).toBe('Hello');
        expect(descriptionsEl.children[1].textContent).toBe('World');
        expect(descriptionsEl.children[2].textContent).toBe('Fiz');
        expect(descriptionsEl.children[3].textContent).toBe('Baz');
        expect(div1.getAttribute('aria-describedby')!.includes(descriptionsEl.children[0].id));
        expect(div1.getAttribute('aria-describedby')!.includes(descriptionsEl.children[2].id));
        expect(div2.getAttribute('aria-describedby')!.includes(descriptionsEl.children[1].id));
        expect(div2.getAttribute('aria-describedby')!.includes(descriptionsEl.children[3].id));

        dispose();
        expect(_getInternals().descriptionsElement).toBeNull();
        expect(_getInternals().descriptions).toBeNull();
    });

    it('Should reuse identical descriptions across multiple elements.', () => {
        const div1 = document.body.appendChild(document.createElement('div'));
        const div2 = document.body.appendChild(document.createElement('div'));
        const descEl = document.createElement('div');
        descEl.textContent = 'World';

        inRoot(() => {
            ariaDescribe(div1, 'Hello');
            ariaDescribe(div1, descEl);
        });
        
        inRoot(() => {
            ariaDescribe(div2, 'Hello');
            ariaDescribe(div2, descEl);
        })

        const descriptionsEl = _getInternals().descriptionsElement!;

        expect(descriptionsEl.children.length).toBe(2);
        expect(descriptionsEl.children[0].textContent).toBe('Hello');
        expect(descriptionsEl.children[1].textContent).toBe('World');
        expect(div1.getAttribute('aria-describedby')!.includes(descriptionsEl.children[0].id));
        expect(div1.getAttribute('aria-describedby')!.includes(descriptionsEl.children[1].id));
        expect(div2.getAttribute('aria-describedby')!.includes(descriptionsEl.children[0].id));
        expect(div2.getAttribute('aria-describedby')!.includes(descriptionsEl.children[1].id));

        disposeBag[0]();
        expect(descriptionsEl.children.length).toBe(2);
        expect(descriptionsEl.children[0].textContent).toBe('Hello'); 
        expect(descriptionsEl.children[1].textContent).toBe('World');
        expect(div1.getAttribute('aria-describedby')).toBeNull();
        expect(div1.getAttribute('aria-describedby')).toBeNull();
        expect(div2.getAttribute('aria-describedby')!.includes(descriptionsEl.children[0].id));
        expect(div2.getAttribute('aria-describedby')!.includes(descriptionsEl.children[1].id));

        disposeBag[1]()
        expect(_getInternals().descriptionsElement).toBeNull();
        expect(_getInternals().descriptions).toBeNull();
        expect(div1.getAttribute('aria-describedby')).toBeNull();
        expect(div1.getAttribute('aria-describedby')).toBeNull();
        expect(div2.getAttribute('aria-describedby')).toBeNull();
        expect(div2.getAttribute('aria-describedby')).toBeNull();
    });

    it('Should do nothing in server environment.', () => {
        const div1 = document.body.appendChild(document.createElement('div'));
        using spy = vitest.spyOn((globalThis as any), '__IS_SERVER__', 'get').mockReturnValue(true);
        
        ariaDescribe(div1, 'Hello');
        ariaDescribe(() => div1, 'World');
        ariaDescribe(() => null!, 'Hello world');

        assertPendingEffectsCount(0);
        expect(_getInternals().descriptionsElement).toBeNull();
        expect(_getInternals().descriptions).toBeNull();
    });

});
