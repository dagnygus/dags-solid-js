/**
 * @license MIT
 * Copyright (c) 2026 dags-solid-cdk contributors
 *
 * Internal implementation details.
 * Not part of the public API.
 */

import { Accessor, createComputed, createMemo, createSignal, getOwner, onCleanup, onMount, Setter } from "solid-js";
import { isDev } from "solid-js/web";
import { _cancelTask, _createTaskObject, _scheduleAsapTask, _scheduleConcurrentTask, _Task } from "../internals/schedulers";

/**
 * Configuration options for {@link observeResizing}.
 * 
 * @see {@link observeResizing}
 */
export interface ObserveElementResizingOptions extends ResizeObserverOptions {

    /**
     * Element to observe.
     *
     * The target may be provided directly or lazily using a getter. If the
     * getter does not return an element immediately, the library retries after
     * the owning component has been mounted.
     *
     * An error is thrown if no element is available after mounting.
     */
    target: Element | (() => Element | null | undefined);

    /**
     * Controls whether the target is currently being observed.
     *
     * When omitted, the target is observed continuously.
     *
     * @default () => true
     */
    observe?: Accessor<boolean>;
}

/**
 * Describes a mutation observed by the CDK mutation observation system.
 *
 * This interface is modeled after the native {@link MutationRecord} interface
 * and additionally supports the `shadowDiscover` mutation type, which is
 * emitted when a Shadow DOM subtree is discovered by the observation system.
 */
export interface CdkMutationRecord {
    /**
     * Nodes that were added as a result of the mutation.
     *
     * This collection is populated for `childList` mutations and may also be
     * populated for `shadowDiscover` mutations with shadow root.
     */
    readonly addedNodes: ArrayLike<Node> & Iterable<Node>;

    /**
     * The local name of the attribute that was modified.
     *
     * This value is `null` for mutations that do not involve an attribute.
     */
    readonly attributeName: string | null;

    /**
     * The namespace URI of the attribute that was modified.
     *
     * This value is `null` when the attribute does not belong to a namespace
     * or when the mutation does not involve an attribute.
     */
    readonly attributeNamespace: string | null;

    /**
     * The node immediately following the added or removed nodes.
     *
     * This value is `null` when there is no following sibling or when the
     * mutation type does not involve sibling relationships.
     */
    readonly nextSibling: Node | null;

    /**
     * The value of the attribute or character data before the mutation.
     *
     * This value is `null` when the mutation type does not provide a previous
     * value or when no previous value is available.
     */
    readonly oldValue: string | null;

    /**
     * The node immediately preceding the added or removed nodes.
     *
     * This value is `null` when there is no preceding sibling or when the
     * mutation type does not involve sibling relationships.
     */
    readonly previousSibling: Node | null;

    /**
     * Nodes that were removed as a result of the mutation.
     *
     * This collection is populated for `childList` mutations.
     */
    readonly removedNodes: ArrayLike<Node> & Iterable<Node>;

    /**
     * The node on which the mutation occurred.
     */
    readonly target: Node;

    /**
     * The type of mutation.
     *
     * - `attributes` — an attribute was added, removed, or modified.
     * - `characterData` — the character data of a node was modified.
     * - `childList` — child nodes were added or removed.
     * - `shadowDiscover` — a Shadow DOM subtree was discovered by the CDK
     *   mutation observation system.
     */
    readonly type: 'attributes' | 'characterData' | 'childList' | 'shadowDiscover';
}

/**
 * Represents a batched summary of one or more DOM mutations.
 *
 * Unlike a native `MutationRecord`, this object aggregates all mutations
 * observed within a single batch into a consolidated result.
 *
 * Collection properties contain unique values gathered from all observed
 * mutations in the batch. A property is `null` when no corresponding changes
 * occurred.
 * 
 * @see {@link observeBatchedMutations}
 */
export interface CdkBatchedMutationRecord {
    /**
     * Nodes that were added during the batch.
     *
     * `null` if no nodes were added.
     */
    readonly addedNodes: readonly Node[] | null;

    /**
     * Names of attributes that changed during the batch.
     *
     * `null` if no attribute changes occurred.
     */
    readonly attributeNames: readonly string[] | null;

    /**
     * Namespaces of attributes that changed during the batch.
     *
     * `null` if no namespaced attribute changes occurred.
     */
    readonly attributeNamespaces: readonly string[] | null;

    /**
     * Nodes whose attributes were changed during the batch.
     *
     * `null` if no attribute changes occurred.
     */
    readonly attributeOwners: readonly Element[] | null;

    /**
     * Nodes that were removed during the batch.
     *
     * `null` if no nodes were removed.
     */
    readonly removedNodes: readonly Node[] | null;

    /**
     * Nodes affected by the observed mutations.
     *
     */
    readonly targets: readonly Node[];

