import { Accessor, createRoot, createSignal, getOwner, onCleanup } from "solid-js";
import { createAnimationFrameEffect, createAsapRenderEffect, createLazyMemo } from "../../signals/signals";
import { PositionStrategy } from "../overlay";
import { observeResizing, observerMutations } from "../../observers/observers";
import { normalizePassiveListenerOptions } from "../../platform/platform";
import { isDev } from "solid-js/web";
import { _assertIsElement, _assertIsFunction, _assertIsNotNaN, _assertIsNumber, _assertIsObjectExcludingArray, _assertIsOneOf, _assertIsOptionalBoolean, _assertIsOptionalFunction, _assertIsOptionalString, _assertIsTrue } from "../../internals/common-assertions";

/**
 * Alignment of an element along an axis.
 */
export type Alignment = 'start' | 'center' | 'end';

/**
 * Corner of the viewport used as the reference point for positioning an overlay.
 */
export type Corner = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';


/**
 * Configuration used by the fixed alignment position strategy.
 */
export interface FixedAlignmentStrategyConfig {
    /**
     * Horizontal alignment of the overlay.
     */
    horizontalAlignment: Alignment;

    /**
     * Vertical alignment of the overlay.
     */
    verticalAlignment: Alignment;

    /**
     * CSS margin applied to the overlay.
     */
    margin?: string;
}

/**
 * Configuration used by the fixed coordinate position strategy.
 */
export interface FixedCoordinateStrategyConfig {
    /**
     * Horizontal coordinate of the overlay's reference point.
     */
    x: number;

    /**
     * Vertical coordinate of the overlay's reference point.
     */
    y: number;

    /**
     * Whether to automatically select the corner that allows the overlay
     * to fit within the viewport as much as possible and coerce `x` and `y`
     * to the viewport boundaries.
     *
     * When `false`, the `top-left` corner is always used.
     * 
     * Default is `false`.
     */
    autoAdjustCorner?: boolean;

    /**
     * Callback invoked with the corner selected for positioning the overlay.
     */
    onCornerSelected?: (corner: Corner) => void;
}

/**
 * Defines an edge or corner of an element that can be used as an
 * attachment point for a connected overlay.
 */
export type Edge = Corner | 'top-center' | 'bottom-center' | 'center-left' | 'center-right';

/**
 * Defines how an overlay is positioned relative to a target element.
 *
 * The target and overlay edges are aligned according to their respective
 * coordinates. Optional offsets are applied to the resulting position.
 * The weight is used to prioritize the connection when multiple connections
 * are possible.
 */
export interface EdgeConnection {
    /**
     * The edge of the target element to which the overlay is connected.
     */
    targetEdge: Edge;

    /**
     * The edge of the overlay that is connected to the target edge.
     */
    overlayEdge: Edge;

    /**
     * Horizontal offset applied to the connected overlay position.
     */
    offsetX?: number;

    /**
     * Vertical offset applied to the connected overlay position.
     */
    offsetY?: number;

    /**
     * Multiplier applied to the visible area of the overlay when scoring this
     * connection against other connections that do not fully fit within the
     * viewport.
    */
    weight?: number;
}

/**
 * Defines an edge connection with the target edge used as the type parameter.
 *
 * The overlay edge is restricted to the edges that are valid for the
 * specified target edge according to {@link ValidConnectionsMap}.
 */
export interface TargetOrientedEdgeConnection<K extends keyof ValidConnectionsMap> extends EdgeConnection {
    /**
     * The target edge from which the connection is oriented.
     */
    targetEdge: K;

    /**
     * An overlay edge that can validly connect to the target edge.
     */
    overlayEdge: ValidConnectionsMap[K];
}

/**
 * Defines an edge connection with the overlay edge used as the type parameter.
 *
 * The target edge is restricted to the edges that are valid for the
 * specified overlay edge according to {@link ValidConnectionsMap}.
 */
export interface OverlayOrientedEdgeConnection <K extends keyof ValidConnectionsMap> extends EdgeConnection {

    /**
     * A target edge that can validly connect to the overlay edge.
     */
    targetEdge: ValidConnectionsMap[K];

    /**
     * The overlay edge from which the connection is oriented.
     */
    overlayEdge: K;
}

