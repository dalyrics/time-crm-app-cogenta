import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Import BrowserRouter from react-router-dom
import { BrowserRouter } from 'react-router-dom';

// Find the root element in your index.html and create a React root
ReactDOM.createRoot(document.getElementById('root')).render(
  // Use React.StrictMode for development checks (optional but recommended)
  <React.StrictMode>
    {/*
      Wrap the entire App component with BrowserRouter.
      This makes routing context available to all components inside App.
    */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);