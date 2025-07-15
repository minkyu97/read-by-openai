import { createRoot } from 'react-dom/client';
import ControlBar from './components/ControlBar';
import './styles/ControlBar.css';

let controlBarRoot: any = null;

function initializeControlBar(): void {
  // Prevent multiple initialization
  if (document.getElementById('read-by-ai-control-bar-root')) {
    return;
  }

  // Create root container
  const rootContainer = document.createElement('div');
  rootContainer.id = 'read-by-ai-control-bar-root';
  document.body.appendChild(rootContainer);

  // Create React root and render
  controlBarRoot = createRoot(rootContainer);
  controlBarRoot.render(<ControlBar />);
}

function destroyControlBar(): void {
  if (controlBarRoot) {
    controlBarRoot.unmount();
    controlBarRoot = null;
  }
  
  const rootContainer = document.getElementById('read-by-ai-control-bar-root');
  if (rootContainer) {
    rootContainer.remove();
  }
}

// Initialize control bar when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeControlBar);
} else {
  initializeControlBar();
}

// Reinitialize on navigation for SPAs
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    destroyControlBar();
    setTimeout(initializeControlBar, 100);
  }
}).observe(document, { subtree: true, childList: true });