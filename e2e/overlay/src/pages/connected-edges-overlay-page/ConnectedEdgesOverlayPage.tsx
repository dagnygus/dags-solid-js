import { connectedEdgesPositionStrategy, createOverlay } from 'dags-solid-cdk/overlay';
import styles from './ConnectedEdgesOverlayPage.module.css';

export default function ConnectedEdgesOverlayPage() {
    let target: HTMLDivElement = null!;
    let container: HTMLDivElement = null!;
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;
    const startX = window.innerWidth / 2 - 100;
    const startY = window.innerHeight / 2 - 100;

    const handle = createOverlay({
        component: () => <>Overlay</>,
        positionStrategy: connectedEdgesPositionStrategy({
            targetGetter: () => target,
            connections: [{
                targetEdge: 'top-left',
                overlayEdge: 'bottom-right',
                offsetX: -60,
                offsetY: 60,
            }],
            push: true
        })
    });

    handle.onPrepared(({ componentContainer }) => {
        componentContainer.classList.add(styles.overlay);
        componentContainer.classList.add('elevation-z5');
    })

    function pointerDownHandler(event: PointerEvent): void {
        if (event.target !== target) { return }
        dragging = true;

        const rect = target.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        offsetX = event.clientX - rect.left;
        offsetY = event.clientY - rect.top + containerRect.top;

        target.setPointerCapture(event.pointerId);
    }

    function pointerMoveHandler(event: PointerEvent): void {
        if (!dragging) return;

        target.style.left = `${event.clientX - offsetX}px`;
        target.style.top = `${event.clientY - offsetY}px`;
    }

    function pointerUpHandler(event: PointerEvent): void {
        dragging = false;
        target.releasePointerCapture(event.pointerId);
    }

    function toggle(): void {
        if (handle.attached) {
            handle.detach();
        } else {
            handle.attach();
        }
    }

    return (
        <div ref={container} class={styles.container}>
            <div 
                ref={target}
                class={styles.target + ' elevation-z2'}
                style={`left: ${startX}px; top: ${startY}px;`}
                onPointerDown={pointerDownHandler}
                onPointerMove={pointerMoveHandler}
                onPointerUp={pointerUpHandler}
                >
                <button onClick={toggle}>toggle</button>
            </div>
        </div>
    )
}