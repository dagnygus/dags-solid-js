/**
 * @license MIT
 * Copyright (c) 2026 dags-solid-cdk contributors
 *
 * Internal implementation details.
 * Not part of the public API.
 */

import { batch, runWithOwner } from "solid-js";

/** @internal */
declare const setImmediate: (cb: () => void) => object;
/** @internal */
declare const clearImmediate: (arg: object) => void;

/** @internal */
export interface _Task {
    prev: _Task | null;
    next: _Task | null;
    callback: () => (() => void) | void;
    cleanup: (() => void) | null;
    deadline: number;
    owner: any
    queue: _TaskQueue | null;
}

interface _TaskQueue {
    head: _Task | null;
    tail: _Task | null;
}

interface _DoubleTaskQueue extends _TaskQueue {
    next: _DoubleTaskQueue;
} 

type _NavigatorWithScheduling = Navigator & {
  scheduling: { isInputPending?: () => boolean };
};

type _MessagePortWithUnref = MessagePort & {
  unref?: () => void;
};

const _maxDuration = 16;
const _taskTimeout = 250;
let _rafRequested = false; //Pending macrotask or looping;
let _asyncRequested = false; //Pending macrotask or looping;
let _asapRequested = false; //Pending microtask or looping;
let _postPaintRequested = false; //Pending or looping;
let _postPaintExecuting = false; //Looping
let _measureRequested = false; //Pending or looping
let _measureExecuting = false; //Looping
let _concurrentRequested = false; //Pending message or looping via message loop;

let _rafRafId: number | undefined = undefined; //Animation frame scheduler raf id.
let _asyncRafId: number | undefined = undefined; //Async scheduler animation frame id.
let _asyncTimerId: number  | undefined = undefined; //Async scheduler timer id.
let _postPaintRafId: number | undefined = undefined; //Post paint animation frame id.
let _measureTimerId: number | undefined = undefined; //Measure scheduler timer id.
let _rafRunning = false;

const _asyncTaskQueue: _TaskQueue = { head: null, tail: null };
const _asapTaskQueue: _TaskQueue = { head: null, tail: null };
const _concurrentTaskQueue: _TaskQueue = { head: null, tail: null };

let _currentQueue: _TaskQueue | null = null;

let _rafTaskQueue: _DoubleTaskQueue = { head: null, tail: null, next: { head: null, tail: null, next: null! } };
_rafTaskQueue.next.next = _rafTaskQueue;

let _postPaintTaskQueue: _DoubleTaskQueue = { head: null, tail: null, next: { head: null, tail: null, next: null! } };
_postPaintTaskQueue.next.next = _postPaintTaskQueue;

let _measureTaskQueue: _DoubleTaskQueue = { head: null, tail: null, next: { head: null, tail: null, next: null! } };
_measureTaskQueue.next.next = _measureTaskQueue;

const _getTime = performance.now.bind(performance);
let _shouldYield: (currentTime: number, startTime: number, deadline: number) => boolean;

// We will take advantage of the experimental api supported by many chromium versions.
// See 'https://developer.mozilla.org/en-US/docs/Web/API/Scheduling/isInputPending'.
if (
    typeof navigator === 'object' &&
    navigator !== null &&
    (navigator as _NavigatorWithScheduling).scheduling &&
    (navigator as _NavigatorWithScheduling).scheduling.isInputPending
) {
    const scheduling = (navigator as _NavigatorWithScheduling).scheduling;
    const isInputPending = scheduling.isInputPending!.bind(scheduling);
    _shouldYield = (currentTime, startTime, deadline) => (_maxDuration <= currentTime - startTime || isInputPending()) && currentTime < deadline;
} else {
    _shouldYield = (currentTime, startTime, deadline) => _maxDuration <= currentTime - startTime && currentTime < deadline;
}

let _postMessage: () => void = null!;

// Emulating experimental setImmediate feature.
// See 'https://developer.mozilla.org/en-US/docs/Web/API/Window/setImmediate'.
if (!__IS_SERVER__) {
    function flushConcurrent(): void {
        try {
            _doMWork(_getTime(), _concurrentTaskQueue)
        } finally {
            if (_concurrentTaskQueue.head) {
                _postMessage();
            } else {
                _concurrentRequested = false;
            }
        }
    }
    
    if (typeof setImmediate === 'function') {
        // In tests, the browser bundle may be imported into a Node.js environment,
        // typically with jsdom. In this case, setImmediate() is an ideal fallback,
        // as it integrates well with fake timers.

        _postMessage = () => setImmediate(flushConcurrent);

    } else {

        const messageChannel = new MessageChannel();
        // In Node.js, active MessagePort listeners keep the event loop alive.
        // Calling unref() allows the process to exit naturally when there is no
        // other work keeping it alive (e.g. after dispose). unref is not available
        // in browsers, so we guard the call.
        const port1 = messageChannel.port1 as _MessagePortWithUnref;
        const port2 = messageChannel.port2 as _MessagePortWithUnref;
        if (typeof port1.unref === 'function') { port1.unref(); }
        if (typeof port2.unref === 'function') { port2.unref(); }
    
        port1.onmessage = flushConcurrent
        _postMessage = port2.postMessage.bind(messageChannel.port2, null);

    }

}

