/**
 * @license
 * Copyright (c) 2026 dags-solid-cdk contributors.
 * Licensed under the MIT License.
 */
import { Accessor, createEffect, createMemo, createReaction, createRenderEffect, createSignal, EffectFunction, getOwner, MemoOptions, onCleanup, onMount, runWithOwner } from "solid-js";
import { _cancelTask, _createTaskObject, _scheduleAnimationFrameTask, _scheduleAsapTask, _scheduleAsyncTask, _schedulePostPaintTask, type _Task } from "../internals/schedulers";
import { isDev } from "solid-js/web";
import { _assertIsElement, _assertIsOptionalBoolean, _assertIsOptionalObjectExcludingArray } from "../internals/common-assertions";

interface _CssAnimationHandler {
    isAnimating(): boolean,
    onDone(cb: () => void): void;
}

function _assertIsFunction(arg: any, caller: Function, errorMessage: string): true | never {
    if (typeof arg === 'function') { return true; }
    throw new Error(`${caller.name}(): ${errorMessage}`);
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
 * @param effectFn Callback executed asynchronously in a microtask whenever
 * the source changes.
 * @param scheduleInitialCall Whether to defer the initial callback invocation
 * to the next microtask. Defaults to `false`.
 */
export function createAsapEffect(effectFn: () => (() => void) | void,  scheduleInitialCall?: boolean): void {
    if (__IS_SERVER__) { return; }
    isDev && _assertIsFunction(
        effectFn,
        createAsapEffect,
        'Invalid first argument! Expected a function.'
    ) && _assertIsOptionalBoolean(
        scheduleInitialCall,
        'createAsapEffect(): Invalid second argument! Expected a boolean or nothing.'
    );

    let task: _Task | null = null;
    
    onMount(() => {
        const track = createReaction(() => _scheduleAsapTask(task!), isDev ? { name: 'createAsapEffect' } : undefined);
        const localEffectFn = () => {
            const cleanup = effectFn();
            if (cleanup instanceof Function) {
                onCleanup(cleanup)
            }
        }
        
        task = _createTaskObject(() => track(localEffectFn));

        if (scheduleInitialCall) {
            _scheduleAsapTask(task);
        } else {
            track(localEffectFn);
        }
    })

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
 * The callback is guaranteed to execute asynchronously before the animation
 * frame scheduler cycle.
 *
 * The initial callback is scheduled during the initial execution of the
 * owning effect. By default, it is scheduled for the current reactive cycle.
 * When `scheduleInitialCall` is `true`, the initial callback invocation is
 * deferred to the next asynchronous scheduler cycle, before animation frame
 * scheduler cycle.
 *
 * If the callback returns a cleanup function, it is invoked before the next
 * scheduled execution or when the owning reactive context is disposed.
 *
 * The callback is executed in the same reactive owner in which the effect was
 * created.
 *
 * @param effectFn Callback executed asynchronously whenever the source changes.
 * @param scheduleInitialCall Whether to defer the initial callback invocation
 * to the next asynchronous scheduler cycle, before animation frame scheduler
 * cycle. Defaults to `false`.
 */
export function createAsyncEffect(effectFn: () => (() => void) | void, scheduleInitialCall?: boolean): void {
    if (__IS_SERVER__) { return; }
    isDev && _assertIsFunction(
        effectFn,
        createAsyncEffect,
        'Invalid first argument! Expected a function.'
    ) && _assertIsOptionalBoolean(
        scheduleInitialCall,
        'createAsyncEffect(): Invalid second argument! Expected a boolean or nothing.'
    );

    let task: _Task | null = null;
    
    createEffect(() => {
        const track = createReaction(() => _scheduleAsyncTask(task!), isDev ? { name: 'createAsyncEffect' } : undefined);
        const localEffectFn = () => {
            const cleanup = effectFn();
            if (cleanup instanceof Function) {
                onCleanup(cleanup)
            }
        }
        
        task = _createTaskObject(() => track(localEffectFn));

        if (scheduleInitialCall) {
            _scheduleAsyncTask(task);
        } else {
            track(localEffectFn);
        }
    })

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
 * The callback is guaranteed to execute asynchronously after asynchronous
 * scheduler cycle.
 *
 * The initial callback is scheduled during the initial execution of the
 * owning effect. By default, it is scheduled for the current reactive cycle.
 * When `scheduleInitialCall` is `true`, the initial callback invocation is
 * deferred to the next animation frame scheduler cycle, after asynchronous
 * scheduler cycle.
 *
 * If the callback returns a cleanup function, it is invoked before the next
 * scheduled execution or when the owning reactive context is disposed.
 *
 * @param effectFn Callback executed asynchronously whenever the source changes.
 * @param scheduleInitialCall Whether to defer the initial callback invocation
 * to the next animation frame scheduler cycle, after asynchronous scheduler
 * cycle. Defaults to `false`.
 */
export function createAnimationFrameEffect(effectFn: () => (() => void) | void, scheduleInitialCall?: boolean): void {
    if (__IS_SERVER__) { return; }
    isDev && _assertIsFunction(
        effectFn,
        createAnimationFrameEffect,
        'Invalid first argument! Expected a function.'
    ) && _assertIsOptionalBoolean(
        scheduleInitialCall,
        'createAsyncEffect(): Invalid second argument! Expected a boolean or nothing.'
    );

    let task: _Task | null = null;
    
    createEffect(() => {
        const track = createReaction(() => _scheduleAnimationFrameTask(task!), isDev ? { name: 'createAnimationFrameEffect' } : undefined);
        const localEffectFn = () => {
            const cleanup = effectFn();
            if (cleanup instanceof Function) {
                onCleanup(cleanup);
            }
        }
        
        task = _createTaskObject(() => track(localEffectFn));

        if (scheduleInitialCall) {
            _scheduleAnimationFrameTask(task);
        } else {
            track(localEffectFn);
        }
    })

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
 * @param effectFn Callback executed asynchronously whenever the source changes.
 */
export function createAsapRenderEffect(effectFn: () => (() => void) | void): void {
    if (__IS_SERVER__) {
        createRenderEffect(() => {
            const cleanup = effectFn()
            if (cleanup instanceof Function) {
                onCleanup(cleanup)
            }
        });
        return;
    }

    isDev && _assertIsFunction(
        effectFn,
        createAsapRenderEffect,
        'Invalid argument! Expected a function.'
    )

    let task: _Task | null = null;
    let cleanup: any

    createRenderEffect(() => {
        const track = createReaction(() => _scheduleAsapTask(task!), isDev ? { name: 'createAsapRenderEffect' } : undefined);
        const localEffectFn = () => {
            cleanup = effectFn();
            if (cleanup instanceof Function) {
                onCleanup(cleanup)
            }
        }
        
        task = _createTaskObject(() => track(localEffectFn));
        track(localEffectFn);
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
 * The callback is guaranteed to execute asynchronously before animation frame
 * scheduler cycle.
 *
 * The callback is executed once immediately after the owning effect is created,
 * and then after every source change. If the callback returns a cleanup
 * function, it is invoked before the next scheduled execution or when the
 * owning reactive context is disposed.
 *
 * The callback is executed in the same reactive owner in which the effect was
 * created.
 * @param effectFn Callback executed asynchronously whenever the source changes.
 */
export function createAsyncRenderEffect(effectFn: () => (() => void) | void): void {
if (__IS_SERVER__) {
        createRenderEffect(() => {
            const cleanup = effectFn()
            if (cleanup instanceof Function) {
                onCleanup(cleanup)
            }
        });
        return;
    }

    isDev && _assertIsFunction(
        effectFn,
        createAsyncRenderEffect,
        'Invalid argument! Expected a function.'
    );

    let task: _Task | null = null;
    let cleanup: any

    createRenderEffect(() => {
        const track = createReaction(() => _scheduleAsyncTask(task!), isDev ? { name: 'createAsyncRenderEffect' } : undefined);
        const localEffectFn = () => {
            cleanup = effectFn();
            if (cleanup instanceof Function) {
                onCleanup(cleanup);
            }
        }
        
        task = _createTaskObject(() => track(localEffectFn));
        track(localEffectFn);
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
 * The callback is guaranteed to execute asynchronously after asynchronous scheduler
 * cycle.
 *
 * The callback is executed once immediately after the owning effect is created,
 * and then after every source change. If the callback returns a cleanup
 * function, it is invoked before the next scheduled execution or when the
 * owning reactive context is disposed.
 *
 * The callback is executed in the same reactive owner in which the effect was
 * created.
 * @param effectFn Callback executed asynchronously whenever the source changes.
 */
export function createAnimationFrameRenderEffect(effectFn: () => (() => void) | void): void {
    if (__IS_SERVER__) {
        createRenderEffect(() => {
            const cleanup = effectFn()
            if (cleanup instanceof Function) {
                onCleanup(cleanup)
            }
        });
        return;
    }

    isDev && _assertIsFunction(
        effectFn,
        createAnimationFrameRenderEffect,
        'Invalid argument! Expected a function.'
    );

    let task: _Task | null = null;
    let cleanup: any

    createRenderEffect(() => {
        const track = createReaction(() => _scheduleAnimationFrameTask(task!), isDev ? { name: 'createAnimationFrameRenderEffect' } : undefined);
        const localEffectFn = () => {
            cleanup = effectFn();
            if (cleanup instanceof Function) {
                onCleanup(cleanup);
            }
        }
        
        task = _createTaskObject(() => track(localEffectFn));
        track(localEffectFn);
    });

    getOwner() && onCleanup(() => task && _cancelTask(task));
}

/**
 * Creates a lazily initialized memo.
 *
 * Unlike {@link createMemo}, the underlying memo is not created immediately.
 * It is created when the returned accessor is called for the first time.
 *
 * Once initialized, subsequent calls return the value of the same memo.
 *
 * @param disposalOwner The owner responsible for disposing the lazy memo.
 * @param fn The function used to compute the memo value.
 *
 * @returns A lazy accessor that initializes the memo on its first read and
 * subsequently returns its current value.
 */
export function createLazyMemo<Next extends Prev, Prev = Next>(disposalOwner: unknown, fn: EffectFunction<undefined | NoInfer<Prev>, Next>): Accessor<Next>;
/**
 * Creates a lazily initialized memo with an initial value.
 *
 * Unlike {@link createMemo}, the underlying memo is not created immediately.
 * It is created when the returned accessor is called for the first time.
 *
 * Once initialized, subsequent calls return the value of the same memo.
 *
 * @param disposalOwner The owner responsible for disposing the lazy memo.
 * @param fn The function used to compute the memo value.
 * @param value The initial value passed to the memo computation.
 * @param options Options used to configure the underlying memo.
 *
 * @returns A lazy accessor that initializes the memo on its first read and
 * subsequently returns its current value.
 */
export function createLazyMemo<Next extends Prev, Init = Next, Prev = Next>(disposalOwner: unknown, fn: EffectFunction<Init | Prev, Next>, value: Init, options?: MemoOptions<Next>): Accessor<Next>;
export function createLazyMemo<Next extends Prev, Init = Next, Prev = Next>(disposalOwner: any, fn: EffectFunction<Init | Prev, Next>, value?: Init, options?: MemoOptions<Next>): Accessor<Next> {
    let memo: Accessor<Next>;
    return () => (memo ??= runWithOwner(disposalOwner, () => createMemo(fn as any, value, options))!, memo())
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
    isDev && _assertIsFunction(source, createPresence, 'Invalid argument! Expected a function.');

    const [state, setState] = createSignal(source());

    let handler: _CssAnimationHandler | null = null;

    createAsapEffect(() => {
        if (!source() && handler && handler.isAnimating()) {
            handler.onDone(() => setState(source));
        } else {
            setState(source);
        }
    })

    const refFn = (el: Element) => {
        isDev && _assertIsElement(
            el,
            'createPresence()[1](): Invalid argument! Expected an Element instance.'
        );
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