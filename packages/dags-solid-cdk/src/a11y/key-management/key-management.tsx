/**
 * @license
 * Copyright (c) 2026 dags-solid-cdk contributors.
 * Licensed under the MIT License.
 */
import { Accessor, batch, createComputed, createContext, createRoot, createSignal, getOwner, onCleanup, Setter, untrack, useContext } from "solid-js";
import { _cancelTask, _createTaskObject, _scheduleAsapTask } from "../../internals/schedulers";
import { isDev } from "solid-js/web";
import { _assertExpectedNumber, _assertIsAllowedModifierKeysConfig, _assertIsBoolean, _assertIsElement, _assertIsElementWithFocus, _assertIsFalse, _assertIsFalsy, _assertIsFiniteNumber, _assertIsFunction, _assertIsInOwningContext, _assertIsNotNaN, _assertIsNumber, _assertIsObjectExcludingArray, _assertIsOptionalBoolean, _assertIsOptionalFiniteNumber, _assertIsOptionalNotNaN, _assertIsOptionalNumber, _assertIsOptionalString, _assertIsOptionalTypeaheadConfig, _assertIsOrientationDirection, _assertIsString, _assertIsTrue, _assertIsTruthy } from "../../internals/common-assertions";
import { observerMutations } from "../../observers/observers";
import { _createNotifier } from "../../internals/utils";
import { addDelegatedEventListener } from "../../event-delegation/event-delegation";
import { FocusableElement, focusVia, isFocused } from "../focus-management/focus-management";
import { createLazyMemo } from "../../signals/signals";

/** 
 * This interface is for items that can be passed to a KeyManager.
 * 
 * @see {@link KeyManager.addItem}
 * @see {@link DOMElementKeyManagerItem}
 */
export interface KeyManagerItem {

    /** The unique ID associated with this item. */
    readonly id: string

    /**
     * Indicates whether the item is disabled.
     *
     * Reads of this property must be reactive so that the KeyManager can
     * automatically respond to changes in the disabled state.
     */
    readonly disabled: boolean;

    /** Label for this item. */
    readonly label: string;

    /**
     * Compares this item with another `KeyManagerItem` to determine ordering.
     *
     * Used by the key manager to maintain a stable navigation order.
     *
     * @param target The item to compare against.
     * @returns A negative number if this item precedes the target,
     *          a positive number if it follows the target,
     *          or 0 if both items are considered equal in order.
     */
    compare(target: KeyManagerItem): number;

    /**
     * Called when the item becomes active.
     */
    onActive(): void;

    /**
     * Called when the item loses its active state.
     */
    onInactive(): void;

    /**
     * Invoked after this item has been attached (added) to a key manager.
     * 
     * @param manager The key manager to which this item has been attached.
     */
    onAttached(manager: KeyManager): void;

    /**
     * Invoked after this item has been detached (removed) from a key manager.
     */
    onDetached(): void;
}



/**
 * Manages keyboard interaction, active-item state, and type-ahead navigation
 * for ordered collections of selectable items.
 *
 * `KeyManager` is responsible for translating keyboard input into
 * navigation operations such as moving to the next item, wrapping around the
 * list, page navigation, type-ahead searching, and active descendant
 * management. The manager itself is UI-agnostic and operates on objects
 * implementing {@link KeyManagerItem}.
 *
 * Instances are created using {@link keyManagerBuilder}. The builder
 * configures the desired keyboard behavior (orientation, wrapping, type-ahead,
 * page navigation, modifier keys, etc.) and finally produces a configured
 * manager via {@link KeyManagerBuilder.build}.
 *
 * Before the manager can be used it **must be bound** to a container element
 * using {@link KeyManager.bind}. Binding installs the internal keyboard
 * event listener and enables item registration.
 *
 * Items are registered automatically when using
 * {@link DOMElementKeyManagerItem}, or manually by calling
 * {@link KeyManager.addItem} when implementing custom item types.
 *
 * ## Typical usage
 *
 * ```tsx
 * const manager = keyManagerBuilder()
 *   .withVerticalOrientation()
 *   .withWrap()
 *   .withHomeAndEnd()
 *   .withTypeAhead()
 *   .withFocus()
 *   .build();
 *
 * return (
 *   <ul ref={manager.bind}>
 *     <For each={data()}>
 *       {(item) => (
 *         <li ref={keyMangerItem}/>{data}</li>
 *       )}
 *     </For>
 *   </ul>
 * );
 * ```
 *
 * Example `Option` component:
 *
 * ## Active item
 *
 * The manager keeps track of a single active item. Depending on the
 * configuration, activating an item may also move DOM focus to it.
 *
 * When working with ARIA active-descendant patterns, the manager updates
 * `aria-activedescendant` on the bound container while leaving DOM focus on
 * the container itself.
 *
 * ## Reactivity
 *
 * The following properties are reactive and can be used directly inside SolidJS
 * reactive computations:
 *
 * - {@link activeItem}
 * - {@link activeItemIndex}
 * - {@link typeAheadBuffer}
 * - {@link typing}
 * - {@link itemsCount}
 *
 * ## Lifetime
 *
 * A manager should be created inside a SolidJS owner (typically inside a
 * component). It is automatically disposed together with its owner and must not
 * be used afterwards.
 *
 * @see {@link KeyManagerBuilder}
 * @see {@link KeyManagerItem}
 * @see {@link keyManagerItem}
 * @see {@link focusableKeyManagerItem}
 * @see {@link DOMElementKeyManagerItem}
 * @see {@link FocusableDOMElementKeyManagerItem}
 * @see {@link DOMElementKeyManagerItem}
 * @see {@link keyManagerBuilder}
 */
export interface KeyManager {

    /**
     * ⚡📡⚡📡
     * The active item.
     * @reactive
     */
    readonly activeItem: KeyManagerItem | null

    /**
     * ⚡📡⚡📡
     * Index of the currently active item. I there isn't any active item, then -1.
     * @reactive
     */
    readonly activeItemIndex: number;
    /**
     * ⚡📡⚡📡
     * The number of items currently managed by the KeyManager.
     * @reactive
     */
    readonly itemsCount: number;

    /**
     * ⚡📡⚡📡
     * The current type-ahead buffer built from user key input.
     *
     * This value represents the accumulated characters used for
     * type-ahead navigation within the list.
     *
     * An empty string (`""`) indicates that type-ahead mode is inactive.
     *
     * The buffer is automatically reset when:
     * - the configured debounce interval elapses,
     * - the active item changes,
     * - the user presses Escape,
     * - or a new navigation context is started.
     * @reactive
     */
    readonly typeAheadBuffer: string;

    /**
     * Indicates whether Home and End key navigation is enabled.
     *
     * When enabled, the Home key moves to the first item and the End key moves
     * to the last item.
     *
     * @default false when not configured in the builder
     */
    readonly homeAndEndEnabled: boolean;

    /**
     * ⚡📡⚡📡
     * Gets whether the user is currently typing into the manager using the typeahead feature.
     * @reactive
     */
    readonly typing: boolean;

    /**
     * Indicates whether the key manager has been disposed.
     *
     * Once disposed, the manager can no longer be used to bind keyboard handlers.
     */
    readonly disposed: boolean;

    /**
     * The number of items to skip when using `page up` and `page down` keys;
     * Coerced to integer no lesser then 1 if those keys have been enabled in builder.
     * Coerced to 0 if those keys haven't been enabled in builder.
     */
    pageUpAndDownDelta: number;

    /**
     * The number of items to skip when using the secondary orientation keys.
     * For a horizontal orientation, these are ArrowUp and ArrowDown.
     * For a vertical orientation, these are ArrowLeft and ArrowRight.
     * Use a negative value to invert the navigation direction.
     * 
     * @default 0
     */
    jumpStep: number

    /**
     * Gets or sets the debounce interval, in milliseconds, used to reset the
     * type-ahead buffer after user input.
     *
     * A value of `0` disables type-ahead functionality.
     *
     * If type-ahead support was not configured when the manager was created,
     * this property always returns `0`, and assigning a value has no effect.
     *
     * Assigned values are coerced to a non-negative integer.
     *
     * @default 0 when type-ahead was not configured in the builder
     */
    typeAheadDebounceInterval: number;

    /**
     * Sets the active item to the specified item or specified index.
     * @param item The item to be set as active.
     * 
     * @returns `true` if a new item was set as active; otherwise, returns `false`.
     */
    setActive(itemOrIndex: KeyManagerItem | number): boolean;

    /**
     * Clears the active item.
     *
     * After calling this method, `activeItem` is `null` and
     * `activeItemIndex` is `-1`.
     *
     * @returns `true` if the active item was cleared; otherwise `false` if no
     * active item was present.
     */
    clearActive(): boolean;

    /**
     * Gets the item at the specified index.
     *
     * @param index The zero-based index of the item to retrieve.
     * @returns The item at the specified index, or `undefined` if the index
     * is out of range.
     */
    getItemAt(index: number): KeyManagerItem | null;

    /**
     * Binds this key manager to a container element.
     *
     * Once bound, the key manager listens for keyboard events dispatched from
     * the container and manages keyboard navigation for the registered items.
     *
     * @param targetContainer The container element to attach the key manager to.
     * @throws Error if manager is already bound.
     * @throws Error if it is used in a server environment.
     */
    bind(targetContainer: Element): void;
    
    /**
     * Sets the active item to the first enabled item in the list.
     * 
     * @returns `true` if a new item was set as active; otherwise, returns `false`.
     */
    setFirstItemActive(): boolean;

    /**
     * Sets the active item to the first enabled item in the list.
     * 
     * @returns `true` if a new item was set as active; otherwise, returns `false`.
     */
    setLastItemActive(): boolean;

    /**
     * Sets the active item to the next enabled item in the list.
     * 
     * @returns `true` if a new item was set as active; otherwise, returns `false`.
     */
    setNextItemActive(): boolean;

    /**
     * Sets the active item to a previous enabled item in the list.
     * 
     * @returns `true` if a new item was set as active; otherwise, returns `false`.
     */
    setPreviousItemActive(): boolean;

    /**
     * Jumps backward by the current page delta and activates the first enabled
     * item encountered.
     *
     * Wrapping is not applied.
     * 
     * @returns `true` if a new item was set as active; otherwise, returns `false`.
     */
    movePageUp(): boolean;

