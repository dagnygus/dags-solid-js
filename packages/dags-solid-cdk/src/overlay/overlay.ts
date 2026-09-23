import { Component } from "solid-js";
import { isDev } from "solid-js/web";
import { _cancelTask, _createTaskObject, _scheduleAsapTask, _Task } from "../internals/schedulers";
import { _Notifier } from "../internals/utils";
import { _assertIsFunction, _assertIsHTMLElement, _assertIsInOwningContext, _assertIsObjectExcludingArray, _assertIsOptionalBoolean, _assertIsTrue } from "../internals/common-assertions";
import { _ServerOverlayHandleImpl, _OverlayHandleImpl } from "./handle/handle";

/**
 * Configuration used to create an overlay.
 * 
 * Overlay is built with following structure:
 * 
 * ```ts
 * body
 *  |
 *  ├── div[id=root] <= Place where usually solid app is rendered.
 *  |
 *  └── div <= An overlay root.
 *       |
 *       ├──div <= An overlay host element managed by "moveUp", "moveDown" etc.
 *       |   |
 *       |   ├── div <= An optional backdrop
 *       |   └── div <= An overlay element where component is placed,
 *       |              directly or not.
 *       |
 *       └──div <= An overlay host element managed by "moveUp", "moveDown" etc.
 *           |
 *           └── div <= An overlay element where component is placed,
 *                      directly or not.
 * ```
 */ 
export interface CreateOverlayConfig<P extends Record<string, any> | void> {

    /**
     * The component to render inside the overlay.
     */
    component: Component<P extends void ? {} : P>;

    /**
     * Strategy responsible for positioning the overlay element and
     * returning the element that will contain the rendered component.
     */
    positionStrategy: PositionStrategy

    /**
     * Strategy or strategies used to control interaction with elements
     * underlying the overlay.
     *
     * When multiple strategies are provided, they are executed in the
     * order in which they appear in the array.
     */
    underlyingInteractionStrategies?: UnderlyingInteractionStrategy<P> | UnderlyingInteractionStrategy<P>[];

    /**
     * Whether to create a backdrop behind the overlay.
     *
     * When enabled, the backdrop element is available through the
     * overlay handle.
     */
    withBackdrop?: boolean;

    /**
     * Whether to attach the overlay using the View Transition API.
     *
     * When set to `true`, the default View Transition is used.
     * When an array of strings is provided, the strings are passed as
     * View Transition types.
     */
    withViewTransitions?: boolean | string[];

    /**
     * Whether the overlay should remain in the DOM when its owner is disposed.
     *
     * When enabled, disposing the owner disposes the overlay's reactive
     * lifetime without automatically removing its DOM elements.
     */
    manualRemove?: boolean;

}

/**
 * Determines the position and component container of an overlay.
 *
 * The strategy receives the overlay element and must return the element
 * into which the overlay component will be rendered.
 */
export interface PositionStrategy {

    /**
     * @param overlayElement The overlay element to position.
     * @returns The element that will contain the rendered overlay component.
     */
    (overlayElement: HTMLDivElement): HTMLElement;

}

/**
 * Configures how interaction with elements underlying the overlay is handled.
 *
 * The strategy is executed for each attachment before the `onBeforeAttach`
 * listeners are notified.
 *
 * @typeParam P Properties passed to the overlay component when it is attached.
 */
export interface UnderlyingInteractionStrategy<P extends Record<string, any> | void> {

    /**
     * @param overlayElement The overlay element being attached.
     * @param componentContainer The element that will contain the rendered overlay component.
     */
    (this: OverlayHandle<P> & { componentContainer: null }, overlayElement: HTMLDivElement, componentContainer: HTMLElement): void;
}

/**
 * Controls the lifecycle, DOM placement, and interaction state of an overlay.
 *
 * An overlay handle represents a single reusable overlay instance. The same
 * handle can be attached and detached multiple times, with a new component
 * container created for each attachment.
 *
 * The handle exposes two independent lifecycle states. The `attached` state
 * describes whether the overlay is attached to the DOM, while the `disposed`
 * state describes whether the reactive lifetime of the current attachment
 * has been disposed.
 *
 * Consequently, an overlay can be attached while disposed. In particular,
 * this allows the DOM representation of an overlay to remain available after
 * its reactive lifetime has ended, such as when manual removal is enabled.
 */
export interface OverlayHandle<P extends Record<string, any> | void = void> {

    /**
     * Indicates whether the overlay is currently attached to the DOM.
     *
     * This property describes the DOM attachment state and is independent
     * of the reactive lifetime represented by {@link disposed}.
     */
    readonly attached: boolean;

