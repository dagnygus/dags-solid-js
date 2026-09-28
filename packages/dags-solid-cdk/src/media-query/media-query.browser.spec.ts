import { createEffect, createRoot } from 'solid-js';
import { observeMediaQueries, observeMediaQuery } from './media-query';
import { page } from 'vitest/browser';
import { unwrap } from 'solid-js/store';

const disposeBag: (() => void)[] = [];

vitest.mock(import('./media-query'), (importOgModule) => {
    (globalThis as any).__IS_SERVER__ = false;
    return importOgModule();
});

function dispose(): void {
    while (disposeBag.length) {
        disposeBag.shift()!();
    }
}

function inRoot<T>(fn: () => T): T {
    return createRoot((dispose) => {
        disposeBag.push(dispose);
        return fn();
    });
}

async function resizeViewport(width: number, height: number): Promise<void> {
    if (window.innerWidth === width && window.innerHeight === height) { return; }
    await page.viewport(width, height);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}


afterEach(() => {
    dispose();
});

beforeEach(async () => {
    await resizeViewport(1280, 720);
})

afterAll(() => {
    vitest.doUnmock('./media-query');
    delete (globalThis as any).__IS_SERVER__;
});

describe('observeMediaQuery()', () => {

    it('Should throw an error if used outside owning context.', () => {
        const errorMessage = 'observeMediaQuery(): An owning context is required!';
        expect(() => observeMediaQuery('foo')).toThrow(errorMessage);
    });

    it('Should throw an error in the first argument is not a string.', () => {
        const errorMessage = 'observeMediaQuery(): Invalid first argument! Expected a string.';

        expect(() => inRoot(() => observeMediaQuery(0 as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQuery(1 as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQuery(true as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQuery(false as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQuery(undefined as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQuery(null as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQuery({} as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQuery([] as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQuery((() => {}) as any))).toThrow(errorMessage);
        
        expect(() => inRoot(() => observeMediaQuery('foo'))).not.toThrow();
    });

    it('Should throw an error if the second argument is not an optional boolean.', () => {
        const errorMessage = 'observeMediaQuery(): Invalid second argument! Expected a boolean or nothing.'

        expect(() => inRoot(() => observeMediaQuery('foo', 0 as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQuery('foo', 0 as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQuery('foo', '' as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQuery('foo', 'A' as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQuery('foo', {} as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQuery('foo', [] as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQuery('foo', (() => {}) as any))).toThrow(errorMessage);

        expect(() => inRoot(() => observeMediaQuery('foo', true))).not.toThrow();
        expect(() => inRoot(() => observeMediaQuery('foo', false))).not.toThrow();
        expect(() => inRoot(() => observeMediaQuery('foo', undefined))).not.toThrow();
        expect(() => inRoot(() => observeMediaQuery('foo', null as any))).not.toThrow();
    });

    it('Should throw an error id the second argument is not an optional boolean in a server environment.', () => {
        using spy = vitest.spyOn((globalThis as any), '__IS_SERVER__', 'get').mockReturnValue(true);
        const errorMessage = 'observeMediaQuery(): Invalid second argument! Expected a boolean or nothing.';

        expect(() => inRoot(() => observeMediaQuery('foo', 0 as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQuery('foo', 0 as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQuery('foo', '' as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQuery('foo', 'A' as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQuery('foo', {} as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQuery('foo', [] as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQuery('foo', (() => {}) as any))).toThrow(errorMessage);

        expect(() => inRoot(() => observeMediaQuery('foo', true))).not.toThrow();
        expect(() => inRoot(() => observeMediaQuery('foo', false))).not.toThrow();
        expect(() => inRoot(() => observeMediaQuery('foo', undefined))).not.toThrow();
        expect(() => inRoot(() => observeMediaQuery('foo', null as any))).not.toThrow();
    });

    it('Should return a function with a fallback return value in a server environment.', () => {
        using spy = vitest.spyOn((globalThis as any), '__IS_SERVER__', 'get').mockReturnValue(true);

        expect(observeMediaQuery('foo')()).toBe(false);
        expect(observeMediaQuery('foo', undefined)()).toBe(false);
        expect(observeMediaQuery('foo', null as any)()).toBe(false);
        expect(observeMediaQuery('foo', false)()).toBe(false);
        expect(observeMediaQuery('foo', true)()).toBe(true);
        expect(observeMediaQuery('foo').toString()).toBe('() => serverFallbackValue');
    });

    it('Should update the match state when the viewport crosses media query boundaries.', async () => {
        await resizeViewport(300, 720);
        
        const matchesGte400 = inRoot(() => observeMediaQuery('(width >= 400px)'));
        const matchesGte400lt600 = inRoot(() => observeMediaQuery('(width >= 400px) and (width < 600px)'));
        const matchesGte600 = inRoot(() => observeMediaQuery('(width >= 600px)'));

        expect(matchesGte400()).toBe(false);
        expect(matchesGte400lt600()).toBe(false);
        expect(matchesGte600()).toBe(false);

        await resizeViewport(400, 720);

        expect(matchesGte400()).toBe(true);
        expect(matchesGte400lt600()).toBe(true);
        expect(matchesGte600()).toBe(false);

        await resizeViewport(600, 720);

        expect(matchesGte400()).toBe(true);
        expect(matchesGte400lt600()).toBe(false);
        expect(matchesGte600()).toBe(true);
    });

    it('Should notify reactive computations when the match state changes.', async () => {
        const log: boolean[] = [];
        await resizeViewport(300, 720);
        
        const matchesGte400 = inRoot(() => observeMediaQuery('(width >= 400px)'));

        inRoot(() => createEffect(() => {
            log.push(matchesGte400());
        }));

        expect(log).toEqual([ false, ]);

        await resizeViewport(400, 720);

        expect(log).toEqual([ false, true ]);
    });

});

describe('observeMediaQueries()', () => {

    it('Should throw an error if used outside owning context.', () => {
        const errorMessage = 'observeMediaQueries(): An owning context is required!';
        expect(() => observeMediaQueries(['foo'])).toThrow(errorMessage);
    });

    it('Should throw an error if the first argument is not na array of strings', () => {
        const errorMessage = 'observeMediaQueries(): Invalid first argument! Expected an array of strings.';

        expect(() => inRoot(() => observeMediaQueries(0 as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQueries(1 as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQueries('' as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQueries('A' as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQueries(true as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQueries(false as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQueries(undefined as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQueries(null as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQueries({} as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQueries([]))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQueries([ 0 ] as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQueries([ 1 ] as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQueries([ true ] as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQueries([ false ] as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQueries([ undefined ] as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQueries([ null ] as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQueries([ {} ] as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQueries([ [] ] as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQueries([ () => {} ] as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQueries((() => {}) as any))).toThrow(errorMessage);
        
        expect(() => inRoot(() => observeMediaQueries([ 'foo' ]))).not.toThrow();
    });

    it('Should throw an error if the second argument is not an optional boolean.', () => {
        const errorMessage = 'observeMediaQueries(): Invalid second argument! Expected a boolean or nothing.';

        expect(() => inRoot(() => observeMediaQueries([ 'foo' ], 0 as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQueries([ 'foo' ], 1 as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQueries([ 'foo' ], '' as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQueries([ 'foo' ], 'A' as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQueries([ 'foo' ], {} as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQueries([ 'foo' ], [] as any))).toThrow(errorMessage);
        expect(() => inRoot(() => observeMediaQueries([ 'foo' ], (() => {}) as any))).toThrow(errorMessage);
        
        expect(() => inRoot(() => observeMediaQueries([ 'foo' ], true))).not.toThrow();
        expect(() => inRoot(() => observeMediaQueries([ 'foo' ], false))).not.toThrow();
        expect(() => inRoot(() => observeMediaQueries([ 'foo' ], undefined))).not.toThrow();
        expect(() => inRoot(() => observeMediaQueries([ 'foo' ], null as any))).not.toThrow();
    });

    it('Should throw an error when a query is not part of the store.', () => {
        const errorMessage = 'MediaQueryStore[\'bar\']: Invalid property name! This media query is not part of the store.';
        const mqStore = inRoot(() => observeMediaQueries([ 'foo' ]));

        expect(() => mqStore['bar']).toThrow(errorMessage);
    });

    it('Should unwrap the state using the unwrap() function.', () => {
        const mqStore = inRoot(() => observeMediaQueries([ 'foo' ]));
        const state = unwrap(mqStore);

        expect(state).not.toBe(mqStore);
        expect(state).toBeTypeOf('object');
        expect(state).toBeTruthy();
    });


    it('Should update the match state when the viewport crosses media query boundaries.', async () => {
        const query1 = '(width >= 400px)';
        const query2 = '(width >= 400px) and (width < 600px)';
        const query3 = '(width >= 600px)';

        await resizeViewport(300, 720);

        const mqStore = inRoot(() => observeMediaQueries([ query1, query2, query3 ]));

        expect(mqStore[query1]).toBe(false);
        expect(mqStore[query2]).toBe(false);
        expect(mqStore[query3]).toBe(false);

        await resizeViewport(400, 720);

        expect(mqStore[query1]).toBe(true);
        expect(mqStore[query2]).toBe(true);
        expect(mqStore[query3]).toBe(false);

        await resizeViewport(600, 720);

        expect(mqStore[query1]).toBe(true);
        expect(mqStore[query2]).toBe(false);
        expect(mqStore[query3]).toBe(true);
    });

    it('Should notify reactive computations when the match state changes.', async () => {
        const log: boolean[] = [];
        const query = '(width >= 400px)';

        await resizeViewport(300, 720);

        const mqStore = inRoot(() => observeMediaQueries([ query ]));
        
        inRoot(() => createEffect(() => {
            log.push(mqStore[query]);
        }));

        expect(log).toEqual([ false ]);

        await resizeViewport(400, 720);

        expect(log).toEqual([ false, true ]);
    });

    it('Should return the state with the fallback value for each query in a server environment.', () => {
        using spy = vitest.spyOn(globalThis as any, '__IS_SERVER__', 'get').mockReturnValue(true);
        const query1 = '(width >= 400px)';
        const query2 = '(width >= 400px) and (width < 600px)';
        const query3 = '(width >= 600px)';

        let mqStore = inRoot(() => observeMediaQueries([ query1, query2, query3 ]));

        expect(mqStore[query1]).toBe(false);
        expect(mqStore[query2]).toBe(false);
        expect(mqStore[query3]).toBe(false);

        mqStore = inRoot(() => observeMediaQueries([ query1, query2, query3 ], false));

        expect(mqStore[query1]).toBe(false);
        expect(mqStore[query2]).toBe(false);
        expect(mqStore[query3]).toBe(false);

        mqStore = inRoot(() => observeMediaQueries([ query1, query2, query3 ], true));

        expect(mqStore[query1]).toBe(true);
        expect(mqStore[query2]).toBe(true);
        expect(mqStore[query3]).toBe(true);
    });
});