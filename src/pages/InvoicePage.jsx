import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc as getFirestoreDoc, query, where, orderBy } from 'firebase/firestore';

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

function InvoicePage() {
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClientData, setSelectedClientData] = useState(null);
  const [loadingClients, setLoadingClients] = useState(true);

  const [detailLevel, setDetailLevel] = useState('detail'); // 'category', 'task', or 'detail'

  // State for time entries of the selected client
  const [fetchedTimeEntries, setFetchedTimeEntries] = useState([]); // Raw entries from DB
  const [loadingTimeEntries, setLoadingTimeEntries] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState(new Set()); // IDs of entries checked for invoice

  // This state will hold the items formatted for the PDF invoice
  const [invoiceItems, setInvoiceItems] = useState([]); 

  const companyData = { /* ... your company data ... */ 
    companyName: 'Cogenta SRL',
    companyAddress: 'Avenue Charles Thielemans 27, 1150 Brussels, Belgium',
    companyNumber: 'BE0800183286',
    bankAccount: 'BE47 7340 6734 4580',
    companyEmail: 'billing@cogenta.io',
    companyWebsite: 'www.cogenta.io',
    companyTagline: 'We save time, streamline operations, and remove friction so businesses can focus on what matters.',
    currency: '€',
    taxRate: 21,
    logoUrl: '/cogenta-logo.png'
  };
  
  const [invoiceNumber, setInvoiceNumber] = useState('INV-001');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceDueDate, setInvoiceDueDate] = useState(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [invoiceNotes, setInvoiceNotes] = useState('Payment due within 14 days.');

  // Fetch clients
  useEffect(() => {
    const fetchClientsFunc = async () => {
      setLoadingClients(true);
      try {
        const snapshot = await getDocs(collection(db, 'clients'));
        setClients(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) { console.error("Error fetching clients:", err); alert("Could not load clients."); }
      setLoadingClients(false);
    };
    fetchClientsFunc();
  }, []);

  // Fetch client details when selectedClientId changes
  useEffect(() => {
    if (!selectedClientId) {
      setSelectedClientData(null);
      setFetchedTimeEntries([]); // Clear time entries when client changes
      setSelectedEntryIds(new Set()); // Clear selections
      return;
    }
    const fetchClientDetailsFunc = async () => {
      try {
        const clientDocSnap = await getFirestoreDoc(doc(db, 'clients', selectedClientId));
        setSelectedClientData(clientDocSnap.exists() ? { id: clientDocSnap.id, ...clientDocSnap.data() } : null);
      } catch (err) { console.error("Error fetching client details:", err); setSelectedClientData(null); }
    };
    fetchClientDetailsFunc();
  }, [selectedClientId]);

  // Fetch time entries for the selected client
  useEffect(() => {
    if (!selectedClientId) {
      setFetchedTimeEntries([]);
      return;
    }
    const fetchEntries = async () => {
      setLoadingTimeEntries(true);
      try {
        const entriesRef = collection(db, 'timeEntries');
        const clientDocRef = doc(db, 'clients', selectedClientId);
        const q = query(entriesRef, where('clientRef', '==', clientDocRef), orderBy('startTime', 'desc'));
        const snapshot = await getDocs(q);
        
        const entriesWithDetails = await Promise.all(snapshot.docs.map(async (entryDoc) => {
          const entry = { id: entryDoc.id, ...entryDoc.data() };
          let categoryName = 'N/A', taskName = 'N/A', detailName = 'N/A';
          if (entry.detailRef) {
            try {
              const detailSnap = await getFirestoreDoc(entry.detailRef);
              if (detailSnap.exists()) {
                const detailData = detailSnap.data();
                detailName = detailData.name || 'Unnamed Detail';
                entry.rate = detailData.hourlyRate; // Get rate from detail

                const taskRef = detailSnap.ref.parent.parent;
                if (taskRef) {
                  const taskSnap = await getFirestoreDoc(taskRef);
                  if (taskSnap.exists()) {
                    taskName = taskSnap.data().name || 'Unnamed Task';
                    const catRef = taskSnap.ref.parent.parent;
                    if (catRef) {
                      const catSnap = await getFirestoreDoc(catRef);
                      if (catSnap.exists()) categoryName = catSnap.data().name || 'Unnamed Category';
                    }
                  }
                }
              }
            } catch (e) { console.error("Error fetching detail hierarchy for invoice item:", e); }
          }
          return { ...entry, categoryName, taskName, detailName, 
                   startTime: entry.startTime?.toDate(), // convert Timestamps
                   endTime: entry.endTime?.toDate() 
                 };
        }));
        setFetchedTimeEntries(entriesWithDetails);
      } catch (error) {
        console.error("Error fetching time entries for invoice:", error);
        alert("Could not load time entries for the client.");
        setFetchedTimeEntries([]);
      }
      setLoadingTimeEntries(false);
    };
    fetchEntries();
  }, [selectedClientId]);

  // Update invoiceItems state when selected entries or detailLevel change
  useEffect(() => {
    const newInvoiceItems = fetchedTimeEntries
      .filter(entry => selectedEntryIds.has(entry.id))
      .map(entry => {
        let description = '';
        if (detailLevel === 'detail') {
          description = `${entry.categoryName} > ${entry.taskName} > ${entry.detailName}`;
        } else if (detailLevel === 'task') {
          description = `${entry.categoryName} > ${entry.taskName}`;
        } else { // category
          description = entry.categoryName;
        }
        // Add date to description for more context if multiple entries are grouped
        description += ` (on ${new Date(entry.startTime).toLocaleDateString()})`;

        const hours = entry.duration / 3600;
        const amount = entry.rate ? hours * parseFloat(entry.rate) : 0;
        return {
          description,
          quantity: hours.toFixed(2), // Or format as HH:MM
          rate: entry.rate ? parseFloat(entry.rate).toFixed(2) : 0,
          amount: amount,
        };
      });
    setInvoiceItems(newInvoiceItems);
  }, [selectedEntryIds, fetchedTimeEntries, detailLevel]);


  const handleTimeEntrySelect = (entryId) => {
    setSelectedEntryIds(prevIds => {
      const newIds = new Set(prevIds);
      if (newIds.has(entryId)) {
        newIds.delete(entryId);
      } else {
        newIds.add(entryId);
      }
      return newIds;
    });
  };

  const calculateSubtotal = () => invoiceItems.reduce((total, item) => total + (item.amount || 0), 0);
  const calculateTax = () => calculateSubtotal() * (companyData.taxRate / 100);
  const calculateTotal = () => calculateSubtotal() + calculateTax();

  const downloadInvoicePDF = () => { /* ... your existing downloadInvoicePDF function ... */
    const input = document.getElementById('invoice-preview-content');
    if (!input) { console.error("Preview element not found!"); return; }
    const originalStyles = { width: input.style.width, height: input.style.height, padding: input.style.padding, backgroundColor: input.style.backgroundColor, boxShadow: input.style.boxShadow, margin: input.style.margin, borderRadius: input.style.borderRadius, color: input.style.color };
    input.style.width = '190mm'; input.style.minHeight = '270mm'; input.style.padding = '0'; input.style.backgroundColor = 'white'; input.style.boxShadow = 'none'; input.style.margin = '0 auto'; input.style.borderRadius = '0'; input.style.color = 'black';
    html2canvas(input, { scale: 2, useCORS: true, logging: false, letterRendering: true, allowTaint: true, scrollY: -window.scrollY })
      .then((canvas) => {
        Object.keys(originalStyles).forEach(key => input.style[key] = originalStyles[key]);
        const imgData = canvas.toDataURL('image/png'); const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth(); const imgProps = pdf.getImageProperties(imgData);
        let pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        let heightLeft = pdfHeight; let position = 0; const pageHeightA4 = pdf.internal.pageSize.getHeight() - 20;
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight); heightLeft -= pageHeightA4;
        while (heightLeft > 0) { position -= pageHeightA4; pdf.addPage(); pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight); heightLeft -= pageHeightA4;}
        const clientNameForFile = selectedClientData?.name?.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '') || "Client";
        pdf.save(`Cogenta-Invoice-${invoiceNumber}_${clientNameForFile}.pdf`);
      }).catch(err => { console.error("PDF Gen Error:", err); alert("Failed to gen PDF."); Object.keys(originalStyles).forEach(key => input.style[key] = originalStyles[key]);});
  };

  const handleInitiateInvoiceGeneration = () => {
    if (!selectedClientId || !selectedClientData) { alert("Please select a client."); return; }
    if (invoiceItems.length === 0) { alert("Please select at least one time entry to include in the invoice."); return; }
    console.log("Initiating PDF with items:", invoiceItems);
    downloadInvoicePDF(); 
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Invoice Generation</h1>
      {/* Client Selection */}
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="client-select-invoice" style={{ marginRight: '10px' }}>Select Client:</label>
        {loadingClients ? (<p>Loading clients...</p>) : (
          <select id="client-select-invoice" value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
          >
            <option value="">-- Select a Client --</option>
            {clients.map(client => (<option key={client.id} value={client.id}>{client.name}</option>))}
          </select>
        )}
      </div>

      {/* Billable Time Entries for Selected Client */}
      {selectedClientId && (
        <div style={{ marginBottom: '20px' }}>
          <h2>Billable Time Entries for {selectedClientData?.name || 'Selected Client'}</h2>
          {loadingTimeEntries ? (<p>Loading time entries...</p>)
           : fetchedTimeEntries.length === 0 ? (<p>No time entries found for this client.</p>)
           : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{border: '1px solid #ddd', padding: '8px'}}><input type="checkbox" 
                    onChange={(e) => {
                        const newSelectedIds = new Set();
                        if (e.target.checked) {
                            fetchedTimeEntries.forEach(entry => newSelectedIds.add(entry.id));
                        }
                        setSelectedEntryIds(newSelectedIds);
                    }}
                    checked={selectedEntryIds.size === fetchedTimeEntries.length && fetchedTimeEntries.length > 0}
                  /></th>
                  <th style={{border: '1px solid #ddd', padding: '8px'}}>Date</th>
                  <th style={{border: '1px solid #ddd', padding: '8px'}}>Work Item</th>
                  <th style={{border: '1px solid #ddd', padding: '8px'}}>Duration</th>
                  <th style={{border: '1px solid #ddd', padding: '8px'}}>Rate</th>
                </tr>
              </thead>
              <tbody>
                {fetchedTimeEntries.map(entry => (
                  <tr key={entry.id}>
                    <td style={{border: '1px solid #ddd', padding: '8px'}}>
                      <input 
                        type="checkbox" 
                        checked={selectedEntryIds.has(entry.id)}
                        onChange={() => handleTimeEntrySelect(entry.id)}
                      />
                    </td>
                    <td style={{border: '1px solid #ddd', padding: '8px'}}>{new Date(entry.startTime).toLocaleDateString()}</td>
                    <td style={{border: '1px solid #ddd', padding: '8px'}}>{`${entry.categoryName} > ${entry.taskName} > ${entry.detailName}`}</td>
                    <td style={{border: '1px solid #ddd', padding: '8px'}}>{(entry.duration / 3600).toFixed(2)} hrs</td>
                    <td style={{border: '1px solid #ddd', padding: '8px'}}>{entry.rate ? `€${entry.rate.toFixed(2)}` : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
           )}
        </div>
      )}
      
      {/* Invoice Options */}
      {selectedClientId && ( 
          <div style={{ marginBottom: '20px' }}>
              <h3>Invoice Options</h3>
              <div>
                  <label htmlFor="detail-level-select" style={{ marginRight: '10px' }}>Level of Detail on Invoice:</label>
                  <select id="detail-level-select" value={detailLevel} onChange={(e) => setDetailLevel(e.target.value)}>
                      <option value="detail">Category &gt; Task &gt; Detail</option>
                      <option value="task">Category &gt; Task</option>
                      <option value="category">Category Only</option>
                  </select>
              </div>
          </div>
      )}

      {/* Generate Invoice Button */}
      {selectedClientId && (
        <div style={{ marginTop: '20px' }}>
          <button onClick={handleInitiateInvoiceGeneration} disabled={selectedEntryIds.size === 0}>
            Generate & Download Invoice PDF
          </button>
        </div>
      )}

      {/* Hidden Div for PDF Content (same as before) */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '1px', height: '1px', overflow: 'hidden'}}>
        <div id="invoice-preview-content" style={{ fontFamily: 'Arial, sans-serif', fontSize: '10pt', color: 'black', backgroundColor:'white', padding: '20mm', width:'210mm' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15mm' }}>
            <div style={{ flex: 1.2 }}>
              {companyData.logoUrl && <img src={companyData.logoUrl} alt="Company Logo" style={{ width: '50mm', marginBottom: '5mm' }} />}
              <p style={{ fontWeight: 'bold', fontSize: '11pt', margin: '0 0 1.5mm 0' }}>{companyData.companyName}</p>
              <p style={{ margin: '0 0 0.5mm 0', whiteSpace: 'pre-line' }}>{companyData.companyAddress}</p>
              <p style={{ margin: '0 0 0.5mm 0' }}>VAT: {companyData.companyNumber}</p>
              <p style={{ margin: '0 0 0.5mm 0' }}>Bank: {companyData.bankAccount}</p>
              <p style={{ margin: '0 0 0.5mm 0' }}>Email: {companyData.companyEmail}</p>
              <p style={{ margin: '0 0 0.5mm 0' }}>Web: {companyData.companyWebsite}</p>
            </div>
            <div style={{ flex: 0.8, textAlign: 'right' }}>
              <h1 style={{ fontSize: '22pt', margin: '0 0 5mm 0', color: '#333333' }}>INVOICE</h1>
              <p style={{ margin: '0 0 1.5mm 0' }}><strong>Invoice #:</strong> {invoiceNumber}</p>
              <p style={{ margin: '0 0 1.5mm 0' }}><strong>Date:</strong> {invoiceDate ? new Date(invoiceDate + 'T00:00:00').toLocaleDateString() : 'N/A'}</p>
              <p style={{ margin: '0 0 1.5mm 0' }}><strong>Due Date:</strong> {invoiceDueDate ? new Date(invoiceDueDate + 'T00:00:00').toLocaleDateString() : 'N/A'}</p>
            </div>
          </div>
          {/* Bill To */}
          {selectedClientData && (
            <div style={{ marginBottom: '12mm' }}>
              <h3 style={{ margin: '0 0 2mm 0', fontSize: '10pt', borderBottom: '0.5px solid #cccccc', paddingBottom: '1mm', color: '#555555' }}>BILL TO:</h3>
              <p style={{ fontWeight: 'bold', margin: '0 0 1.5mm 0' }}>{selectedClientData.name}</p>
              <p style={{ margin: '0 0 0.5mm 0', whiteSpace: 'pre-line' }}>{selectedClientData.address || 'No address provided'}</p>
              {selectedClientData.companyNumber && <p style={{ margin: '0 0 0.5mm 0' }}>VAT: {selectedClientData.companyNumber}</p>}
              {selectedClientData.email && <p style={{ margin: '0 0 0.5mm 0' }}>Email: {selectedClientData.email}</p>}
            </div>
          )}
          {/* Items Table - now uses dynamic invoiceItems */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8mm', fontSize:'9pt' }}>
            <thead>
              <tr style={{ backgroundColor: '#eeeeee', color: '#333333' }}>
                <th style={{ border: '0.5px solid #dddddd', padding: '2.5mm', textAlign: 'left' }}>Description</th>
                <th style={{ border: '0.5px solid #dddddd', padding: '2.5mm', textAlign: 'right', width: '20mm' }}>Hours/Qty</th>
                <th style={{ border: '0.5px solid #dddddd', padding: '2.5mm', textAlign: 'right', width: '25mm' }}>Rate</th>
                <th style={{ border: '0.5px solid #dddddd', padding: '2.5mm', textAlign: 'right', width: '30mm' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoiceItems.map((item, index) => ( // Uses dynamic invoiceItems
                <tr key={index}>
                  <td style={{ border: '0.5px solid #dddddd', padding: '2.5mm', whiteSpace: 'pre-line' }}>{item.description}</td>
                  <td style={{ border: '0.5px solid #dddddd', padding: '2.5mm', textAlign: 'right' }}>{item.quantity}</td>
                  <td style={{ border: '0.5px solid #dddddd', padding: '2.5mm', textAlign: 'right' }}>{companyData.currency}{item.rate}</td>
                  <td style={{ border: '0.5px solid #dddddd', padding: '2.5mm', textAlign: 'right' }}>{companyData.currency}{item.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8mm' }}>
            <div style={{ width: '75mm', fontSize: '9pt' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1.5mm 0', borderBottom: '0.25px solid #eeeeee' }}><span>Subtotal:</span><span>{companyData.currency}{calculateSubtotal().toFixed(2)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1.5mm 0', borderBottom: '0.25px solid #eeeeee' }}><span>Tax (VAT {companyData.taxRate}%):</span><span>{companyData.currency}{calculateTax().toFixed(2)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2mm 0', fontWeight: 'bold', fontSize: '10pt', borderTop: '1px solid #555555', marginTop:'1mm' }}><span>TOTAL:</span><span>{companyData.currency}{calculateTotal().toFixed(2)}</span></div>
            </div>
          </div>
          {/* Notes */}
          {invoiceNotes && (<div style={{ marginBottom: '15mm', fontSize: '8.5pt', borderTop: '0.5px solid #eeeeee', paddingTop: '3mm' }}><h4 style={{margin: '0 0 1.5mm 0', fontSize: '9pt'}}>Notes:</h4><p style={{margin: '0', whiteSpace: 'pre-line'}}>{invoiceNotes}</p></div>)}
          {/* Footer */}
          <div style={{ fontSize: '8pt', color: '#666666', textAlign: 'center', paddingTop: '5mm', borderTop: '0.5px solid #cccccc', marginTop: 'auto' }}><p>{companyData.companyName} | {companyData.companyTagline}</p></div>
        </div>
      </div>
    </div>
  );
} 

export default InvoicePage;