/**
 * Represents an edge connection whose target and overlay edges form a
 * valid connection defined by {@link ValidConnectionsMap}.
 *
 * This type supports both target-oriented and overlay-oriented declarations
 * while preventing invalid target/overlay edge combinations at compile time.
 */
export type StrictEdgeConnection = {
    [K in keyof ValidConnectionsMap]:
        | TargetOrientedEdgeConnection<K>
        | OverlayOrientedEdgeConnection<K>
}[keyof ValidConnectionsMap];

/**
 * Configuration for a connected-edges positioning strategy.
 */
export interface ConnectedEdgesStrategyConfig {
    /**
     * Returns the element to which the overlay should be connected.
     */
    targetGetter: () => Element;

    /**
     * Ordered list of possible edge connections.
     *
     * Connections are evaluated in the order in which they are provided.
     */
    connections: [EdgeConnection, ...EdgeConnection[]];

    /**
     * Whether the overlay should be pushed into the viewport when the selected
     * connection would otherwise extend beyond its boundaries.
     */
    push?: boolean;

    onEdgeConnectionSelected?(connection: EdgeConnection): void
}

/**
 * Configuration for a connected-edges positioning strategy with compile-time
 * validation of target and overlay edge combinations.
 */
export interface StrictConnectedEdgesStrategyConfig extends ConnectedEdgesStrategyConfig {
    /**
     * Ordered list of possible valid edge connections.
     *
     * Each target/overlay edge pair must be permitted by {@link ValidConnectionsMap}.
     */
    connections: [StrictEdgeConnection, ...StrictEdgeConnection[]];
}

/**
 * Maps each edge of the target element to the overlay edges that can validly
 * connect to it.
 *
 * This map is the source of truth for the compile-time validation performed
 * by {@link StrictEdgeConnection}.
 */
export interface ValidConnectionsMap {
    ['top-left']: 'bottom-right' | 'center-right' | 'top-right' | 'bottom-center' | 'bottom-left';
    ['top-center']: 'bottom-right' | 'bottom-center' | 'bottom-left';
    ['top-right']: 'bottom-left' | 'center-left' | 'top-left' | 'bottom-center' | 'bottom-right';
    ['center-right']: 'bottom-left' | 'center-left' | 'top-left';
    ['bottom-right']: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'bottom-left';
    ['bottom-center']: 'top-left' | 'top-center' | 'top-right';
    ['bottom-left']: 'top-right' | 'top-center' | 'top-left' | 'center-right' | 'bottom-right';
    ['center-left']: 'bottom-right' | 'center-right' | 'top-right'
}

export const _validConnections: { [key: string]: string[] } = {
    'top-left': [
        'bottom-right',
        'center-right',
        'top-right',
        'bottom-center',
        'bottom-left'
    ],
    'top-center': [
        'bottom-right',
        'bottom-center',
        'bottom-left'
    ],
    'top-right': [
        'bottom-left',
        'center-left',
        'top-left',
        'bottom-center',
        'bottom-right'
    ],
    'center-right': [
        'bottom-left',
        'center-left',
        'top-left',
    ],
    'bottom-right': [
        'top-left',
        'top-center',
        'top-right',
        'center-left',
        'bottom-left'
    ],
    'bottom-center': [
        'top-left',
        'top-center',
        'top-right'
    ],
    'bottom-left': [
        'top-right',
        'top-center',
        'top-left',
        'center-right',
        'bottom-right'
    ],
    'center-left': [
        'bottom-right',
        'center-right',
        'top-right'
    ]
}

function _assertIsValidConnection(targetEdge: Edge, overlayEdge: Edge, errorMessage: string): true {
    if (_validConnections[targetEdge].includes(overlayEdge)) { return true; }
    throw new Error(errorMessage)
}

function _assertIsEdgeConnection(target: any, errorMessage: string): true {
    if (
        target !== null &&
        typeof target === 'object' &&
        !Array.isArray(target) &&
        typeof target.targetEdge === 'string' &&
        typeof target.overlayEdge === 'string' &&
        (!('offsetX' in target) || target.offsetX == null || typeof target.offsetX === 'number') &&
        (!('offsetY' in target) || target.offsetY == null || typeof target.offsetY === 'number') &&
        (!('weight' in target) || target.weight == null || typeof target.weight === 'number')
    ) {
        return true;
    }

    throw new Error(errorMessage);
}

