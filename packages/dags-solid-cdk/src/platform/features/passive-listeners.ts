/**
 * @license
 * Derived from Angular.
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 *
 * Modifications Copyright (c) 2026 Dag Nygard
 */

let _supportsPassiveEvents: boolean | undefined;

/**
 * Checks whether the user's browser supports passive event listeners.
 * See: https://github.com/WICG/EventListenerOptions/blob/gh-pages/explainer.md
 */
export function supportsPassiveEventListeners(): boolean {
    if (__IS_SERVER__) { return false; }
    if (_supportsPassiveEvents === undefined) {
        try {
        window.addEventListener(
            'test',
            null!,
            Object.defineProperty({}, 'passive', {
            get: () => (_supportsPassiveEvents = true),
            }),
        );
        } finally {
        _supportsPassiveEvents = _supportsPassiveEvents || false;
        }
    }

  return _supportsPassiveEvents;
}

/**
 * Normalizes an `AddEventListener` object to something that can be passed
 * to `addEventListener` on any browser, no matter whether it supports the
 * `options` parameter.
 * @param options Object to be normalized.
 */
export function normalizePassiveListenerOptions(options: AddEventListenerOptions): AddEventListenerOptions | boolean {
    return supportsPassiveEventListeners() ? options : !!options.capture;
}