    /**
     * Whether at least one attribute mutation occurred.
     */
    readonly attributeChange: boolean;

    /**
     * Whether at least one character data mutation occurred.
     */
    readonly characterDataChange: boolean;

    /**
     * Whether at least one child list mutation occurred.
     */
    readonly childListChange: boolean;
}

export interface _BatchedMutationRecord {
    addedNodes:  Node[] | null;
    attributeNames:  string[] | null;
    attributeNamespaces:  string[] | null;
    attributeOwners: Element[] | null;
    removedNodes:  Node[] | null;
    targets:  Node[];
    attributeChange: boolean;
    characterDataChange: boolean;
    childListChange: boolean;
    shadowDiscover: boolean;
}

interface _CustomNodeIterator {
    nativeIterator: TreeWalker | NodeIterator
    delegate: _CustomNodeIterator | null;
    nextNode(): Element | null;
}

interface _SetterRef<T> {
    setter: Setter<T>;
    next: _SetterRef<T> | null;
    prev: _SetterRef<T> | null;
    linked: boolean;
}

interface _SetterList<T> {
    head: _SetterRef<T> | null;
    tail: _SetterRef<T> | null;
}

type _SettersRef<T> = [_SetterList<readonly T[] | null>, T[] | null]

interface _MutationTask {
    task: _Task;
    next: _MutationTask | null;
    prev: _MutationTask | null;
}

let _mutableElementSetters: Map<Element, _SettersRef<CdkMutationRecord>> | null = null;
let _mutableShadowHosts: Map<Element, MutationObserver> | null = null;
let _mutationObserver: MutationObserver | null = null;
let _mutableObserverOptions: MutationObserverInit | null = null!;
let _mutationTaskHead: _MutationTask | null = null;
let _mutationTaskTail: _MutationTask | null = null;
let _emitMutationRecordsTask: _Task | null = null;
let _shadowDiscoverRecords: CdkMutationRecord[] | null = null;
let _shadowDiscoverTask: _Task | null = null;
let _dispatchingMutations = false;
let _startTime = 0;

let _resizableElements: WeakMap<Node, [_SetterList<ResizeObserverEntry | null>, number]> = null!;
let _resizeObserver: ResizeObserver | null = null;

/** @internal */
export function _getPrivates() {
    return {
        mutableElementSetters: _mutableElementSetters,
        mutableShadowHosts: _mutableShadowHosts,
        mutationObserver: _mutationObserver,
        mutationObserverOptions: _mutableObserverOptions,
        mutationTaskHead: _mutationTaskHead,
        mutationTaskTail: _mutationTaskTail,
        emitMutationRecordsTask: _emitMutationRecordsTask,
        shadowDiscoverRecords: _shadowDiscoverRecords,
        shadowDiscoverTask: _shadowDiscoverTask,
        resizableElements: _resizableElements,
        resizeObserver: _resizeObserver 
    }
}

function _assertValidObservationTarget(target: any, includeDoc: boolean, deep: boolean, caller: Function): true {
    if (includeDoc && target instanceof Document) { return true }
    if (
        target instanceof Element ||
        typeof target === 'function' ||
        (
            deep && typeof target === 'object' &&
            target !== null &&
            'target' in target &&
            _assertValidObservationTarget(target.target, includeDoc, false, caller)
        )
    ) { return true; }

    let message: string = `${caller.name}(): Invalid argument. It must be a function returning a DOM Element or a DOM Element instance (e.g. HTMLElement, SVGElement, etc.).`

    if (includeDoc) {
        message = message + ' It can be also a directly provided Document instance.';
    }

    throw new Error(message);
}

 function _assertIsInOwningContext(caller: Function): true {
    if (getOwner()) { return true; }
    throw new Error(`${caller.name}(): An owning context is required!`);
}

function _pushSetter<T>(list: _SetterList<T>, setterRef: Setter<T> | _SetterRef<T>): _SetterRef<T> {
    if (setterRef instanceof Function) {
        setterRef = { setter: setterRef, next: null, prev: list.tail, linked: true };
    } else {
        if (setterRef.linked) { return setterRef; }
        setterRef.prev = list.tail;
        setterRef.linked = true
    }

    if (list.tail) {
        list.tail.next = setterRef;
    } else {
        list.head = setterRef;
    }

    list.tail = setterRef;

    return setterRef;
}

function _unlinkSetter<T>(list: _SetterList<T>, setterRef: _SetterRef<T>): void {
    if (setterRef.linked) {
        const { next, prev } = setterRef;
        
        if (prev) {
            prev.next = next
        } else {
            list.head = next
        }
    
        if (next) {
            next.prev = prev;
        } else {
            list.tail = prev;
        }
    
        setterRef.next = null;
        setterRef.prev = null;
        setterRef.linked = false
    }
}

