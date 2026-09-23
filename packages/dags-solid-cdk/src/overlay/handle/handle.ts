import { getOwner, Component, onCleanup, sharedConfig, createComponent, createRoot, useContext, createContext } from "solid-js";
import { isDev, insert } from "solid-js/web";
import { _assertIsFunction, _assertIsHTMLElement } from "../../internals/common-assertions";
import { _Task, _createTaskObject, _scheduleAsapTask, _cancelTask } from "../../internals/schedulers";
import { _Notifier } from "../../internals/utils";
import { OverlayHandle, PositionStrategy, UnderlyingInteractionStrategy } from "../overlay";

const _handleContext = createContext<OverlayHandle<any>>();

let _overlayRoot: HTMLDivElement | null = null;


function _createOverlayRoot(): HTMLDivElement {
    const root = document.createElement('div');
    root.style.position = 'absolute';
    root.style.width = '1px';
    root.style.height = '1px';
    root.style.padding = '0';
    root.style.margin = '-1px';
    return document.body.appendChild(root);
}

/** @internal */
export function _getOverlayRoot(): HTMLDivElement | null {
    return _overlayRoot;
}

/**
 * Returns the overlay handle associated with the current component.
 *
 * The handle is available only when the component is rendered as part of
 * an overlay created by {@link createOverlay}.
 *
 * @typeParam P Properties passed to the overlay component when it is attached.
 * @returns The current overlay handle, or `undefined` when the component is
 * not rendered within an overlay context.
 */
export function useOverlayHandle<P extends Record<string, any> | void>(): OverlayHandle<P> | undefined {
    return useContext(_handleContext);
}

/** @internal */
export class _OverlayHandleImpl<P extends Record<string, any> | void> implements OverlayHandle<P> {
    private _attached = false;
    private _disposed = true;
    private _attaching = false;
    private _detaching = false;
    private _ownerDisposed = false;
    private _applyingStrategies = false;
    private _disposer: (() => void) | null = null;
    private _task: _Task | null = null;
    private _backdrop: HTMLDivElement | null = null;
    private _container: HTMLElement | null = null;
    private _hostElement = document.createElement('div');
    private _overlayElement = this._hostElement.appendChild(document.createElement('div'));
    private _owner = getOwner()!
    private _detachNotifier = new _Notifier<[OverlayHandle<any>]>();
    private _disposeNotifier = new _Notifier<[OverlayHandle<any>]>();
    private _preparedNotifier = new _Notifier<[OverlayHandle<any>]>();
    private _beforeAttachNotifier = new _Notifier<[OverlayHandle<any>]>();
    private _attachNotifier = new _Notifier<[OverlayHandle<any>]>();
    private _beforeDetachNotifier = new _Notifier<[OverlayHandle<any>]>();

    constructor(
        public _component: Component<P extends void ? {} : P>,
        public _positionStrategy: PositionStrategy,
        public _underlyingInteractionStrategies: UnderlyingInteractionStrategy<P>[],
        public _withViewTransitions: boolean | string[],
        withBackdrop: boolean,
        manualRemove: boolean
    ) {
        if (withBackdrop) {
            const backdrop = this._backdrop = document.createElement('div');
            backdrop.style.position = 'fixed';
            backdrop.style.inset = '0';
            this._hostElement.prepend(backdrop);
        }

        onCleanup(() => {
            this._ownerDisposed = true;
            this._attachNotifier.dispose();
            this.dispose();
            if (manualRemove) { return; }
            this.detach();
        });
    }

    get attached(): boolean { return this._attached; }

    get disposed(): boolean { return this._disposed && this._task === null; }

    get backdrop(): HTMLDivElement | null { return this._backdrop; }

    get componentContainer(): HTMLElement | null { return this._container; }

    attach(props: P): void {
        if (isDev && this._detaching) {
                throw new Error('OverlayHandle.attach(): This method can not be used during detachment!');
            }
        if (this._attached || this._attaching || this._task || this._ownerDisposed) {
            return;
        }
        this._disposed = false;
        // We need to escape hydration
        if (sharedConfig.context) {
            this._task = _createTaskObject(() => {
                this._task = null;
                try {
                    this._doAttachment(props);
                } finally {
                    if (this._disposed) { 
                        this._disposer?.();
                        this._disposeNotifier.notify(this as any);
                    }
                }
            });
            _scheduleAsapTask(this._task);
        } else {
            this._doAttachment(props);
        }
    }

