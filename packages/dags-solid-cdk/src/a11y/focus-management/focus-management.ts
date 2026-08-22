import { Accessor, createComputed, createEffect, createMemo, createSignal, getOwner, onCleanup, onMount, Signal } from "solid-js";
import { _cancelTask, _createTaskObject, _scheduleAsapTask, _Task, } from "../../internals/schedulers";
import { normalizePassiveListenerOptions } from "../../platform/platform";
import { isDev } from "solid-js/web";
import { _assertIsElement, _assertIsElementWithFocus, _assertIsInOwningContext, _assertIsOptionalBoolean } from "../../internals/common-assertions";
import { CdkBatchedMutationRecord, observeBatchedMutations, disableShadowDomScanning } from "../../observers/observers";
import { createAsapEffect, createLazyMemo } from "../../signals/signals";
import { addDelegatedEventListener } from "../../event-delegation/event-delegation";

/**
 * Represents a DOM element that supports programmatic focus.
 *
 * Implementations must provide the standard `focus()` method, allowing the
 * element to receive keyboard focus programmatically.
 */
export interface FocusableElement extends Element {

    /**
     * Moves focus to this element.
     *
     * @param options Options controlling how focus is applied.
     */
    focus(options?: FocusOptions): void;
}

interface _PotentialTabbable {
    element: FocusableElement;
    priority: number;
}

interface _CustomNodeIterator {
    nativeIterator: NodeIterator
    delegate: _CustomNodeIterator | null;
    nextNode(): FocusableElement | null;
}

interface _ElementStackRef {
    ref: WeakRef<FocusableElement>;
    next: _ElementStackRef | null;
    prev: _ElementStackRef | null;
}

let _origin: 'program' | 'keyboard' | 'pointer' = 'program';
let _stopped: 'pointerdown' | 'keydown' | '' = ''
let _focusStackHead: _ElementStackRef | null = null;
let _focusStackTail: _ElementStackRef | null = null;
const _focusOrigins = new WeakMap<Element, Accessor<'program' | 'keyboard' | 'pointer' | undefined>>();
const _deepFocusOrigins = new WeakMap<Element, Accessor<'program' | 'keyboard' | 'pointer' | undefined>>();

function _assertIsValidArgument(target: any, caller: Function, firstOne: boolean): true {
    if (target instanceof Element || typeof target === 'function') { return true; }
    throw new Error(
        `${caller.name}(): Invalid${firstOne ? ' first ' : ' '}argument! It must be a function returning a DOM Element or a DOM Element instance (e.g. HTMLElement, SVGElement, etc.).`
    );
}

function _pushElement(element: FocusableElement): _ElementStackRef {
    const stackRef: _ElementStackRef = {
        ref: new WeakRef(element),
        next: null,
        prev: _focusStackTail,
    }

    if (_focusStackTail) {
        _focusStackTail.next = stackRef
    } else {
        _focusStackHead = stackRef
    }

    _focusStackTail = stackRef;

    return stackRef;
}

function _unlinkElement(elementRef: _ElementStackRef): _ElementStackRef {
    const { next, prev } = elementRef;

    if (prev) {
        prev.next = next
    } else {
        _focusStackHead = next
    }

    if (next) {
        next.prev = prev;
    } else {
        _focusStackTail = prev
    }

    elementRef.next = null;
    elementRef.prev = null;

    return elementRef;
}

function _tryRestorePreviousFocus(): void {
    while (_focusStackHead) {
        const element = _unlinkElement(_focusStackTail!).ref.deref();
        if (element) {
            element.focus();
            if (isFocused(element)) { return; }
        }
    }
}

const _resetTask = _createTaskObject(() => {
    _origin = 'program';
    if (isDev) {
        _stopped = '';
    }
});