    /**
     * Jumps forward by the current page delta and activates the first enabled
     * item encountered.
     *
     * Wrapping is not applied.
     * 
     * @returns `true` if a new item was set as active; otherwise, returns `false`.
     */
    movePageDown(): boolean;

    /**
     * Jumps forward from current active item index by the given
     * `jumpStep`and sets the new active item from the new position.
     * 
     * @returns `true` if a new item was set as active; otherwise, returns `false`.
     */
    jumpForward(): boolean;

    /**
     * Jumps backward from current active item index by the given 
     * `jumpStep` and sets the new active item from the new position.
     * 
     * @returns `true` if a new item was set as active; otherwise, returns `false`.
     */
    jumpBackward(): boolean;

    /**
     * Registers a listener invoked when the active item becomes disabled.
     *
     * The listener is executed after the active item has been cleared
     * (`activeItem` is `null` and `activeItemIndex` is `-1`). Components may
     * use this event to restore another active item or perform custom behavior.
     *
     * @param listener A listener invoked when the active item becomes disabled.
     * Receives the current {@link KeyManager} instance, the disabled item and
     * its position in the managed item collection.
     * @returns A function that unregisters the listener.
     */
    onActiveItemDisabled(listener: (manager: KeyManager, item: KeyManagerItem, index: number) => void): () => void;

    /**
     * Registers a callback invoked when the active item is removed.
     *
     * The callback is executed after the active item has been cleared
     * (`activeItem` is `null` and `activeIndex` is `-1`). Components may
     * use this event to restore another active item or perform custom
     * cleanup.
     *
     * @param listener A listener invoked when the active item is removed.
     * Receives the current {@link KeyManager} instance.
     * @returns A function that unregisters the listener.
     */
    onActiveItemRemoved(listener: (manager: KeyManager) => void): () => void;

    /**
     * Registers a listener that is invoked when the Tab key is pressed.
     *
     * @param listener The listener to invoke.
     * @returns A function that unregisters the listener.
     */
    onTabOut(listener: (manager: KeyManager, event: KeyboardEvent) => void): () => void;

    /**
     * Adds an item to the managed list.
     *
     * @param item The item to add.
     * @throws Error if manager is not bound to element.
     * @throws Error if item already belongs to other manager.
     */
    addItem(item: KeyManagerItem): void;

    /**
     * Removes an item from the managed list.
     *
     * @param item The item to remove.
     */
    removeItem(item: KeyManagerItem): void;

    /**
     * Cancels the current typeahead sequence.
     */
    cancelTypeahead(): void;

    /**
     * Provides this instance to context.
     * 
     * @param props A component props object with children only.
     * @throws Error if is not bound to container element.
     * @throws Error if is disposed.
     */
    Provider(props: { children: any }): any;
}

type _ModifierKey = 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey';

/** Default values: all properties are `false`. */
export interface AllowedModifierKeysConfig {
    /** Whether the Alt key is allowed. */
    altKey?: boolean;

    /** Whether the Control key is allowed. */
    ctrlKey?: boolean;

    /** Whether the Meta (Command/Windows) key is allowed. */
    metaKey?: boolean;

    /** Whether the Shift key is allowed. */
    shiftKey?: boolean;
}

/** 
 * Configuration for type-ahead navigation.
 * 
 * @see {@link KeyManagerBuilder.withTypeAhead}
 */
interface TypeAheadConfig {
    /**
     * The debounce interval, in milliseconds, used to reset the typed buffer.
     *
     * @default 200
     */
    debounceInterval?: number;

    /**
     * Reduces the current type-ahead buffer using the incoming key.
     *
     * The reducer is responsible for controlling how typed keys are accumulated
     * into the search buffer used for type-ahead navigation.
     *
     * Default implementation only accepts single-character alphanumeric keys
     * and appends them to the buffer:
     *
     * ```ts
     * (buffer, key) =>
     *   key.length === 1 &&
     *   ((key >= 'A' && key <= 'z') || (key >= '0' && key <= '9'))
     *     ? buffer + key
     *     : buffer
     * ```
     *
     * @param buffer The current accumulated type-ahead buffer.
     * @param key The newly pressed key.
     * @returns The updated buffer string.
     */
    reducer?: (buffer: string, key: string) => string;

    /**
     * Whether type-ahead matching is case-sensitive.
     *
     * @default false
     */
    caseSensitive?: boolean;

    /**
     * Determines whether each word in an item's label should be treated as an
     * independent prefix during type-ahead matching.
     *
     * When enabled, the search buffer may contain multiple prefixes separated by
     * whitespace. Each prefix is matched against the beginning of a corresponding
     * word in the label while preserving word order.
     *
     * For example, the label `"New York City"` matches:
     * - `"new"`
     * - `"yor"`
     * - `"new ci"`
     * - `"yo ci"`
     *
     * But does not match:
     * - `"ci yo"`
     *
     * When disabled, matching is performed only against the beginning of the
     * entire label.
     *
     * @default false
     */
    eachWordAsPrefix?: boolean;

}

/**
 * A builder for configuring and creating a {@link KeyManager}.
 * 
 * @see {@link keyManagerBuilder}
 */
export interface KeyManagerBuilder {
    /**
     * Sets the function used to retrieve an item's accessible name.
     *
     * By default, the built-in manager uses a simple implementation based on
     * `aria-labelledby`, `aria-label`, and `textContent`.
     *
     * @param getAccessibilityNameFn A function that returns the accessible name for an element.
     */
    withAccessibilityNameAccessor(getAccessibilityNameFn: (element: Element) => string): this;

    /**
     * Specifies which modifier keys are allowed when processing keyboard events.
     *
     * Builder default: all modifier keys are disabled.
     * Default manager: all modifier keys are disabled.
     *
     * @param config The modifier key configuration.
     */
    withAllowedModifierKeys(config: AllowedModifierKeysConfig): this;

    /**
     * Enables or disables Home and End key navigation.
     *
     * Builder default: `true`.
     * Default manager: `false`.
     *
     * @param enabled Whether Home and End key handling should be enabled.
     */
    withHomeAndEnd(enabled?: boolean): this;

    /**
     * Enables horizontal navigation. The primary navigation keys are
     * `arrow left` and `arrow right`
     *
     * @param direction The horizontal text direction.
     * @param jumpStep The number of items to skip when using the secondary
     * navigation keys. Defaults to `0`. The secondary keys for this orientation
     * are `arrow up` and `arrow down`. For inverted behavior use negative values.
     * It is useful for scenarios where items are placed in grid-ish layout and
     * `jumpStep` represents number of columns.
     *
     * Builder default: `jumpStep = 0`.
     * Default manager: `jumpStep = 0`.
     * 
     * @see {@link horizontalLtrOrientationKeyboardHandler}
     * @see {@link horizontalRtlOrientationKeyboardHandler}
     * @see {@link verticalOrientationKeyboardHandler}
     */
    withHorizontalOrientation(direction: "ltr" | "rtl", jumpStep?: number): this;

    /**
     * Registers a custom keyboard event handler.
     *
     * The handler is executed during keyboard event processing and can be used
     * to implement custom key behavior or extend the behavior of predefined
     * keyboard handlers.
     *
     * The handler must return `true` when the keyboard event has been handled.
     * Returning `true` prevents the remaining keyboard processing pipeline from
     * executing, including built-in features such as type-ahead handling.
     *
     * Calling `event.preventDefault()` inside the handler is not allowed and will
     * cause the manager to throw an error. To stop further processing, return
     * `true` instead.
     *
     * The predefined keyboard handlers can be used as a base and extended with
     * custom cases. For example:
     *
     * ```ts
     * const verticalHandler = verticalOrientationKeyboardHandler();
     *
     * keyManagerBuilder().withKeyboardHandler((manager, event) => {
     *     if (verticalOrientationKeyboardHandlerHandler(manager, event)) {
     *         return true;
     *     }
     *
     *     if (event.key === 'Enter') {
     *         // Custom Enter key handling
     *         return true;
     *     }
     *
     *     return false;
     * }).build();
     * ```
     *
     * @param handler A callback invoked with the manager instance and keyboard
     * event. Returns `true` if the event has been handled and further processing
     * should be skipped.
     * 
     * @see {@link horizontalLtrOrientationKeyboardHandler}
     * @see {@link horizontalRtlOrientationKeyboardHandler}
     * @see {@link verticalOrientationKeyboardHandler}
     */
    withKeyboardHandler(handler: (manger: KeyManager, event: KeyboardEvent) => boolean): this;
    /**
     * Registers a custom keyboard event handler with a custom jump step.
     *
     * The handler is executed during keyboard event processing and can be used
     * to implement custom key behavior or extend the behavior of predefined
     * keyboard handlers.
     *
     * The handler must return `true` when the keyboard event has been handled.
     * Returning `true` prevents the remaining keyboard processing pipeline from
     * executing, including built-in features such as type-ahead handling.
     *
     * Calling `event.preventDefault()` inside the handler is not allowed and will
     * cause the manager to throw an error. To stop further processing, return
     * `true` instead.
     *
     * The `jumpStep` value can be used by predefined orientation keyboard handlers
     * to control the amount of items skipped during grid-like navigation.
     *
     * Example:
     *
     * ```ts
     * const verticalHandler = verticalOrientationKeyboardHandler(jumpStep);
     *
     * keyManagerBuilder().withKeyboardHandler(jumpStep, (manager, event) => {
     *     if (verticalOrientationKeyboardHandlerHandler(manager, event)) {
     *         return true;
     *     }
     *
     *     if (event.key === 'Enter') {
     *         // Custom Enter key handling
     *         return true;
     *     }
     *
     *     return false;
     * }).build();
     * ```
     *
     * @param jumpStep The number of items skipped by predefined keyboard handlers
     * during vertical or horizontal grid navigation.
     * @param handler A callback invoked with the manager instance and keyboard
     * event. Returns `true` if the event has been handled and further processing
     * should be skipped.
     * 
     * @see {@link horizontalLtrOrientationKeyboardHandler}
     * @see {@link horizontalRtlOrientationKeyboardHandler}
     * @see {@link verticalOrientationKeyboardHandler}
     */
    withKeyboardHandler(jumpStep: number, handler: (manger: KeyManager, event: KeyboardEvent) => boolean): this;