    detach(): void {
        if (isDev && this._attaching) {
                throw new Error('OverlayHandle.detach(): This method can not be used during attachment!');
            }
            if (!(this._attached || this._task)) { return; }
            if (this._task) {
                _cancelTask(this._task);
                this._task = null;
            }
            this.dispose();
            this._detaching = true;
            try {
                if (this._attached) {
                    if (this._withViewTransitions && document.startViewTransition) {
                        document.startViewTransition({
                            update: () => this._detachOverlay(),
                            types: Array.isArray(this._withViewTransitions) ? this._withViewTransitions : undefined
                        });
                    } else {
                        this._detachOverlay();
                    }
                    this._attached = false;
                }
            } finally {
                try {
                    if (!this._attached) {
                        this._detachNotifier.notify(this as any);
                        if (this._ownerDisposed) { 
                            this._disposeNotifier.dispose();
                            this._detachNotifier.dispose();
                        }
                    }
                } finally {
                    this._detaching = false;
                }
            }
    }

    moveUp(): void {
        if (!(this._attached && this._hostElement.nextElementSibling) || this._task) { return; }
        this._hostElement.nextElementSibling.insertAdjacentElement(
            'afterend',
            this._hostElement
        );
    }

    moveDown(): void {
        if (!(this._attached && this._hostElement.previousElementSibling) || this._task) { return; }
        this._hostElement.previousElementSibling.insertAdjacentElement(
            'beforebegin',
            this._hostElement
        );
    }

    moveToTheTop(): void {
        if (!this._attached || this._task) { return; }
        _overlayRoot!.appendChild(this._hostElement);
    }

    moveToTheBottom(): void {
        if (!this._attached || this._task) { return; }
        _overlayRoot!.prepend(this._hostElement);
    }

    dispose(): void {
        if (isDev && this._attaching) {
            throw new Error('OverlayHandle.dispose(): This method can not be used during attachment!');
        }
        if (this._disposed) { return; }
        this._disposer?.()
        this._disposed = true;
        if (!this._task) {
            this._disposeNotifier.notify(this as any);
        }
    }

    onPrepared(listener: (handle: this & { componentContainer: HTMLElement; }) => void): () => void {
        isDev && _assertIsFunction(
            listener,
            'OverlayHandle.onPrepared(): Invalid argument! Expected a function.'
        );
        if (useOverlayHandle()) {
            return () => {};
        } else if (this._applyingStrategies) {
            return this._preparedNotifier.addOnce(listener as any); 
        } else {
            return this._preparedNotifier.add(listener as any);
        }
    }

    onBeforeAttach(listener: (handle: this & { componentContainer: HTMLElement }) => void): () => void {
        isDev && _assertIsFunction(
            listener,
            'OverlayHandle.onBeforeAttach(): Invalid argument! Expected a function.'
        );
        if (useOverlayHandle()) {
            return () => {};
        } else if (this._applyingStrategies) {
            return this._beforeAttachNotifier.addOnce(listener as any);
        } else {
            return this._beforeAttachNotifier.add(listener as any);
        }
    }

    onAttach(listener: (handle: this & { componentContainer: HTMLElement }) => void) {
        isDev && _assertIsFunction(
            listener,
            'OverlayHandle.onAttach(): Invalid argument! Expected a function.'
        );
        if (this._applyingStrategies) {
            return this._attachNotifier.addOnce(listener as any);
        } else if (useOverlayHandle() && this._attaching) {
            if (this._attached) {
                return () => {};
            } else {
                return this._attachNotifier.addOnce(listener as any);
            }

        } else {
            return this._attachNotifier.add(listener as any);
        }
    }

    onDispose(listener: (handle: this & { componentContainer: HTMLElement }) => void): () => void {
        isDev && _assertIsFunction(
            listener,
            'OverlayHandle.onDispose(): Invalid argument! Expected a function.'
        );
        if (this._applyingStrategies || useOverlayHandle()) {
            return this._disposeNotifier.addOnce(listener as any);
        } else {
            return this._disposeNotifier.add(listener as any);
        }
    }