/**
 * Creates a position strategy that aligns an overlay within the viewport.
 *
 * The overlay is positioned using a fixed positioning context that covers
 * the entire viewport. Its content is aligned horizontally and vertically
 * according to the specified configuration.
 *
 * The `start` and `end` alignment values are interpreted relative to the
 * corresponding flex axis and are therefore mapped to `flex-start` and
 * `flex-end`.
 *
 * The optional `margin` value is applied directly to the overlay element,
 * allowing additional spacing to be applied around its viewport-aligned area.
 *
 * The overlay does not participate in pointer hit testing, allowing pointer
 * events to reach elements underneath it.
 *
 * Configuration values are read inside the {@link createAsapRenderEffect()} callback,
 * allowing changes to the configuration to be reflected when the effect is
 * executed.
 *
 * @param config Configuration used to determine the overlay's horizontal and
 * vertical alignment and optional margin.
 * @returns A position strategy for positioning and aligning the overlay
 * within the viewport.
 */
export function fixedAlignmentStrategy(config: FixedAlignmentStrategyConfig): PositionStrategy {
    if (__IS_SERVER__) {
        throw new Error('fixedAlignmentStrategy(): This function is not available in a server environment!');
    }
    isDev && _assertIsObjectExcludingArray(
        config,
        'fixedAlignmentStrategy(): Invalid argument! Expected an non-array object.'
    ) && _assertIsOneOf(
        config.horizontalAlignment,
        ['start', 'center', 'end'],
        'fixedAlignmentStrategy({ horizontalAlignment }): Invalid argument! Expected an object with a "horizontalAlignment" property set to one of ["start", "center", "end"].'
    ) && _assertIsOneOf(
        config.verticalAlignment,
        ['start', 'center', 'end'],
        'fixedAlignmentStrategy({ verticalAlignment }): Invalid argument! Expected an object with a "verticalAlignment" property set to one of ["start", "center", "end"].'
    ) && _assertIsOptionalString(
        config.margin,
        'fixedAlignmentStrategy({ margin }): Invalid argument! Expected am object with "margin" property of type string or without it.'
    );

    return function(overlayElement) {
        overlayElement.style.position = 'fixed';
        overlayElement.style.display = 'flex';
        overlayElement.style.inset = '0';
        const container = overlayElement.appendChild(document.createElement('div'));

        createAsapRenderEffect(() => {
            let { horizontalAlignment, verticalAlignment, margin } = config;

            isDev && _assertIsOneOf(
                horizontalAlignment,
                ['start', 'center', 'end'],
                'fixedAlignmentStrategy({ horizontalAlignment }): Invalid argument! Expected an object with a "horizontalAlignment" property set to one of ["start", "center", "end"].'
            ) && _assertIsOneOf(
                verticalAlignment,
                ['start', 'center', 'end'],
                'fixedAlignmentStrategy({ verticalAlignment }): Invalid argument! Expected an object with a "verticalAlignment" property set to one of ["start", "center", "end"].'
            ) && _assertIsOptionalString(
                margin,
                'fixedAlignmentStrategy({ margin }): Invalid argument! Expected am object with "margin" property of type string or without it.'
            );

            margin = margin || '';

            if (horizontalAlignment !== 'center') {
                horizontalAlignment = 'flex-' + horizontalAlignment;
            }
            if (verticalAlignment !== 'center') {
                verticalAlignment = 'flex-' + verticalAlignment;
            }
            container.style.margin = margin;
            overlayElement.style.justifyContent = horizontalAlignment;
            overlayElement.style.alignItems = verticalAlignment;
            overlayElement.style.pointerEvents = 'none';
        });

        return container;
    }
}

/**
 * Creates a position strategy that positions an overlay at the specified
 * viewport coordinates.
 *
 * The overlay is positioned from the `top-left` corner by default. When
 * `autoAdjustCorner` is enabled, the strategy automatically selects the
 * corner that provides more available space when the overlay does not fit
 * within the viewport.
 *
 * Configuration values are read inside the {@link createAnimationFrameEffect()}
 * callback, except for `onCornerSelected()`, allowing changes to the configuration to be reflected when the
 * effect is executed.
 *
 * @param config Configuration used to position the overlay.
 * @returns A position strategy for positioning the overlay at the specified coordinates.
 */