    /**
     * Enables or disables Page Up and Page Down navigation.
     *
     * Builder defaults: `enabled = true`, `delta = 10`.
     * Default manager: `enabled = false`, `delta = 0`.
     *
     * @param enabled Whether Page Up and Page Down handling should be enabled.
     * @param delta The number of items to move for each page navigation,
     *              Coerced to integer no lesser then 1 if `enabled` is `true`.
     *              Coerced to 0 if `enabled` is `false`.
     */
    withPageUpDown(enabled?: boolean, delta?: number): this;

    /**
     * Sets the predicate used to determine whether an item should be skipped
     * during keyboard navigation.
     * 
     * If the predicate does not return true for a disabled item, an error will be thrown.
     *
     * Default manager: `(item) => item.disabled`.
     *
     * @param predicate The predicate used to skip items.
     */
    withSkipPredicate(predicate: (item: KeyManagerItem) => boolean): this;

    /**
     * Enables and configures type-ahead navigation.
     *
     * Builder default: uses the default {@link TypeAheadConfig} values.
     * Default manager: type-ahead is disabled.
     *
     * @param config The type-ahead configuration.
     */
    withTypeAhead(config?: TypeAheadConfig): this;

    /**
     * Enables vertical navigation.The primary navigation keys are
     * `arrow up` and `arrow down`
     *
     * @param jumpStep The number of items to skip when using the secondary
     * navigation keys. Defaults to `0`.  The secondary keys for this orientation
     * are `arrow left` and `arrow right`. For inverted behavior use negative values.
     * It is useful for scenarios where items are placed in grid-ish layout and
     * `jumpStep` represents number of rows.
     */
    withVerticalOrientation(jumpStep?: number): this;

    /**
     * Enables or disables wrapping navigation.
     *
     * Builder default: `true`.
     * Default manager: `false`.
     *
     * @param shouldWrap Whether navigation should wrap at the list boundaries.
     */
    withWrap(shouldWrap?: boolean): this;

    /**
     * Creates a new {@link KeyManager} using the current builder configuration.
     *
     * @returns A configured `KeyManager` instance.
     */
    build(): KeyManager;
}

interface _KeyManagerConfig {
    jumpStep: number;
    allowedModifierKeys: _ModifierKey[];
    keyboardHandler: (manager: KeyManager, e: KeyboardEvent) => boolean;//true if key was handled.
    pageUpDownDelta: number;
    homeAndEndEnabled: boolean;
    shouldWrap: boolean;
    typeaheadConfig: Required<TypeAheadConfig> | null;
    skipPredicate: (item: KeyManagerItem) => boolean;
    getAccessibilityNameFn: ((element: Element) => string) | null;
}

const enum _OperableKey {
    ArrowUp = 'ArrowUp',
    ArrowDown = 'ArrowDown',
    ArrowLeft = 'ArrowLeft',
    ArrowRight = 'ArrowRight',
    Tab = 'Tab',
    Escape = 'Escape',
    Home = 'Home',
    End = 'End',
    PageUp = 'PageUp',
    PageDawn = 'PageDown',

}

const _KEY_MANAGER = /** @__PURE__ */ Symbol('KeyManager');

const _containerBinding: WeakMap<Element, KeyManager> = isDev ? new WeakMap() : null!;

const _itemBinding: WeakMap<Element, KeyManagerItem> = isDev ? new WeakMap() : null!;

const _managerContext = createContext<_KeyManagerImpl>(null!);

const _accNameGetterContext = createContext<(element: Element) => string>(null!);

/**
 * Retrieves the current {@link KeyManager} from context.
 *
 * This hook returns the nearest `KeyManager` provided by
 * {@link KeyManager.Provide}.
 *
 * Returns `null` when called outside a `KeyManager` context.
 *
 * @returns The current {@link KeyManager}, or `null` if no manager is
 * available.
 */
export function useKeyManger(): KeyManager | null {
    return useContext(_managerContext) || null
}

/**
 * Retrieves the current accessibility name accessor from context.
 *
 * The returned function is used by DOM-backed list key manager items to obtain
 * an element's accessible name for type-ahead matching and other accessibility
 * related features.
 *
 * If no accessor has been explicitly provided via
 * {@link AccessabilityNameAccessorProvider}, the accessor configured on the
 * current {@link KeyManager} is returned instead.
 *
 * Returns `null` when neither source is available.
 *
 * @returns The current accessibility name accessor, or `null`.
 * 
 * @see {@link AccessabilityNameAccessorProvider}
 */
export function useAccessibilityNameAccessor(): ((element: Element) => string) | null {
    return useContext(_accNameGetterContext) || useContext(_managerContext)?._getAccName || null;
}

/**
 * Provides an accessibility name accessor to descendant components.
 *
 * Components such as {@link DOMElementKeyManagerItem} consume this accessor
 * to determine an element's accessible name without requiring every component
 * to configure the {@link KeyManager} directly.
 *
 * This provider makes it possible for custom component libraries to encapsulate
 * their accessibility logic while remaining compatible with the list key
 * manager.
 *
 * Nested providers override the accessor from outer providers.
 *
 * @param props.accessor A function that returns the accessible name for a given
 * element.
 * @param props.children The descendant elements that should receive the
 * accessor.
 * 
 * @see {@link useAccessibilityNameAccessor}
 */
export function AccessabilityNameAccessorProvider(props: { accessor: (element: Element) => string, children: any }): any {
    const { accessor } = props;
    return <_accNameGetterContext.Provider value={accessor} children={props.children}/>
}

/**
 * Defers adding an item to a key manager until the current rendering cycle has
 * completed.
 *
 * This helper is intended for framework integrations where a DOM element may
 * not yet have a parent node when a ref callback is invoked. In such cases,
 * adding the item immediately may prevent the key manager from determining the
 * correct document order.
 *
 * Use this helper instead of {@link KeyManager.addItem} when the underlying
 * element has not yet been attached to its parent.
 *
 * @param manager The key manager that the item will be added to.
 * @param item The item to add.
 */
export function deferAddItem(manager: KeyManager, item: KeyManagerItem): void;
export function deferAddItem(manager: KeyManager, item: KeyManagerItem): void {
    if (isDev) {
        if (!(manager instanceof _KeyManagerImpl)) {
            throw new Error('deferAddItem(): Invalid first argument. The first argument must be an instance of the default CDK KeyManager.');
        }
        _assertIsObjectExcludingArray(
            item,
            'deferAddItem(): Invalid second argument! Expected a non-array object.'
        );
    }

    const task = _createTaskObject(() => manager.addItem(item));

    _scheduleAsapTask(task);

    if (getOwner()) {
        onCleanup(() => _cancelTask(task))
    } 
}

/**
 * Creates a new {@link KeyManagerBuilder}.
 *
 * The builder provides a fluent API for configuring keyboard navigation
 * behavior before creating a {@link KeyManager}. Configuration options
 * include orientation, wrapping, type-ahead navigation, page navigation,
 * focus management, accessibility name resolution, and custom keyboard
 * handling.
 *
 * The returned builder is mutable and may be reused to create multiple
 * managers with the same configuration.
 *
 * @returns A new {@link KeyManagerBuilder} instance.
 *
 * @example
 * Create a vertically-oriented manager with wrapping and type-ahead support.
 *
 * ```tsx
 * const manager = keyManagerBuilder()
 *   .withVerticalOrientation()
 *   .withWrap()
 *   .withHomeAndEnd()
 *   .withPageUpDown()
 *   .withTypeAhead()
 *   .withFocus()
 *   .build();
 *
 * return (
 *   <div ref={manager.bind}>
 *     ...
 *   </div>
 * );
 * ```
 *
 * @example
 * Configure a custom keyboard handler.
 *
 * ```ts
 * const manager = keyManagerBuilder()
 *   .withKeyboardHandler((manager, event) => {
 *     if (event.key === 'Enter') {
 *       // Handle Enter.
 *       return true;
 *     }
 *
 *     return verticalOrientationKeyboardHandler(manager, event);
 *   })
 *   .build();
 * ```
 *
 * @see {@link KeyManagerBuilder}
 * @see {@link KeyManager}
 */
