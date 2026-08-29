/**
 * @license
 * Copyright (c) 2026 dags-solid-cdk contributors.
 * Licensed under the MIT License.
 */
import { isDev } from "solid-js/web";
import { _assertIsElement, _assertIsFiniteNumber, _assertIsInOwningContext, _assertIsNotNaN, _assertIsNumber, _assertIsOneOf, _assertIsOptionalString, _assertIsString, _assertIsTrue } from "../../internals/common-assertions";
import { createUniqueId, onCleanup, onMount } from "solid-js";

/** @internal */
export const _blacklistedElements = new Set([
    'HTML',
    'HEAD',
    'BODY',

    'SCRIPT',
    'STYLE',
    'LINK',
    'META',
    'BASE',
    'TITLE',

    'IFRAME',
    'FRAME',
    'FRAMESET',
    'OBJECT',
    'EMBED',

    'AUDIO',
    'VIDEO',
    'SOURCE',
    'TRACK',

    'IMG',
    'PICTURE',
    'CANVAS',

    'INPUT',
    'AREA',
])

/** @internal */
export const _elementsToUnwrap = new Set([
    'FORM',
    'BUTTON',
    'SELECT',
    'TEXTAREA',
    'OPTION',
    'OPTGROUP',
    'LABEL',
    'FIELDSET',
    'LEGEND',
    'DATALIST',
    'OUTPUT',
    'PROGRESS',
    'METER',

    'A',

    'DIALOG',
    'DETAILS',
    'SUMMARY',

    'TEMPLATE',
    'SLOT',
]);

const _DESC_EL = 0;
const _REF_COUNT = 1;

let _liveElement: HTMLDivElement | null = null;
let _descriptionsElement: HTMLElement | null = null;
let _announceTimeoutId: number | undefined = undefined;
let _descriptions: Map<string | Element, [Element, number]> | null = null;

function _createVisuallyHiddenElement(): HTMLDivElement {
    const element = document.createElement('div');
    
    element.style.position = 'absolute';
    element.style.width = '1px';
    element.style.height = '1px';
    element.style.padding = '0';
    element.style.margin = '-1px';
    element.style.overflow = 'hidden';
    element.style.clipPath = 'rect(0, 0, 0, 0)';
    element.style.whiteSpace = 'nowrap';
    element.style.border = '0';

    return element;
}

function _createLiveElement(): HTMLDivElement {
    const liveEl = _createVisuallyHiddenElement();
    liveEl.id = createUniqueId();
    liveEl.ariaAtomic = 'true';
    liveEl.ariaLive = 'polite';
    return document.body.appendChild(liveEl);
}

function _createDescriptionsElement(): HTMLDivElement {
    const containerEl = _createVisuallyHiddenElement();
    containerEl.style.visibility = 'hidden';
    return document.body.appendChild(containerEl);
}

function _clearAnnounce(): void {
    _liveElement!.replaceChildren();
    _liveElement!.ariaLive = 'off';
    _announceTimeoutId = undefined;
}

/** @internal */
export function _getInternals() {
    return {
        liveElement: _liveElement,
        descriptionsElement: _descriptionsElement,
        descriptions: _descriptions
    }
}

/** @internal */
export function _resetInternals(): void {
    _liveElement?.remove();
    _liveElement = null;
    _descriptionsElement?.remove();
    _descriptionsElement = null;
    _descriptions = null;
    if (_announceTimeoutId !== undefined) {
        clearTimeout(_announceTimeoutId);
        _announceTimeoutId = undefined;
    }
}

/** @internal */
export function _cloneSanitized(node: Node): DocumentFragment | HTMLElement | Text | null {
    if (node instanceof Text) {
        return document.createTextNode(node.data);
    }

    let clone: DocumentFragment | HTMLElement | Text | null = null;

    if (node instanceof DocumentFragment) {
        clone = document.createDocumentFragment();
    } else if (node instanceof HTMLElement && !_blacklistedElements.has(node.tagName)) {
        clone = _elementsToUnwrap.has(node.tagName) ?
            document.createDocumentFragment() : document.createElement(node.localName);
    }

    if (clone) {
        for (const child of node.childNodes) {
            const childClone = _cloneSanitized(child);
            if (childClone) { clone.appendChild(childClone); }
        }
    }

    return clone;
}

