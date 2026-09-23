import { createOverlay, fixedCoordinateStrategy } from "dags-solid-cdk/overlay";
import styles from './FixedCoordinateOverlayPage.module.css';

export default function FixedCoordinateOverlayPage() {
    let viewportX = 0;
    let viewportY = 0;

    const handle = createOverlay({
        component: () => <div class={styles['overlay-point']}></div>,
        positionStrategy: fixedCoordinateStrategy({
            autoAdjustCorner: true,
            get x() { return viewportX; },
            get y() { return viewportY; }
        })
    });

    handle.onPrepared((handle) => {
        handle.componentContainer.classList.add(styles.overlay);
        handle.componentContainer.classList.add('elevation-z6');
    });

    function handleContextMenu(event: MouseEvent): void {
        event.preventDefault();
        viewportX = event.clientX;
        viewportY = event.clientY;

        if (handle.attached) { handle.detach(); }

        handle.attach();
    }

    return (
        <div class={styles.container} onContextMenu={handleContextMenu}>
        </div>
    );
}