export function keyManagerBuilder(): KeyManagerBuilder {

    const config: _KeyManagerConfig = {
        allowedModifierKeys: [],
        getAccessibilityNameFn: _defaultGetAccName,
        homeAndEndEnabled: false,
        jumpStep: 0,
        keyboardHandler: verticalOrientationKeyboardHandler,
        pageUpDownDelta: 0,
        shouldWrap: false,
        skipPredicate: (item) => item.disabled,
        typeaheadConfig: null
    }

    let builded = false;

    function throwIfBuilded(methodName: string): true {
        if (builded) {
            throw new Error(
                'ListKeyManager.' + methodName + '(): This builder has already been used. ' +
                'Create a new builder instance by calling keyManagerBuilder().'
            );
        }

        return true;
    }

    return {
        withAccessibilityNameAccessor(getAccessibilityNameFn) {
            isDev && throwIfBuilded(
                'withAccessibilityNameAccessor'
            ) && _assertIsFunction(
                getAccessibilityNameFn,
                'KeyManagerBuilder.withAccessibilityNameAccessor(): Invalid argument! It must be a function.'
            )
            config.getAccessibilityNameFn = getAccessibilityNameFn;
            return this;
        },
        withAllowedModifierKeys(allowedKeysConfig) {
            isDev && throwIfBuilded(
                'withAllowedModifierKeys'
            ) && _assertIsAllowedModifierKeysConfig(
                allowedKeysConfig,
                'KeyManagerBuilder.withAllowedModifierKeys(): Invalid argument! ' +
                'It must be an object of type { altKey?: boolean, ctrlKey?: boolean, metaKey?: boolean, shiftKey?: boolean }'
            )
            const modifiers = config.allowedModifierKeys;
            if (config.allowedModifierKeys.length) { modifiers.splice(0); }
            if (allowedKeysConfig.altKey) { modifiers.push('altKey'); }
            if (allowedKeysConfig.ctrlKey) { modifiers.push('ctrlKey'); }
            if (allowedKeysConfig.metaKey) { modifiers.push('metaKey'); }
            if (allowedKeysConfig.shiftKey) { modifiers.push('shiftKey'); }
            return this;
        },
        withKeyboardHandler(stepOrHandler, maybeHandler?: any) {
            if (isDev) {
                throwIfBuilded('withKeyboardHandler');
                _assertExpectedNumber(
                    arguments.length,
                    (value) => value > 0,
                    'KeyManagerBuilder.withKeyboardHandler(). Invalid method usage! Expected at least one argument'
                );
                if (arguments.length === 1) {
                    _assertIsFunction(
                        stepOrHandler,
                        'KeyManagerBuilder.withKeyboardHandler(). Invalid argument! It must be a function.'
                    );
                } else {
                    _assertIsNumber(
                        stepOrHandler,
                        'KeyManagerBuilder.withKeyboardHandler(). Invalid first argument! It must be a number.'
                    ) && _assertIsNotNaN(
                        stepOrHandler,
                        'KeyManagerBuilder.withKeyboardHandler(). Invalid first argument! NaN is not supported.'
                    ) && _assertIsFiniteNumber(
                        stepOrHandler,
                        'KeyManagerBuilder.withKeyboardHandler(). Invalid first argument! Infinite numbers are not supported.'
                    ) && _assertIsFunction(
                        maybeHandler,
                        'KeyManagerBuilder.withKeyboardHandler(). Invalid second argument! It must be a function.'
                    );
                }
            }

            config.keyboardHandler = typeof stepOrHandler === 'function' ? stepOrHandler : maybeHandler!;
            config.jumpStep = typeof stepOrHandler === 'number' ? Math.trunc(stepOrHandler) : 0;
            
            return this;
        },
        withHomeAndEnd(enabled) {
            isDev && throwIfBuilded(
                'withHomeAndEnd'
            ) && _assertIsOptionalBoolean(
                enabled,
                'KeyManagerBuilder.withHomeAndEnd(): Invalid argument! It must be a boolean or nothing.'
            );
            config.homeAndEndEnabled = enabled == null || enabled;
            return this;
        },
        withHorizontalOrientation(direction, jumpStep) {
            isDev && throwIfBuilded(
                'withHorizontalOrientation'
            ) && _assertExpectedNumber(
                arguments.length,
                (value) => value > 0,
                'KeyManagerBuilder.withHorizontalOrientation(): Provide orientation direction!'
            ) &&
             _assertIsOrientationDirection(
                direction,
                'KeyManagerBuilder.withHorizontalOrientation(): Invalid first argument! It must be \'ltr\' or \'rtl\'.'
            ) && _assertIsOptionalNumber(
                jumpStep,
                'KeyManagerBuilder.withHorizontalOrientation(): Invalid second argument! It must be a number or nothing.'
            ) && _assertIsOptionalNotNaN(
                jumpStep,
                'KeyManagerBuilder.withHorizontalOrientation(): Invalid second argument! NaN is not supported.'
            ) && _assertIsOptionalFiniteNumber(
                jumpStep,
                'KeyManagerBuilder.withHorizontalOrientation(): Invalid second argument! Infinite numbers are not supported.'
            );
            if (direction === 'ltr') {
                config.keyboardHandler = horizontalLtrOrientationKeyboardHandler;
            } else {
                config.keyboardHandler = horizontalRtlOrientationKeyboardHandler;
            }
            config.jumpStep = Math.trunc(jumpStep || 0);
            return this;
        },
        withPageUpDown(enabled, delta) {
            isDev && throwIfBuilded(
                'withPageUpDown'
            ) && _assertIsOptionalBoolean(
                enabled,
                'KeyManagerBuilder.withPageUpDown(): Invalid first argument! It must be a boolean or nothing.'
            ) && _assertIsOptionalNumber(
                delta,
                'KeyManagerBuilder.withPageUpDown(): Invalid second argument! It must be a boolean or nothing.'
            ) && _assertIsOptionalNotNaN(
                delta,
                'KeyManagerBuilder.withPageUpDown(): Invalid second argument! NaN is not supported.'
            ) && _assertIsOptionalFiniteNumber(
                delta,
                'KeyManagerBuilder.withPageUpDown(): Invalid second argument! Infinite numbers are not supported.'
            );
            enabled = enabled == null || enabled;
            config.pageUpDownDelta = enabled ? Math.max(1, Math.floor(delta ? delta : 10)) : 0;
            return this;
        },
        withSkipPredicate(predicate) {
            isDev && throwIfBuilded(
                'withSkipPredicate'
            ) && _assertIsFunction(
                predicate,
                'KeyManagerBuilder.withSkipPredicate(): Invalid argument! It must be a function.'
            )
            config.skipPredicate = predicate;
            return this;
        },
        withTypeAhead(typeaheadConfig) {
            isDev && throwIfBuilded(
                'withTypeAhead'
            ) && _assertIsOptionalTypeaheadConfig(
                typeaheadConfig,
                'KeyManagerBuilder.withTypeAhead(): Invalid argument! It must be an object of type ' +
                '{\n' +
                '   debounceInterval: number,\n' +
                '   reducer: (buffer: string, key: string) => string,\n' + 
                '   caseSensitive: boolean,\n' +
                '   eachWordAsPrefix: boolean\n' +
                '}'
            ) && _assertIsOptionalNotNaN(
                typeaheadConfig?.debounceInterval,
                'KeyManagerBuilder.withTypeAhead({ debounceInterval }): Invalid argument! NaN is not supported.'
            ) && _assertIsOptionalFiniteNumber(
                typeaheadConfig?.debounceInterval,
                'KeyManagerBuilder.withTypeAhead({ debounceInterval }): Invalid argument! Infinite numbers are not supported.'
            );
            config.typeaheadConfig = {
                debounceInterval: Math.max(0, Math.floor(typeaheadConfig?.debounceInterval || 200)),
                caseSensitive: typeaheadConfig?.caseSensitive || false,
                eachWordAsPrefix: typeaheadConfig?.eachWordAsPrefix || false,
                reducer: typeaheadConfig?.reducer || (
                    (buffer, key) => 
                        key.length === 1 && ((key >= 'A' && key <= 'z') || (key >= '0' && key <= '9')) ?
                        buffer + key :
                        buffer
                )
            }
            return this;
        },
        withVerticalOrientation(jumpStep) {
            isDev && throwIfBuilded(
                'withVerticalOrientation'
            ) && _assertIsOptionalNumber(
                jumpStep,
                'KeyManagerBuilder.withVerticalOrientation(): Invalid argument! It must be a number or nothing.'
            ) && _assertIsOptionalNotNaN(
                jumpStep,
                'KeyManagerBuilder.withVerticalOrientation(): Invalid argument! NaN is not supported.'
            ) && _assertIsOptionalFiniteNumber(
                jumpStep,
                'KeyManagerBuilder.withVerticalOrientation(): Invalid argument! Infinite numbers are not supported.'
            );
            config.keyboardHandler = verticalOrientationKeyboardHandler;
            config.jumpStep = Math.trunc(jumpStep || 0);
            return this;
        },
        withWrap(shouldWrap) {
            isDev && throwIfBuilded(
                'withWrap'
            ) && _assertIsOptionalBoolean(
                shouldWrap,
                'KeyManagerBuilder.withWrap(): Invalid argument! It must be a boolean or nothing.'
            );
            config.shouldWrap = shouldWrap == null || shouldWrap;
            return this;
        },
        build() {
            isDev && throwIfBuilded('build') && _assertIsInOwningContext('KeyManagerBuilder.build');
            builded = true;
            return new _KeyManagerImpl(config);
        },
    }
}

/** @internal */
export const _UNWRAP_SKIP_PREDICATE: symbol = /* @__PURE__ */ Symbol();

let _isInHandlerContext = false;
let _currentKey: string | undefined = undefined;

/**
 * Determines whether the current execution is taking place inside a
 * `KeyManager` keyboard event handler.
 *
 * This function can be used to detect whether code is being executed as part
 * of keyboard navigation managed by a `KeyManager`.
 *
 * @returns `true` if the current execution is inside a `KeyManager` keyboard
 * event handler; otherwise `false`.
 */
export function isInKeyManagerHandlerContext(): boolean {
    return _isInHandlerContext;
}

/**
 * Returns the `KeyboardEvent.key` value of the key currently being handled
 * by the active key manager.
 *
 * Returns `undefined` when called outside of a key handling context.
 *
 * @returns The currently handled key, or `undefined` if no key is being handled.
 */
export function currentHandledKey(): string | undefined {
    return _currentKey
}

/** @internal */
export class _KeyManagerImpl implements KeyManager {
    private readonly _activeItem: Accessor<KeyManagerItem | null>;
    private readonly _setActiveItem: Setter<KeyManagerItem | null>;
    private readonly _activeIndex: Accessor<number>;
    private readonly _setActiveIndex: Setter<number>;
    private readonly _modifiers: _ModifierKey[] = ['altKey', 'ctrlKey', 'metaKey', 'shiftKey'];
    private readonly _count: Accessor<number>;
    private readonly _setCount: Setter<number>;
    private readonly _tabOutNotifier = _createNotifier<[KeyManager, KeyboardEvent]>();
    private readonly _activeItemRemovedNotifier = _createNotifier<[KeyManager]>();
    private readonly _activeItemDisabledNotifier = _createNotifier<[KeyManager, KeyManagerItem, number]>();
    readonly _allowedModifierKeys: _ModifierKey[];
    readonly _homeAndEndEnabled: boolean;
    readonly _skipPredicate: (item: KeyManagerItem) => boolean;
    readonly _typeahead: _Typeahead | null;
    readonly _items: KeyManagerItem[] = [];
    readonly _getAccName: ((element: Element) => string) | null;
    readonly _keyboardHandler: (manager: KeyManager, e: KeyboardEvent) => boolean; //true if key was handled.

    private _jumpStep: number;
    private _unsubscribe: (() => void) | null = null;
    private _removeListener: (() => void) | null = null;
    _pageUpDownDelta: number;
    _disposed = false;
    _cssClassForContainer?: string | undefined;
    _containerEl: Element | null = null;
    _shouldWrap: boolean;