function _pushMutationTask(task: _Task): _MutationTask {
    const mutationTask: _MutationTask = {
        task,
        next: null,
        prev: _mutationTaskTail
    };

    if (_mutationTaskTail) {
        _mutationTaskTail.next = mutationTask;
    } else {
        _mutationTaskHead = mutationTask;
    }

    _mutationTaskTail = mutationTask;

    return mutationTask;
}

function _unlinkMutationTask(mutationTask: _MutationTask): void {
    const { prev, next } = mutationTask;

    if (prev) {
        prev.next = next;
    } else {
        _mutationTaskHead = next;
    }

    if (next) {
        next.prev = prev;
    } else {
        _mutationTaskTail = prev;
    }

    mutationTask.prev = null;
    mutationTask.next = null;
}

function _freezeRecord(record: _BatchedMutationRecord): CdkBatchedMutationRecord {
    Object.freeze(record);
    record.addedNodes && Object.freeze(record.addedNodes);
    record.attributeNames && Object.freeze(record.attributeNames);
    record.attributeNamespaces && Object.freeze(record.attributeNamespaces);
    record.attributeOwners && Object.freeze(record.attributeOwners)
    record.removedNodes && Object.freeze(record.removedNodes);
    record.targets && Object.freeze(record.targets);
    return record;
}

function _createShadowRecord(element: Element): CdkMutationRecord {
    return Object.freeze({
        addedNodes: Object.freeze([element.shadowRoot!]),
        attributeName: null,
        attributeNamespace: null,
        nextSibling: null,
        oldValue: null,
        previousSibling: null,
        removedNodes: Object.freeze([]),
        target: element,
        type: 'shadowDiscover'
    } as CdkMutationRecord)
}

function _createNodeIterator(target: Document | Element | ShadowRoot): _CustomNodeIterator {
    return {
        nativeIterator: document.createNodeIterator(
            target,
            NodeFilter.SHOW_ELEMENT,
            (node) => node instanceof HTMLElement && node.shadowRoot ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
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
            const element = this.nativeIterator.nextNode() as Element | null;
            if (element) {
                this.delegate = _createNodeIterator(element.shadowRoot!);
            }
            return element;
        },
    }
}

function _aggregateShadows(target: Document | Element): void {
    const it = _createNodeIterator(target);
    const startTime = _dispatchingMutations ? _startTime : performance.now();
    const timeBudget = _dispatchingMutations ? 12 : 4;

    let element: Element | null;

    while ((element = it.nextNode()) && performance.now() - startTime < timeBudget) {
        if (_mutableShadowHosts?.has(element) || !element!.isConnected) {
            continue;
        }
        const shadowObserver = new MutationObserver(_dispatchMutationRecords);

        (_mutableShadowHosts ??= new Map()).set(element, shadowObserver);
        shadowObserver.observe(element.shadowRoot!, _mutableObserverOptions!);
        _shadowDiscoverRecords!.push(_createShadowRecord(element));
        
        if (_dispatchingMutations) { continue; }
        _scheduleAsapTask(_shadowDiscoverTask!);
    }

    if (element) {
        const task = _createTaskObject(() => {
            const startTime = performance.now();
            do {
                if (_mutableShadowHosts?.has(element!) || !element!.isConnected) {
                continue;
                }

                const shadowObserver = new MutationObserver(_dispatchMutationRecords);

                (_mutableShadowHosts ??= new Map()).set(element!, shadowObserver);
                shadowObserver.observe(element!.shadowRoot!, _mutableObserverOptions!);
                _shadowDiscoverRecords!.push(_createShadowRecord(element!));
                
                if (_dispatchingMutations) { continue; }
                _scheduleAsapTask(_shadowDiscoverTask!);

            } while ((element = it.nextNode()) && performance.now() - startTime < 4);

            if (element) { 
                _scheduleConcurrentTask(task);
            } else {
                _unlinkMutationTask(mutationTask);
            }
        });
        const mutationTask = _pushMutationTask(task);
        _scheduleConcurrentTask(task);
    }
}

function _scanForShadows(list: ArrayLike<Node> & Iterable<Node>): void {
    const startTime = performance.now();
    const length = list.length;

    let i = 0;

    while (i < length && performance.now() - startTime < 12) {
        let node = list[i];
        if (node instanceof Element) {
            _aggregateShadows(node);
        }
        i++;
    }

    if (i < length) {
        const task = _createTaskObject(() => {
            const startTime = performance.now();

            while (i < length && performance.now() - startTime < 4) {
                let node = list[i];
                if (node instanceof Element) {
                    _aggregateShadows(node);
                }
                i++;
            }

            if (i < length) {
                _scheduleConcurrentTask(task);
            } else {
                _unlinkMutationTask(mutationTask);
            }
        });
        const mutationTask = _pushMutationTask(task);
        _scheduleConcurrentTask(task);
    }
}

