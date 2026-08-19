/**
 * @license
 * Copyright (c) 2026 dags-solid-cdk contributors.
 * Licensed under the MIT License.
 */

import { Accessor, createEffect, createRenderEffect, createSignal, getOwner, onCleanup, untrack } from "solid-js";
import { _cancelTask, _createTaskObject, _scheduleAsapTask, _scheduleAsyncTask, _schedulePostPaintTask, type _Task } from "../internals/schedulers";
import { isDev } from "solid-js/web";
import { _assertIsOptionalObjectExcludingArray } from "../internals/arg-assertions";

interface _CssAnimationHandler {
    isAnimating(): boolean,
    onDone(cb: () => void): void;
}

const INVALID_ARG_PRESENCE_ERROR_MESSAGE = 'Invalid argument! It must be a function!'
const FIRST_ARG_EFFECT_ERROR_MESSAGE = 'Invalid first argument! It must be a function or array of functions!';
const SECOND_ARG_EFFECT_ERROR_MESSAGE = 'Invalid second argument! It must be a function!';

function _assertIsArrayOfFunctionsOrFunction(arg: any, caller: Function, errorMessage: string): true | never {
    if (typeof arg === 'function' || (Array.isArray(arg) && arg.length && typeof arg[0] === 'function')) { return true; }
    throw new Error(`${caller.name}(): ${errorMessage}`);
}

function _assertIsFunction(arg: any, caller: Function, errorMessage: string): true | never {
    if (typeof arg === 'function') { return true; }
    throw new Error(`${caller.name}(): ${errorMessage}`);
}

function _coerceToFunction(target: Function | Function[]): Function {
    if (Array.isArray(target)) {
        target = target.slice()
        return () => {
            for (let i = 0; i < target.length; i++ ) { (target as Function[])[i](); }
        }
    }
    return target;
}

/**
 * Creates an effect that is built on top of SolidJS `createEffect`, but
 * defers the execution of the provided callback to the next microtask.
 *
 * Unlike `createEffect`, the callback is never executed synchronously after a
 * source changes. Multiple source updates occurring within the same
 * synchronous execution context are automatically coalesced into a single
 * callback invocation.
 *
 * By default, the callback is executed once immediately after the owning
 * effect is created, and then after each batch of source changes. When
 * `scheduleInitialCall` is `true`, the initial callback invocation is also
 * deferred to the next microtask.
 *
 * If the callback returns a cleanup function, it is invoked before the next
 * scheduled execution or when the owning reactive context is disposed.
 *
 * @param source Reactive source that triggers the scheduled callback.
 * @param effectFn Callback executed asynchronously in a microtask whenever
 * the source changes.
 * @param scheduleInitialCall Whether to defer the initial callback invocation
 * to the next microtask. Defaults to `false`.
 */
export function createAsapEffect(source: Accessor<any>, effectFn: () => (() => void) | void, scheduleInitialCall?: boolean): void;
/**
 * Creates an effect that is built on top of SolidJS `createEffect`, but defers
 * the execution of the provided callback to the next microtask.
 *
 * Unlike `createEffect`, the callback is never executed synchronously after a
 * source changes. Multiple source updates occurring within the same synchronous
 * execution context are automatically coalesced into a single callback
 * invocation.
 *
 * The callback is executed once immediately after the owning effect is created,
 * and then after every source change. If the callback returns a cleanup
 * function, it is invoked before the next scheduled execution or when the
 * owning reactive context is disposed.
 *
 * Any accessor from the provided array may trigger the scheduled callback.
 *
 * @param sources Reactive sources that trigger the scheduled callback.
 * @param effectFn Callback executed asynchronously in a microtask whenever any
 * source changes.
 */
export function createAsapEffect(sources: Accessor<any>[], effectFn: () => (() => void) | void, scheduleInitialCall?: boolean): void;
export function createAsapEffect(source: any, effectFn: () => (() => void) | void,  scheduleInitialCall?: boolean): void {
    if (__IS_SERVER__) { return; }
    isDev &&
    _assertIsArrayOfFunctionsOrFunction(
        source,
        createAsapEffect,
        FIRST_ARG_EFFECT_ERROR_MESSAGE
    ) &&
    _assertIsFunction(
        effectFn,
        createAsapEffect,
        SECOND_ARG_EFFECT_ERROR_MESSAGE
    );

    let task: _Task | null = null;
    source = _coerceToFunction(source);
    
    createEffect(() => {
        source();
        if (task) {
            _scheduleAsapTask(task);
        } else if (scheduleInitialCall) {
            task = _createTaskObject(effectFn, undefined, getOwner());
            _scheduleAsapTask(task);
        } else {
            task = untrack(() => _createTaskObject(effectFn, effectFn(), getOwner()));
        }
    });

    getOwner() && onCleanup(() => task && _cancelTask(task));
}

