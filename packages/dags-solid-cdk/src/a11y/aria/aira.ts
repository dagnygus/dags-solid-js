import { isDev } from "solid-js/web";
import { _assertIsOneOf, _assertIsString } from "../../internals/common-assertions";

let _liveElement: HTMLDivElement | null = null;

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

    return element
}

function _createLiveElement(): HTMLDivElement {
    const liveEl = _createVisuallyHiddenElement();
    
    liveEl.ariaAtomic = 'true';
    liveEl.ariaLive = 'polite';

    return document.body.appendChild(liveEl);
}

/**
 * Announces a message to assistive technologies using a live region.
 *
 * The announcement is delivered with the specified politeness level. By
 * default, announcements are polite and do not interrupt ongoing speech.
 *
 * @param message Message to announce.
 * @param politeness The priority of the announcement. Defaults to `'polite'`.
 */
export function liveAnnounce(message: string, politeness: 'off' | 'polite' | 'assertive' = 'polite'): void {
    isDev && _assertIsString(
        message,
        'liveAnnounce(): Invalid first argument! Expected a string.'
    ) && _assertIsOneOf(
        politeness,
        ['off', 'polite', 'assertive'],
        'liveAnnounce(): Invalid second argument! Expected "off", "polite", or "assertive".'
    );
    _liveElement ??= _createLiveElement();
    _liveElement.ariaLive = politeness;
    _liveElement.textContent = message;
}