function _removeShadow(node: Node): void {
    const entries = _mutableShadowHosts!.entries();
    const startTime = _dispatchingMutations ? _startTime : performance.now();
    const timeBudget = _dispatchingMutations ? 12 : 4;

    let entry: [Element, MutationObserver] | null;

    while ((entry = entries.next().value || null) && performance.now() - startTime < timeBudget) {
        const el = entry[0];
        if (node.contains(el)) {
            _mutableShadowHosts!.get(el)!.disconnect();
            _mutableShadowHosts!.delete(el);
        }
    }

    if (entry) {
        const task = _createTaskObject(() => {
            if (!_mutableShadowHosts) {
                return;
            }
            const startTime = performance.now();

            do {
                const el = entry![0];
                if (node.contains(el)) {
                    entry![1].disconnect();
                    _mutableShadowHosts.delete(el);
                }
            } while ((entry = entries.next().value || null) && performance.now() - startTime < 4);

            if (entry) {
                _scheduleConcurrentTask(task);
                return;
            } else {
                _unlinkMutationTask(mutationTask);
            }

            if (_mutableShadowHosts!.size) { return; }
            _mutableShadowHosts = null;
        })
        const mutationTask = _pushMutationTask(task);
        _scheduleConcurrentTask(task);
        return;
    }

    if (_mutableShadowHosts!.size) { return; }
    _mutableShadowHosts = null;
}

function _removeSetters(node: Node): void {
    const entries = _mutableElementSetters!.entries();
    const startTime = _dispatchingMutations ? _startTime : performance.now();
    const timeBudget = _dispatchingMutations ? 12 : 4;

    let entry: [Element, _SettersRef<CdkMutationRecord> ]| null

    while ((entry = entries.next().value || null) && performance.now() - startTime < timeBudget) {
        const el = entry[0];
        if (node.contains(el)) {
            _mutableElementSetters!.delete(el);
        }
    }

    if (entry) {
        const task = _createTaskObject(() => {
            const startTime = performance.now();

            do {
                const el = entry![0];
                if (node.contains(el)) {
                    _mutableElementSetters!.delete(el);
                }
            } while ((entry = entries.next().value || null) && performance.now() - startTime < 4);

            if (entry) {
                _scheduleConcurrentTask(task);
                return;
            } else {
                _unlinkMutationTask(mutationTask);
            }

            if(_mutableElementSetters!.size) { return; }
            _finalizeMutationObserver();
        });
        const mutationTask = _pushMutationTask(task);
        _scheduleConcurrentTask(task)
        return;
    }

    if(_mutableElementSetters!.size) { return; }
    _finalizeMutationObserver();
}

function _scanForRemove(list: ArrayLike<Node> & Iterable<Node>): void {
    if (!_mutableElementSetters) {
        return;
    }
    const startTime = performance.now();
    const length = list.length

    let i = 0;

    while (i < length && performance.now() - startTime < 12) {
        const node = list[i]
        _mutableShadowHosts && _removeShadow(node);
        _removeSetters(node)
        i++;
    }

    if (i < length) {
        const task = _createTaskObject(() => {
            if (!_mutableElementSetters) {
                return;
            }
            const startTime = performance.now();

            while (i < length && performance.now() - startTime < 4) {
                const node = list[i]
                _mutableShadowHosts && _removeShadow(node);
                _removeSetters(node)
                i++;
            }
            if (i < length) {
                _scheduleConcurrentTask(task);
            } else {
                _unlinkMutationTask(mutationTask);
            }
        })
        const mutationTask = _pushMutationTask(task);
        _scheduleConcurrentTask(task);
    }
}


function _dispatchMutationRecords(records: CdkMutationRecord[]) {
    if (!_mutableElementSetters) { return; }

    _dispatchingMutations = true;
    _startTime = performance.now();

     for (const record of records) {
        if (record.type !== 'shadowDiscover') {
            if (record.addedNodes.length) {
                _scanForShadows(record.addedNodes);
            }
    
            if (record.removedNodes.length) {
                _scanForRemove(record.removedNodes);
            }
        }

        if (!_mutableElementSetters) { return; }

        let node: Node | null = record.target;
        
        while(node) {
            const settersRef = _mutableElementSetters.get(node as any);
            
            if (settersRef) {
                (settersRef[1] ??= []).push(record);
                _scheduleAsapTask(_emitMutationRecordsTask!);
            }

            if (node.parentNode instanceof ShadowRoot) {
                node = node.parentNode.host;
            } else {
                node = node.parentElement as Element | null;
            }
        }

    }

    _dispatchingMutations = false;

    if (_shadowDiscoverRecords!.length) {
        const records = _shadowDiscoverRecords!;
        _shadowDiscoverRecords = [];
        _cancelTask(_shadowDiscoverTask!);
        _dispatchMutationRecords(records);
    } 
}