/**
 * Creates an effect that is built on top of SolidJS `createEffect`, but
 * defers the execution of the provided callback asynchronously using the
 * library's Async Scheduler.
 *
 * Unlike `createEffect`, the callback is never executed synchronously after a
 * source changes. Multiple source updates occurring within the same
 * synchronous execution context are automatically coalesced into a single
 * callback invocation.
 *
 * The callback is guaranteed to execute asynchronously before the browser
 * renders the next frame.
 *
 * The initial callback is scheduled during the initial execution of the
 * owning effect. By default, it is scheduled for the current reactive cycle.
 * When `scheduleInitialCall` is `true`, the initial callback invocation is
 * deferred to the next asynchronous scheduler cycle.
 *
 * If the callback returns a cleanup function, it is invoked before the next
 * scheduled execution or when the owning reactive context is disposed.
 *
 * The callback is executed in the same reactive owner in which the effect was
 * created.
 *
 * @param source Reactive source that triggers the scheduled callback.
 * @param effectFn Callback executed asynchronously whenever the source changes.
 * @param scheduleInitialCall Whether to defer the initial callback invocation
 * to the next asynchronous scheduler cycle. Defaults to `false`.
 */
export function createAsyncEffect(source: Accessor<any>, effectFn: () => (() => void) | void, scheduleInitialCall?: boolean): void;
/**
 * Creates an effect that is built on top of SolidJS `createEffect`, but
 * defers the execution of the provided callback asynchronously using the
 * library's Async Scheduler.
 *
 * Unlike `createEffect`, the callback is never executed synchronously after a
 * source changes. Multiple source updates occurring within the same
 * synchronous execution context are automatically coalesced into a single
 * callback invocation.
 *
 * The callback is guaranteed to execute asynchronously before the browser
 * renders the next frame.
 *
 * The initial callback is scheduled during the initial execution of the
 * owning effect. By default, it is scheduled for the current reactive cycle.
 * When `scheduleInitialCall` is `true`, the initial callback invocation is
 * deferred to the next asynchronous scheduler cycle.
 *
 * If the callback returns a cleanup function, it is invoked before the next
 * scheduled execution or when the owning reactive context is disposed.
 *
 * The callback is executed in the same reactive owner in which the effect was
 * created.
 *
 * @param sources Reactive sources that trigger the scheduled callback.
 * @param effectFn Callback executed asynchronously whenever any source changes.
 * @param scheduleInitialCall Whether to defer the initial callback invocation
 * to the next asynchronous scheduler cycle. Defaults to `false`.
 */
export function createAsyncEffect(sources: Accessor<any>[], effectFn: () => (() => void) | void, scheduleInitialCall?: boolean): void;
export function createAsyncEffect(source: any, effectFn: () => (() => void) | void, scheduleInitialCall?: boolean): void {
    if (__IS_SERVER__) { return; }

    isDev &&
    _assertIsArrayOfFunctionsOrFunction(
        source,
        createAsyncEffect,
        FIRST_ARG_EFFECT_ERROR_MESSAGE
    ) &&
    _assertIsFunction(
        effectFn,
        createAsyncEffect,
        SECOND_ARG_EFFECT_ERROR_MESSAGE
    );

    let task: _Task | null = null;
    source = _coerceToFunction(source);
    
    createEffect(() => {
        source();
        if (task) {
            _scheduleAsyncTask(task);
        } else if (scheduleInitialCall) {
            task = _createTaskObject(effectFn, undefined, getOwner());
            _scheduleAsyncTask(task);
        } else {
            task = untrack(() => _createTaskObject(effectFn, effectFn(), getOwner()));
        }
    });

    getOwner() && onCleanup(() => task && _cancelTask(task));
}

/**
 * Creates an effect that is built on top of SolidJS `createRenderEffect`, but
 * defers the execution of the provided callback to the next microtask.
 *
 * Unlike `createRenderEffect`, the callback is never executed synchronously
 * after a source changes. Multiple source updates occurring within the same
 * synchronous execution context are automatically coalesced into a single
 * callback invocation.
 *
 * The callback is executed once immediately after the owning effect is created,
 * and then after every source change. If the callback returns a cleanup
 * function, it is invoked before the next scheduled execution or when the
 * owning reactive context is disposed.
 *
 * The callback is executed in the same reactive owner in which the effect was
 * created.
 *
 * @param source Reactive source that triggers the scheduled callback.
 * @param effectFn Callback executed asynchronously in a microtask whenever the
 * source changes.
 */