if (!__IS_SERVER__) {

    document.addEventListener(
        'pointerdown',
        (e) => {
            if (isDev) {
                const ogStopPropagation = e.stopPropagation;
                const ogStopImmediatePropagation = e.stopImmediatePropagation;
                e.stopPropagation = function() {
                    _stopped = 'pointerdown';
                    ogStopPropagation.call(e);
                };
                e.stopImmediatePropagation = function() {
                    _stopped = 'pointerdown'
                    ogStopImmediatePropagation.call(e);
                };
            }
            _scheduleAsapTask(_resetTask);
        },
        normalizePassiveListenerOptions({ capture: true, passive: true })
    );

    document.addEventListener(
        'keydown',
        (e) =>  {
            if (isDev) {
                const ogStopPropagation = e.stopPropagation;
                const ogStopImmediatePropagation = e.stopImmediatePropagation;
                e.stopPropagation = function() {
                    ogStopPropagation.call(e);
                    _stopped = 'keydown';
                };
                e.stopImmediatePropagation = function() {
                    ogStopImmediatePropagation.call(e);
                    _stopped = 'keydown'
                };
            }
            _scheduleAsapTask(_resetTask);
        },
        normalizePassiveListenerOptions({ capture: true, passive: true })
    );

    document.addEventListener(
        'pointerdown',
        () => {
            if (_resetTask.queue) {
                _origin = 'pointer';
            }
        },
        normalizePassiveListenerOptions({ passive: true })
    );

    document.addEventListener(
        'keydown',
        () => {
            if (_resetTask.queue) {
                _origin = 'keyboard';
            }
        },
        normalizePassiveListenerOptions({ passive: true })
    );
}

/** @internal */
export function _getCurrentAssignedOrigin(): 'program' | 'keyboard' | 'pointer' {
    return _origin
}

function _finalizeIfProgram(): true {
    if (_origin === 'program') {
        _cancelTask(_resetTask);
        return true;
    }
    return true;
}

/**
 * Returns the currently focused element.
 *
 * Unlike `document.activeElement`, this function correctly resolves the
 * focused element across nested Shadow DOM boundaries.
 *
 * @returns The currently focused element, or `null` if no element is focused.
 */
export function getFocusedElement(): Element | null {
    if (__IS_SERVER__) {
        throw new Error('getFocusedElement(): This function cannot be used in a server environment!')
    }
    let active = document.activeElement;

    while (active instanceof HTMLElement && active.shadowRoot) {
        const next = active.shadowRoot.activeElement;
        if (!next) break;
        active = next;
    }

    return active;
}

/**
 * Determines whether the specified node is currently focused.
 *
 * Unlike checking `document.activeElement` directly, this function correctly
 * resolves the focused element across Shadow DOM boundaries.
 *
 * @param target The node to check.
 *
 * @returns `true` if the specified node is currently focused; otherwise `false`.
 * @throws `Error` if it is used in a server environment.
 */
export function isFocused(target: Node): boolean {
    if (__IS_SERVER__) {
        throw new Error('isFocused(): This function cannot be used in a server environment!');
    }
    return target === getFocusedElement();
}

/**
 * Determines whether the specified node contains the currently focused element,
 * including itself.
 *
 * Unlike checking `document.activeElement` directly, this function correctly
 * resolves the focused element across Shadow DOM boundaries.
 *
 * @param target The node whose descendants should be checked.
 *
 * @returns `true` if the specified node contains the currently focused
 * element; otherwise `false`.
 * @throws `Error` if it is used in a server environment.
 */
export function hasFocusedElement(target: Node): boolean {
    if (__IS_SERVER__) {
        throw new Error('hasFocusedElement(): This function cannot be used in a server environment!');
    }
    const root = target.getRootNode();

    if (root instanceof Document || root instanceof ShadowRoot) {
        return target.contains(root.activeElement);
    }

    return false;
}

function _logError(): void {
    if (_stopped) {
        console.error(
            `monitorFocus(): ${_stopped}.stopPropagation() was called. ` +
            'Focus origin may be incorrectly reported as "program".'
        );
        _stopped = '';
    }
}

/**
 * Monitors focus changes within the specified element.
 *
 * Creates a reactive accessor that returns the origin of the most recent
 * focus event. The accessor updates whenever the focus state changes.
 *
 * The returned value can be:
 * - `program` — focus was triggered programmatically.
 * - `keyboard` — focus was caused by keyboard interaction.
 * - `pointer` — focus was caused by pointer interaction.
 * - `undefined` — when the element is not focused or the focus origin
 *   cannot be determined.
 *
 * @remarks
 * Focus origin is determined from `keydown` and `pointerdown` events that
 * reach the bubbling phase. Calling `stopPropagation()` or
 * `stopImmediatePropagation()` on these events may prevent the focus origin
 * from being detected correctly, causing it to be reported as `program`.
 *
 * @param element The element to monitor for focus changes.
 * @param checkDescendants Whether focus changes from descendant elements should
 * also be tracked.
 *
 * @returns A reactive accessor containing the current focus origin.
 */