    constructor({
        jumpStep,
        allowedModifierKeys,
        pageUpDownDelta,
        homeAndEndEnabled,
        shouldWrap,
        skipPredicate,
        typeaheadConfig,
        getAccessibilityNameFn,
        keyboardHandler
    }: _KeyManagerConfig) {
        const [activeItem, setActiveItem] = createSignal<KeyManagerItem | null>(null);
        const [activeIndex, setActiveIndex] = createSignal<number>(-1);
        const [count, setCount] = createSignal(0);
        this._activeItem = activeItem;
        this._setActiveItem = setActiveItem;
        this._activeIndex = activeIndex;
        this._setActiveIndex = setActiveIndex;
        this._count = count;
        this._setCount = setCount;
        this._jumpStep = jumpStep;
        this._allowedModifierKeys = allowedModifierKeys;
        this._pageUpDownDelta = pageUpDownDelta;
        this._homeAndEndEnabled = homeAndEndEnabled;
        this._shouldWrap = shouldWrap;
        this._getAccName = getAccessibilityNameFn;
        this._keyboardHandler = keyboardHandler;
        if (isDev) {
            this._skipPredicate = (item) => {
                const result = skipPredicate(item)
                _assertIsBoolean(
                    result,
                    'KeyManagerBuilder.withSkipPredicate(): Invalid predicate return value! The predicate must return a boolean.'
                );
                if (item.disabled && !result) {
                    throw new Error(
                        'KeyManagerBuilder.withSkipPredicate(): Invalid predicate implementation! The predicate must return true for a disabled item.'
                    );
                }
                return result;
            }
            this._skipPredicate.toString = skipPredicate.toString;
            (this._skipPredicate as any)[_UNWRAP_SKIP_PREDICATE] = skipPredicate;
        } else {
            this._skipPredicate = skipPredicate;
        }

        if (typeaheadConfig) {
            this._typeahead = new _Typeahead(this, typeaheadConfig);
        } else {
            this._typeahead = null;
        }

        onCleanup(() => {
            this._disposed = true;
            this._unsubscribe?.();
            (this as any)._items = null;
            this._tabOutNotifier.dispose();
            this._activeItemRemovedNotifier.dispose();
            this._activeItemDisabledNotifier.dispose();
            this._typeahead?.dispose();
            if (this._removeListener) {
                this._removeListener();
                this._removeListener = null;
            }
            (this as any)._keyboardHandler = null;
            if (isDev && this._containerEl) {
                _containerBinding.delete(this._containerEl);
            }
            this._containerEl = null;
        });
    }

    get activeItem(): KeyManagerItem | null { return this._activeItem(); }

    get activeItemIndex(): number { return this._activeIndex(); }

    get itemsCount(): number { return this._count(); } 

    get typeAheadBuffer(): string { return this._typeahead?.buffer() || ''; }

    get homeAndEndEnabled(): boolean { return this._homeAndEndEnabled; }

    get typing(): boolean {
        if (this._disposed || this._typeahead === null) { return false; }
        return this._typeahead.typing();
    }

    get jumpStep(): number { return this._jumpStep; }
    set jumpStep(value: number) {
        isDev && _assertIsNumber(
            value,
            'KeyManager.jumpStep: Failed to assign jumpStep! Expected a number.'
        ) && _assertIsNotNaN(
            value,
            'KeyManager.jumpStep: Failed to assign jumpStep! NaN is not supported.'
        ) && _assertIsFiniteNumber(
            value,
            'KeyManager.jumpStep: Failed to assign jumpStep! Infinite numbers are not supported.'
        );
        this._jumpStep = Math.trunc(value);
    }

    get typeAheadDebounceInterval(): number {
        if (this._disposed || this._typeahead === null) { return 0; }
        return this._typeahead.interval;
    }
    set typeAheadDebounceInterval(value: number) {
        isDev && _assertIsNumber(
            value,
            'KeyManager.typeAheadDebounceInterval: Failed to assign typeAheadDebounceInterval! Expected a number.'
        ) && _assertIsNotNaN(
            value,
            'KeyManager.typeAheadDebounceInterval: Failed to assign typeAheadDebounceInterval! NaN is not supported.'
        ) && _assertIsFiniteNumber(
            value,
            'KeyManager.typeAheadDebounceInterval: Failed to assign typeAheadDebounceInterval! Infinite numbers are not supported.'
        );
        if (this._typeahead) { this._typeahead.interval = Math.max(1, Math.floor(value)); }
    }

    get pageUpAndDownDelta(): number { return this._pageUpDownDelta; }
    set pageUpAndDownDelta(value: number) {
        isDev && _assertIsNumber(
            value,
            'KeyManager.pageUpAndDownDelta: Failed to assign pageUpAndDownDelta! Expected a number.'
        ) && _assertIsNotNaN(
            value,
            'KeyManager.pageUpAndDownDelta: Failed to assign pageUpAndDownDelta! NaN is not supported.'
        ) && _assertIsFiniteNumber(
            value,
            'KeyManager.pageUpAndDownDelta: Failed to assign pageUpAndDownDelta! Infinite numbers are not supported.'
        );
        if (this._pageUpDownDelta) {
            this._pageUpDownDelta = Math.max(1, Math.floor(value));
        }
    }

    get disposed(): boolean { return this._disposed; }

    bind = (container: Element) => {
        if (__IS_SERVER__) {
            throw new Error('KeyManager.bind(): This method cannot be used in a server environment!');
        }

        isDev && _assertIsFalse(
            this._disposed,
            'KeyManger.bind(): Cannot bind after the manager has been disposed!'
        ) && _assertIsElement(
            container,
            'KeyManager.bind(): Invalid argument! String or instance of Element class are allowed.'
        ) && _assertIsFalsy(
            this._containerEl,
            'KeyManager.bind(): Manager is already bound!'
        ) && _assertIsFalse(
            _containerBinding.has(container),
            'KeyManager.bind(): Provided element is already bound to some key manager!'
        ) && _containerBinding.set(container, this);

        const keyboardHandler = this._keyboardHandler

        this._containerEl = container;
        
        this._removeListener = addDelegatedEventListener<KeyboardEvent>(container, 'keydown', (e) => {
            if (e.defaultPrevented) { return; }
            if (e.key === _OperableKey.Tab) {
                this._tabOutNotifier.notify(this, e);
                this._typeahead?.reset();
                return;
            }
            if (!this._isAllowedModifier(e)) { return; }

            let result: boolean;
            _isInHandlerContext = true;
            _currentKey = e.key;
            try {
                result = keyboardHandler(this, e);
            } finally {
                _isInHandlerContext = false;
                _currentKey = undefined;
            }
            isDev && _assertIsBoolean(
                result,
                'KeyManagerBuilder.withKeyboardHandler(): Invalid keyboard handler! The return type must be a boolean.'
            ) && _assertIsFalse(
                e.defaultPrevented,
                'KeyManagerBuilder.withKeyboardHandler(): '+
                'Keyboard handler must not call event.preventDefault(). ' +
                'Return true instead to indicate that the event has been handled.'
            );
            if (result) {
                e.preventDefault();
                this._typeahead?.reset();
            } else {
                this._typeahead?.typeKey(e.key) && e.preventDefault();
            }
        });
    }

    setActive(itemOrIndex: KeyManagerItem | number): boolean {
        if (this._disposed) { return false; }
        isDev && typeof itemOrIndex !== 'number' && _assertIsObjectExcludingArray(
            itemOrIndex,
            'KeyManager.setActive(): Invalid argument!'
        );

        const index = typeof itemOrIndex === 'number' ? Math.trunc(itemOrIndex) : this._indexOf(itemOrIndex);

        if (
            index > -1 &&
            index < this._items.length &&
            index !== untrack(this._activeIndex) &&
            !this._skipPredicate.call(null, this._items[index])
        ) {
            this._setActiveItemByIndex(index);
            return true;
        }

        return false;
    }

    clearActive(): boolean {
        if (untrack(this._activeItem)) {
            batch(() => {
                this._setActiveItem(null);
                this._setActiveIndex(-1);
            });
            return true;
        }
        return false;
    }

    getItemAt(index: number): KeyManagerItem | null {
        if (this._disposed || index < 0 || index >= this._items.length) { return null; }
        return this._items[Math.floor(index)];
    }

    setFirstItemActive(): boolean {
        if (this._disposed || !this._items.length) { return false; }
        let index = 0;
        const skipPredicate = this._skipPredicate;
        while (index < this._items.length && skipPredicate(this._items[index])) {
            index++;
        }
        if (index < this._items.length) {
            this._setActiveItemByIndex(index);
            return true;
        }
        return false;
    }

    setLastItemActive(): boolean {
        if (this._disposed || !this._items.length) { return false; }
        let index = this._items.length - 1;
        const skipPredicate = this._skipPredicate
        while (index > -1 && skipPredicate(this._items[index])) {
            index--;
        }
        if (index > -1) {
            this._setActiveItemByIndex(index);
            return true;
        }
        return false;
    }

    setNextItemActive(): boolean {
        if (this._disposed || !this._items.length) { return false; }
        if (untrack(this._activeItem)) {
            return this._setNextItemActive(1);
        } else {
            return this.setFirstItemActive();
        }
    }

    setPreviousItemActive(): boolean {
        if (this._disposed || !this._items.length) { return false; }
        if (untrack(this._activeItem)) {
            return this._setPreviousItemActive(-1);
        } else {
            return this.setLastItemActive();
        }
    }

    movePageDown(): boolean {
        if (this._disposed || !this._items.length || this._pageUpDownDelta === 0) { return false; }
        const shouldWrap = this._shouldWrap;
        this._shouldWrap = false;
        try {
            return this._setNextItemActive(this._pageUpDownDelta) || this._setPreviousItemActive(this._pageUpDownDelta);
        } finally {
            this._shouldWrap = shouldWrap;
        }
    }

    movePageUp(): boolean {
        if (this._disposed || !this._items.length || this._pageUpDownDelta === 0) { return false; }
        const shouldWrap = this._shouldWrap;
        this._shouldWrap = false;
        try {
            return this._setPreviousItemActive(-this._pageUpDownDelta) || this._setNextItemActive(-this.pageUpAndDownDelta);
        } finally {
            this._shouldWrap = shouldWrap;
        }
    }


    jumpForward(): boolean {
        if (this._disposed) { return false; }
        if (untrack(this._activeItem)) {
            return this._jumpByStep(this.jumpStep);
        } else if (this._jumpStep > 0) {
            return this.setFirstItemActive();
        } else if (this._jumpStep < 0) {
            return this.setLastItemActive();
        }
        return false
    }

    jumpBackward(): boolean {
        if (this._disposed) { return false; }
        if (untrack(this._activeItem)) {
            return this._jumpByStep(-this.jumpStep);
        } else if (this._jumpStep > 0) {
            return this.setLastItemActive();
        } else if (this._jumpStep < 0) {
            return this.setFirstItemActive();
        }
        return false
    }

    onActiveItemDisabled(listener: (manager: KeyManager, item: KeyManagerItem, index: number) => void): () => void {
        isDev && _assertIsFunction(
            listener,
            'KeyManager.onActiveItemDisabled(): Invalid argument! Expected a function.'
        );
        return this._activeItemDisabledNotifier.add(listener);
    }