const _flush = batch.bind(undefined, () => {
    const queue = _currentQueue!
    let task: _Task | null = null;
    try {
        while((task = _dequeue(queue))) {
            const owner = task.owner;
            const cleanup = task.cleanup;
            const callback = task.callback;
            try {
                if (cleanup) { runWithOwner(owner, cleanup); }
            } finally {
                const c = runWithOwner(owner, callback)
                task.cleanup = typeof c === 'function' ? c : null;
            }
        } 
    } finally {
        if (queue.head) {
            _flush();
        } else {
            _currentQueue = null;
        }
    }
});

function _tryEnqueue(queue: _TaskQueue, task: _Task): boolean {
    if (task.queue) return false;
    task.prev = queue.tail;

    if (queue.tail !== null) {
        queue.tail.next = task;
    } else {
        queue.head = task;
    }

    queue.tail = task;
    task.queue = queue
    return true;
}

function _dequeue(queue: _TaskQueue): _Task | null {
    const task = queue.head;

    if (task === null) {
        return null;
    }

    queue.head = task.next;

    if (queue.head !== null) {
        queue.head.prev = null;
    } else {
        queue.tail = null;
    }

    task.next = null;
    task.prev = null;
    task.queue = null;

    return task;
}

function _flushAnimationFrame(): void {
    _rafRunning = true;
    let asyncFlushed = false;
    try {
        if (_asyncRafId !== undefined) {
            clearTimeout(_asyncTimerId)
            cancelAnimationFrame(_asyncRafId);
            _asyncTimerId = undefined
            _asyncRafId = undefined;
            asyncFlushed = true;
            _currentQueue = _asyncTaskQueue;
            _flush();
        }
    } finally {
        if (asyncFlushed) {
            _asyncRequested = false;
        }
        try {
            _currentQueue = _rafTaskQueue;
            _flush();
        } finally {
            _rafRunning = false;
            if (_rafTaskQueue.next.head) {
                //Swap
                _rafTaskQueue = _rafTaskQueue.next;
                //Reschedule
                _rafRafId = requestAnimationFrame(() => {
                    _rafRafId = undefined;
                    _flushAnimationFrame();
                })
            } else {
                _rafRequested = false;
            }
        }
    }
}

function _flushMeasure(): void {
    _measureExecuting = true;
    try {
        _currentQueue = _measureTaskQueue;
        _flush();
    } finally {
        _measureExecuting = false;
        if (_measureTaskQueue.next.head) {
            //Swap
            _measureTaskQueue = _measureTaskQueue.next;
            //Reschedule
            requestAnimationFrame(() => {
                _measureTimerId = setTimeout(() => {
                    _measureTimerId = undefined;
                    _flushMeasure();
                });;
            });
        } else {
            _measureRequested = false;
        }
    }
}

function _flushPostPaint(): void {
    _postPaintExecuting = true;
    try {
        _currentQueue = _postPaintTaskQueue
        _flush();
    } finally {
        _postPaintExecuting = false;
        if (_postPaintTaskQueue.next.head) {
            //Swap
            _postPaintTaskQueue = _postPaintTaskQueue.next;
            //Reschedule
            requestAnimationFrame(() => {
                _postPaintRafId = requestAnimationFrame(() => {
                    _postPaintRafId = undefined;
                    _flushPostPaint();
                });
            });
        } else {
            _postPaintRequested = false;
        }
    }
}

/**
 * Implemented with coalescing.
 * @internal
 */
export function _scheduleAsapTask(task: _Task): void {
    if (!_tryEnqueue(_asapTaskQueue, task) || _asapRequested) { return; }
    _asapRequested = true;
    queueMicrotask(() => {
        try {
            _currentQueue = _asapTaskQueue;
            _flush();
        } finally {
            _asapRequested = false;
        }
    });
}

/**
 * Implemented with coalescing.
 * @internal
 */
