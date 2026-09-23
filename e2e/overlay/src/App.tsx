
import { useLocation, type RouteSectionProps } from '@solidjs/router';
import './App.css';
import { createEffect, createSignal } from 'solid-js';

function App(props: RouteSectionProps) {

  const location = useLocation();
  const [sidenavOpen, setSidenavOpen] = createSignal(false);
  const menuButtonText = () => sidenavOpen() ? 'close' : 'open';

  createEffect(() => {
    location.pathname;
    setSidenavOpen(false);
  });

  return (
    <>
      <div class='app-bar'>
        <button class='menu-button' onClick={() => setSidenavOpen((value) => !value)}>{menuButtonText()}</button>
      </div>
      <main class='main-content-container'>
        {props.children}
      </main>
      <div class='side-nav-container elevation-z3' classList={{ open: sidenavOpen() }}>
        <nav>
          <ul>
            <li><a href="/fixed-aligned-overlay">Fixed aligned overlay</a></li>
            <li><a href="/fixed-coordinate-overlay">Fixed coordinate overlay</a></li>
            <li><a href="/connected-edges-overlay">Connected overlay</a></li>
          </ul>
        </nav>
      </div>
    </>
  )
}

export default App

// fixed aligned 