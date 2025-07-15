import React from 'react';
import { createRoot } from 'react-dom/client';
import ConfigForm from './components/ConfigForm';
import './popup.css';

const App: React.FC = () => {
  return <ConfigForm />;
};

// Initialize when DOM is ready
function initializePopup() {
  const rootElement = document.getElementById('popup-root');
  if (!rootElement) {
    console.error('Root element not found');
    return;
  }

  const root = createRoot(rootElement);
  root.render(<App />);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePopup);
} else {
  initializePopup();
}