    /**
     * Indicates whether the reactive lifetime of the current attachment
     * has been disposed.
     *
     * An overlay may be both attached and disposed. This can occur when
     * the reactive lifetime is disposed before the overlay is physically
     * removed from the DOM, for example when `manualRemove` is enabled.
     */
    readonly disposed: boolean;

    /**
     * The backdrop element associated with the overlay, or `null` when
     * the overlay was created without a backdrop.
     *
     * The same backdrop element is reused across attachments.
     * 
     * @throws `Error` when read in a server environment.
     */
    readonly backdrop: HTMLDivElement | null;

    /**
     * The container element into which the overlay component is rendered,
     * or `null` when the overlay is not attached.
     *
     * A new container may be created for each attachment.
     */
    readonly componentContainer: HTMLElement | null;

    /**
     * Attaches the overlay and renders its component using the provided
     * properties.
     *
     * If the overlay is already attached, is being attached, has a pending
     * attachment task, or its owner has been disposed, this method does
     * nothing.
     *
     * @param props Properties passed to the overlay component.
     * @throws `Error` when called in a server environment.
     */
    attach(props: P): void;

    /**
     * Detaches the overlay from the DOM.
     *
     * If an attachment is pending, the pending attachment is cancelled.
     * The reactive lifetime of the attachment is disposed before the
     * overlay is removed.
     *
     * If the overlay is not attached and has no pending attachment,
     * this method does nothing.
     */
    detach(): void;

    /**
     * Disposes the reactive lifetime of the current attachment.
     *
     * Disposing an overlay does not necessarily remove its DOM elements.
     * The overlay may therefore remain attached after this method returns.
     *
     * Calling this method when the overlay is already disposed has no effect.
     */
    dispose(): void;

    /**
     * Moves the overlay one position toward the top of the overlay stack.
     *
     * Does nothing when the overlay is not attached, has no next sibling,
     * or an attachment is pending.
     */
    moveUp(): void;

    /**
     * Moves the overlay one position toward the bottom of the overlay stack.
     *
     * Does nothing when the overlay is not attached, has no previous sibling,
     * or an attachment is pending.
     */
    moveDown(): void;

    /**
     * Moves the overlay to the top of the overlay stack.
     *
     * Does nothing when the overlay is not attached or an attachment
     * is pending.
     */
    moveToTheTop(): void;

    /**
     * Moves the overlay to the bottom of the overlay stack.
     *
     * Does nothing when the overlay is not attached or an attachment
     * is pending.
     */
    moveToTheBottom(): void;

    /**
     * Registers a listener that is invoked when the overlay has been prepared
     * for attachment.
     *
     * The listener is invoked after the position strategy and all underlying
     * interaction strategies have been applied. At this point,
     * {@link componentContainer} is available, but the overlay has not yet
     * been attached to the DOM.
     *
     * This hook can also be used while implementing an underlying interaction
     * strategy. In that context, the listener is invoked once for the current
     * attachment.
     *
     * This hook is also available through the {@link useOverlayHandle} context
     * from within the rendered overlay component. When used from this context,
     * this hook is a no-op because the overlay has already been rendered by the
     * time the context becomes available.
     *
     * This hook is invoked before the View Transition is started, making it
     * suitable for setup that must occur before {@link Document.startViewTransition}
     * is called.
     *
     * @param listener The listener to register.
     * @returns A function that removes the registered listener.
     */
    onPrepared(listener: (handle: this & { componentContainer: HTMLElement }) => void): () => void;

    /**
     * Registers a listener that is invoked immediately before the overlay is
     * attached to the DOM.
     *
     * At the time the listener is invoked, {@link componentContainer} is
     * available and the overlay has not yet been attached to the DOM.
     *
     * When View Transitions are enabled, the listener is invoked from the
     * View Transition update callback.
     *
     * This hook can also be used while implementing an underlying interaction
     * strategy. In that context, the listener is invoked once for the current
     * attachment.
     *
     * This hook is also available through the {@link useOverlayHandle} context
     * from within the rendered overlay component. When used from this context,
     * this hook is a no-op because the context becomes available only after the
     * overlay has been rendered.
     *
     * @param listener The listener to invoke before the overlay is attached.
     * @returns A function that removes the registered listener.
     */
    onBeforeAttach(listener: (handle: this & { componentContainer: HTMLElement }) => void): () => void;

