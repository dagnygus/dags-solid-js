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

/** Whether the current application is being rendered in the browser. */
export const isBrowser: boolean = !__IS_SERVER__;

/** Whether the current rendering engine is Blink (Chromium family). */
export const isChromium: boolean =
    isBrowser &&
    /Chrome|Chromium|CriOS/.test(navigator.userAgent) &&
    typeof CSS !== "undefined";

/** Whether the current browser is Microsoft Edge. */
export const isEdge: boolean =
    isBrowser &&
    /\bEdg\//.test(navigator.userAgent);

/** Whether the current browser is Opera. */
export const isOpera: boolean =
    isBrowser &&
    /\bOPR\//.test(navigator.userAgent);

/** Whether the current rendering engine is WebKit. */
export const isWebkit: boolean =
    isBrowser &&
    /AppleWebKit/i.test(navigator.userAgent) &&
    !isChromium;

/** Whether the current platform is Apple iOS. */
export const isIOS: boolean =
    isBrowser &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);

/** Whether the current browser is Firefox. */
export const isFirefox: boolean =
    isBrowser &&
    /Firefox/i.test(navigator.userAgent);

/** Whether the current platform is Android. */
export const isAndroid: boolean =
    isBrowser &&
    /Android/i.test(navigator.userAgent);

/** Whether the current browser is Safari. */
export const isSafari: boolean =
    isBrowser &&
    isWebkit &&
    /Safari/i.test(navigator.userAgent);

export * from "./features/passive-listeners";