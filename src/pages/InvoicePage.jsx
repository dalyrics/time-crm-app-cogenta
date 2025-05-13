import React from 'react'; // Make sure this is here

// The function name should exactly match the file name (PascalCase)
function InvoicePage() {
  return (
    <div>
      <h1>Invoice Generation</h1>
      <p>Select time entries and generate invoices from this page.</p>
    </div>
  );
}

// This line is crucial. It makes the InvoicePage component the 'default' export.
export default InvoicePage;