    /**
     * Registers a listener that is invoked after the overlay has been attached
     * to the DOM and its component has been rendered.
     *
     * At the time the listener is invoked, {@link attached} is `true` and
     * {@link componentContainer} is available.
     *
     * This hook can also be used while implementing an underlying interaction
     * strategy. In that context, the listener is invoked once for the current
     * attachment.
     *
     * This hook is also available through the {@link useOverlayHandle} context
     * from within the rendered overlay component. When used from this context,
     * this hook is a no-op because the overlay has already been attached to the
     * DOM by the time the context becomes available.
     *
     * @param listener The listener to invoke after the overlay is attached.
     * @returns A function that removes the registered listener.
     */
    onAttach(listener: (handle: this & { componentContainer: HTMLElement }) => void): () => void;

    /**
     * Registers a listener that is invoked when the reactive lifetime associated
     * with the current overlay attachment is disposed.
     * 
     * At the time the listener is invoked, the overlay is still attached,
     * {@link attached} is `true`, and {@link componentContainer} is still
     * available.
     *
     * The listener is associated with the current attachment rather than with
     * the lifetime of the overlay handle itself. Disposing the attachment's
     * reactive lifetime does not necessarily detach the overlay from the DOM.
     *
     * This hook can also be used while implementing an underlying interaction
     * strategy. In that context, the listener is invoked once for the current
     * attachment.
     *
     * This hook is also available through the {@link useOverlayHandle} context
     * from within the rendered overlay component. Listeners registered from
     * this context are automatically removed after they are invoked, preventing
     * the listener from retaining the component's reactive scope.
     *
     * @param listener The listener to invoke when the current attachment is disposed.
     * @returns A function that removes the registered listener.
     */
    onDispose(listener: (handle: this & { componentContainer: HTMLElement }) => void): () => void;

    /**
     * Registers a listener that is invoked immediately before the overlay is
     * detached from the DOM.
     *
     * At the time the listener is invoked, the overlay is still attached,
     * {@link attached} is `true`, and {@link componentContainer} is still
     * available.
     *
     * When View Transitions are enabled, the listener is invoked from the
     * View Transition update callback.
     *
     * This hook can also be used while implementing an underlying interaction
     * strategy. In that context, the listener is invoked once for the current
     * attachment.
     *
     * This hook is also available through the {@link useOverlayHandle} context
     * from within the rendered overlay component. Listeners registered from
     * this context are automatically removed after they are invoked, preventing
     * the listener from retaining the component's reactive scope across
     * subsequent attachments.
     *
     * @param listener The listener to invoke before the overlay is detached.
     * @returns A function that removes the registered listener.
     */
    onBeforeDetach(listener: (handle: this & { componentContainer: HTMLElement }) => void): () => void;

    /**
     * Registers a listener that is invoked after the overlay has been detached
     * from the DOM.
     *
     * At the time the listener is invoked, {@link attached} is `false` and
     * {@link componentContainer} is `null`.
     *
     * This hook can also be used while implementing an underlying interaction
     * strategy. In that context, the listener is invoked once for the current
     * attachment.
     *
     * This hook is also available through the {@link useOverlayHandle} context
     * from within the rendered overlay component. Listeners registered from
     * this context are automatically removed after they are invoked, preventing
     * the listener from retaining the component's reactive scope across
     * subsequent attachments.
     *
     * @param listener The listener to invoke after the overlay is detached.
     * @returns A function that removes the registered listener.
     */
    onDetach(listener: (handle: this & { componentContainer: null }) => void): () => void;

}

/**
 * Overlay handle for an overlay that has a backdrop.
 *
 * Extends {@link OverlayHandle} with a non-null backdrop element that is
 * created for the lifetime of the overlay handle.
 */
export interface OverlayHandleWithBackdrop<P extends Record<string, any> | void = void> extends OverlayHandle<P> {

    /**
     * The backdrop element associated with the overlay.
     */
    readonly backdrop: HTMLDivElement;

}

/**
 * Overlay handle for an overlay without a backdrop.
 *
 * Extends {@link OverlayHandle} with a statically null backdrop.
 */
export interface OverlayHandleWithoutBackdrop<P extends Record<string, any> | void = void> extends OverlayHandle<P> {

    /**
     * Always `null` because this overlay has no backdrop.
     */
    readonly backdrop: null;
}