export function fixedCoordinateStrategy(config: FixedCoordinateStrategyConfig): PositionStrategy {
    if (__IS_SERVER__) {
        throw new Error('fixedCoordinateStrategy(): This function is not available in a server environment!');
    }
    isDev && _assertIsObjectExcludingArray(
        config,
        'fixedCoordinateStrategy(): Invalid argument! Expected am non-array object.'
    ) && _assertIsNumber(
        config.x,
        'fixedCoordinateStrategy({ x }): Invalid argument! Expected am object with "x" property of type number.'
    ) && _assertIsNotNaN(
        config.x,
        'fixedCoordinateStrategy({ x }): Invalid argument! NaN is not supported.'
    ) && _assertIsNumber(
        config.y,
        'fixedCoordinateStrategy({ y }): Invalid argument! Expected am object with "y" property of type number.'
    ) && _assertIsNotNaN(
        config.y,
        'fixedCoordinateStrategy({ y }): Invalid argument! NaN is not supported.'
    ) && _assertIsOptionalBoolean(
        config.autoAdjustCorner,
        'fixedCoordinateStrategy({ autoAdjustCorner }): Invalid argument! Expected am object with "autoAdjustCorner" property of type boolean or without it.'
    ) && _assertIsOptionalFunction(
        config.onCornerSelected,
        'fixedCoordinateStrategy(): Invalid argument! Expected am object with "onCornerSelected" property of type function or without it.'
    );
    const onCornerSelected = config.onCornerSelected;

    return function(overlayElement) {
        const overlayResize = observeResizing(overlayElement);
        const [getViewportWidth, setViewportWidth] = createSignal(window.innerWidth);
        const [getViewportHeight, setViewportHeight] = createSignal(window.innerHeight);

        let listener: () => void;
        window.addEventListener('resize', (listener = () => {
            setViewportWidth(window.innerWidth);
            setViewportHeight(window.innerHeight);
        }))

        onCleanup(() => window.removeEventListener('resize', listener));

        createAnimationFrameEffect(() => {
            overlayResize();
            let { x, y, autoAdjustCorner } = config;

            isDev && _assertIsNumber(
                x,
                'fixedCoordinateStrategy({ x }): Invalid argument! Expected am object with "x" property of type number.'
            ) && _assertIsNotNaN(
                x,
                'fixedCoordinateStrategy({ x }): Invalid argument! NaN is not supported.'
            ) && _assertIsNumber(
                y,
                'fixedCoordinateStrategy({ y }): Invalid argument! Expected am object with "y" property of type number.'
            ) && _assertIsNotNaN(
                y,
                'fixedCoordinateStrategy({ y }): Invalid argument! NaN is not supported.'
            ) && _assertIsOptionalBoolean(
                autoAdjustCorner,
                'fixedCoordinateStrategy({ autoAdjustCorner }): Invalid argument! Expected am object with "autoAdjustCorner" property of type boolean or without it.'
            );

            const viewportWidth = getViewportWidth();
            const viewportHeight = getViewportHeight();
            const width = overlayElement.offsetWidth;
            const height = overlayElement.offsetHeight;
            
            if (autoAdjustCorner && width > 0 && height > 0) {
                x = Math.max(0, Math.min(x, viewportWidth));
                y = Math.max(0, Math.min(y, viewportHeight));
                
                let xCoordinate: 'left' | 'right' = 'left';
                let yCoordinate: 'top' | 'bottom' = 'top';
                let leftAvailableRatio = (viewportWidth - x) / width;
                let rightAvailableRatio = x / width;
                let topAvailableRatio = (viewportHeight - y) / height;
                let bottomAvailableRatio = y / height;

                if (leftAvailableRatio < 1 && rightAvailableRatio > leftAvailableRatio) {
                    xCoordinate = 'right';
                }

                if (topAvailableRatio < 1 && bottomAvailableRatio > topAvailableRatio) {
                    yCoordinate = 'bottom';
                }
                
                overlayElement.style.left = (x - (xCoordinate === 'left' ? 0 : width)) + 'px';
                overlayElement.style.top = (y - (yCoordinate === 'top' ? 0 : height)) + 'px';
                onCornerSelected?.((yCoordinate + '-' + xCoordinate) as Corner);

            } else {
                overlayElement.style.left = x + 'px';
                overlayElement.style.top = y + 'px';
                onCornerSelected?.('top-left');
            }
        }, true);

        overlayElement.style.position = 'fixed';
        return overlayElement;
    }
}