function _initializeMutationObserver(): void {
    if (_mutationObserver) { return; }
    _mutableElementSetters = new Map();
    _mutationObserver = new MutationObserver(_dispatchMutationRecords);
    _emitMutationRecordsTask = _createTaskObject(() => {
        if (!_mutableElementSetters) { return; }
        for (const [_, settersRef] of _mutableElementSetters) {
            const setterList = settersRef[0];
            const records = settersRef[1];
            if (records) {
                for (let setterRef = setterList.head; setterRef; setterRef = setterRef.next) {
                    setterRef.setter(Object.freeze(records));
                }
                settersRef[1] = null;
            }
        }
    });
    _shadowDiscoverRecords = [];
    _shadowDiscoverTask = _createTaskObject(() => {
        const records = _shadowDiscoverRecords!;
        _shadowDiscoverRecords = [];
        _dispatchMutationRecords(records);
    });
    _mutationObserver.observe(document, _mutableObserverOptions ??= { attributes: true, childList: true, subtree: true, characterData: true });
    _aggregateShadows(document);
}

function _finalizeMutationObserver(): void {
    _mutationObserver!.disconnect();
    _mutationObserver = null;
    _mutableObserverOptions = null;
    _mutableElementSetters = null;
    _shadowDiscoverRecords = null;
    _cancelTask(_emitMutationRecordsTask!);
    _emitMutationRecordsTask = null;
    _cancelTask(_shadowDiscoverTask!);
    _shadowDiscoverTask = null;

    for (let mutationTask = _mutationTaskHead; mutationTask; mutationTask = mutationTask.next) {
        _cancelTask(mutationTask.task);
    }

    _mutationTaskHead = null;
    _mutationTaskTail = null;

    if (_mutableShadowHosts) {
        for (const [_, shadowObserver] of _mutableShadowHosts) {
            shadowObserver.disconnect();
        }
        _mutableShadowHosts = null;
    }
}

/**
 * Creates a reactive accessor that observes mutations affecting the provided
 * element and its descendants.
 *
 * Mutations are observed within the element's subtree, including changes to
 * attributes, character data, child nodes, and supported open shadow DOM.
 *
 * Shadow roots are discovered asynchronously. To avoid blocking the main
 * thread while scanning large DOM subtrees, discovery may be performed
 * incrementally and yield between work slices.
 *
 * As a result, a shadow root may not be observed immediately after its host is
 * added to the DOM. Mutations occurring inside the shadow root before it is
 * discovered may therefore not be reported.
 *
 * When a shadow root is discovered, a synthetic mutation record with
 * `type === 'shadowDiscover'` is emitted. Its `addedNodes` collection contains
 * the discovered `ShadowRoot`, allowing consumers to inspect and handle the
 * newly discovered shadow DOM.
 *
 * After discovery, mutations occurring within the shadow root are observed
 * normally.
 *
 * The returned accessor initially returns `null` and updates whenever one or
 * more mutation records are emitted.
 *
 * @param element Element to observe.
 *
 * @returns A reactive accessor that initially returns `null` and subsequently
 * returns arrays of mutation records affecting the observed target.
 *
 * @see {@link observeBatchedMutations}
 */
export function observerMutations(element: Element): Accessor<readonly CdkMutationRecord[] | null>;
 /**
 * Creates a reactive accessor that observes mutations affecting the provided
 * document and its DOM content.
 *
 * Mutations are observed within the element's subtree, including changes to
 * attributes, character data, child nodes, and supported open shadow DOM.
 *
 * Shadow roots are discovered asynchronously. To avoid blocking the main
 * thread while scanning large DOM subtrees, discovery may be performed
 * incrementally and yield between work slices.
 *
 * As a result, a shadow root may not be observed immediately after its host is
 * added to the DOM. Mutations occurring inside the shadow root before it is
 * discovered may therefore not be reported.
 *
 * When a shadow root is discovered, a synthetic mutation record with
 * `type === 'shadowDiscover'` is emitted. Its `addedNodes` collection contains
 * the discovered `ShadowRoot`, allowing consumers to inspect and handle the
 * newly discovered shadow DOM.
 *
 * After discovery, mutations occurring within the shadow root are observed
 * normally.
 *
 * The returned accessor initially returns `null` and updates whenever one or
 * more mutation records are emitted.
 *
 * @param document The document to observe.
 *
 * @returns A reactive accessor that initially returns `null` and subsequently
 * returns arrays of mutation records affecting the observed target.
 * 
 * @see {@link observeBatchedMutations}
 */
