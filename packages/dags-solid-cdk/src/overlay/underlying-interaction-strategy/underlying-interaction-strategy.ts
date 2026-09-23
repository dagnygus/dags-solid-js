import { OverlayHandle } from "../overlay";
import { normalizePassiveListenerOptions } from "../../platform/platform";
import { isDev } from "solid-js/web";
import { _assertIsElement, _assertIsHTMLElement, _assertIsTrue } from "../../internals/common-assertions";
import { onCleanup } from "solid-js";
import { _OverlayHandleImpl } from "../handle/handle";

function _assertIsOverlayHandle(handle: any, caller: Function): true {
    if (handle instanceof _OverlayHandleImpl) { return true }
    throw new Error(`${caller.name}(): Underlying interaction strategy must be executed with an OverlayHandle as its "this" value!`)
}

function _assertAreValidArguments(thisArg: any, firstArg: any, secondArg: any, caller: Function): true {
    return _assertIsOverlayHandle(
        thisArg,
        caller
    ) && _assertIsTrue(
        firstArg instanceof HTMLDivElement,
        `${caller.name}(): Invalid first argument! Expected an HTMLDivElement instance.`
    ) && _assertIsHTMLElement(
        secondArg,
        `${caller.name}(): Invalid second argument! Expected an HTMLElement instance.`
    )
}

/**
 * Prevents user interaction with the content underlying the overlay.
 *
 * The strategy creates a background element behind the overlay when one is
 * not already present and prevents `wheel` and `touchmove` events from
 * performing their default actions.
 * 
 * @throws `Error` if used in a server environment.
 */
export function blockInteractions<P extends Record<string, any> | void>(
    this: OverlayHandle<P> & { componentContainer: null },
    overlayElement: HTMLDivElement,
    componentContainer: HTMLElement
): void {
    if (__IS_SERVER__) {
        throw new Error('blockInteractions(): This function is not available in a server environment.');
    }
    isDev && _assertAreValidArguments(this, overlayElement, componentContainer, blockInteractions);

    let backgroundElement = this.backdrop;
    if (!backgroundElement) {
        backgroundElement = document.createElement('div');
        backgroundElement.style.inset = '0';
        backgroundElement.style.position = 'fixed';
        overlayElement.insertAdjacentElement('beforebegin', backgroundElement);
    }

    const listener = (e: Event) => e.preventDefault();

    backgroundElement.addEventListener('wheel', listener);
    backgroundElement.addEventListener('touchmove', listener);
    overlayElement.addEventListener('wheel', listener);
    overlayElement.addEventListener('touchmove', listener);

    if (this.backdrop) {
        onCleanup(() => {
            backgroundElement.removeEventListener('wheel', listener);
            backgroundElement.removeEventListener('touchmove', listener);
        });
    }
};

/**
 * Detaches the overlay when the user clicks outside its component container.
 *
 * Clicks occurring inside the component container are ignored.
 * 
 * @throws `Error` if used in a server environment.
 */
export function detachOnOutsideClick<P extends Record<string, any> | void>(
    this: OverlayHandle<P> & { componentContainer: null },
    overlayElement: HTMLDivElement,
    componentContainer: HTMLElement
): void {
    if (__IS_SERVER__) {
        throw new Error('detachOnOutsideClick(): This function is not available in a server environment.');
    }
    isDev && _assertAreValidArguments(this, overlayElement, componentContainer, detachOnOutsideClick);

    const listener = (e: MouseEvent) => {
        if (componentContainer.contains(e.target as Element)) { return; }
        this.detach();
    };

    const options =  normalizePassiveListenerOptions({ passive: true });
    document.addEventListener('click', listener,  options);

    onCleanup(() => {
        document.removeEventListener('click', listener, options);
    });
};

/**
 * Disposes the overlay when the user clicks outside its component container.
 *
 * Clicks occurring inside the component container are ignored.
 * 
 * @throws `Error` if used in a server environment.
 */