/** @internal */
export function _sanitize(target: string | HTMLElement | DocumentFragment): HTMLElement | DocumentFragment | Text | null {
    if (typeof target === 'string') {
        if (!target.trim()) { return null; }
        const template = document.createElement('template');
        template.innerHTML = target;
        target = template.content;
    }
    return _cloneSanitized(target);
}

function _getDescriptionKey(message: Element | string, role: string | null | undefined): Element | string {
    return typeof message === 'string' ? `${role ? role + '/' : ''}${message}` : message;
}

/**
 * Announces a message to assistive technologies using a live region.
 *
 * The message may be provided as plain text or as an HTMLElement. When an
 * HTMLElement is provided, supported semantic markup is preserved while
 * unsafe elements and attributes are removed.
 *
 * @param message The message to announce.
 * @param politeness The politeness level of the live region.
 */
export function liveAnnounce(message: string | HTMLElement): void;
/**
 * Announces a message to assistive technologies using a live region.
 *
 * The message may be provided as plain text or as an HTMLElement. When an
 * HTMLElement is provided, supported semantic markup is preserved while
 * unsafe elements and attributes are removed.
 *
 * The `duration` specifies, in milliseconds, how long the message
 * remains in the live region. A duration of `0` leaves the message in the
 * live region indefinitely.
 *
 * @param message The message to announce.
 * @param duration The duration of the announcement in milliseconds.
 */
export function liveAnnounce(message: string | HTMLElement, duration: number): void;
/**
 * Announces a message to assistive technologies using a live region.
 *
 * The message may be provided as plain text or as an HTMLElement. When an
 * HTMLElement is provided, supported semantic markup is preserved while
 * unsafe elements and attributes are removed.
 *
 * The `politeness` controls how the screen reader should announce
 * the message. It defaults to `polite`.
 *
 * @param message The message to announce.
 * @param politeness The politeness level of the live region.
 */
export function liveAnnounce(message: string | HTMLElement, politeness: 'off' | 'polite' | 'assertive'): void;
/**
 * Announces a message to assistive technologies using a live region.
 *
 * The message may be provided as plain text or as an HTMLElement. When an
 * HTMLElement is provided, supported semantic markup is preserved while
 * unsafe elements and attributes are removed.
 *
 * The optional `duration` specifies, in milliseconds, how long the message
 * remains in the live region. A duration of `0` leaves the message in the
 * live region indefinitely.
 *
 * The optional `politeness` controls how the screen reader should announce
 * the message. It defaults to `polite`.
 *
 * @param message The message to announce.
 * @param duration The duration of the announcement in milliseconds.
 * @param politeness The politeness level of the live region.
 */