export function createAsapRenderEffect(source: Accessor<any>, effectFn: () => (() => void) | void): void;
/**
 * Creates an effect that is built on top of SolidJS `createRenderEffect`, but
 * defers the execution of the provided callback to the next microtask.
 *
 * Unlike `createRenderEffect`, the callback is never executed synchronously
 * after a source changes. Multiple source updates occurring within the same
 * synchronous execution context are automatically coalesced into a single
 * callback invocation.
 *
 * The callback is executed once immediately after the owning effect is created,
 * and then after every source change. If the callback returns a cleanup
 * function, it is invoked before the next scheduled execution or when the
 * owning reactive context is disposed.
 *
 * The callback is executed in the same reactive owner in which the effect was
 * created.
 *
 * Any accessor from the provided array may trigger the scheduled callback.
 *
 * @param sources Reactive sources that trigger the scheduled callback.
 * @param effectFn Callback executed asynchronously in a microtask whenever any
 * source changes.
 */
export function createAsapRenderEffect(sources: Accessor<any>[], effectFn: () => (() => void) | void): void;
export function createAsapRenderEffect(source: any, effectFn: () => (() => void) | void): void {
    if (__IS_SERVER__) {
        source = _coerceToFunction(source);
        let cleanup: any
        createRenderEffect(() => {
            source();
            cleanup = untrack(() => {
                if (typeof cleanup === 'function') { cleanup(); }
                return effectFn();
            });
        });
        return;
    }

    isDev &&
    _assertIsArrayOfFunctionsOrFunction(
        source,
        createAsapRenderEffect,
        FIRST_ARG_EFFECT_ERROR_MESSAGE
    ) &&
    _assertIsFunction(
        effectFn,
        createAsapRenderEffect,
        SECOND_ARG_EFFECT_ERROR_MESSAGE
    );

    let task: _Task | null = null;
    source = _coerceToFunction(source);
    
    createRenderEffect(() => {
        source();
        if (task) {
            _scheduleAsapTask(task);
        } else {
            task = untrack(() => _createTaskObject(effectFn, effectFn(), getOwner()));
        }
    });

    getOwner() && onCleanup(() => task && _cancelTask(task));
}

/**
 * Creates an effect that is built on top of SolidJS `createRenderEffect`, but
 * defers the execution of the provided callback asynchronously using the
 * library's Async Scheduler.
 *
 * Unlike `createRenderEffect`, the callback is never executed synchronously after a
 * source changes. Multiple source updates occurring within the same synchronous
 * execution context are automatically coalesced into a single callback
 * invocation.
 *
 * The callback is guaranteed to execute asynchronously before the browser
 * renders the next frame.
 *
 * The callback is executed once immediately after the owning effect is created,
 * and then after every source change. If the callback returns a cleanup
 * function, it is invoked before the next scheduled execution or when the
 * owning reactive context is disposed.
 *
 * The callback is executed in the same reactive owner in which the effect was
 * created.
 * @param source Reactive source that triggers the scheduled callback.
 * @param effectFn Callback executed asynchronously in a microtask whenever the
 * source changes.
 */
export function createAsyncRenderEffect(source: Accessor<any>, effectFn: () => (() => void) | void): void;
/**
 * Creates an effect that is built on top of SolidJS `createRenderEffect`, but
 * defers the execution of the provided callback asynchronously using the
 * library's Async Scheduler.
 *
 * Unlike `createRenderEffect`, the callback is never executed synchronously after a
 * source changes. Multiple source updates occurring within the same synchronous
 * execution context are automatically coalesced into a single callback
 * invocation.
 *
 * The callback is guaranteed to execute asynchronously before the browser
 * renders the next frame.
 *
 * The callback is executed once immediately after the owning effect is created,
 * and then after every source change. If the callback returns a cleanup
 * function, it is invoked before the next scheduled execution or when the
 * owning reactive context is disposed.
 *
 * The callback is executed in the same reactive owner in which the effect was
 * created.
 * 
 * @param sources Reactive sources that trigger the scheduled callback.
 * @param effectFn Callback executed asynchronously in a microtask whenever any
 */
export function createAsyncRenderEffect(sources: Accessor<any>[], effectFn: () => (() => void) | void): void;
export function createAsyncRenderEffect(source: any, effectFn: () => (() => void) | void): void {
    if (__IS_SERVER__) {
        source = _coerceToFunction(source);
        let cleanup: any;
        createRenderEffect(() => {
            source();
            cleanup = untrack(() => {
                if (typeof cleanup === 'function') { cleanup(); }
                return effectFn();
            });
        });
        return;
    }
    
    isDev &&
    _assertIsArrayOfFunctionsOrFunction(
        source,
        createAsyncRenderEffect,
        FIRST_ARG_EFFECT_ERROR_MESSAGE
    ) &&
    _assertIsFunction(
        effectFn,
        createAsyncRenderEffect,
        SECOND_ARG_EFFECT_ERROR_MESSAGE
    );

    let task: _Task | null = null;
    source = _coerceToFunction(source);
    
    createRenderEffect(() => {
        source();
        if (task) {
            _scheduleAsyncTask(task);
        } else {
            task = untrack(() => _createTaskObject(effectFn, effectFn(), getOwner()));
        }
    });

    getOwner() && onCleanup(() => task && _cancelTask(task));
}