export function monitorFocusOrigin(element: Element, checkDescendants?: boolean): Accessor<'program' | 'keyboard' | 'pointer' | undefined>;
/**
 * Monitors focus changes within the specified element.
 *
 * Creates a reactive accessor that returns the origin of the most recent
 * detected focus event. The accessor updates whenever the focus state changes.
 *
 * The returned value can be:
 * - `program` — focus was triggered programmatically.
 * - `keyboard` — focus was caused by keyboard interaction.
 * - `pointer` — focus was caused by pointer interaction.
 * - `undefined` — when the focus origin is unknown, including when the element
 *   was already focused before monitoring started or when the origin could not
 *   be determined.
 *
 * The element is resolved lazily using the provided getter. If the getter does
 * not return an Element during initial execution, resolution is deferred until
 * the component is mounted using Solid's `onMount` lifecycle hook.
 *
 * @remarks
 * Focus origin is determined from `keydown` and `pointerdown` events that
 * reach the bubbling phase. Calling `stopPropagation()` or
 * `stopImmediatePropagation()` on these events may prevent the focus origin
 * from being detected correctly, causing it to be reported as `program`.
 *
 * @param elementGetter A function returning the element to monitor.
 * @param checkDescendants Whether focus changes from descendant elements should
 * also be tracked.
 *
 * @returns A reactive accessor containing the current focus origin.
 */
export function monitorFocusOrigin(elementGetter: () => Element, checkDescendants?: boolean): Accessor<'program' | 'keyboard' | 'pointer' | undefined>;
/**
 * Monitors focus changes within the specified element.
 *
 * Creates a reactive accessor that returns the origin of the most recent
 * detected focus event. The accessor updates whenever the focus state changes.
 *
 * The returned value can be:
 * - `program` — focus was triggered programmatically.
 * - `keyboard` — focus was caused by keyboard interaction.
 * - `pointer` — focus was caused by pointer interaction.
 * - `undefined` — when the focus origin is unknown, including when the element
 *   was already focused before monitoring started or when the origin could not
 *   be determined.
 *
 * The target can be provided either directly as an Element or as a getter
 * function. When a getter is provided and it does not return an Element during
 * initial execution, resolution is deferred until the component is mounted
 * using Solid's `onMount` lifecycle hook.
 *
 * @remarks
 * Focus origin is determined from `keydown` and `pointerdown` events that
 * reach the bubbling phase. Calling `stopPropagation()` or
 * `stopImmediatePropagation()` on these events may prevent the focus origin
 * from being detected correctly, causing it to be reported as `program`.
 *
 * @param target The element to monitor or a function returning the element.
 * @param checkDescendants Whether focus changes from descendant elements should
 * also be tracked.
 *
 * @returns A reactive accessor containing the current focus origin.
 */
