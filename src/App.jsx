import React from 'react';
// Import the components we need from react-router-dom
import { Routes, Route, Link } from 'react-router-dom';

// Import all the page components
import Dashboard from './pages/Dashboard';
import ClientsPage from './pages/ClientsPage';
import WorkItemsPage from './pages/WorkItemsPage';
import TimeTrackingPage from './pages/TimeTrackingPage';
import ReportsPage from './pages/ReportsPage';
import InvoicePage from './pages/InvoicePage';
import ClientDetailPage from './pages/ClientDetailPage'; // Import the Client Detail Page

import './App.css'; // Keep or remove if you don't plan to use App.css

function App() {
  return (
    <div className="App">
      {/* Navigation Menu */}
      <nav>
        <ul>
          <li><Link to="/">Dashboard</Link></li>
          <li><Link to="/clients">Clients</Link></li> {/* Link to the Clients LIST page */}
          <li><Link to="/work-items">Work Items</Link></li>
          <li><Link to="/time-tracking">Time Tracking</Link></li>
          <li><Link to="/reports">Reports</Link></li>
          <li><Link to="/invoice">Invoice</Link></li>
        </ul>
      </nav>

      {/* Define the routes */}
      <Routes>
        {/* Route for the homepage */}
        <Route path="/" element={<Dashboard />} />

        {/* Route for the Clients LIST page - order matters, put this before the detail page route */}
        <Route path="/clients" element={<ClientsPage />} />

        {/* Route for the Work Items page */}
        <Route path="/work-items" element={<WorkItemsPage />} />

        {/* Route for the Time Tracking page */}
        <Route path="/time-tracking" element={<TimeTrackingPage />} />

        {/* Route for the Reports page */}
        <Route path="/reports" element={<ReportsPage />} />

        {/* Route for the Invoice page */}
        <Route path="/invoice" element={<InvoicePage />} />

        {/* Route for the Client DETAIL page - has a dynamic segment ':clientId' */}
        {/* This route must come AFTER the /clients route so that /clients matches the list page */}
        <Route path="/clients/:clientId" element={<ClientDetailPage />} />

        {/* Optional: A route for any path not matched */}
        {/* <Route path="*" element={<div><h1>404: Not Found</h1></div>} /> */}
      </Routes>
    </div>
  );
}

export default App;