function _createCssAnimationHandler(el: Element): _CssAnimationHandler {
    let transitioning = false, animating = false, doneCb = null as (() => void) | null;
    
    const animationStart = () => animating = true;
    const transitionStart = () => transitioning = true;
    const animationDone = () => { 
        animating = false;
        if (transitioning) { return; }
        doneCb?.();
    }
    const transitionDone = () => {
        transitioning = false;
        if (animating) { return; }
        doneCb?.();
    } 

    el.addEventListener('animationstart', animationStart);
    el.addEventListener('animationcancel', animationDone);
    el.addEventListener('animationend', animationDone);
    el.addEventListener('transitionstart', transitionStart);
    el.addEventListener('transitioncancel', transitionDone);
    el.addEventListener('transitionend', transitionDone);

    const handler = {
        isAnimating() { return transitioning || animating; },
        onDone(cb: () => void) { doneCb = cb; }
    }

    return handler;
}

/**
 * Creates a reactive presence state that delays removal while CSS animations
 * or transitions are still running.
 *
 * This utility is primarily intended for implementing exit animations with
 * conditional rendering primitives such as SolidJS `Show`.
 *
 * When the source value becomes falsy, the returned accessor continues to
 * expose the previous value until all active CSS animations and transitions
 * associated with the provided element have completed. Once the element is no
 * longer animating, the latest source value is propagated.
 *
 * Truthy values are propagated almost immediately.
 *
 * The returned directive function must be attached to the element whose CSS
 * animations or transitions should control the presence state.
 *
 * @param source Reactive source controlling the element presence.
 *
 * @returns A tuple containing:
 * - A reactive accessor representing the delayed presence state.
 * - A directive function that must be assigned to the animated element via
 *   `ref`.
 *
 * @example
 * ```tsx
 * const [visible, presence] = createPresence(open);
 *
 * <Show when={visible()}>
 *   <div
 *     ref={presence}
 *     classList={{
 *       'leave-transition': !open()
 *     }}
 *   >
 *     Content
 *   </div>
 * </Show>
 * ```
 */
export function createPresence<T>(source: Accessor<T>): [Accessor<T>, (element: Element) => void] {
    if (__IS_SERVER__) {
        return [source, () => {}];
    }
    isDev && _assertIsFunction(source, createPresence, INVALID_ARG_PRESENCE_ERROR_MESSAGE);

    const [state, setState] = createSignal(source());

    let handler: _CssAnimationHandler | null = null;

    createAsapEffect(source, () => {
        if (!source() && handler && handler.isAnimating()) {
            handler.onDone(() => setState(source));
        } else {
            setState(source);
        }
    })

    const refFn = (el: Element) => {
        if (isDev && !(el instanceof Element)) {
            throw new Error('createPresence()[1]: Invalid argument! Expected an Element instance.');
        }
        handler = _createCssAnimationHandler(el);
        getOwner() && onCleanup(() => handler = null);
    }
    
    return [state, refFn];
}

/**
 * Creates a reactive signal that becomes `true` shortly after the owning
 * component has been mounted.
 *
 * The signal initially returns `false` and is updated asynchronously using the
 * library's PostPaint Scheduler, allowing the browser to render the element
 * before the value changes. This makes it suitable for triggering CSS enter
 * transitions without forcing synchronous layout updates.
 *
 * The returned accessor changes from `false` to `true` only once during the
 * lifetime of the owning context.
 *
 * @returns A reactive accessor indicating whether the entrance phase has
 * completed.
 *
 * @example
 * ```tsx
 * const entrance = createEntrance();
 *
 * <div
 *   classList={{
 *     'enter-transition': entrance()
 *   }}
 * />
 * ```
 */
export function createEntrance(): Accessor<boolean> {
    if (__IS_SERVER__) { return () => false; }
    const [state, setState] = createSignal(false);
    let task: _Task | null = null;

    return () => {
        const value = state();
        if (value || task) { return value; };

        task = _createTaskObject(() => {  setState(true); });
        _schedulePostPaintTask(task);

        getOwner() && onCleanup(() => _cancelTask(task!));

        return false;
    };
}