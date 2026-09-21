/**
 * @license
 * Copyright (c) 2026 dags-solid-cdk contributors.
 * Licensed under the MIT License.
 */

import { isDev } from "solid-js/web";

const enum _Flags {
    Linked = 1,
    Once = 2
}

interface _ListenerNode<TArgs extends unknown[]> {
    cb: (...args: TArgs) => void;
    next: _ListenerNode<TArgs> | null;
    prev: _ListenerNode<TArgs> | null;
    flags: number;
    gen: number
}

/** @internal */
export interface _Notifier2<TArgs extends unknown[] = []> {
    add(listener: (...args: TArgs) => void): () => void;
    addOnce(listener: (...args: TArgs) => void): () => void;
    notify(...args: TArgs): void;
    dispose(): void;
    count(): number;
}

/** @internal */
export interface _ElementIterator<T extends Element = Element> {
    target: Element;
    nextElement(): T | null;
    reset(): void;
}

/** @internal */
export class _Notifier<TArgs extends unknown[] = []> {
    private _disposed = false;
    private _head: _ListenerNode<TArgs> | null = null;
    private _tail: _ListenerNode<TArgs> | null = null;
    private _notifying = false;
    private _gen = 0;
    private _count = 0;

    add(listener: (...args: TArgs) => void): () => void {
        if (this._disposed) {
            return () => {};
        }
        const node = this._add(listener, _Flags.Linked);
        return this._unlink.bind(this, node);
    }

    addOnce(listener: (...args: TArgs) => void): () => void {
        if (this._disposed) {
            return () => {};
        }
        const node = this._add(listener, _Flags.Linked | _Flags.Once);
        return this._unlink.bind(this, node);
    }

    notify(...args: TArgs): void {
        if (this._disposed) {
            return;
        }
        if (isDev && this._notifying) {
            throw new Error('Cannot notify a notifier while it is already notifying!');
        }
        this._notify(this._head, ++this._gen, args)
    }

    count(): number {
        return this._count;
    }

    dispose(): void {
        this._disposed = true;
        this._head = null;
        this._tail = null;
        this._count = 0;
    }

    private _add(cb: (...args: TArgs) => void, flags: number): _ListenerNode<TArgs> {
        const node: _ListenerNode<TArgs> = {
            cb,
            prev: this._tail,
            next: null,
            flags,
            gen: this._gen
        }

        if (this._tail) {
            this._tail.next = node;
        } else {
            this._head = node;
        }

        this._tail = node;
        this._count++;
        
        return node;
    }

    private _unlink(node: _ListenerNode<TArgs>): void {
        if (node.flags & _Flags.Linked) {
            const { prev, next } = node;
            
            if (prev) {
                prev.next = next;
            } else {
                this._head = next;
            }

            if (next) {
                next.prev = prev;
            } else {
                this._tail = prev;
            }
            
            node.flags &= ~_Flags.Linked;
            this._count--;

            if (this._count === 0) {
                this._gen = 0;
            }
        }
    }

    private _notify(startNode: _ListenerNode<TArgs> | null, newGen: number, args: TArgs): void {
        this._notifying = true;
        let node = startNode;
        let stop = false
        let ogStopImmediatePropagation: (() => void) | null = null;
        if (args.length === 1 && args[0] instanceof Event) {
            const event = args[0] as Event
            ogStopImmediatePropagation = event.stopImmediatePropagation;
            event.stopImmediatePropagation = function() {
                ogStopImmediatePropagation!.call(event);
                stop = true;
            }
        }

        try {
            while (!(this._disposed || stop) && node && node.gen < newGen) {
                try {
                    if (node.flags & _Flags.Linked) {
                        node.cb.call(null, ...args);
                    }
                } finally {
                    if (!this._disposed) {
                        if (node.flags & _Flags.Once) {
                            this._unlink(node);
                        }
                        node = node.next;
                    }
                }
            }
        } finally {
            if (ogStopImmediatePropagation) {
                (args[0] as Event).stopImmediatePropagation = ogStopImmediatePropagation;
            }
            if (!(this._disposed || stop) && node && node.gen < newGen) {
                this._notify(node, newGen, args);
            } else {
                this._notifying = false;
            }
        }
    }
}

/** @internal */
export function _createElementIterator<T extends Element = Element>(target: Element, filter: (element: Element) => number): _ElementIterator<T> {
    const iterator = {
        target: target,
        _starts: true,
        _walker: document.createTreeWalker(target, NodeFilter.SHOW_ELEMENT, filter as any),
        reset(): void {
            this._starts = true;
            this._walker.currentNode = this.target;
        },
        nextElement(): T | null {
            if (this._starts) {
                this._starts = false;
                if (filter(target) === 1) { 
                    if (target.shadowRoot) {
                        this._walker.currentNode = target.shadowRoot;
                    }
                    return target as T;
                }
            }
            const element = this._walker.nextNode() as T | null;
            if (element) {
                if (element.shadowRoot) {
                    this._walker.currentNode = element.shadowRoot
                }
                return element as T;
            } else {
                while (this._walker.currentNode !== this.target) {
                    const currentNode = this._walker.currentNode;

                    let root: Node;

                    if (
                        (root = currentNode) instanceof ShadowRoot ||
                        (root = currentNode.getRootNode()) instanceof ShadowRoot
                    ) {
                        this._walker.currentNode = root.host;

                        const element = this._walker.nextNode() as T | null;

                        if (element) {
                            if (element.shadowRoot) {
                                this._walker.currentNode = element.shadowRoot;
                            }
                            return element;
                        }
                    } else {
                        return null;
                    }
                }

                return null;
            }
        }
    }
    return iterator;
}