export function disposeOnOutsideClick<P extends Record<string, any> | void>(
    this: OverlayHandle<P> & { componentContainer: null },
    overlayElement: HTMLDivElement,
    componentContainer: HTMLElement
): void {
    if (__IS_SERVER__) {
        throw new Error('disposeOnOutsideClick(): This function is not available in a server environment.');
    }
    isDev && _assertAreValidArguments(this, overlayElement, componentContainer, disposeOnOutsideClick);

    const listener = (e: MouseEvent) => {
        if (componentContainer.contains(e.target as Element)) { return; }
        this.dispose();
    };

    const options =  normalizePassiveListenerOptions({ passive: true });
    document.addEventListener('click', listener,  options);

    onCleanup(() => {
        document.removeEventListener('click', listener, options);
    });
};

/**
 * Detaches the overlay when a scroll occurs outside its component container.
 *
 * Scroll events originating inside the component container are ignored.
 * The strategy listens during the capture phase so that scroll events from
 * scrollable descendants can be observed.
 * 
 * @throws `Error` if used in a server environment.
 */
export function detachOnScrollOutside<P extends Record<string, any> | void>(
    this: OverlayHandle<P> & { componentContainer: null },
    overlayElement: HTMLDivElement,
    componentContainer: HTMLElement
): void {
    if (__IS_SERVER__) {
        throw new Error('detachOnScrollOutside(): This function is not available in a server environment.');
    }
    isDev && _assertAreValidArguments(this, overlayElement, componentContainer, detachOnScrollOutside);

    const listener = (e: Event) => {
        if (componentContainer.contains(e.target as Element)) { return; }
        this.detach();
    };

    const options =  normalizePassiveListenerOptions({ passive: true, capture: true });
    document.addEventListener('scroll', listener,  options);

    onCleanup(() => {
        document.removeEventListener('scroll', listener, options);
    });
};

/**
 * Disposes the overlay when a scroll occurs outside its component container.
 *
 * Scroll events originating inside the component container are ignored.
 * The strategy listens during the capture phase so that scroll events from
 * scrollable descendants can be observed.
 * 
 * @throws `Error` if used in a server environment.
 */
export function disposeOnScrollOutside<P extends Record<string, any> | void>(
    this: OverlayHandle<P> & { componentContainer: null },
    overlayElement: HTMLDivElement,
    componentContainer: HTMLElement
): void {
    if (__IS_SERVER__) {
        throw new Error('disposeOnScrollOutside(): This function is not available in a server environment.');
    }
    isDev && _assertAreValidArguments(this, overlayElement, componentContainer, disposeOnScrollOutside);

    const listener = (e: Event) => {
        if (componentContainer.contains(e.target as Element)) { return; }
        this.dispose();
    };

    const options =  normalizePassiveListenerOptions({ passive: true, capture: true });
    document.addEventListener('scroll', listener,  options);

    onCleanup(() => {
        document.removeEventListener('scroll', listener, options);
    });
}

/**
 * Detaches the overlay after it has been disposed and its exit animation
 * or transition has finished or been cancelled.
 *
 * This strategy is intended for overlays configured with `manualRemove: true`.
 * When the overlay is disposed, its reactive lifetime is terminated and
 * dispose listeners are invoked, but the overlay remains attached to the DOM.
 * This strategy waits for the exit animation or transition to finish before
 * calling {@link OverlayHandle.detach}.
 *
 * Use this strategy with care. The overlay remains attached until a matching
 * `transitionend`, `transitioncancel`, `animationend`, or `animationcancel`
 * event occurs. The exit animation or transition must therefore be
 * guaranteed to finish or be cancelled, otherwise the overlay may remain in
 * the DOM indefinitely.
 * 
 * @throws `Error` if used in a server environment.
 */
export function detachAfterDisposeAndAnimation<P extends Record<string, any> | void>(
    this: OverlayHandle<P> & { componentContainer: null },
    overlayElement: HTMLDivElement,
    componentContainer: HTMLElement
): void {
    if (__IS_SERVER__) {
        throw new Error('detachAfterDisposeAndAnimation(): This function is not available in a server environment.');
    }
    isDev && _assertAreValidArguments(this, overlayElement, componentContainer, detachAfterDisposeAndAnimation);

    this.onDispose(() => {
        const options = normalizePassiveListenerOptions({ passive: true })
        const listener = (e: Event) => {
            if (e.target !== componentContainer) {
                return;
            }
            this.detach();
        }
        componentContainer.addEventListener('transitionend', listener, options);
        componentContainer.addEventListener('transitioncancel', listener, options);
        componentContainer.addEventListener('animationend', listener, options);
        componentContainer.addEventListener('animationcancel', listener, options);
    });
}