    onBeforeDetach(listener: (handle: this & { componentContainer: HTMLElement }) => void) {
        isDev && _assertIsFunction(
            listener,
            'OverlayHandle.onBeforeDetach(): Invalid argument! Expected a function.'
        );
        if (this._applyingStrategies || useOverlayHandle()) {
            return this._beforeDetachNotifier.addOnce(listener as any);
        } else {
            return this._beforeDetachNotifier.add(listener as any);
        }
    }

    onDetach(listener: (handle: this & { componentContainer: null }) => void): () => void {
        isDev && _assertIsFunction(
            listener,
            'OverlayHandle.onDetach(): Invalid argument! Expected a function.'
        );
        if (this._applyingStrategies || useOverlayHandle()) {
            return this._detachNotifier.addOnce(listener as any);
        } else {
            return this._detachNotifier.add(listener as any);
        }
    }

    private _attachOverlay(props: any): void {
        const component = this._component
        this._beforeAttachNotifier.notify(this);
        
        _overlayRoot!.appendChild(this._hostElement);
        insert(
            this._container!,
            createComponent(
                _handleContext.Provider,
                {
                    value: this,
                    get children() {
                        return createComponent(component, props);
                    }
                }
            )
        )
    }

    private _doAttachment(props: P): void {
        this._disposer = createRoot((d) => {
            _overlayRoot ??= _createOverlayRoot();
            this._attaching = true;
            try {
                const coercedProps = typeof props === 'undefined' ? {} : props as any;
                const container = this._positionStrategy.call(null, this._overlayElement);
                
                isDev && _assertIsHTMLElement(
                    container,
                    'PositionStrategy.call(): Invalid return type! Expected an HTMLElement instance.'
                );

                this._applyingStrategies = true;
                try {
                    for (const strategy of this._underlyingInteractionStrategies) {
                        strategy.call(this as any, this._overlayElement, container);
                    }
                } finally {
                    this._applyingStrategies = false;
                }

                this._container = container;
                
                this._preparedNotifier.notify(this)
                if (this._withViewTransitions && document.startViewTransition) {                    
                    document.startViewTransition({
                        update: () => this._attachOverlay(coercedProps),
                        types: Array.isArray(this._withViewTransitions) ? this._withViewTransitions : undefined
                    })
                } else {
                    this._attachOverlay(coercedProps);
                }
                this._attached = true;
            } finally {
                try {
                    if (this._attached) {
                        this._attachNotifier.notify(this);
                    } else {
                        d();
                        this._cleanupElements();
                    }
                } finally {
                    this._attaching = false;
                }
            }

            return d;
        }, this._owner);
    }

    private _detachOverlay(): void {
        this._beforeDetachNotifier.notify(this);
        this._cleanupElements();
    }

    private _cleanupElements(): void {
        this._hostElement.remove();
        this._overlayElement.remove();
        this._overlayElement = this._hostElement.appendChild(document.createElement('div'));
        this._container = null;
        if (!_overlayRoot!.hasChildNodes()) {
            _overlayRoot!.remove();
            _overlayRoot = null;
        }
    }
}

/** @internal */
export class _ServerOverlayHandleImpl implements OverlayHandle<any> {

    get attached(): boolean { return false };

    get disposed(): boolean { return true };
    
    get backdrop(): HTMLDivElement | null { 
        throw new Error('OverlayHandle.backdrop: This property is not available in a server environment!');
    };

    get componentContainer(): HTMLElement | null { return null };

    attach(): void {
        throw new Error('OverlayHandle.attach(): This method is not available in a server environment!');
    }

    detach(): void {}

    dispose(): void {}

    moveUp(): void {}

    moveDown(): void {}

    moveToTheTop(): void {}

    moveToTheBottom(): void {}

    onPrepared(): () => void { return () => {}; }

    onBeforeAttach(): () => void { return () => {}; }

    onAttach(): () => void { return () => {}; }

    onDispose(): () => void { return () => {}; }

    onBeforeDetach(): () => void { return () => {}; }

    onDetach(): () => void { return () => {}; }

}