    onActiveItemRemoved(listener: (manager: KeyManager) => void): () => void {
        isDev && _assertIsFunction(
            listener,
            'KeyManager.onActiveItemRemoved(): Invalid argument! Expected a function.'
        );
        return this._activeItemRemovedNotifier.add(listener);
    }

    onTabOut(listener: (manager: KeyManager, event: KeyboardEvent) => void): () => void {
        isDev && _assertIsFunction(
            listener,
            'KeyManager.onTabOut(): Invalid argument! Expected a function.'
        );
        return this._tabOutNotifier.add(listener);
    }
    
    addItem(item: KeyManagerItem): void {
        if (this._disposed) { return; }
        isDev && _assertIsTruthy(
            this._containerEl,
            'KeyManager.addItem(): This method can not be used if manager is not bound to container element.'
        ) && _assertIsFalsy(
            (item as any)[_KEY_MANAGER] && (item as any)[_KEY_MANAGER] !== this && !((item as any)[_KEY_MANAGER] as _KeyManagerImpl)._disposed,
            'KeyManager.addItem(): The item already belongs to some key manager!'
        );

        if ((item as any)[_KEY_MANAGER] === this) { return; }
        (item as any)[_KEY_MANAGER] = this;

        const items = this._items;

        if (items.length) {
            if (items[items.length - 1].compare(item) <= 0) {
                items.push(item);
                batch(() => {
                    this._setCount(items.length);
                    item.onAttached(this);
                });
                return;
            }
        } else {
            items.push(item);
                batch(() => {
                this._setCount(items.length);
                item.onAttached(this);
            });
            return;
        }

        let low = 0;
        let high = items.length;

        while (low < high) {
            const mid = (low + high) >>> 1; // Math.floor((low + high) / 2) equivalent

            if (items[mid].compare(item) <= 0) {
                low = mid + 1;
            } else {
                high = mid;
            }
        }

        items.splice(low, 0, item);
        batch(() => {
            this._setCount(items.length);
            item.onAttached(this);
        });
    }

    removeItem(item: KeyManagerItem): void {
        if (this._disposed) { return; }

        if (isDev && !this._containerEl) {
            throw new Error('KeyManager.removeItem(): This method con not be used if manager is not bound to container element.');
        }

        const index = this._indexOf(item);

        if (index === -1) { return; }

        this._items.splice(index, 1);
        (item as any)[_KEY_MANAGER] = null;

        batch(() => {
            this._setCount(this._items.length);
            if (index === untrack(this._activeIndex)) {
                this._setActiveItem(null);
                this._setActiveIndex(-1);
                item.onInactive();
            }
            item.onDetached();
            this._activeItemRemovedNotifier.notify(this);
            !this._items.length && this._typeahead && this._typeahead.reset();
        });
    }

    cancelTypeahead(): void {
        this._typeahead?.reset();
    }

    Provider = (props: { children: any; }) => {
        if (__IS_SERVER__) {
            throw new Error('<KeyManager.Provider>: This method cannot be used in a server environment!');
        }
        isDev && _assertIsFalse(
            this._disposed,
            `<keyManager.Provide>: Cannot use a disposed key manager!`
        ) && _assertIsTruthy(
            this._containerEl,
            '<keyManager.Provide>: The key manager must be bound to a container element before using this component!'
        )
        return <_managerContext.Provider value={this}>{props.children}</_managerContext.Provider>
    }

    /** Returns true if new item was set active */
    private _setNextItemActive(delta: number): boolean {
        let nextIndex = this._getNewIndexByDelta(delta);
        const currentIndex = untrack(this._activeIndex);
        const shouldNotWrap = !this._shouldWrap;
        const skipPredicate = this._skipPredicate;

        if (shouldNotWrap && currentIndex === this._items.length - 1) {
            return false;
        }

        while (nextIndex !== currentIndex && skipPredicate(this._items[nextIndex])) {
            nextIndex = this._getNewIndexByDelta(++delta);
            if (shouldNotWrap && nextIndex === this._items.length - 1 && skipPredicate(this._items[nextIndex])) {
                nextIndex = -1;
                break;
            }
        }

        if (nextIndex > -1) {
            if (currentIndex === nextIndex) { return false; }
            this._setActiveItemByIndex(nextIndex);
            return true;
        }

        return false
    }

    /** Returns true if new item was set active */
    private _setPreviousItemActive(delta: number): boolean {
        let prevIndex = this._getNewIndexByDelta(delta);
        const currentIndex = untrack(this._activeIndex);
        const shouldNotWrap = !this._shouldWrap;
        const skipPredicate = this._skipPredicate

        if (shouldNotWrap && currentIndex === 0) {
            return false;
        }

        while (prevIndex !== currentIndex && skipPredicate(this._items[prevIndex])) {
            prevIndex = this._getNewIndexByDelta(--delta);
            if (shouldNotWrap && prevIndex === 0 && skipPredicate(this._items[prevIndex])) {
                prevIndex = -1;
                break;
            }
        }

        if (prevIndex > -1) {
            if (currentIndex === prevIndex) { return false; }
            this._setActiveItemByIndex(prevIndex);
            return true;
        }
        return false;
    }

    _setActiveItemByIndex(index: number): void {
        if (untrack(this._activeIndex) === index) { return; }
        const prevActive = untrack(this._activeItem);
        const currentActive = this._items[index];

        batch(() => {
            this._setActiveIndex(index);
            this._setActiveItem(currentActive);
            prevActive?.onInactive();
            currentActive.onActive();
        });
        
        this._unsubscribe?.();
        this._unsubscribe = createRoot((dispose) => {
            createComputed(() => {
                if (currentActive.disabled) {
                    untrack(() => batch(() => {
                        this._unsubscribe = null;
                        this._setActiveIndex(-1);
                        this._setActiveItem(null);
                        currentActive.onInactive();
                        this._activeItemDisabledNotifier.notify(this, currentActive, index);
                        dispose();
                    }));
                }
            });
            return dispose;
        });
    }

    private _getNewIndexByDelta(delta: number): number {
        const length = this._items.length;
        const currentIndex = untrack(this._activeIndex);
        if (length === 0) {
            return -1;
        }

        let index = currentIndex + delta;

        if (this._shouldWrap) {
            index = ((index % length) + length) % length;
        } else {
            index = Math.max(0, Math.min(index, length - 1));
        }

        return index;
    }

    private _jumpByStep(step: number): boolean {
        if (step === 0) {
            return false;
        }

        const items = this._items;
        const length = items.length;
        const skipPredicate = this._skipPredicate

        if (length === 0) {
            return false;
        }

        const mainAxisLength = Math.abs(step);
        const crossAxisLength = Math.ceil(length / mainAxisLength);

        const startIndex = untrack(this._activeIndex);

        let mainAxisIndex = Math.floor(startIndex / mainAxisLength);
        const crossAxisIndex = startIndex % mainAxisLength;

        const direction = step > 0 ? 1 : -1;

        for (let i = 0; i < crossAxisLength; i++) {
            mainAxisIndex += direction;

            if (this._shouldWrap) {
                mainAxisIndex = ((mainAxisIndex % crossAxisLength) + crossAxisLength) % crossAxisLength;
            } else if (mainAxisIndex < 0 || mainAxisIndex >= crossAxisLength) {
                return false;
            }

            let index = mainAxisIndex * mainAxisLength + crossAxisIndex;

            // Not full last row/column.
            if (index >= length) {
                continue;
            }

            if (!skipPredicate(items[index])) {
                this._setActiveItemByIndex(index);
                return true;
            }
        }
        return false;
    }

    _isAllowedModifier(e: KeyboardEvent): boolean {
        return this._modifiers.every((modifier) => !e[modifier] || this._allowedModifierKeys.indexOf(modifier) > -1);
    }