export function _scheduleAsyncTask(task: _Task): void {
    if (!_tryEnqueue(_asyncTaskQueue, task) || _asyncRequested) { return; }

    _asyncRequested = true;
    
    _asyncTimerId = setTimeout(() => {
        _asyncTimerId = undefined
        cancelAnimationFrame(_asyncRafId!);
        _asyncRafId = undefined;
        try {
            _currentQueue = _asyncTaskQueue;
            _flush();
        } finally {
            _asyncRequested = false;
        }
    }, 0);

    _asyncRafId = requestAnimationFrame(() => {
        _asyncRafId = undefined;
        clearTimeout(_asyncTimerId);
        _asyncTimerId = undefined;

        _rafRunning = true;
        try {
            _currentQueue = _asyncTaskQueue;
            _flush();
        } finally {
            _asyncRequested = false;
            if (_rafRequested) {
                if (_rafRafId !== undefined) {
                    cancelAnimationFrame(_rafRafId);
                    _rafRafId = undefined;
                }
                _flushAnimationFrame();
            } else {
                _rafRunning = false;
            }
        }
    });

}

/**
 * Implemented with coalescing.
 * @internal
 */
export function _scheduleAnimationFrameTask(task: _Task): void {
    if ((_rafRunning && _tryEnqueue(_rafTaskQueue.next, task) || _tryEnqueue(_rafTaskQueue, task)) && !_rafRequested) {
        _rafRequested = true;
        _rafRafId = requestAnimationFrame(() => {
            _rafRafId = undefined;
            _flushAnimationFrame();
        });
    }
}

/**
 * Implemented with coalescing.
 * @internal
 */
export function _schedulePostPaintTask(task: _Task): void {
    if (_postPaintExecuting || _postPaintRafId !== undefined) {
        _tryEnqueue(_postPaintTaskQueue.next, task)
    } else if (_tryEnqueue(_postPaintTaskQueue, task) && !_postPaintRequested) {
        _postPaintRequested = true;
        if (_rafRunning) {
            requestAnimationFrame(() => _flushPostPaint());
        } else {
            requestAnimationFrame(() => {
                _postPaintRafId = requestAnimationFrame(() => {
                    _postPaintRafId = undefined;
                    _flushPostPaint();
                });
            });
        }

    }
}

/**
 * Implemented with coalescing.
 * @internal
 */
export function _scheduleMeasureTask(task: _Task): void {
    if (_measureExecuting || _measureTimerId !== undefined) {
        _tryEnqueue(_measureTaskQueue.next, task)
    } else if (_tryEnqueue(_measureTaskQueue, task) && !_measureRequested) {
        _measureRequested = true;
        if (_rafRunning) {
            setTimeout(() => _flushMeasure());
        } else {
            requestAnimationFrame(() => {
                _measureTimerId = setTimeout(() => {
                    _measureTimerId = undefined;
                    _flushMeasure();
                });
            });
        }
    }
}

/**
 * Implemented with coalescing.
 * @internal
 */
export function _scheduleConcurrentTask(task: _Task): void {
    if (_tryEnqueue(_concurrentTaskQueue, task)) {
        task.deadline = _getTime() + _taskTimeout;
    } else {
        return;
    }
    if (_concurrentRequested) { return; }
    _concurrentRequested = true;
    _postMessage();
}

/** @internal */
export function _cancelTask(task: _Task, runCleanup?: boolean): void {
    if (task.queue) {
        const queue = task.queue;
        const prev = task.prev;
        const next = task.next;
    
        if (prev !== null) {
            prev.next = next;
        } else {
            queue.head = next;
        }
    
        if (next !== null) {
            next.prev = prev;
        } else {
            queue.tail = prev;
        }
    
        task.next = null;
        task.prev = null;
        task.queue = null;

        if (runCleanup && task.cleanup) {
            task.cleanup.call(undefined);
        }
    }
}

function _doMWork(startTime: number, queue: _TaskQueue): void {
    let task = _dequeue(queue);
    while (task) {
        const owner = task.owner
        const cleanup = task.cleanup;
        const callback = task.callback;
        try {
            if (cleanup) { runWithOwner(owner, cleanup) }
        } finally {
            const c = runWithOwner(owner, callback);
            task.cleanup = typeof c === 'function' ? c : null;
        }
        if (_shouldYield(_getTime(), startTime, task.deadline)) { return; }
        task = _dequeue(queue);
    }
}

/** @internal */
export function _createTaskObject(callback: () => (() => void) | void, cleanup?: (() => void) | void, owner?: any): _Task {
    return {
        prev: null,
        next: null,
        callback,
        cleanup: cleanup || null,
        deadline: 0,
        owner: owner || null,
        queue: null,
    }
}