export function monitorFocusOrigin(target: Element | (() => Element), checkDescendants?: boolean): Accessor<'program' | 'keyboard' | 'pointer' | undefined>;
/** @internal */
export function monitorFocusOrigin(target: Element | (() => Element), checkDescendants?: boolean, caller?: Function): Accessor<'program' | 'keyboard' | 'pointer' | undefined>;
export function monitorFocusOrigin(target: any, checkDescendants: boolean = false, caller: Function = monitorFocusOrigin): Accessor<'program' | 'keyboard' | 'pointer' | undefined> {
    if (__IS_SERVER__) { return () => undefined; }
    isDev && _assertIsValidArgument(
        target,
        caller,
        caller === monitorFocusOrigin
    ) && _assertIsOptionalBoolean(
        checkDescendants,
        'monitorFocus(): Invalid second argument! Expected a boolean or nothing.'
    );

    let returnVal: any
    let element = target instanceof Element ? target : (returnVal = target()) instanceof Element ? returnVal : null;

    isDev && element && _assertIsValidArgument(element, caller, caller === monitorFocusOrigin);
    
    if (element) {
        const origin = _monitorFocus(element, checkDescendants);
        return () => origin();
    } else {
        isDev && !getOwner() && _assertIsValidArgument(element, caller, caller === monitorFocusOrigin)
        let onMountSignal: Signal<boolean> | null = createSignal(false);
        let origin: Accessor<'program' | 'keyboard' | 'pointer' | undefined> | null;
        
        onMount(() => {
            element = target() as Element;
            isDev && _assertIsValidArgument(element, caller, caller === monitorFocusOrigin);
            origin = _monitorFocus(element, checkDescendants);
            onMountSignal![1](true);
            onMountSignal = null;
        });

        return () => {
            if (onMountSignal) { onMountSignal[0](); }
            return origin ? origin() : undefined;
        }
    }
}

function _monitorFocus(element: Element, checkDescendants?: boolean): Accessor<'program' | 'keyboard' | 'pointer' | undefined> {
    const origin = checkDescendants ? _deepFocusOrigins.get(element) : _focusOrigins.get(element);

    if (origin) { return origin; }

    const [getOrigin, setOrigin] = createSignal<'program' | 'keyboard' | 'pointer' | undefined>(undefined);

    if (checkDescendants) {
        element.addEventListener(
            'focusin',
            () => (isDev && _logError(), hasFocusedElement(element) && _finalizeIfProgram() && setOrigin(_origin)),
            normalizePassiveListenerOptions({ passive: true })
        );
        element.addEventListener(
            'focusout',
            () => (isDev && _logError(), !hasFocusedElement(element) && setOrigin(undefined)),
            normalizePassiveListenerOptions({ passive: true })
        );
    } else {
        element.addEventListener(
            'focus',
            (e) => (isDev && _logError(), isFocused(e.target as Node) && _finalizeIfProgram() && setOrigin(_origin)),
            normalizePassiveListenerOptions({ passive: true })
        ); 
        element.addEventListener(
            'blur',
            (e) => (isDev && _logError(), !isFocused(e.target as Node) && setOrigin(undefined)),
            normalizePassiveListenerOptions({ passive: true })
        );
    }

    checkDescendants ? _deepFocusOrigins.set(element, getOrigin) : _focusOrigins.set(element, getOrigin);
  
    return getOrigin;
}

/**
 * Focuses the specified element while assigning a custom focus origin.
 *
 * Unlike calling `focus()` directly, this function temporarily associates
 * the focus operation with the provided origin so that `monitorFocus()`
 * reports it as `program`, `keyboard`, or `pointer`.
 *
 * If the target element is already focused, no action is performed and
 * `false` is returned.
 *
 * @param target The element to receive focus.
 * @param origin The origin that should be associated with the focus
 * operation. Must be one of:
 * - `program`
 * - `keyboard`
 * - `pointer`
 *
 * @returns `true` if the target element became focused, otherwise `false`.
 * @throws `Error` if it is used in a server environment.
 */
export function focusVia(target: Element, origin:  'program' | 'keyboard' | 'pointer'): boolean {
    if (__IS_SERVER__) {
        throw new Error('focusVia(): This function cannot be used in a server environment!');
    }
    if (isDev) {
        if (!(target instanceof Element)) {
            throw new Error('focusVia(): Invalid first argument! Expected an Element instance.');
        }
        if (!('focus' in target && typeof target.focus === 'function')) {
            throw new Error('focusVia(): Provided target does not implement the focus() method.');
        }
        if (!['program', 'keyboard', 'pointer'].includes(origin)) {
            throw new Error('focusVia(): Invalid second argument! Expected one of ["program", "keyboard", "pointer"].');
        }
    }

    if (isFocused(target)) { return false; }

    const prevOrigin = _origin;
    let isActive = false;

    _origin = origin;

    try {
        (target as any).focus();
    } finally {
        isActive = isFocused(target);
        if (isActive) {
            _origin = 'program';
            _cancelTask(_resetTask);
        } else {
            _origin = prevOrigin;
        }
    }

    return isActive;
}