    private _indexOf(item: KeyManagerItem): number {
        if ((item as any)[_KEY_MANAGER] != this) { return -1; } 
        if (item === untrack(this._activeItem)) { return untrack(this._activeIndex); }
        let low = 0;
        let high = this._items.length - 1;
        let startIndex = -1;
        let index = 0
        const items = this._items
        const length = items.length;

        if (this._items[low] === item) { return low; }
        if (this._items[high] === item) { return high; }

        while (low <= high) {
            const mid = (low + high) >>> 1;
            const result = item.compare(items[mid]);

            if (result === 0) {
                startIndex = mid
                break;
            }

            if (result < 0) {
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }

        if (startIndex < 0) {
            return startIndex
        }
        
        index = startIndex
        while (item.compare(items[index]) === 0 && index < length) {
            if (item === items[index]) {
                return index;
            }
            index++
        }

        index = startIndex
        while (item.compare(items[index]) === 0 && index > -1) {
            if (item === items[index]) {
                return index;
            }
            index--;
        }

        return -1;
    }
}

/**
 * Registers a DOM element as a {@link KeyManagerItem}.
 *
 * This is a convenience overload equivalent to creating a
 * {@link DOMElementKeyManagerItem} directly.
 *
 * The function must run within a {@link KeyManager} context.
 * 
 * @throws Error if it is used outside {@link KeyManager} context.
 *
 * @param element The element to register.
 *
 * @example
 * ```tsx
 * <div ref={keyManagerItem}>
 *   Option
 * </div>
 * ```
 */
export function keyManagerItem(element: Element): void;
/**
 * Creates a ref callback that registers a DOM element as a
 * {@link KeyManagerItem}.
 *
 * The supplied CSS class is automatically applied whenever the item becomes
 * active and removed when it becomes inactive.
 *
 * This overload is intended for use with framework `ref` callbacks.
 *
 * @param activeElementCssClassName The CSS class applied while the item is active.
 *
 * @returns A ref callback that registers the element with the current
 * {@link KeyManager}. This ref callback must run within a {@link KeyManager}
 * context; otherwise it will throw error.
 *
 * @example
 * ```tsx
 * <div ref={KeyManagerItem('active-option')}>
 *   Option
 * </div>
 * ```
 */
export function keyManagerItem(activeElementCssClassName: string): (element: Element) => void;
export function keyManagerItem(elOrCssClass: Element | string): void | ((element: Element) => void) {
    if (__IS_SERVER__) {
        throw new Error('keyManagerItem(): This function cannot be used in a server environment!')
    }
    if (elOrCssClass instanceof Element) {
        _registerItem(keyManagerItem, elOrCssClass, DOMElementKeyManagerItem);
        return;
    }
    isDev && _assertIsString(
        elOrCssClass,
        'keyManagerItem(): Invalid argument! It must be string or instance of Element class.'
    );
    return (element) => _registerItem(keyManagerItem, element, DOMElementKeyManagerItem, elOrCssClass);
}

/**
 * Registers a focusable DOM element as a {@link KeyManagerItem}.
 *
 * This is a convenience overload equivalent to creating a
 * {@link FocusableDOMElementKeyManagerItem} directly.
 *
 * The element must be used within a {@link KeyManager} context.
 *
 * @throws Error if it is used outside a {@link KeyManager} context.
 *
 * @param element The focusable element to register.
 *
 * @example
 * ```tsx
 * <input ref={focusableKeyManagerItem} />
 * ```
 */
export function focusableKeyManagerItem(element: FocusableElement): void;
/**
 * Creates a ref callback that registers a focusable DOM element as a
 * {@link KeyManagerItem}.
 *
 * The supplied CSS class is automatically applied whenever the item becomes
 * active and removed when it becomes inactive. The element also receives
 * focus automatically whenever it becomes active.
 *
 * This overload is intended for use with framework `ref` callbacks.
 *
 * @param activeElementCssClassName The CSS class applied while the item is active.
 *
 * @returns A ref callback that registers the element with the current
 * {@link KeyManager}. This ref callback must run within a {@link KeyManager}
 * context; otherwise, it will throw an error.
 *
 * @example
 * ```tsx
 * <input ref={focusableKeyManagerItem('active-option')} />
 * ```
 */
export function focusableKeyManagerItem(activeElementCssClassName: string): (element: FocusableElement) => void;
export function focusableKeyManagerItem(elOrCssClass: FocusableElement | string): void | ((element: FocusableElement) => void) {
    if (__IS_SERVER__) {
        throw new Error('focusableKeyManagerItem(): This function cannot be used in a server environment!')
    }
    if (elOrCssClass instanceof Element) {
        _registerItem(focusableKeyManagerItem, elOrCssClass, FocusableDOMElementKeyManagerItem as any);
        return;
    }
    isDev && _assertIsString(
        elOrCssClass,
        'focusableKeyManagerItem(): Invalid argument! It must be string or instance of Element class.'
    );
    return (element) => _registerItem(focusableKeyManagerItem, element, FocusableDOMElementKeyManagerItem as any, elOrCssClass);
}

function _registerItem(
    caller: Function,
    element: Element,
    constructor: typeof DOMElementKeyManagerItem,
    cssClass?: string
) {
    const manager = useKeyManger()!;
    if (isDev && !manager) {
        throw new Error(`${caller.name}(): KeyManager context is required!`);
    }
    const item = new constructor(element, cssClass);
    if (element.parentNode) {
        manager.addItem(item);
    } else {
        deferAddItem(manager, item);
    }
    onCleanup(() => {
        manager.removeItem(item);
        item.dispose();
    });
}


/**
 * A {@link KeyManagerItem} implementation that adapts a DOM {@link Element}
 * for use with a {@link KeyManager}.
 *
 * This class provides the default behavior for native DOM elements, including
 * ordering, focus management, accessibility information, and active state
 * handling.
 * 
 * @see {@link keyManagerItem}
 * @see {@link KeyManager.addItem}
 * @see {@link KeyManagerItem}
 */
export class DOMElementKeyManagerItem<T extends Element = Element> implements KeyManagerItem {

    private _getAccName = useAccessibilityNameAccessor() || _defaultGetAccName;
    private _disabled!: Accessor<boolean>;
    private _dispose: () => void;
    protected _disposed = false;
    protected _manager: KeyManager | null = null;

    /**
     * Creates a new DOM-backed key manager item.
     *
     * @param _element The DOM element represented by this item.
     * @param _activeElementCssClassName The CSS class applied while the item is
     * active. Defaults to an empty string.
     *
     * @throws Error If instantiated outside a `KeyManager` context.
     */
    constructor(protected _element: T, private _activeElementCssClassName?: string) {
        if (__IS_SERVER__) {
            throw new Error(
                `${(this as any).constructor.name} cannot be instantiated on the server.`
            );
        }
        this._getAccName = useAccessibilityNameAccessor() || _defaultGetAccName
        isDev && _assertIsElement(
            _element,
            `${(this as any).constructor.name}.constructor(): The provided element is not a DOM element!`
        ) && _assertIsOptionalString(
            _activeElementCssClassName,
            `${(this as any).constructor.name}.constructor(): The second argument must be a string!`
        ) && _assertIsFalse(
            _itemBinding.has(_element),
            `${(this as any).constructor.name}.constructor(): The provided element already has a key manager item!`
        ) && _assertIsString(
            this._getAccName(_element),
            'KeyManagerBuilder.withAccessabilityNameAccessor() or <AccessabilityNameAccessorProvider>: The return type of provided function must be a string!'
        ) && _itemBinding.set(_element, this);

        this._dispose = createRoot((dispose) => {
            const mutationRecordSource = createRoot((dispose) => (this._dispose = dispose, observerMutations(_element)));
            this._disabled = createLazyMemo(getOwner()!, () => {
                mutationRecordSource()
                if (
                    _element instanceof HTMLInputElement ||
                    _element instanceof HTMLButtonElement ||
                    _element instanceof HTMLSelectElement ||
                    _element instanceof HTMLTextAreaElement
                ) {
                    return _element.disabled && _element.matches(':disabled');
                }
                return this._element.ariaDisabled === 'true';
            });
            return dispose;
        });
    }

    /**
     * Gets the underlying DOM element represented by this item.
     * 
     * @throws `Error` if item is disposed.
     */
    get element(): T { 
        if (isDev && this._disposed) {
            throw new Error(`${(this as any).constructor.name}.element: Cannot access properties of a disposed instance!`);
        }
        return this._element;
    }

    /**
     * The unique ID associated with this item.
     * 
     * @throws `Error` if item is disposed.
     */
    get id(): string {
        if (isDev && this._disposed) {
            throw new Error(`${(this as any).constructor.name}.id: Cannot access properties of a disposed instance!`);
        }
        return this.element.id;
    }

    /**
     * Indicates whether the item is disabled.
     *
     * Reads of this property must be reactive so that the KeyManager can
     * automatically respond to changes in the disabled state.
     * 
     * @throws `Error` if item is disposed.
     */
    get disabled(): boolean {
        if (isDev && this._disposed) {
            throw new Error(`${(this as any).constructor.name}.disabled: Cannot access properties of a disposed instance!`);
        }
        return this._disabled();
    }

    /**
     * Label for this item.
     * 
     * @throws `Error` if item is disposed.
     * */
    get label(): string {
        if (isDev && this._disposed) {
            throw new Error(`${(this as any).constructor.name}.label: Cannot access properties of a disposed instance!`);
        }
        return this._getAccName(this._element);
    }

    /**
     * Returns `true` if this item has been disposed; otherwise, `false`.
     */
    get disposed(): boolean { return this._element === null; }

    /**
     * Compares this item with another `KeyManagerOption` to determine ordering.
     *
     * Used by the key manager to maintain a stable navigation order.
     *
     * @throws `Error` if item is disposed.
     * 
     * @param target The item to compare against.
     * @returns A negative number if this item precedes the target,
     *          a positive number if it follows the target,
     *          or 0 if both items are considered equal in order.
     */
    compare(target: KeyManagerItem): number {
        isDev && _assertIsFalse(
            this._disposed,
            `${(this as any).constructor.name}.compare(): A disposed item cannot be compared!`
        );
        if (target === this) { return 0; }
        if (target instanceof DOMElementKeyManagerItem) {
            const relation = this._element.compareDocumentPosition(target.element);
            isDev && _assertIsFalsy(
                relation & Node.DOCUMENT_POSITION_DISCONNECTED,
                `${(this as any).constructor.name}.compare(): Failed to compare the items! Make sure both items belong to the same DOM tree.`
            );
            if (relation & Node.DOCUMENT_POSITION_FOLLOWING) {
                return -1
            }
            if (relation & Node.DOCUMENT_POSITION_PRECEDING) {
                return 1;
            }
            return undefined!;
        } else {
            return -target.compare(this);
        }
    }

    /**
     * Called when the item becomes active.
     */
    onActive(): void {
        if (this._disposed) { return; }
        if (this._activeElementCssClassName) {
            this._element.classList.add(this._activeElementCssClassName);
        }
    }

    /**
     * Called when the item loses its active state.
     */
    onInactive(): void {
        if (this._disposed) { return; }
        if (this._activeElementCssClassName) {
            this._element.classList.remove(this._activeElementCssClassName);
        }
    }

    /**
     * Invoked after this item has been attached (added) to a key manager.
     */
    onAttached(manager: KeyManager): void {
        if (isDev) {
            try {
                _assertIsFalse(
                    this._disposed,
                    `${(this as any).constructor.name}.onAttached(): A disposed item cannot be added to a key manager!`
                );
                _assertIsTrue(
                    manager != null && typeof manager === 'object' && 'removeItem' in manager && typeof manager.removeItem === 'function',
                    `${(this as any).constructor.name}.onAttached(): Invalid argument! Expected a key manager with a removeItem() method!`
                );
            } finally {
                if (this.disposed) {
                    manager.removeItem(this);
                }
            }
        }
        this._manager = manager;
    }

    /**
     * Invoked after this item has been detached (removed) from a key manager.
     */
    onDetached(): void {
        this._manager = null;
    }

    /**
     * Disposes this key manager item instance.
     *
     * Removes the association between the managed DOM element and this item,
     * releasing any resources held by the instance. After disposal, this item
     * must no longer be used.
     */
    dispose(): void {
        if (this._disposed) { return; }
        isDev && _assertIsFalsy(
            this._manager && !this._manager.disposed,
            `${(this as any).constructor.name}.dispose(): attached item cannot be disposed!`
        ) && _itemBinding.delete(this._element);
        this._element = null!;
        this._manager = null;
        this._dispose();
        this._dispose = null!;
        this._disposed = true;
    }
}

/**
 * A {@link KeyManagerItem} implementation for focusable DOM elements.
 *
 * This class automatically transfers focus to the associated element when it
 * becomes active. It extends {@link DOMElementKeyManagerItem} by invoking the
 * element's `focus()` method from {@link KeyManagerItem.onActive}.
 *
 * @remarks
 * The provided element must implement the `focus()` method.
 */
export class FocusableDOMElementKeyManagerItem<T extends FocusableElement = FocusableElement> extends DOMElementKeyManagerItem<T> implements KeyManagerItem {