/**
 * Creates a positioning strategy that connects an overlay to a target element
 * using an ordered list of valid edge connections.
 *
 * Connections that fully fit within the viewport are preferred in the order
 * provided. If none fits, the connection with the highest weighted visible
 * area is selected.
 * 
 * Configuration values are read inside the {@link createAnimationFrameEffect()}
 * callback, except for `onEdgeConnectionSelected()`, allowing changes to the configuration to be reflected when the
 * effect is executed.
 *
 * @param config - Configuration defining the target element and possible edge
 * connections.
 * @returns A positioning strategy that positions the overlay relative to the
 * target element.
 */
export function connectedEdgesPositionStrategy(config: StrictConnectedEdgesStrategyConfig): PositionStrategy;
export function connectedEdgesPositionStrategy(config: ConnectedEdgesStrategyConfig): PositionStrategy {
    if (__IS_SERVER__) {
        throw new Error('connectedEdgesPositionStrategy(): This function is not available in a server environment!');
    }
    if (isDev) {
        _assertIsObjectExcludingArray(
            config,
            'connectedEdgesPositionStrategy(): Invalid argument! Expected an non-array object.'
        );
        _assertIsFunction(
            config.targetGetter,
            'connectedEdgesPositionStrategy({ targetGetter }): Invalid argument! Expected an object with "targetGetter" property of type function.'
        );
        _assertIsTrue(
            Array.isArray(config.connections),
            'connectedEdgesPositionStrategy({ connections }): Invalid argument! Expected an object with "connections" property of type array.'
        );
        _assertIsTrue(
            config.connections.length > 0,
            'connectedEdgesPositionStrategy({ connections }): Invalid argument! The "connections" property can not be an empty array.'
        );
        _assertIsOptionalBoolean(
            config.push,
            'connectedEdgesPositionStrategy({ push }): Invalid argument! Expected an object with "push" property of type boolean or without it.'
        );

        const connections = config.connections;
        for (let i = 0; i < connections.length; i++) {
            _assertIsEdgeConnection(
                connections[i],
                'connectedEdgesPositionStrategy(): Invalid edge connection! Expected an object with "targetEdge" and "overlayEdge" properties,' +
                ' and optional numeric "offsetX", "offsetY", and "weight" properties.'
            );
            _assertIsValidConnection(
                connections[i].targetEdge,
                connections[i].overlayEdge,
                `connectedEdgesPositionStrategy({ connections[${i}] }): Invalid edge pair! Following are allowed: ${JSON.stringify(_validConnections)}`
            );
        }
    }

    const onEdgeConnectionSelected = config.onEdgeConnectionSelected;

    return function(overlayElement) {
        const [getViewportWidth, setViewportWidth] = createSignal(window.innerWidth);
        const [getViewportHeight, setViewportHeight] = createSignal(window.innerHeight);
        const [scrolled, notifyScroll] = createSignal<void>(undefined, { equals: () => false });
        const overlayResize = observeResizing(overlayElement);
        const docMutationRecord = observerMutations(document);
        let currentTarget: Element | null = null;
        let targetResizeDisposer: (() => void) | null = null;
        let targetResize: Accessor<ResizeObserverEntry | null> | null = null;

        const disposalOwner = getOwner();

        const getTargetRect = createLazyMemo(disposalOwner, () => {
            const { targetGetter } = config

            isDev && _assertIsFunction(
                targetGetter,
                'connectedEdgesPositionStrategy({ targetGetter }): Invalid argument! Expected an object with "targetGetter" property of type function.'
            )

            const target = targetGetter()

            isDev && _assertIsElement(
                target,
                'connectedEdgesPositionStrategy({ targetGetter }): Invalid return type of "targetGetter"! Expected an element instance.'
            )

            if (currentTarget !== target) {
                currentTarget = target;
                targetResizeDisposer?.();
                targetResizeDisposer = createRoot((dispose) => {
                    targetResize = observeResizing(target);
                    return dispose;
                })
            }

            targetResize!();
            docMutationRecord();
            scrolled();
            
            return target.getBoundingClientRect();
        }, undefined, {
            equals: (prev, next) => (
                    prev.top === next.top &&
                    prev.left === next.left &&
                    prev.bottom === next.bottom &&
                    prev.right === next.right
                )
            
        });

        const getOverlayRect = createLazyMemo(disposalOwner, () => {
            overlayResize();
            return overlayElement.getBoundingClientRect();
        }, undefined, {
            equals: (prev, next) => (
                    prev.width === next.width &&
                    prev.height === next.height
                )
            
        })

        let resizeListener: () => void;
        window.addEventListener('resize', (resizeListener = () => {
            setViewportWidth(window.innerWidth);
            setViewportHeight(window.innerHeight);
        }));

        let scrollListener: () => void;
        const listenerConfig = normalizePassiveListenerOptions({ capture: true, passive: true });
        document.addEventListener('scroll', (scrollListener = () => notifyScroll()), listenerConfig);

        onCleanup(() => {
            targetResizeDisposer?.();
            window.removeEventListener('resize', resizeListener);
            document.removeEventListener('scroll', scrollListener, listenerConfig);
        });

        createAnimationFrameEffect(() => {
            const { connections, push } = config;
            
            isDev && _assertIsTrue(
                Array.isArray(connections),
                'connectedEdgesPositionStrategy({ connections }): Invalid argument! Expected an object with "connections" property of type array.'
            ) && _assertIsOptionalBoolean(
                push,
                'connectedEdgesPositionStrategy({ push }): Invalid argument! Expected an object with "push" property of type boolean or without it.'
            );

            const connectionsLength = connections.length;

            isDev && _assertIsTrue(
                connectionsLength > 0,
                'connectedEdgesPositionStrategy({ connections }): Invalid argument! The "connections" property can not be an empty array.'
            );

            const targetRect = getTargetRect();
            const { width, height } = getOverlayRect();
            const viewportWidth = getViewportWidth();
            const viewportHeight = getViewportHeight();

            let top = 0;
            let left = 0;
            let bottom = 0;
            let right = 0;
            let originX = 0;
            let originY = 0;
            let currentScore = -1;
            let fit = false;
            let targetEdge = '' as Edge;
            let overlayEdge = '' as Edge;
            let connection: EdgeConnection = null!;

            let dashIndex = 0;

            for (let i = 0; i < connectionsLength; i++) {
                const currentConnection = connections[i]
                const {  offsetX, offsetY, targetEdge: localTEdge, overlayEdge: localOEdge, weight } = currentConnection;

                isDev && _assertIsEdgeConnection(
                    currentConnection,
                    'connectedEdgesPositionStrategy(): Invalid edge connection! Expected an object with "targetEdge" and "overlayEdge" properties, ' +
                    'and optional numeric "offsetX", "offsetY", and "weight" properties.'
                ) && _assertIsValidConnection(
                    localTEdge,
                    localOEdge,
                    `connectedEdgesPositionStrategy({ connections[${i}] }): Invalid edge pair! Following are allowed: ${JSON.stringify(_validConnections)}`
                );

                dashIndex = localTEdge.indexOf('-');
                const xTargetCoordinate = localTEdge.substring(dashIndex + 1) as 'left' | 'center' | 'right';
                const yTargetCoordinate = localTEdge.substring(0, dashIndex) as 'top' | 'center' | 'bottom';
                dashIndex = localOEdge.indexOf('-');
                const xOverlayCoordinate = localOEdge.substring(dashIndex + 1) as 'left' | 'center' | 'right';
                const yOverlayCoordinate = localOEdge.substring(0, dashIndex) as 'top' | 'center' | 'bottom';
                const localOriginX = _getOriginX(xTargetCoordinate, targetRect);
                const localOriginY = _getOriginY(yTargetCoordinate, targetRect);
                const localTop = _getOverlayTop(yOverlayCoordinate, height, localOriginY) + (offsetY || 0);
                const localLeft = _getOverlayLeft(xOverlayCoordinate, width, localOriginX) + (offsetX || 0);
                const localBottom = localTop + height;
                const localRight = localLeft + width;

                if (
                    localTop >= 0 &&
                    localLeft >= 0 &&
                    localBottom <= viewportHeight &&
                    localRight <= viewportWidth
                ) {
                    top = localTop;
                    left = localLeft;
                    bottom = localBottom;
                    right = localRight;
                    originX = localOriginX;
                    originY = localOriginY;
                    targetEdge = localTEdge;
                    overlayEdge = localOEdge;
                    connection = currentConnection;
                    fit = true;
                    break;
                }

                const visibleLeft = Math.max(localLeft, 0);
                const visibleTop = Math.max(localTop, 0);
                const visibleRight = Math.min(localRight, viewportWidth);
                const visibleBottom = Math.min(localBottom, viewportHeight);

                const visibleWidth = Math.max(0, visibleRight - visibleLeft);
                const visibleHeight = Math.max(0, visibleBottom - visibleTop);

                const score = Math.max(0, (weight ?? 1)) * visibleWidth * visibleHeight;

                if (currentScore < score) {
                    currentScore = score;
                    top = localTop;
                    left = localLeft;
                    bottom = localBottom;
                    right = localRight;
                    originX = localOriginX;
                    originY = localOriginY;
                    targetEdge = localTEdge;
                    overlayEdge = localOEdge;
                    connection = currentConnection;
                }
            }

            if (!fit && push) {
                const originalTop = top;
                const originalBottom = bottom;
                const originalLeft = left;
                const originalRight = right;

                const overflowLeft = originalLeft < 0;
                const overflowRight = originalRight > viewportWidth;
                const overflowTop = originalTop < 0;
                const overflowBottom = originalBottom > viewportHeight;

                const overflowX = overflowLeft || overflowRight;
                const overflowY = overflowTop || overflowBottom;

                if (overflowX) {
                    if (overflowLeft) {
                        left = 0;
                        right = left + width;
                    } else {
                        right = viewportWidth;
                        left = right - width;
                    }
                }

                if (overflowY) {
                    if (overflowTop) {
                        top = 0;
                        bottom = top + height;
                    } else {
                        bottom = viewportHeight;
                        top = bottom - height;
                    }
                }

                if (_isOppositeCornerConnection(targetEdge, overlayEdge)) {
                    let pushHorizontal = false;
                    let pushVertical  = false;

                    if (overlayEdge === 'top-left' && !(left >= originX && top >= originY)) {
                        if (left < originX) {
                            left = originX;
                            right = left + width;
                        }
                        if (top < originY) {
                            top = originY;
                            bottom = top + height;
                        }
                        
                        if (originalLeft >= originX && originalTop < originY) {
                            pushVertical  = true;
                        } else if (originalLeft < originX && originalTop >= originY) {
                            pushHorizontal = true;
                        } else if (originalLeft >= originX && originalTop >= originY) {
                            if (
                                Math.min(width, Math.max(0, viewportWidth - left)) * height < width * Math.min(height, Math.max(0, viewportHeight - top))
                            ) {
                                pushHorizontal = true;
                            } else {
                                pushVertical  = true;
                            }
                        } else {
                            pushHorizontal = true;
                            pushVertical  = true;
                        }
                    } else if (overlayEdge === 'top-right' && !(right <= originX && top >= originY)) {
                        if (right > originX) {
                            right = originX;
                            left = right - width;
                        }
                        if (top < originY) {
                            top = originY;
                            bottom = top + height;
                        }
                        if (originalRight <= originX && originalTop < originY) {
                            pushVertical  = true;
                        } else if (originalRight > originX && originalTop >= originY) {
                            pushHorizontal = true;
                        } else if (originalRight <= originX && originalTop >= originY) {
                            if (
                                Math.min(width, Math.max(0, right)) * height < width * Math.min(height, Math.max(0, viewportHeight - top))
                            ) {
                                pushHorizontal = true;
                            } else {
                                pushVertical  = true;
                            }
                        } else {
                            pushHorizontal = true;
                            pushVertical  = true;
                        }
                    } else if (overlayEdge === 'bottom-right' && !(right <= originX && bottom <= originY)) {
                        if (right > originX) {
                            right = originX;
                            left = right - width;
                        }
                        if (bottom > originY) {
                            bottom = originY;
                            top = bottom - height;
                        }
                        if (originalRight <= originX && originalBottom > originY) {
                            pushVertical  = true;
                        } else if (originalRight > originX && originalBottom <= originY) {
                            pushHorizontal = true;
                        } else if (originalRight <= originX && originalBottom <= originY) {
                            if (
                                Math.min(width, Math.max(0, right)) * height < width * Math.min(height, Math.max(0, bottom))
                            ) {
                                pushHorizontal = true;
                            } else {
                                pushVertical  = true;
                            }
                        } else {
                            pushHorizontal = true;
                            pushVertical  = true;
                        }
                    } else if (overlayEdge === 'bottom-left' && !(left >= originX && bottom <= originY)) {
                        if (left < originX) {
                            left = originX;
                            right = left + width;
                        }
                        if (bottom > originY) {
                            bottom = originY;
                            top = bottom - height;
                        }
                        if (originalLeft >= originX && originalBottom > originY) {
                            pushVertical  = true;
                        } else if (originalLeft < originX && originalBottom <= originY) {
                            pushHorizontal = true;
                        } else if (originalLeft >= originX &&  originalBottom <= originY) {
                            if (
                                Math.min(width, Math.max(0, viewportWidth - left)) * height < width * Math.min(height, Math.max(0, bottom))
                            ) {
                                pushHorizontal = true;
                            } else {
                                pushVertical  = true;
                            }
                        } else {
                            pushHorizontal = true;
                            pushVertical  = true;
                        }
                    }

                    if (pushHorizontal) {
                        if (left < 0) {
                            left = 0;
                        } else if (right > viewportWidth) {
                            left = viewportWidth - width;
                        }
                    }

                    if (pushVertical) {
                        if (top < 0) {
                            top = 0;
                        } else if (bottom > viewportHeight) {
                            top = viewportHeight - height;
                        }
                    }

                } else {
                    if (targetEdge.startsWith('top') && overlayEdge.startsWith('bottom') && originalBottom <= originY) {
                        top = Math.min(top, originY - height);
                    } else if (targetEdge.startsWith('bottom') && overlayEdge.startsWith('top') && originalTop >= originY) {
                        top = Math.max(top, originY);
                    } else if (targetEdge.endsWith('left') && overlayEdge.endsWith('right') && originalRight <= originX) {
                        left = Math.min(left, originX - width);
                    } else if (targetEdge.endsWith('right') && overlayEdge.endsWith('left') && originalLeft >= originX) {
                        left = Math.max(left, originX);
                    }
                }
            }

            overlayElement.style.top = top + 'px';
            overlayElement.style.left = left + 'px';
            onEdgeConnectionSelected?.(connection);
        }, true);

        overlayElement.style.position = 'fixed';
        return overlayElement;
    }
}

