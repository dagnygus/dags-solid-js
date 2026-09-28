import { isDev } from "solid-js/web";
import { _assertIsArray, _assertIsInOwningContext, _assertIsOptionalBoolean, _assertIsOptionalString, _assertIsString, _assertIsTrue } from "../internals/common-assertions";
import { $TRACK, Accessor, createSignal, onCleanup } from "solid-js";
import { $RAW, createStore } from "solid-js/store";
import { $PROXY } from "solid-js/types/server/reactive.js";

/**
 * Represents the reactive state of observed media queries.
 *
 * Each property is keyed by the media query string and contains whether
 * the corresponding media query currently matches.
 */
export interface MediaQueryStore {
    [query: string]: boolean;
}

/**
 * Observes a media query and returns a reactive accessor containing
 * whether the query currently matches.
 *
 * Some historical WebKit and Chromium versions had issues with
 * `MediaQueryList` change notifications when the media query was not
 * represented by a CSS rule targeting an element in the document.
 * A workaround for affected browsers is to add a CSS rule that targets
 * an existing element, for example:
 *
 * ```css
 * \@media (min-width: 768px) {
 *     body {}
 * }
 * ```
 *
 * The rule must target an element in the document. An empty `@media`
 * block without a selector is not sufficient.
 *
 * This function does not inject such rules automatically. Applications
 * that need to support affected browser versions can provide the
 * workaround themselves.
 *
 * @param query The media query to observe.
 * @param serverFallbackValue The fallback value returned when executed on the server.
 * @returns A reactive accessor containing the current match state.
 */
export function observeMediaQuery(query: string, serverFallbackValue?: boolean): Accessor<boolean> {
    if (__IS_SERVER__) {
        _assertIsOptionalBoolean(
            serverFallbackValue,
            'observeMediaQuery(): Invalid second argument! Expected a boolean or nothing.'
        );
        serverFallbackValue = !!serverFallbackValue;
        return () => serverFallbackValue as any;
    }
    isDev && _assertIsInOwningContext(
        observeMediaQuery
    ) && _assertIsString(
        query,
        'observeMediaQuery(): Invalid first argument! Expected a string.'
    ) && _assertIsOptionalBoolean(
        serverFallbackValue,
        'observeMediaQuery(): Invalid second argument! Expected a boolean or nothing.'
    );

    const mql = matchMedia(query);
    const [matches, setMatches] = createSignal(mql.matches);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);

    mql.addEventListener('change', listener);

    onCleanup(() => mql.removeEventListener('change', listener));

    return matches;
}

/**
 * Observes multiple media queries and returns a reactive store containing
 * their current match states.
 *
 * Some historical WebKit and Chromium versions had issues with
 * `MediaQueryList` change notifications when a media query was not
 * represented by a CSS rule targeting an element in the document.
 * A workaround for affected browsers is to add a CSS rule for each
 * query that targets an existing element, for example:
 *
 * ```css
 * \@media (min-width: 768px) {
 *     body {}
 * }
 * ```
 *
 * The rule must target an element in the document. An empty `@media`
 * block without a selector is not sufficient.
 *
 * This function does not inject such rules automatically. Applications
 * that need to support affected browser versions can provide the
 * workaround themselves.
 *
 * Each query is used as a property key in the returned store.
 *
 * @param queries The media queries to observe.
 * @param serverFallbackValue The fallback value used for all queries when executed on the server.
 * @returns A reactive store containing the current match state of each media query.
 */
export function observeMediaQueries(queries: string[], serverFallbackValue?: boolean): MediaQueryStore {
    isDev && _assertIsInOwningContext(
        observeMediaQueries
    ) && _assertIsArray(
        queries,
        'observeMediaQueries(): Invalid first argument! Expected an array of strings.'
    ) && _assertIsTrue(
        queries.length > 0,
        'observeMediaQueries(): Invalid first argument! Expected an array of strings.'
    ) && _assertIsOptionalBoolean(
        serverFallbackValue,
        'observeMediaQueries(): Invalid second argument! Expected a boolean or nothing.'
    )

    queries = queries.slice();
    const state: Record<string, boolean> = {};
    if (__IS_SERVER__) {
        serverFallbackValue = !!serverFallbackValue;
    }
    for (const query of queries) {
        isDev && _assertIsString(
            query,
            'observeMediaQueries(): Invalid first argument! Expected an array of strings.'
        )
        if (__IS_SERVER__) {
            state[query] = serverFallbackValue as any;
        } else {
            const mql = matchMedia(query);
            const listener = (e: MediaQueryListEvent) => setStore(query, e.matches);
    
            state[query] = mql.matches;
            mql.addEventListener('change', listener);
            onCleanup(() => mql.removeEventListener('change', listener));
        }
    }

    let [store, setStore] = createStore(state);

    if (isDev) {
        store = new Proxy(store, {
            get(target, prop) {
                if (typeof prop === 'symbol') {
                    return target[prop as any]
                }

                if (prop in target) {
                    return target[prop];
                }

                if (typeof prop !== 'string') {
                    prop = JSON.stringify(prop);
                }
                
                throw new Error(`MediaQueryStore[\'${prop}\']: Invalid property name! This media query is not part of the store.`);
            },
        })
    }

    return store;
}