export function liveAnnounce(message: string | HTMLElement, politeness: 'off' | 'polite' | 'assertive', duration: number): void;
export function liveAnnounce(message: string | HTMLElement, ...args: any[]): void {
    if (__IS_SERVER__) {
        throw new Error('liveAnnounce(): This function cannot be used in a server environment!')
    }
    if (isDev) {
        _assertIsTrue(
            typeof message === 'string' || message instanceof HTMLElement,
            `liveAnnounce(): Invalid${args.length ? ' first ' : ' '}argument! Expected a string or an HTMLElement instance.`
        );
        if (args.length === 1) {
            if (typeof args[0] === 'number') {
                _assertIsNotNaN(
                    args[0],
                    'liveAnnounce(): Invalid second argument! NaN is not supported.'
                );
                _assertIsFiniteNumber(
                    args[0],
                    'liveAnnounce(): Invalid second argument! Infinite numbers are not supported.'
                );
            } else {
                _assertIsOneOf(
                    args[0],
                    ['off', 'polite', 'assertive'],
                    'liveAnnounce(): Invalid second argument! Expected one of [ "off", "polite", "assertive" ] or a number.'
                );
            }
        } else if (args.length > 1) {
            _assertIsOneOf(
                args[0],
                ['off', 'polite', 'assertive'],
                'liveAnnounce(): Invalid second argument! Expected one of [ "off", "polite", "assertive" ].'
            );
            _assertIsNumber(
                args[1],
                'liveAnnounce(): Invalid third argument! Expected a number.'
            );
            _assertIsNotNaN(
                args[1],
                'liveAnnounce(): Invalid third argument! NaN is not supported.'
            );
            _assertIsFiniteNumber(
                args[1],
                'liveAnnounce(): Invalid third argument! Infinite numbers are not supported.'
            );
        }
    }
    let duration = 0;
    let politeness = 'polite';

    if (args.length === 1) {
        typeof args[0] === 'number' ? duration = Math.max(Math.trunc(args[0]), 0) : politeness = args[0];
    } else if (args.length > 1) {
        politeness = args[0];
        duration =  Math.max(Math.trunc(args[1]), 0);
    }
    
    if (_liveElement) {
        _liveElement.replaceChildren();
        _liveElement.ariaLive = 'off';

    } else {
        _liveElement ??= _createLiveElement();
    }

    if (_announceTimeoutId !== undefined) {
        clearTimeout(_announceTimeoutId);
    }

    const sanitized = _sanitize(message);

    if (!sanitized || (sanitized instanceof DocumentFragment && !sanitized.hasChildNodes())) {
        return;
    }

    _announceTimeoutId = setTimeout(() => {
        _liveElement!.replaceChildren(sanitized);
        _liveElement!.ariaLive = politeness;
        if (duration) {
            _announceTimeoutId = setTimeout(_clearAnnounce, duration);
        } else {
            _announceTimeoutId = undefined;
        }
    }, 100);
}

/**
 * Returns the ID of the live announcer element.
 *
 * When using `aria-modal="true"` on a modal container, some browser and
 * screen reader combinations may not expose a live announcer located outside
 * the modal to the accessibility tree. In such cases, add the returned ID to
 * the modal's `aria-owns` attribute.
 *
 * @returns The ID of the live announcer element.
 */
export function getLiveAnnouncerId(): string {
    _liveElement ??= _createLiveElement();
    return _liveElement.id;
}

const _TARGET_ERROR_MESSAGE = 'ariaDescribe(): Invalid first argument! It must be a function returning a DOM Element or a DOM Element instance (e.g. HTMLElement, SVGElement, etc.).';

/**
 * Associates an accessible description with an element.
 *
 * When `message` is provided as an HTML string, its attributes are
 * sanitized and are not preserved. If a custom `role` is required,
 * it must be provided as the third argument.
 *
 * When `message` is provided as an `HTMLElement`, its `role` attribute
 * is preserved during sanitization.
 *
 * @param target The element to associate the description with.
 * @param message The description as an HTML string or an `HTMLElement`.
 * @param role The ARIA role to assign to a description created from an HTML string.
 */
export function ariaDescribe(target: Element, message: string, role?: string): void;
 /**
 * Associates an accessible description with an element.
 *
 * When `message` is provided as an HTML string, its attributes are
 * sanitized and are not preserved. If a custom `role` is required,
 * it must be provided as the third argument.
 *
 * When `message` is provided as an `HTMLElement`, its `role` attribute
 * is preserved during sanitization.
 *
 * `targetGetter` function is evaluated after the component is mounted. 
 * If the target element is not available immediately, the description
 * is associated with the target when it becomes available through
 * the `onMount()` hook.
 * 
 * @param targetGetter A function returning the element to associate the description with.
 * @param message The description as an HTML string.
 * @param role The ARIA role to assign to a description created from an HTML string.
 */
export function ariaDescribe(targetGetter: () => Element, message: string, role?: string): void;
/**
 * Associates an accessible description with an element.
 *
 * When `message` is provided as an HTML string, its attributes are
 * sanitized and are not preserved. If a custom `role` is required,
 * it must be provided as the third argument.
 *
 * When `message` is provided as an `HTMLElement`, its `role` attribute
 * is preserved during sanitization.
 * 
 * @param target The element to associate the description with.
 * @param message The description element. Its `role` attribute is preserved.
 */