export function observerMutations(document: Document): Accessor<readonly CdkMutationRecord[] | null>;
/**
 * Creates a reactive accessor that observes mutations affecting the provided
 * element and its descendants.
 *
 * Mutations are observed within the element's subtree, including changes to
 * attributes, character data, child nodes, and supported open shadow DOM.
 *
 * Shadow roots are discovered asynchronously. To avoid blocking the main
 * thread while scanning large DOM subtrees, discovery may be performed
 * incrementally and yield between work slices.
 *
 * As a result, a shadow root may not be observed immediately after its host is
 * added to the DOM. Mutations occurring inside the shadow root before it is
 * discovered may therefore not be reported.
 *
 * When a shadow root is discovered, a synthetic mutation record with
 * `type === 'shadowDiscover'` is emitted. Its `addedNodes` collection contains
 * the discovered `ShadowRoot`, allowing consumers to inspect and handle the
 * newly discovered shadow DOM.
 *
 * After discovery, mutations occurring within the shadow root are observed
 * normally.
 *
 * The element may be provided lazily using a getter. If the getter does not
 * return an element immediately, the library retries after the owning component
 * has been mounted.
 *
 * An error is thrown if no element is available after mounting.
 *
 * The returned accessor initially returns `null` and updates whenever one or
 * more mutation records are emitted.
 *
 * @param elementGetter Getter returning the element to observe.
 *
 * @returns A reactive accessor that initially returns `null` and subsequently
 * returns arrays of mutation records affecting the observed target.
 * 
 * @see {@link observeBatchedMutations}
 */
export function observerMutations(elementGetter: () => Element): Accessor<readonly CdkMutationRecord[] | null>;
/**
 * Creates a reactive accessor that observes mutations affecting the provided
 * element and its descendants.
 *
 * Mutations are observed within the element's subtree, including changes to
 * attributes, character data, child nodes, and supported open shadow DOM.
 *
 * Shadow roots are discovered asynchronously. To avoid blocking the main
 * thread while scanning large DOM subtrees, discovery may be performed
 * incrementally and yield between work slices.
 *
 * As a result, a shadow root may not be observed immediately after its host is
 * added to the DOM. Mutations occurring inside the shadow root before it is
 * discovered may therefore not be reported.
 *
 * When a shadow root is discovered, a synthetic mutation record with
 * `type === 'shadowDiscover'` is emitted. Its `addedNodes` collection contains
 * the discovered `ShadowRoot`, allowing consumers to inspect and handle the
 * newly discovered shadow DOM.
 *
 * After discovery, mutations occurring within the shadow root are observed
 * normally.
 * 
 * When a function is provided, the target is obtained from the function.
 * Observation starts when the function returns an Element. If the getter does not
 * return an element immediately, the library retries after the owning component
 * has been mounted.
 * 
 * The accessor returns null until the first mutation is observed.
 * 
 * @param target The document, element, or function returning the element to
 * observe.
 * 
 * @returns A reactive accessor that initially returns `null` and subsequently
 * returns arrays of mutation records affecting the observed target.
 * 
 * @see {@link observeBatchedMutations}
 */
export function observerMutations(target: Document | Element | (() => Element)): Accessor<readonly CdkMutationRecord[] | null>;
/** @internal */
export function observerMutations(target: any, caller?: Function): Accessor<CdkMutationRecord[] | null>;
export function observerMutations(target: any, caller: Function = observerMutations): Accessor<readonly CdkMutationRecord[] | null> {
    if (__IS_SERVER__) { return () => null; }
    isDev && _assertValidObservationTarget(target, true, false, caller) && _assertIsInOwningContext(caller);

    if (target instanceof Document) {
        target = target.documentElement;
    }

    let returnValue: any;
    let element = target instanceof Element ? target : (returnValue = target()) instanceof Element ? returnValue : null;
    isDev && element && _assertValidObservationTarget(element, true, false, caller);
    
    if (element) {
        return _observeMutations(element);
    } else {
        const [mutation, setMutation] = createSignal<readonly CdkMutationRecord[] | null>(null);
        onMount(() => {
            element = target() as Element;
            isDev && _assertValidObservationTarget(element, true, false, caller);
            const getter = _observeMutations(element);
            createComputed(() => setMutation(getter()));
        });
        return mutation;
    }
}

function _observeMutations(element: Element): Accessor<readonly CdkMutationRecord[] | null> {
    _initializeMutationObserver();
    let settersRef = _mutableElementSetters!.get(element);
    !settersRef && _mutableElementSetters!.set(element, (settersRef = [{ head: null, tail: null }, null]));
    const setterList = settersRef[0];

    const [getter, setter] = createSignal<readonly CdkMutationRecord[] | null>(null);
    const setterRef = _pushSetter(setterList, setter);

    onCleanup(() => {
        _unlinkSetter(setterList, setterRef);
        if (setterList.head) { return; }
        if (_mutableElementSetters) {
            _mutableElementSetters.delete(element);
            if (_mutableElementSetters!.size) { return; }
            _finalizeMutationObserver();
        }
    })

    return getter;
}