/**
 * Creates a reusable overlay handle from the provided configuration.
 *
 * The returned handle can be attached and detached multiple times. The
 * concrete handle type reflects whether a backdrop is explicitly enabled
 * or disabled in the configuration.
 * 
 * Overlay is built with following structure:
 * 
 * ```ts
 * body
 *  |
 *  ├── div[id=root] <= Place where usually solid app is rendered.
 *  |
 *  └── div <= An overlay root.
 *       |
 *       ├──div <= An overlay host element managed by "moveUp", "moveDown" etc.
 *       |   |
 *       |   ├── div <= An optional backdrop
 *       |   └── div <= An overlay element where component is placed,
 *       |              directly or not.
 *       |
 *       └──div <= An overlay host element managed by "moveUp", "moveDown" etc.
 *           |
 *           └── div <= An overlay element where component is placed,
 *                      directly or not.
 * ```
 *
 * @param config Configuration used to create the overlay.
 * @returns An overlay handle controlling the lifecycle and DOM state of the overlay.
 */
export function createOverlay<P extends Record<string, any> | void = void>(
    config: CreateOverlayConfig<P> & { withBackdrop: true }
): OverlayHandleWithBackdrop<P>;
export function createOverlay<P extends Record<string, any> | void = void>(
    config: CreateOverlayConfig<P> & { withBackdrop: false }
): OverlayHandleWithoutBackdrop<P>;
export function createOverlay<P extends Record<string, any> | void = void>(
    config: CreateOverlayConfig<P>
): OverlayHandle<P>
export function createOverlay<P extends Record<string, any> | void = void>(config: CreateOverlayConfig<P>): OverlayHandle<P> {
    if (__IS_SERVER__) {
        return new _ServerOverlayHandleImpl();
    }

    isDev && _assertIsInOwningContext(
        createOverlay
    ) && _assertIsObjectExcludingArray(
        config,
        'createOverlay(): Invalid argument! Expected a non-array object.'
    );

    const {
        component,
        positionStrategy,
        withBackdrop,
        withViewTransitions,
        manualRemove
    } = config;

    isDev && _assertIsFunction(
        component,
        'createOverlay({ component }): Invalid argument! Expected an object with "component" property of type function.'
    ) && _assertIsFunction(
        positionStrategy,
        'createOverlay({ positionStrategy }): Invalid argument! Expected an object with "positionStrategy" property of type function.'
    ) && _assertIsTrue(
        config.underlyingInteractionStrategies == null ||
        typeof config.underlyingInteractionStrategies === 'function' ||
        Array.isArray(config.underlyingInteractionStrategies),
        'createOverlay({ underlyingInteractionStrategies }): Invalid argument! Expected an object with "underlyingInteractionStrategies"' +
        ' property of type function or array of functions, or without it.'
    ) && _assertIsOptionalBoolean(
        withBackdrop,
        'createOverlay({ withBackdrop }): Invalid argument! Expected an object with "withBackdrop" property of type boolean, or without it.'
    ) && _assertIsOptionalBoolean(
        manualRemove,
        'createOverlay({ manualRemove }): Invalid argument! Expected an object with "manualRemove" property of type boolean, or without it.'
    ) && _assertIsTrue(
        withViewTransitions == null ||
        typeof withViewTransitions === 'boolean' ||
        Array.isArray(withViewTransitions),
        'createOverlay({ withViewTransitions }): Invalid argument! Expected an object with "withViewTransitions" property of type boolean' +
        ' or array of strings, or without it.'
    );

    const underlyingInteractionStrategies =
        config.underlyingInteractionStrategies
            ? Array.isArray(config.underlyingInteractionStrategies)
                ? config.underlyingInteractionStrategies.slice()
                : [config.underlyingInteractionStrategies]
            : [];

    return new _OverlayHandleImpl<P>(
        component,
        positionStrategy,
        underlyingInteractionStrategies,
        withViewTransitions || false,
        withBackdrop || false,
        manualRemove || false
    );
}



export type {
    Alignment,
    ConnectedEdgesStrategyConfig,
    Corner,
    Edge,
    EdgeConnection,
    FixedAlignmentStrategyConfig,
    FixedCoordinateStrategyConfig,
    OverlayOrientedEdgeConnection,
    StrictConnectedEdgesStrategyConfig,
    StrictEdgeConnection,
    TargetOrientedEdgeConnection,
    ValidConnectionsMap
} from "./position-strategy/position-strategy";

export {
    useOverlayHandle
} from "./handle/handle";

export {
    connectedEdgesPositionStrategy,
    fixedAlignmentStrategy,
    fixedCoordinateStrategy
 } from "./position-strategy/position-strategy";

 export {
    blockInteractions,
    detachAfterDisposeAndAnimation,
    detachOnOutsideClick,
    detachOnScrollOutside,
    disposeOnScrollOutside,
    disposeOnOutsideClick
 } from "./underlying-interaction-strategy/underlying-interaction-strategy";