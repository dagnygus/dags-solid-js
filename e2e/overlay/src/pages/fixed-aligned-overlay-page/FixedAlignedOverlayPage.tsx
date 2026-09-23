import type { JSXElement } from "solid-js";
import styles from './FixedAlignedOverlayPage.module.css';
import { blockInteractions, createOverlay, detachAfterDisposeAndAnimation, detachOnOutsideClick, detachOnScrollOutside, disposeOnOutsideClick, fixedAlignmentStrategy } from "dags-solid-cdk/overlay";

export default function FixedAlignmentOverlayPage(): JSXElement {
    
    const handle = createOverlay({
        component: OverlayContent,
        positionStrategy: fixedAlignmentStrategy({
            horizontalAlignment: 'center',
            verticalAlignment: 'start',
            margin: '120px 0 0 0'
        }),
        withBackdrop: true,
        underlyingInteractionStrategies: [blockInteractions, detachOnOutsideClick],
        withViewTransitions: true
    });

    handle.backdrop.classList.add(styles.backdrop)

    handle.onPrepared((handle) => {
        handle.componentContainer.classList.add('elevation-z3');
        handle.componentContainer.classList.add(styles.overlay)
    });

    // handle.onDispose((handle) => {
    //     handle.componentContainer.classList.add(styles.leave)
    // });

    function toggleOverlay(): void {
        if (handle.attached) {
            handle.detach();
        } else {
            handle.attach();
        }
    }

    return (
        <div class={styles.container}>
            <button class={styles['attach-overlay-btn']} onClick={toggleOverlay}>Show overlay</button>
        </div>
    );
}

function OverlayContent() {
    return <span>The overlay</span>
    // return <div style='height: 800px'><span>The overlay</span></div>
}