function _getOriginX(coordinate: 'left' | 'center' | 'right', rect: DOMRect): number {
    switch (coordinate) {
        case 'left':
            return rect.left;
        case 'center':
            return rect.left + rect.width / 2;
        case 'right':
            return rect.right;
    }
}

function _getOriginY(coordinate: 'top' | 'center' | 'bottom', rect: DOMRect): number {
    switch (coordinate) {
        case 'top':
            return rect.top;
        case 'center':
            return rect.top + rect.height / 2;
        case 'bottom':
            return rect.bottom
    }
}

function _getOverlayTop(coordinate: 'top' | 'center' | 'bottom', overlayHeight: number, originY: number): number {
    switch (coordinate) {
        case 'top':
            return originY;
        case 'center':
            return originY - overlayHeight / 2;
        case 'bottom':
            return originY - overlayHeight;
    }
}

function _getOverlayLeft(coordinate: 'left' | 'center' | 'right', overlayWidth: number, originX: number): number {
    switch (coordinate) {
        case 'left':
            return originX;
        case 'center':
            return originX - overlayWidth / 2;
        case 'right':
            return originX - overlayWidth;
    }
}

function _isOppositeCornerConnection(targetEdge: Edge, overlayEdge: Edge): boolean {
    return (
        (targetEdge === 'top-left' && overlayEdge === 'bottom-right') ||
        (targetEdge === 'top-right' && overlayEdge === 'bottom-left') ||
        (targetEdge === 'bottom-right' && overlayEdge === 'top-left') ||
        (targetEdge === 'bottom-left' && overlayEdge === 'top-right')
    );
}