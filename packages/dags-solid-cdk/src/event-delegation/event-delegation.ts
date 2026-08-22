import { delegateEvents, isDev } from "solid-js/web";
import { _assertIsElement, _assertIsFunction, _assertIsOpenShadowRoot, _assertIsString } from "../internals/common-assertions";
import { _createNotifier, _Notifier } from "../internals/utils";

const _listeners = new Map<string, Map<Node, _Notifier<[Event]>>>();
const _eventTargets = new WeakMap<Event, Node>();
const _replayEvents = new WeakSet<Event>();

let _allowPropagation = true;
let _node: Node | null = null;

/**
 * Forces SolidJS to replay a delegated event.
 *
 * This handler is intended to be used directly in JSX. SolidJS only replays
 * delegated events that have at least one delegated event handler registered
 * in JSX. Attaching this handler ensures that the event is replayed and passed
 * to the CDK delegated event dispatcher.
 *
 * The handler is also responsible for capturing the event target required by
 * the dispatcher.
 *
 * @param event The delegated event replayed by SolidJS.
 */
export function replayHandler(event: Event): void {
    if (isDev && !(event instanceof Event)) {
        throw new Error('replayHandler(): Invalid argument! Expected an Event instance.');
    }
    _replayEvents.add(event);
}

/**
 * Registers a delegated event listener for the specified event type.
 *
 * Instead of attaching the listener directly to the target element, events are
 * dispatched through an internal delegation mechanism. When an event occurs,
 * the dispatcher starts from the original event target and traverses up the DOM
 * tree, invoking matching delegated listeners until the event reaches the root
 * or propagation stops.
 *
 * Traversal follows the event bubbling phase and stops immediately for
 * non-bubbling events.
 *
 * @param target The element to listen for delegated events on.
 * @param type The event type.
 * @param listener The callback invoked when the delegated event reaches the target.
 * @returns A function that removes the delegated event listener.
 *
 * @throws Error If the target belongs to a closed Shadow DOM.
 */
export function addDelegatedEventListener<K extends keyof HTMLElementEventMap>(target: HTMLElement, type: K, listener: (e: HTMLElementEventMap[K]) => void): () => void;
/**
 * Registers a delegated event listener for the specified event type.
 *
 * Instead of attaching the listener directly to the target element, events are
 * dispatched through an internal delegation mechanism. When an event occurs,
 * the dispatcher starts from the original event target and traverses up the DOM
 * tree, invoking matching delegated listeners until the event reaches the root
 * or propagation stops.
 *
 * Traversal follows the event bubbling phase and stops immediately for
 * non-bubbling events.
 *
 * @param target The element to listen for delegated events on.
 * @param type The event type.
 * @param listener The callback invoked when the delegated event reaches the target.
 * @returns A function that removes the delegated event listener.
 *
 * @throws Error If the target belongs to a closed Shadow DOM.
 */
export function addDelegatedEventListener<K extends keyof SVGElementEventMap>(target: SVGElement, type: K, listener: (e: SVGElementEventMap[K]) => void): () => void;
/**
 * Registers a delegated event listener for the specified event type.
 *
 * Instead of attaching the listener directly to the target element, events are
 * dispatched through an internal delegation mechanism. When an event occurs,
 * the dispatcher starts from the original event target and traverses up the DOM
 * tree, invoking matching delegated listeners until the event reaches the root
 * or propagation stops.
 *
 * Traversal follows the event bubbling phase and stops immediately for
 * non-bubbling events.
 *
 * @param target The element to listen for delegated events on.
 * @param type The event type.
 * @param listener The callback invoked when the delegated event reaches the target.
 * @returns A function that removes the delegated event listener.
 *
 * @throws Error If the target belongs to a closed Shadow DOM.
 */
export function addDelegatedEventListener<K extends keyof MathMLElementEventMap>(target: MathMLElement, type: K, listener: (e: MathMLElementEventMap[K]) => void): () => void;
/**
 * Registers a delegated event listener for the specified event type.
 *
 * Instead of attaching the listener directly to the target element, events are
 * dispatched through an internal delegation mechanism. When an event occurs,
 * the dispatcher starts from the original event target and traverses up the DOM
 * tree, invoking matching delegated listeners until the event reaches the root
 * or propagation stops.
 *
 * Traversal follows the event bubbling phase and stops immediately for
 * non-bubbling events.
 *
 * @param target The element to listen for delegated events on.
 * @param type The event type.
 * @param listener The callback invoked when the delegated event reaches the target.
 * @returns A function that removes the delegated event listener.
 *
 * @throws Error If the target belongs to a closed Shadow DOM.
 */
