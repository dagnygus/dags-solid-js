import { _OverlayHandleImpl, UnderlyingInteractionStrategy } from "../overlay";
import { normalizePassiveListenerOptions } from "../../platform/platform";
import { isDev } from "solid-js/web";
import { _assertIsElement, _assertIsHTMLElement } from "../../internals/common-assertions";
import { onCleanup } from "solid-js";

function _assertOVerlayHandle(handle: any, caller: Function): true {
    if (handle instanceof _OverlayHandleImpl) { return true }
    throw new Error(`${caller.name}(): Underlying interaction strategy must be executed with an OverlayHandle as its "this" value!`)
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
export const blockInteractions: UnderlyingInteractionStrategy<any> = function(overlayElement) {
    if (__IS_SERVER__) {
        throw new Error('blockInteraction(): This function is not available in a server environment')
    }
    isDev && _assertOVerlayHandle(
        this,
        blockInteractions
    ) && _assertIsHTMLElement(
        overlayElement,
        'blockInteraction(): Invalid argument! Expected an HTMLElement instance.'
    );

    let backgroundElement = this.backdrop;
    if (!backgroundElement) {
        backgroundElement = document.createElement('div');
        backgroundElement.style.inset = '0';
        overlayElement.insertAdjacentElement('beforebegin', backgroundElement);
    }

    const listener = (e: Event) => e.preventDefault();

    backgroundElement.addEventListener('wheel', listener);
    backgroundElement.addEventListener('touchmove', listener);

    onCleanup(() => {
        backgroundElement.removeEventListener('wheel', listener);
        backgroundElement.removeEventListener('touchmove', listener);
    });
};

/**
 * Detaches the overlay when the user clicks outside its component container.
 *
 * Clicks occurring inside the component container are ignored.
 * 
 * @throws `Error` if used in a server environment.
 */
export const detachOnOutsideClick: UnderlyingInteractionStrategy<any> = function(_, containerElement) {
    if (__IS_SERVER__) {
        throw new Error('detachOnOutsideClick(): This function is not available in a server environment')
    }
    isDev && _assertOVerlayHandle(
        this,
        detachOnOutsideClick
    ) && _assertIsHTMLElement(
        _,
        'detachOnOutsideClick(): Invalid first argument! Expected an HTMLElement instance.'
    ) && _assertIsElement(
        containerElement,
        'detachOnOutsideClick(): Invalid second argument! Expected an Element instance.'
    );

    const listener = (e: MouseEvent) => {
        if (containerElement.contains(e.target as Element)) { return; }
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
export const disposeOnOutsideClick: UnderlyingInteractionStrategy<any> = function(_, containerElement) {
    if (__IS_SERVER__) {
        throw new Error('disposeOnOutsideClick(): This function is not available in a server environment')
    }
    isDev && _assertOVerlayHandle(
        this,
        disposeOnOutsideClick
    ) && _assertIsHTMLElement(
        _,
        'disposeOnOutsideClick(): Invalid first argument! Expected an HTMLElement instance.'
    ) && _assertIsElement(
        containerElement,
        'disposeOnOutsideClick(): Invalid second argument! Expected an Element instance.'
    );

    const listener = (e: MouseEvent) => {
        if (containerElement.contains(e.target as Element)) { return; }
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
export const detachOnScrollOutside: UnderlyingInteractionStrategy<any> = function(_, containerElement) {
    if (__IS_SERVER__) {
        throw new Error('detachOnScrollOutside(): This function is not available in a server environment')
    }
    isDev && _assertOVerlayHandle(
        this,
        detachOnScrollOutside
    ) && _assertIsHTMLElement(
        _,
        'detachOnScrollOutside(): Invalid first argument! Expected an HTMLElement instance.'
    ) && _assertIsElement(
        containerElement,
        'detachOnScrollOutside(): Invalid second argument! Expected an Element instance.'
    );

    const listener = (e: Event) => {
        if (containerElement.contains(e.target as Element)) { return; }
        this.detach();
    };

    const options =  normalizePassiveListenerOptions({ passive: true, capture: true });
    document.addEventListener('scroll', listener,  options);

    onCleanup(() => {
        document.removeEventListener('scroll', listener, options);
    });
};

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
export const detachAfterDisposeAndAnimation: UnderlyingInteractionStrategy<any> = function(_, containerElement) {
    if (__IS_SERVER__) {
        throw new Error('detachAfterDisposeAndAnimation(): This function is not available in a server environment')
    }
    isDev && _assertOVerlayHandle(
        this,
        detachAfterDisposeAndAnimation
    ) && _assertIsHTMLElement(
        _,
        'detachAfterDisposeAndAnimation(): Invalid first argument! Expected an HTMLElement instance.'
    ) && _assertIsElement(
        containerElement,
        'detachAfterDisposeAndAnimation(): Invalid second argument! Expected an Element instance.'
    );

    this.onDispose(() => {
        const options = normalizePassiveListenerOptions({ passive: true })
        const listener = (e: Event) => {
            if (e.target !== containerElement) {
                return;
            }
            
            this.detach();
        }
        containerElement.addEventListener('transitionend', listener, options);
        containerElement.addEventListener('transitioncancel', listener, options);
        containerElement.addEventListener('animationend', listener, options);
        containerElement.addEventListener('animationcancel', listener, options);
    });
}