    private _isFocused = false;
    private _handleFocus: () => void = () => {
        this._isFocused = true;
        this._manager?.setActive(this);
    }
    private _handleBlur: () => void = () => this._isFocused = false;

    constructor(element: T, activeElementCssClassName?: string) {
        super(element, activeElementCssClassName);
        if (isDev ) {
            let shouldDelete = true;
            try {
                _assertIsElementWithFocus(
                    element,
                    'FocusableDOMElementKeyManagerItem.constructor(): The provided element is not focusable! It does not implement the `focus()` method!'
                )
                shouldDelete = false;
            } finally {
                shouldDelete && _itemBinding.delete(element);
            }
        }
        element.addEventListener('focus', this._handleFocus);
        element.addEventListener('blur', this._handleBlur);
    }

    override onActive(): void {
        super.onActive();
        if (this._disposed || this._isFocused) { return; }
        if (_isInHandlerContext) {
            focusVia(this._element, 'keyboard');
        } else {
            this._element.focus();
        }
        isDev && _assertIsTrue(
            isFocused(this._element),
            'FocusableDOMElementKeyManagerItem.onActive(): Failed to focus the underlying element. Make sure the element is focusable and connected to the DOM.'
        );
    }

    override dispose(): void {
        if (this._disposed) { return; }
        this._element.removeEventListener('focus', this._handleFocus);
        this._element.removeEventListener('blur', this._handleBlur);
        super.dispose();
    }

    override onAttached(manager: KeyManager): void {
        super.onAttached(manager);
        this._manager = manager;
        if (isFocused(this._element)) {
            manager.setActive(this);
        }
    }

    override onDetached(): void {
        super.onDetached();
        this._manager = null;
    }
}

/** @internal */
export function _defaultGetAccName(el: Element): string {
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
        let label = '';
        const ids = labelledBy.split(' ');
        for (let i = 0; i < ids.length; i++) {
            const labelEl = document.getElementById(ids[i]);
            if (labelEl) {
                label += _defaultGetAccName(labelEl) + ' ';
            }
        }
        label = label.trim();
        if (label) { return label; }
    }

    const label = el.getAttribute('aria-label');
    if (label) { return label; }

    return el.textContent;
}

function _throwHandlerError(handler: Function): never {
    throw new Error(
        `${handler.name}(): This handler must receive an event that has not been prevented. ` +
        `If your custom keyboard handler handles the event, return true instead of calling ${handler.name}().`
    );
}

/**
 * Handles keyboard navigation for vertically oriented lists.
 *
 * Supported keys:
 * - ArrowUp
 * - ArrowDown
 *
 * Returns `true` if the keyboard event was handled; otherwise `false`.
 *
 * This handler is intended to be used directly or as a building block for a
 * custom keyboard handler registered via `KeyManagerBuilder.withKeyboardHandler()`.
 * 
 * @see {@link KeyManagerBuilder.withKeyboardHandler}
 */
export function verticalOrientationKeyboardHandler(manager: KeyManager, e: KeyboardEvent): boolean {
    isDev && e.defaultPrevented && _throwHandlerError(verticalOrientationKeyboardHandler);

    switch (e.key) {
        case _OperableKey.ArrowDown:
            return manager.setNextItemActive();
        case _OperableKey.ArrowUp:
            return manager.setPreviousItemActive();
        case _OperableKey.ArrowRight:
            return manager.jumpForward();
        case _OperableKey.ArrowLeft:
            return manager.jumpBackward();
    }
    return _handleCommonKeys(manager, e);
}

/**
 * Handles keyboard navigation for horizontally oriented left-to-right (LTR)
 * lists.
 *
 * Supported keys:
 * - ArrowLeft
 * - ArrowRight
 *
 * Returns `true` if the keyboard event was handled; otherwise `false`.
 *
 * This handler is intended to be used directly or as a building block for a
 * custom keyboard handler registered via `KeyManagerBuilder.withKeyboardHandler()`.
 * 
 * @see {@link KeyManagerBuilder.withKeyboardHandler}
 */
export function horizontalLtrOrientationKeyboardHandler(manager: KeyManager, e: KeyboardEvent): boolean {
    isDev && e.defaultPrevented && _throwHandlerError(horizontalLtrOrientationKeyboardHandler);

    switch (e.key) {
        case _OperableKey.ArrowDown:
            return manager.jumpForward();
        case _OperableKey.ArrowUp:
            return manager.jumpBackward();
        case _OperableKey.ArrowRight:
            return manager.setNextItemActive();
        case _OperableKey.ArrowLeft:
            return manager.setPreviousItemActive();
    }
    return _handleCommonKeys(manager, e);
}

/**
 * Handles keyboard navigation for horizontally oriented right-to-left (RTL)
 * lists.
 *
 * Supported keys:
 * - ArrowLeft
 * - ArrowRight
 *
 * Returns `true` if the keyboard event was handled; otherwise `false`.
 *
 * This handler is intended to be used directly or as a building block for a
 * custom keyboard handler registered via `KeyManagerBuilder.withKeyboardHandler()`.
 * 
 * @see {@link KeyManagerBuilder.withKeyboardHandler}
 */
export function horizontalRtlOrientationKeyboardHandler(manager: KeyManager, e: KeyboardEvent): boolean {
    isDev && e.defaultPrevented && _throwHandlerError(horizontalRtlOrientationKeyboardHandler);

    switch (e.key) {
        case _OperableKey.ArrowDown:
            return manager.jumpForward();
        case _OperableKey.ArrowUp:
            return manager.jumpBackward();
        case _OperableKey.ArrowRight:
            return manager.setPreviousItemActive();
        case _OperableKey.ArrowLeft:
            return manager.setNextItemActive();
    }
    return _handleCommonKeys(manager, e);
}

function _handleCommonKeys(manager: KeyManager, e: KeyboardEvent): boolean {
        switch (e.key) {
            case _OperableKey.Home:
                return manager.setFirstItemActive();
            case _OperableKey.End:
                return manager.setLastItemActive();
            case _OperableKey.PageDawn:
                return manager.movePageDown();
            case _OperableKey.PageUp:
                return manager.movePageUp();
            case _OperableKey.Escape:
                if (manager.typing) {
                    manager.cancelTypeahead();
                    return true;
                }
                break;
        }
    return false;
}

class _Typeahead {
    private readonly _setTyping: Setter<boolean>;
    private readonly _reducer: (buffer: string, key: string) => string;
    private readonly _caseSensitive: boolean;
    private readonly _setBuffer: Setter<string>;
    private _timeoutId: number | undefined = undefined;
    private _items: KeyManagerItem[];
    
    readonly typing: Accessor<boolean>;
    readonly buffer: Accessor<string>;
    readonly eachWordAsPrefix: boolean
    interval: number;

    constructor(private _manager: _KeyManagerImpl, {
        reducer,
        debounceInterval,
        caseSensitive,
        eachWordAsPrefix
    }: Required<TypeAheadConfig>) {
        this._reducer = reducer;
        this.interval = debounceInterval;
        this._caseSensitive = caseSensitive;
        this.eachWordAsPrefix = eachWordAsPrefix;
        const [typing, setTyping] = createSignal(false);
        this.typing = typing;
        this._setTyping = setTyping;
        const [buffer, setBuffer] = createSignal('');
        this.buffer = buffer;
        this._setBuffer = setBuffer;
        this._items = _manager._items;
    }

    typeKey(key: string): boolean {
        if (!this._items.length) { return false; }
        let oldBuffer: string = this.buffer();
        let newBuffer: string = oldBuffer;
        batch(() => {
            newBuffer = this._reducer.call(null, oldBuffer, key);

            isDev && _assertIsString(
                newBuffer,
                'KeyManagerBuilder.withTypeAhead(): Invalid reducer return type! Expected a string.'
            );
                
            if (oldBuffer === newBuffer) { return; }

            this._setBuffer(newBuffer);
        });

        if (newBuffer) {
            this._setTyping(true);
        } else {
            this._setTyping(false);
            if (this._timeoutId !== undefined) {
                clearTimeout(this._timeoutId);
                this._timeoutId = undefined;
            }
        }

        if (newBuffer === oldBuffer) { return false; }

        if (!this.typing()) { return true; }

        if (this._timeoutId !== undefined) {
            clearTimeout(this._timeoutId);
        }

        this._timeoutId = setTimeout(() => {
            this._timeoutId = undefined;
            const eachWordAsPrefix = this.eachWordAsPrefix;
            const skipPredicate = this._manager._skipPredicate;
            const length = this._items.length;
            const buffer = this._caseSensitive ? this.buffer() : this.buffer().toLowerCase();
            const bufferWords = eachWordAsPrefix ? buffer.trim().split(/\s+/) : [ buffer ];

            

            for (let i = 0; i < length; i++) {
                const item = this._items[i];
                if (skipPredicate(item)) { continue; }
                const label = this._caseSensitive ? item.label : item.label.toLowerCase();
                const labelWords = eachWordAsPrefix ? label.trim().split(/\s+/) : [ label ];

                let labelIndex = 0;
                let matched = false;

                for (const bufferWord of bufferWords) {
                    matched = false;

                    while (labelIndex < labelWords.length) {
                        if (labelWords[labelIndex].startsWith(bufferWord)) {
                            matched = true;
                            labelIndex++;
                            break;
                        }
                        labelIndex++;
                    }

                    if (!matched) {
                        break;
                    }
                }

                batch(() => {
                    this._setBuffer('');
                    this._setTyping(false);
                    if (matched) {
                        _isInHandlerContext = true
                        try {
                            this._manager._setActiveItemByIndex(i);
                        } finally {
                            _isInHandlerContext = false;
                        }
                    }
                });

                if(matched) { return; }
            }
        }, this.interval);

        return true;
    }

    reset(): void {
        if (untrack(this.typing)) {
            batch(() => {
                this._setBuffer('');
                this._setTyping(false);
            });
        }
        if (this._timeoutId !== undefined) {
            clearTimeout(this._timeoutId);
            this._timeoutId = undefined;
        }
    }

    dispose(): void {
        this.reset();
        this._items = null!;
    }
}