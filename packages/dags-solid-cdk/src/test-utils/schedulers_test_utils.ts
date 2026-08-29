/**
 * @license
 * Copyright (c) 2026 dags-solid-cdk contributors.
 * Licensed under the MIT License.
 */

import { vitest, expect } from "vitest";

interface _PendingEnvironmentTask {
    id: number;
    cb: Function
}

/** @internal */
export const enum _EventLogs {
    SetTimeout = 'SET_TIMEOUT',
    ClearTimeout = 'CLEAR_TIMER',
    FireTimeout = 'FIRE_TIMEOUT',
    RequestAnimationFrame = 'REQUEST_ANIMATION_FRAME',
    CancelAnimationFrame = 'CANCEL_ANIMATION_FRAME',
    FireAnimationFrame = 'FIRE_ANIMATION_FRAME',
    PostMessage = 'POST_MESSAGE',
    FireOnMessage = 'FIRE_ON_MESSAGE',
    AddMicrotask = 'ADD_MICROTASK',
    FireMicrotask = 'FIRE_MICROTASK'
}

/** @internal */
export interface _MockEnvironmentController {
    logEvent(value: string | number): void;
    advanceTime(milis: number): void;
    assertLogs(expectedLogs: (string | number)[]): void;
    fireTimeoutEvent(): void;
    fireAnimationFrameEvent(): void;
    fireMicrotaskEvent(): void;
    fireMessageEvent(): void;
    disposeEnvironment(): void;
}

let _disposed = true

function _assertNotDisposed() {
    if (_disposed) {
        throw new Error('Environment disposed');
    }
}

/** @internal */
export async function _mocEnvironment<T extends object>(
    emulationTarget: 'browser' | 'server',
    moduleFetcher: () => Promise<T>
) : Promise<_MockEnvironmentController & T> {    
    if (!_disposed) {
        throw new Error('Environment not disposed!');
    }
    _disposed = false
    let time = 0;
    let eventLogs: (string | number)[] = [];
    const timeoutTasks: _PendingEnvironmentTask[] = [];
    const rafTasks: _PendingEnvironmentTask[] = [];
    const microtasks: Function[] = [];
    const messageQueue: Function[] = [];

    function logEvent(value: string | number): void {
        _assertNotDisposed()
        eventLogs.push(value);
    }

    function advanceTime(milis: number): void {
        _assertNotDisposed();
        if (milis <= 0) {
            throw new Error('milis <= 0');
        }
        time += milis
    }

    function assertLogs(expectedLogs: (string | number)[]): void {
        _assertNotDisposed()
        const logs = eventLogs;
        eventLogs = []
        expect(logs).toEqual(expectedLogs);
    }

    function fireTimeoutEvent(): void {
        _assertNotDisposed()
        if (!timeoutTasks.length) {
            throw new Error('No pending timeout event!');
        }
        eventLogs.push(_EventLogs.FireTimeout)
        timeoutTasks.shift()!.cb.call(undefined);
    }

    function fireAnimationFrameEvent(): void {
        _assertNotDisposed()
        if (!rafTasks.length) {
            throw new Error('No pending animation frame event!');
        }
        eventLogs.push(_EventLogs.FireAnimationFrame)
        rafTasks.shift()!.cb.call(undefined);
    }

    function fireMicrotaskEvent(): void {
        _assertNotDisposed()
        if (!microtasks.length) {
            throw new Error('No pending microtask event!');
        }
        eventLogs.push(_EventLogs.FireMicrotask)
        microtasks.shift()!.call(undefined);
    }

    function fireMessageEvent(): void {
        _assertNotDisposed()
        if (!messageQueue.length) {
            throw new Error('No pending message event!');
        }
        eventLogs.push(_EventLogs.FireOnMessage)
        messageQueue.shift()!.call(undefined);
    }

    function disposeEnvironment(): void {
        if (_disposed) { return; }

        if (
            timeoutTasks.length ||
            rafTasks.length ||
            microtasks.length ||
            messageQueue.length
        ) {
            let info: string[] = [];
            if (timeoutTasks.length) { info.push('timeout') }
            if (rafTasks.length) { info.push('rafTasks') }
            if (microtasks.length) { info.push('microtasks') }
            if (messageQueue.length) { info.push('messageQueue') }
            throw new Error('There is still pending event!' + info.toString());
        }

        if (eventLogs.length) {
            throw new Error('There is/are still pending event(s)!')
        }

        vitest.unstubAllGlobals();
        vitest.resetModules();
        _disposed = true;
    }

    vitest.stubGlobal('__IS_SERVER__', emulationTarget === 'server');

    vitest.stubGlobal('setImmediate', undefined);

    vitest.stubGlobal('setTimeout', (cb: () => void) => {
        timeoutTasks.push({
            id: timeoutTasks.length,
            cb
        });
        eventLogs.push(_EventLogs.SetTimeout);
        return timeoutTasks.length - 1;
    });

    vitest.stubGlobal('clearTimeout', (timerId: number | undefined) => {
        if (timerId === undefined) { return; }
        const index = timeoutTasks.findIndex(({ id }) => id === timerId );
        if (index > -1) {
            timeoutTasks.splice(index, 1);
            eventLogs.push(_EventLogs.ClearTimeout);
        }
    });

    vitest.stubGlobal('requestAnimationFrame', (cb: () => void) => {
        rafTasks.push({
            id: rafTasks.length,
            cb
        });
        eventLogs.push(_EventLogs.RequestAnimationFrame);
        return rafTasks.length - 1
    });

    vitest.stubGlobal('cancelAnimationFrame', (rafId: number) => {
        const index = rafTasks.findIndex(({ id }) => id === rafId );
        if (index > -1) {
            rafTasks.splice(index, 1);
            eventLogs.push(_EventLogs.CancelAnimationFrame);
        }
    });

    vitest.stubGlobal('queueMicrotask', (cb: () => void) => {
        microtasks.push(cb);
        eventLogs.push(_EventLogs.AddMicrotask);
    });

    vitest.stubGlobal('MessageChannel', class {
        port1 = {
            _onmessage: null as Function | null,
            set onmessage(value: Function) {
                this._onmessage = value;
            }
        };
        port2 = {
            postMessage: () => {
                eventLogs.push(_EventLogs.PostMessage)
                if (this.port1._onmessage) {
                    messageQueue.push(this.port1._onmessage);
                }
            }
        };
    });

    vitest.stubGlobal('performance', {
        now() { return time; }
    })

    return {
        ...(await moduleFetcher()),
        logEvent,
        advanceTime,
        assertLogs,
        fireTimeoutEvent,
        fireAnimationFrameEvent,
        fireMessageEvent,
        fireMicrotaskEvent,
        disposeEnvironment
    }
}