/**
 * Creates a reactive accessor that indicates whether the specified element is
 * currently focused.
 *
 * Unlike `document.activeElement`, focus is resolved correctly across nested
 * Shadow DOM boundaries.
 *
 * @param element The element to observe.
 *
 * @returns A reactive accessor returning `true` when the specified element is
 * currently focused; otherwise `false`.
 */
export function observeIsFocused(element: Element): Accessor<boolean>;
/**
 * Creates a reactive accessor that indicates whether the specified element is
 * currently focused.
 *
 * Unlike `document.activeElement`, focus is resolved correctly across nested
 * Shadow DOM boundaries.
 *
 * The element is resolved lazily using the provided getter. If the getter does
 * not return an Element during initial execution, resolution is deferred until
 * the component is mounted using Solid's `onMount` lifecycle hook.
 *
 * @param elementGetter A function returning the element to observe.
 *
 * @returns A reactive accessor returning `true` when the specified element is
 * currently focused; otherwise `false`.
 */
export function observeIsFocused(elementGetter: () => Element): Accessor<boolean>;
/**
 * Creates a reactive accessor that indicates whether the specified element is
 * currently focused.
 *
 * Unlike `document.activeElement`, focus is resolved correctly across nested
 * Shadow DOM boundaries.
 *
 * The target can be provided either directly as an Element or as a getter
 * function. When a getter is provided and it does not return an Element during
 * initial execution, resolution is deferred until the component is mounted
 * using Solid's `onMount` lifecycle hook.
 *
 * @param target The element to observe or a function returning the element.
 *
 * @returns A reactive accessor returning `true` when the specified element is
 * currently focused; otherwise `false`.
 */
export function observeIsFocused(target: Element | (() => Element)): Accessor<boolean>;
export function observeIsFocused(target: Element | (() => Element)): Accessor<boolean> {
    if (__IS_SERVER__) { return () => false; }
    return _observeFocus(target, false, isFocused, observeIsFocused);
}

/**
 * Creates a reactive accessor that indicates whether the specified element
 * contains the currently focused element.
 *
 * The accessor also returns `true` when the specified element itself is
 * focused.
 *
 * Unlike `Node.contains(document.activeElement)`, focus is resolved correctly
 * across nested Shadow DOM boundaries.
 *
 * @param element The element to observe.
 *
 * @returns A reactive accessor returning `true` when the specified element
 * contains the currently focused element; otherwise `false`.
 */
export function observeHasFocusedElement(element: Element): Accessor<boolean>;
/**
 * Creates a reactive accessor that indicates whether the specified element
 * contains the currently focused element.
 *
 * The accessor also returns `true` when the specified element itself is
 * focused.
 *
 * Unlike `Node.contains(document.activeElement)`, focus is resolved correctly
 * across nested Shadow DOM boundaries.
 *
 * The element is resolved lazily using the provided getter. If the getter does
 * not return an Element during initial execution, resolution is deferred until
 * the component is mounted using Solid's `onMount` lifecycle hook.
 *
 * @param elementGetter A function returning the element to observe.
 *
 * @returns A reactive accessor returning `true` when the specified element
 * contains the currently focused element; otherwise `false`.
 */
export function observeHasFocusedElement(elementGetter: () => Element): Accessor<boolean>;
/**
 * Creates a reactive accessor that indicates whether the specified element
 * contains the currently focused element.
 *
 * The accessor also returns `true` when the specified element itself is
 * focused.
 *
 * Unlike `Node.contains(document.activeElement)`, focus is resolved correctly
 * across nested Shadow DOM boundaries.
 *
 * The target can be provided either directly as an Element or as a getter
 * function. When a getter is provided and it does not return an Element during
 * initial execution, resolution is deferred until the component is mounted
 * using Solid's `onMount` lifecycle hook.
 *
 * @param target The element to observe or a function returning the element.
 *
 * @returns A reactive accessor returning `true` when the specified element
 * contains the currently focused element; otherwise `false`.
 */
export function observeHasFocusedElement(target: Element | (() => Element)): Accessor<boolean>;
export function observeHasFocusedElement(target: Element | (() => Element)): Accessor<boolean> {
    if (__IS_SERVER__) { return () => false; }
    return _observeFocus(target, false, hasFocusedElement, observeHasFocusedElement);
}

