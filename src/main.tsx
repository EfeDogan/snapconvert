import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import MobileUpload from './MobileUpload.tsx';
import './index.css';

// Check if this is the mobile upload page
const params = new URLSearchParams(window.location.search);
const isMobileUpload = params.get('mode') === 'upload' && params.has('peer');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isMobileUpload ? <MobileUpload /> : <App />}
  </StrictMode>,
);