export function ariaDescribe(target: Element, message: HTMLElement): void;
/**
 * Associates an accessible description with an element.
 *
 * When `message` is provided as an HTML string, its attributes are
 * sanitized and are not preserved. If a custom `role` is required,
 * it must be provided as the third argument.
 *
 * When `message` is provided as an `HTMLElement`, its `role` attribute
 * is preserved during sanitization.
 *
 * `targetGetter` function is evaluated after the component is mounted. 
 * If the target element is not available immediately, the description
 * is associated with the target when it becomes available through
 * the `onMount()` hook.
 * 
 * @param targetGetter A function returning the element to associate the description with.
 * @param message The description element. Its `role` attribute is preserved.
 */
export function ariaDescribe(targetGetter: () => Element, message: HTMLElement): void;
export function ariaDescribe(target: Element | (() => any), message: HTMLElement | string, role?: string): void {
    if (__IS_SERVER__) { return; }
    if (isDev) {
        _assertIsInOwningContext(ariaDescribe);
        _assertIsTrue(target instanceof Element || typeof target === 'function', _TARGET_ERROR_MESSAGE);
        if (arguments.length > 2) {
            _assertIsString(
                message,
                'ariaDescribe(): Invalid second argument! Expected a string.'
            );
            _assertIsOptionalString(
                role,
                'ariaDescribe(): Invalid third argument! Expected a string or nothing.'
            );
        } else {
            _assertIsTrue(
                message instanceof HTMLElement || typeof message === 'string',
                'ariaDescribe(): Invalid second argument! Expected an HTMLElement instance or string.'
            );
        }
    }

    let localTarget: Element | null = null;

    if (target instanceof Element) {
        localTarget = target;
    } else {
        const value = target!();
        if (value instanceof Element) {
            localTarget = value;
        }
    }

    if (localTarget) {
        _ariaDescribe(localTarget, message, message instanceof HTMLElement ? message.role : role);
    } else {
        onMount(() => {
            const localTarget = (target as () => Element)();
            isDev && _assertIsElement(localTarget, _TARGET_ERROR_MESSAGE);
            _ariaDescribe(localTarget, message,  message instanceof HTMLElement ? message.role : role);
        });
    }
}

function _ariaDescribe(target: Element, message: HTMLElement | string, role: string | null | undefined): void {
    _descriptionsElement ??= _createDescriptionsElement();
    _descriptions ??= new Map();
    const key = _getDescriptionKey(message, role);
    let description = _descriptions.get(key);

    if (!description) {
        const sanitized = _sanitize(message);
        if (!sanitized || sanitized instanceof DocumentFragment && !sanitized.hasChildNodes()) { return; }
        if (sanitized instanceof Element) {
            description = [_descriptionsElement.appendChild(sanitized), 0];
        } else if (
            sanitized instanceof DocumentFragment &&
            sanitized.childNodes.length === 1 &&
            sanitized.firstChild instanceof HTMLElement
        ) {
            description = [_descriptionsElement.appendChild(sanitized.firstChild), 0];
        } else {
            const descEl = _descriptionsElement.appendChild(document.createElement('div'));
            descEl.appendChild(sanitized);
            description = [descEl , 0];
        }
        description[_DESC_EL].id = createUniqueId();
        description[_DESC_EL].role = role == null ? null : role;
        _descriptions.set(key, description);
    }

    const attrValue = target.getAttribute('aria-describedby');
    if (attrValue) {
        const ids = attrValue.split(/\s+/);
        if (ids.includes(description[_DESC_EL].id)) {
            return;
        }
        ids.push(description[_DESC_EL].id);
        target.setAttribute('aria-describedby', ids.join(' '));
    } else {
        target.setAttribute('aria-describedby', description[_DESC_EL].id);
    }

    description[_REF_COUNT]++;

    onCleanup(() => {
        const id = description[_DESC_EL].id;
        const ids = target.getAttribute('aria-describedby')!.split(/\s+/);
        const index = ids.indexOf(id);
        ids.splice(index, 1);

        if (ids.length) {
            target.setAttribute('aria-describedby', ids.join(' '));
        } else {
            target.removeAttribute('aria-describedby');
        }
        
        const refCount = --description[_REF_COUNT];
        if (refCount) { return; }
        description[_DESC_EL].remove();
        _descriptions!.delete(key);
        if (_descriptions!.size) { return; }
        _descriptionsElement!.remove();
        _descriptionsElement = null;
        _descriptions = null;
    });
}