/**
 * Observes DOM mutations within the specified element and its descendants,
 * returning a reactive accessor containing a batched mutation record.
 *
 * Multiple mutations that occur within the same scheduling cycle are
 * coalesced into a single {@link BatchedMutationRecord}. The accessor updates
 * asynchronously using the batched mutation scheduler.
 *
 * The observer tracks mutations from the entire descendant tree of the
 * specified element, including changes to child nodes, attributes, and
 * character data.
 *
 * The returned accessor contains `null` until the first mutation batch is
 * emitted.
 *
 * @param element The element whose subtree should be observed.
 *
 * @returns A reactive accessor containing the latest batched mutation record,
 * or `null` if no mutations have been observed yet.
 * 
 * @see {@link observeMutations}
 */
export function observeBatchedMutations(element: Element): Accessor<CdkBatchedMutationRecord | null>;
/**
 * Observes and batches mutations within the specified document.
 *
 * Creates a reactive accessor that batches multiple mutation records occurring
 * within the same scheduling cycle into a single `BatchedMutationRecord`.
 *
 * The accessor returns `null` until the first batch of mutations is emitted.
 *
 * @param document The document to observe.
 *
 * @returns A reactive accessor containing the latest batched mutation record,
 * or `null` if no mutations have been observed yet.
 * 
 * @see {@link observeMutations}
 */
export function observeBatchedMutations(document: Document): Accessor<CdkBatchedMutationRecord | null>;
/**
 * Observes DOM mutations within the specified element and its descendants,
 * using a reactive element getter.
 *
 * The getter is evaluated reactively. If the element is not available during
 * initialization, observation starts once the getter returns a valid element.
 *
 * Multiple mutations that occur within the same scheduling cycle are
 * coalesced into a single {@link BatchedMutationRecord}.
 *
 * The returned accessor contains `null` until the first mutation batch is
 * emitted.
 *
 * @param elementGetter A function returning the element whose subtree should
 * be observed.
 *
 * @returns A reactive accessor containing the latest batched mutation record,
 * or `null` if no mutations have been observed yet.
 * 
 * @see {@link observeMutations}
 */
export function observeBatchedMutations(elementGetter: () => Element): Accessor<CdkBatchedMutationRecord | null>;
/**
 * Observes DOM mutations within the specified target and its descendants.
 *
 * This overload accepts either a direct element instance or a reactive getter.
 * Mutations are coalesced into {@link BatchedMutationRecord} instances and
 * emitted through a reactive accessor.
 *
 * The returned accessor contains `null` until the first mutation batch is
 * emitted.
 *
 * @param target The target to observe or a function returning the element to
 * observe.
 *
 * @returns A reactive accessor containing the latest batched mutation record,
 * or `null` if no mutations have been observed yet.
 * 
 * @see {@link observeMutations}
 */
export function observeBatchedMutations(target: Document | Element | (() => Element)): Accessor<CdkBatchedMutationRecord | null>;
export function observeBatchedMutations(target: any): Accessor<CdkBatchedMutationRecord | null> {
    if (__IS_SERVER__) { return () => null; }
    const recordsSource = observerMutations(target, observeBatchedMutations)
    
    return createMemo(() => {
        const records = recordsSource();
        if (records) {
            const batchedRecord: _BatchedMutationRecord = {
                addedNodes: null,
                attributeNames: null,
                attributeNamespaces: null,
                attributeOwners: null,
                removedNodes: null,
                targets: [],
                attributeChange: false,
                characterDataChange: false,
                childListChange: false,
                shadowDiscover: false
            }

            for (const record of records) {
                batchedRecord.targets.push(record.target);
                if (record.addedNodes.length) {
                    batchedRecord.addedNodes ??= []
                    for (const node of record.addedNodes) {
                        batchedRecord.addedNodes.push(node);
                    }
                }
                if (record.removedNodes.length) {
                    batchedRecord.removedNodes ??= [];
                    for (const node of record.removedNodes) {
                        batchedRecord.removedNodes.push(node);
                    }
                }
                if (record.attributeName !== null) {
                    (batchedRecord.attributeNames ??= []).push(record.attributeName);
                    (batchedRecord.attributeNamespaces ??= []).push(record.attributeNamespace || '');
                    (batchedRecord.attributeOwners ??= []).push(record.target as Element);
                }
                record.type === 'attributes' && (batchedRecord.attributeChange = true);
                record.type === 'characterData' && (batchedRecord.characterDataChange = true);
                record.type === 'childList' && (batchedRecord.childListChange = true);
                record.type === 'shadowDiscover' && (batchedRecord.shadowDiscover = true);
            }

            return _freezeRecord(batchedRecord);
        }

        return null
    })
}

/**
 * Creates a reactive signal that emits the latest resize observation for the
 * provided element.
 *
 * The element may be provided directly or lazily using a getter. If the getter
 * does not return an element immediately, the library retries after the owning
 * component has been mounted.
 *
 * An error is thrown if no element is available after mounting.
 *
 * The returned accessor initially returns `null` and updates whenever the
 * observed element is resized.
 *
 * @param element Element to observe.
 *
 * @returns A reactive accessor containing the latest resize observer entry.
 * @throws `Error` if called outside an owning context.
 */