function _observeFocus(target: Element | (() => Element), observeDescendants: boolean, predicate: (el: Element) => boolean, caller: Function): Accessor<boolean> {
    const origin = monitorFocusOrigin(target, observeDescendants, caller);
    let element: Element | null = null;
    return createMemo<boolean, boolean | undefined>((initialValue) => {
        const o = origin();
        if (element && initialValue === undefined) {
            return predicate(element);
        } else {
            if (element === null) {
                element = target instanceof Element ? target : target() || null;
            }
            return o !== undefined;
        }
    }, undefined);
}

function _isFocusable(target: Node): target is FocusableElement {
    return 'focus' in target && typeof target.focus === 'function';
}

function _isNativeFocusable(target: FocusableElement): target is FocusableElement & { disabled: boolean } {
    if (
        target instanceof HTMLButtonElement ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
    ) { return true; }

    return false;
}

function _isDisabled(target: FocusableElement): boolean {
    return _isNativeFocusable(target) ? target.disabled || target.matches(':disabled') : target instanceof HTMLOptionElement || target.ariaDisabled === 'true';
}

function _isInert(focusTrapHost: Node, target: Element | null): boolean {
    while(target instanceof HTMLElement) {
        if (target === focusTrapHost || target.inert) { return target.inert; }
        if (target.parentNode instanceof ShadowRoot) {
            target = target.parentNode.host;
        } else {
            target = target.parentElement;
        }
    }
    return false;
}

function _isPotentialTabbableOrHasShadow(node: Element): boolean {
    return (
        ('tabIndex' in node && typeof node.tabIndex === 'number' && node.tabIndex > -1) ||
        (node instanceof HTMLElement && (node.isContentEditable || node.shadowRoot !== null))
    );
}

function _createNodeIterator(target: Node): _CustomNodeIterator {
    return {
        nativeIterator: document.createNodeIterator(
            target,
            NodeFilter.SHOW_ELEMENT,
            (node) => {
                if (
                    node.isConnected &&
                    _isFocusable(node) &&
                    !_isInert(target, node) &&
                    !_isDisabled(node) &&
                    _isPotentialTabbableOrHasShadow(node)
                ) {
                    return NodeFilter.FILTER_ACCEPT;
                }
                return NodeFilter.FILTER_SKIP;
            }
        ),
        delegate: null,
        nextNode() {
            if (this.delegate) {
                const element = this.delegate.nextNode();
                if (element) {
                    return element;
                } else {
                    this.delegate = null;
                }
            }
            const element = this.nativeIterator.nextNode() as FocusableElement | null;
            if (element && element.shadowRoot) {
                this.delegate = _createNodeIterator(element.shadowRoot);
            } 
            return element;
        },
    }
}

/** @internal */
export function _eachPotentialTabbable(target: Node, fn: (item: _PotentialTabbable) => void): void {
    if((target instanceof HTMLElement && target.inert) || !target.isConnected) { return; }
    const it = _createNodeIterator(target);
    let element: FocusableElement | null = null;
    
    while (element = it.nextNode()) {
        if (element instanceof HTMLElement) {
            let potentialFocusable: _PotentialTabbable | null = null;

            if (element.isContentEditable) {
                potentialFocusable = { element, priority: Math.max(0, element.tabIndex) };
            } else if (element.tabIndex > -1) {
                potentialFocusable = { element, priority: element.tabIndex };
            }

            if (potentialFocusable) {
                fn(potentialFocusable);
            }
        } else if ('tabIndex' in element && typeof element.tabIndex === 'number' && element.tabIndex > -1) {
            fn({ element, priority: element.tabIndex });
        }
    }
}

function _containsFragileAttributes(attrNames: readonly string[] | null): boolean {
    return attrNames ? (
        attrNames.includes('disabled') ||
        attrNames.includes('contenteditable') ||
        attrNames.includes('tabindex') ||
        attrNames.includes('inert') ||
        attrNames.includes('aria-disabled')
    ) : false
}

