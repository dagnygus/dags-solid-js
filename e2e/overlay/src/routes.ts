import ConnectedEdgesOverlayPage from "./pages/connected-edges-overlay-page/ConnectedEdgesOverlayPage";
import FixedAlignmentOverlayPage from "./pages/fixed-aligned-overlay-page/FixedAlignedOverlayPage";
import FixedCoordinateOverlayPage from "./pages/fixed-coordinate-overlay-page/FixedCoordinateOverlayPage";

export const  routers = [
    {
        path: 'fixed-aligned-overlay',
        component: FixedAlignmentOverlayPage
    },
    {
        path: 'fixed-coordinate-overlay',
        component: FixedCoordinateOverlayPage
    },
    {
        path: 'connected-edges-overlay',
        component: ConnectedEdgesOverlayPage
    }
]