export function observeResizing(element: Element): Accessor<ResizeObserverEntry | null>;
/**
 * Creates a reactive signal that emits the latest resize observation for the
 * provided element.
 *
 * The element may be provided lazily using a getter. If the getter does not
 * return an element immediately, the library retries after the owning component
 * has been mounted.
 *
 * An error is thrown if no element is available after mounting.
 *
 * The returned accessor initially returns `null` and updates whenever the
 * observed element is resized.
 *
 * @param elementGetter Getter returning the element to observe.
 *
 * @returns A reactive accessor containing the latest resize observer entry.
 * @throws `Error` if called outside an owning context.
 */
export function observeResizing(elementGetter: () => Element): Accessor<ResizeObserverEntry | null>;
/**
 * Creates a reactive signal that emits the latest resize observation for the
 * configured element.
 *
 * The target may be provided directly or lazily using a getter. If the getter
 * does not return an element immediately, the library retries after the owning
 * component has been mounted.
 *
 * An error is thrown if no element is available after mounting.
 *
 * Observation may be dynamically enabled or disabled using the `observe`
 * accessor.
 *
 * The returned accessor initially returns `null` and updates whenever the
 * observed element is resized.
 *
 * @param options Resize observation options.
 *
 * @returns A reactive accessor containing the latest resize observer entry.
 * @throws `Error` if called outside an owning context.
 * 
 * @see {@link ObserveElementResizingOptions}
 */
export function observeResizing(options: ObserveElementResizingOptions): Accessor<ResizeObserverEntry | null>;
export function observeResizing(target: Element | (() => Element) | ObserveElementResizingOptions): Accessor<ResizeObserverEntry | null> {
    if (__IS_SERVER__) { return () => null; }
    isDev && _assertValidObservationTarget(target, false, true, observeResizing) && _assertIsInOwningContext(observeResizing);

    if (_resizeObserver === null) {
        _resizableElements = new WeakMap();
        _resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const settersRef = _resizableElements.get(entry.target);
                if (settersRef) {
                    const settersList = settersRef[0];
                    for (let setterRef = settersList.head; setterRef; setterRef = setterRef.next) {
                        setterRef.setter(entry);
                    }
                }
            }
        });
    }

    let returnValue: any
    let element: Element | null | undefined;
    let elGetter: () => Element | null | undefined;
    let options: ResizeObserverOptions | undefined;
    let watch: Accessor<boolean> | null = null;

    if ('target' in target) {
        const { target: _target, observe, ...rest } = target;
        options = rest;
        watch = observe || null;
        element = _target instanceof Element ? _target : (returnValue = _target()) instanceof Element ? returnValue : null;
        if (!element) { elGetter = _target as any; }
    } else {
        element = target instanceof Element ? target : (returnValue = target()) instanceof Element ? returnValue : null;
        if (!element) { elGetter = target as any; }
    }
    isDev && element && _assertValidObservationTarget(element, false, false, observeResizing);
    
    if (element) {
        return _observeResizing(element, watch, options);
    } else {
        const [entry, setEntry] = createSignal<ResizeObserverEntry | null>(null);
        onMount(() => {
            element = elGetter()!;
            isDev && _assertValidObservationTarget(element, false, false, observeResizing);
            const getter = _observeResizing(element, watch, options);
            createComputed(() => setEntry(getter()));
        });
        return entry;
    }
}

function _observeResizing(element: Element, watch: Accessor<boolean> | null, options?: ResizeObserverOptions): Accessor<ResizeObserverEntry | null> {
    let settersRef = _resizableElements.get(element);
    !settersRef && _resizableElements.set(element, (settersRef = [{ head: null, tail: null }, 0]));
    
    const setterList = settersRef[0];
    const [getter, setter] = createSignal<ResizeObserverEntry | null>(null);
    const setterRef: _SetterRef<ResizeObserverEntry | null> = { setter, next: null, prev: null, linked: false };

    settersRef[1]++;
    
    if (watch) {
        createComputed(() => {
            const observe = watch();
            if (observe) {
                if (!setterList.head) { _resizeObserver!.observe(element, options); }
                _pushSetter(setterList, setterRef);
            } else {
                _unlinkSetter(setterList, setterRef);
            }
        })
    } else {
        _pushSetter(setterList, setterRef);
        _resizeObserver!.observe(element, options);
    }

    onCleanup(() => {
        _unlinkSetter(setterList, setterRef);
        const refCount = --settersRef[1];
        if (refCount) { return; }
        _resizeObserver!.unobserve(element);
        _resizableElements.delete(element);
    })
    
    return getter;
}