/**
 * Traps keyboard focus within the specified element and its descendants.
 *
 * When the Tab key is pressed, focus is moved to the next tabbable element
 * within the trapped DOM branch. If the currently focused element is the last
 * tabbable element, focus wraps to the first one.
 *
 * Elements are traversed according to their tabindex order. Elements that
 * cannot receive focus when focus navigation is attempted are automatically
 * skipped.
 *
 * The trap automatically reacts to changes within the DOM branch and updates
 * its internal list of potential tabbable elements accordingly.
 *
 * Open shadow DOM is supported and is automatically discovered as part of the
 * DOM observation process. Shadow roots discovered after their host is added
 * to the DOM are incorporated into the focus trap asynchronously.
 *
 * Calling {@link disableShadowDomScanning} disables automatic Shadow DOM
 * discovery. As a result, tabbable elements inside undiscovered shadow roots
 * are not included in the focus trap.
 *
 * @param element The element that defines the boundary within which focus is
 * trapped.
 *
 * @see {@link disableShadowDomScanning}
 */
export function focusTrap(element: Element): void {
    if (__IS_SERVER__) {
        throw new Error('focusTrap(): This function cannot be used in a server environment!');
    }
    isDev && _assertIsInOwningContext(
        focusTrap
    ) && _assertIsElement(
        element,
        'focusTrap(): Invalid argument! Expected an Element instance.'
    )
    const disposalOwner = getOwner()!;
    const mutationRecordSource = observeBatchedMutations(element);
    const docMutationRecordSource = observeBatchedMutations(document)
    const hasFocusedElementSource = observeHasFocusedElement(element);
    const currentFocusedSource = createLazyMemo(disposalOwner, () => {
        if (hasFocusedElementSource()) {
            return getFocusedElement();
        } else {
            return null;
        }
    });

    const hasInertAncestorSource = createLazyMemo(disposalOwner, () => {
        const record = docMutationRecordSource();
        if (!record || !record.attributeChange) {
            return false;
        }
        
        let index = -1;
        let owner: Element;

        do {
            index = record.attributeNames!.indexOf('inert', index + 1);
            if (
                index > -1 &&
                (owner = record.attributeOwners![index]) instanceof HTMLElement &&
                owner.inert &&
                owner.contains(element)
            ) { return true; }
        } while (index > -1);

        return false;
    });
    const isConnectedSource = createLazyMemo(disposalOwner, () => {
        docMutationRecordSource();
        return element.isConnected;
    })
    
    let items: _PotentialTabbable[] | null = null;
    let focusedIndex = -1;
    let mutationRecord: CdkBatchedMutationRecord | null = null;
    let currentFocused: Element | null = null;
    let callback: ((item: _PotentialTabbable) => void) | null = null;

    createAsapEffect(() => {
        const newRecord = mutationRecordSource();
        const newFocusedEl = currentFocusedSource();

        if (hasInertAncestorSource() || !isConnectedSource()) {
            currentFocused = null;
            focusedIndex = -1;
            items = null;
            return;
        }

        if (
            !items ||
            (mutationRecord !== newRecord && (newRecord!.addedNodes || _containsFragileAttributes(newRecord!.attributeNames)))
        ) {
            mutationRecord = newRecord;
            items = [];
            _eachPotentialTabbable(element, (callback ??= (tabbable) => {
                if (items!.length) {
                    if (tabbable.priority <= items![items!.length - 1].priority){
                        if (isFocused(tabbable.element)) { 
                            focusedIndex = items!.length;
                            currentFocused = tabbable.element; 
                        }
                        items!.push(tabbable);
                        return;
                    }
                } else {
                    if (isFocused(tabbable.element)) {
                        currentFocused = tabbable.element;
                        focusedIndex = items!.length;
                    }
                    items!.push(tabbable);
                    return;
                }

                let low = 0;
                let high = items!.length;
        
                while (low < high) {
                    const mid = (low + high) >>> 1; // Math.floor((low + high) / 2) equivalent
        
                    if (tabbable.priority <= items![mid].priority) {
                        low = mid + 1;
                    } else {
                        high = mid;
                    }
                }
        
                items!.splice(low, 0, tabbable);

                if (isFocused(tabbable.element)) {
                    focusedIndex = low;
                    currentFocused = tabbable.element;
                } else if (low <= focusedIndex) {
                    focusedIndex++;
                }
            }));

            return;

        } else if (
            mutationRecord !== newRecord &&
            newRecord!.removedNodes &&
            !newRecord!.addedNodes &&
            !_containsFragileAttributes(newRecord!.attributeNames)
        ) {
            mutationRecord = newRecord!;
            for (const removed of mutationRecord.removedNodes!) {
                let index = -1;

                removed instanceof Element && (index = items.findIndex((tabbable) => tabbable.element === removed));

                if (index > -1) {
                    items.splice(index, 1);
                    if (focusedIndex === index) {
                        focusedIndex = -1;
                        currentFocused = null!
                    } else if (index < focusedIndex) {
                        focusedIndex--;
                    }
                }
                
            }
            return;
        }

        if (currentFocused !== newFocusedEl) {
            currentFocused = newFocusedEl;
            if (currentFocused === null) {
                focusedIndex = -1
            } else {
                focusedIndex = items.findIndex((tabbable) => tabbable.element === currentFocused);
            }
            return;
        }

    }, !element.isConnected);

    const remove = addDelegatedEventListener<KeyboardEvent>(element, 'keydown', (e) => {
        if (
            e.defaultPrevented ||
            e.key !== 'Tab' ||
            e.altKey ||
            e.ctrlKey ||
            e.metaKey ||
            !items ||
            !items.length
        ) { return; }

        let index = focusedIndex;
        
        while (true) {
            if (++index === items.length) {
                if (focusedIndex === -1) { return; }
                index = 0;
            }
            if (index === focusedIndex) { return; }
            const el = items[index].element;
            if (focusVia(el, 'keyboard')){
                focusedIndex = index;
                e.preventDefault();
                return;
            }
        }
    })
    
    onCleanup(remove);
}