export function addDelegatedEventListener<T extends Event = Event>(target: Element, type: string, listener: (e: T) => void): () => void;
export function addDelegatedEventListener(target: Element, type: string, listener: (e: Event) => void): () => void {
    if (__IS_SERVER__) {
        throw new Error('addDelegatedEventListener(): This function cannot be used in a server environment!');
    }
    isDev && _assertIsElement(
        target,
        'addDelegatedEventListener(): Invalid first argument! Expected a DOM Element instance.',
    ) && _assertIsOpenShadowRoot(
        target.getRootNode(),
        'addDelegatedEventListener(): Closed Shadow DOM is not supported! Cannot attach a delegated event listener to a closed Shadow DOM.'
    ) && _assertIsString(
        type,
        'addDelegatedEventListener(): Invalid second argument! Expected a string.'
    ) && _assertIsFunction(
        listener,
        'addDelegatedEventListener(): Invalid third argument! Expected a function.'
    );
    
    delegateEvents([type]);
    let notifiers = _listeners.get(type) || null;
    let notifier: _Notifier<[Event]> | null = null;

    if (notifiers === null) {
        document.addEventListener(type, _dispatcher);
        notifier = _createNotifier();
        notifiers = new Map<Element, _Notifier<[Event]>>();
        notifiers.set(target, notifier);
        _listeners.set(type, notifiers);
    }

    if (notifier === null) {
        notifier = notifiers.get(target) || null;

        if (notifier === null) {
            notifier = _createNotifier();
            notifiers.set(target, notifier);
        }
    }

    if (notifier.count() === 0) {
        target.addEventListener(type, _captureEventTarget);
    }

    let removeListener: (() => void) | null = notifier.add(listener);

    return () => {
        if (removeListener) {
            const notifiers = _listeners.get(type)!;
            const notifier = notifiers.get(target)!;

            removeListener();
    
            if (notifier.count() === 0) {
                notifiers.delete(target);
                target.removeEventListener(type, _captureEventTarget);
            }

            if (notifiers.size === 0) {
                _listeners.delete(type);
                document.removeEventListener(type, _dispatcher)
            }

            removeListener = null;
        }
    }
}

/** @internal */
export function _dispatcher(e: Event): void {
    _node = _eventTargets.get(e) || null;

    if (_node === null && _replayEvents.has(e)) {
        _node = e.composedPath()[0] as Node;
    }

    if (_node === null) { return; }

    const ogStopPropagation = e.stopPropagation;
    const ogStopImmediatePropagation = e.stopImmediatePropagation;

    e.stopPropagation = function() {
        ogStopPropagation.call(e);
        _allowPropagation = false;
    }
    e.stopImmediatePropagation = function() {
        ogStopImmediatePropagation.call(e);
        _allowPropagation = false;
    }

    const notifiers = _listeners.get(e.type)!;

    try {
        _propagateEvent(e, notifiers);
    } finally {
        _allowPropagation = true;
        e.stopPropagation = ogStopPropagation;
        e.stopImmediatePropagation = ogStopImmediatePropagation;
    }

}

function _propagateEvent(e: Event, notifiers: Map<Node, _Notifier<[Event]>>): void {
    try {
        while (_node && _allowPropagation) {
            const currentNode = _node;
            if (_node.parentNode instanceof ShadowRoot) {
                _node = _node.parentNode.host;
            } else {
                _node = _node.parentElement;
            }
            const notifier = notifiers.get(currentNode);
            if (notifier) {
                notifier.notify(e);
            }
        }
    } finally {
        if (_node && _allowPropagation) {
            _propagateEvent(e, notifiers);
        }
    }
}

function _captureEventTarget(event: Event): void {
    _eventTargets.set(event, event.target as Node);
}

/** @internal */
export function _getListeners(): Map<string, Map<Node, _Notifier<[Event]>>> {
    return _listeners;
}