/**
 * Captures keyboard focus on the specified element for the lifetime of the
 * current owning reactive context.
 *
 * If the element is connected to the document DOM, it is focused immediately.
 * If it is not yet connected, focusing is deferred until the element is
 * connected.
 *
 * The element that was focused before the capture is remembered. When the owning
 * context is disposed, focus is restored to that element if it is still available
 * and can receive focus.
 *
 * @param element The element to focus and keep as the active focus target.
 *
 * @throws If called in a server environment.
 * @throws If no owning reactive context is available.
 * @throws If the provided value is not an Element.
 * @throws If the element does not implement the `focus()` method.
 */
export function focusAutoCapture(element: Element): void {
    if (__IS_SERVER__) {
        throw new Error('focusAutoCapture(): This function cannot be used in a server environment!');
    }
    isDev && _assertIsInOwningContext(
        focusAutoCapture
    ) && _assertIsElement(
        element,
        'focusAutoCapture(): Invalid argument! Expected an Element instance.'
    ) && _assertIsElementWithFocus(
        element,
        'focusAutoCapture(): Provided element does not implement focus() method.'
    );

    let task: _Task | null = null;
    let prevFocusedRef: _ElementStackRef | null = null;

    if (element.isConnected) {
        const prevFocused = getFocusedElement() as FocusableElement | null;
        if (prevFocused) {
            prevFocusedRef = _pushElement(prevFocused);
        }
        (element as FocusableElement).focus();
        if (isDev && !isFocused(element)) {
            console.error('focusAutoCapture(): Failed to focus the provided element!');
        }
    } else {
        task = _createTaskObject(() => {
            task = null;
            if (!element.isConnected) {
                throw new Error('focusAutoCapture(): Provided element is not connected to the document DOM!');
            }
            const prevFocused = getFocusedElement() as FocusableElement | null;
            if (prevFocused) {
                prevFocusedRef = _pushElement(prevFocused);
            }
            (element as FocusableElement).focus();
            if (isDev && !isFocused(element)) {
                console.error('focusAutoCapture(): Failed to focus the provided element!');
            }
        });
        _scheduleAsapTask(task);
    }

    onCleanup(() => {
        task && _cancelTask(task);
        if (prevFocusedRef && prevFocusedRef === _focusStackTail) {
            _tryRestorePreviousFocus();
        }
    });
}
