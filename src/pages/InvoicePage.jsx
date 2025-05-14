// InvoicePage.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection,
  getDocs,
  doc,
  getDoc as getFirestoreDoc,
  query,
  where,
  orderBy,
  runTransaction,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

function InvoicePage() {
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClientData, setSelectedClientData] = useState(null);
  const [loadingClients, setLoadingClients] = useState(true);

  const [detailLevel, setDetailLevel] = useState('detail');
  const [summarizeByRate, setSummarizeByRate] = useState(false);

  const [fetchedTimeEntries, setFetchedTimeEntries] = useState([]);
  const [loadingTimeEntries, setLoadingTimeEntries] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState(new Set());
  const [invoiceItems, setInvoiceItems] = useState([]);

  const companyData = {
    companyName: 'Cogenta SRL',
    companyAddress: 'Avenue Charles Thielemans 27, 1150 Brussels, Belgium',
    companyNumber: 'BE0800183286', // This is your company's VAT/registration
    bankAccount: 'BE47 7340 6734 4580',
    companyEmail: 'billing@cogenta.io',
    companyWebsite: 'www.cogenta.io',
    companyTagline: 'We save time, streamline operations, and remove friction so businesses can focus on what matters.',
    currency: '€',
    taxRate: 21,
    logoUrl: '/cogenta-logo.png' // Ensure this path is correct in your public folder
  };

  const [invoiceNumber, setInvoiceNumber] = useState('INV-000');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceDueDate, setInvoiceDueDate] = useState(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [invoiceNotes, setInvoiceNotes] = useState('Payment due within 14 days.');

  useEffect(() => {
    const fetchClientsFunc = async () => {
      setLoadingClients(true);
      try {
        const snapshot = await getDocs(collection(db, 'clients'));
        setClients(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error fetching clients:", err);
        alert("Could not load clients.");
      }
      setLoadingClients(false);
    };
    fetchClientsFunc();
  }, []);

  useEffect(() => {
    if (!selectedClientId) {
      setSelectedClientData(null);
      setFetchedTimeEntries([]);
      setSelectedEntryIds(new Set());
      return;
    }
    const fetchClientDetailsFunc = async () => {
      try {
        const clientDocSnap = await getFirestoreDoc(doc(db, 'clients', selectedClientId));
        setSelectedClientData(clientDocSnap.exists() ? { id: clientDocSnap.id, ...clientDocSnap.data() } : null);
      } catch (err) {
        console.error("Error fetching client details:", err);
        setSelectedClientData(null);
      }
    };
    fetchClientDetailsFunc();
  }, [selectedClientId]);

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
        const q = query(entriesRef, where('clientRef', '==', clientDocRef), orderBy('startTime', 'asc'));
        const snapshot = await getDocs(q);
        const entriesWithDetails = await Promise.all(snapshot.docs.map(async (entryDoc) => {
          const entry = { id: entryDoc.id, ...entryDoc.data() };
          let categoryName = 'N/A', taskName = 'N/A', detailName = 'N/A';
          entry.rate = null;
          if (entry.detailRef) {
            try {
              const detailSnap = await getFirestoreDoc(entry.detailRef);
              if (detailSnap.exists()) {
                const detailData = detailSnap.data();
                detailName = detailData.name || 'Unnamed Detail';
                entry.rate = detailData.hourlyRate;
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
          return {
            ...entry, categoryName, taskName, detailName,
            startTime: entry.startTime?.toDate(),
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

  useEffect(() => {
    const selectedEntries = fetchedTimeEntries.filter(entry => selectedEntryIds.has(entry.id));
    if (summarizeByRate) {
      if (selectedEntries.length === 0) {
        setInvoiceItems([]);
        return;
      }
      const groupedByRate = selectedEntries.reduce((acc, entry) => {
        const rateKey = entry.rate === null || entry.rate === undefined ? "N/A" : String(parseFloat(entry.rate).toFixed(2));
        if (!acc[rateKey]) {
          acc[rateKey] = {
            entries: [], totalHours: 0, totalAmount: 0, earliestDate: null, latestDate: null, categoriesInvolved: new Set(), rateValue: entry.rate
          };
        }
        acc[rateKey].entries.push(entry);
        const hours = entry.duration / 3600;
        acc[rateKey].totalHours += hours;
        const numericRate = typeof entry.rate === 'number' ? entry.rate : 0;
        acc[rateKey].totalAmount += hours * numericRate;
        if (entry.startTime) {
          if (!acc[rateKey].earliestDate || entry.startTime < acc[rateKey].earliestDate) acc[rateKey].earliestDate = entry.startTime;
          if (!acc[rateKey].latestDate || entry.startTime > acc[rateKey].latestDate) acc[rateKey].latestDate = entry.startTime;
        }
        if (entry.categoryName && entry.categoryName !== 'N/A') acc[rateKey].categoriesInvolved.add(entry.categoryName);
        return acc;
      }, {});

      const newRateSummarizedItems = Object.entries(groupedByRate).map(([rateStr, group]) => {
        const dateRangeStr = (group.earliestDate && group.latestDate)
          ? `${new Date(group.earliestDate).toLocaleDateString()} to ${new Date(group.latestDate).toLocaleDateString()}`
          : 'Date range not specified';
        let description = `Services at ${companyData.currency}${rateStr}/hr, rendered from ${dateRangeStr}.`;
        if (rateStr === "N/A") description = `Services with unspecified rate, rendered from ${dateRangeStr}.`;
        if (group.categoriesInvolved.size > 0) description += ` Categories: ${Array.from(group.categoriesInvolved).join(', ')}.`;
        return {
          description: description, quantity: group.totalHours.toFixed(2), rate: rateStr === "N/A" ? "0.00" : rateStr, amount: group.totalAmount,
        };
      });
      setInvoiceItems(newRateSummarizedItems);
    } else {
      const newInvoiceItems = selectedEntries.map(entry => {
        const entryDate = entry.startTime ? new Date(entry.startTime).toLocaleDateString() : 'N/A';
        let itemDescription = '';
        if (detailLevel === 'detail') itemDescription = `${entryDate} - ${entry.categoryName} > ${entry.taskName} > ${entry.detailName}`;
        else if (detailLevel === 'task') itemDescription = `${entryDate} - ${entry.categoryName} > ${entry.taskName}`;
        else itemDescription = `${entryDate} - ${entry.categoryName}`;
        const hours = entry.duration / 3600;
        const numericRate = typeof entry.rate === 'number' ? entry.rate : 0;
        const amount = hours * numericRate;
        return { description: itemDescription, quantity: hours.toFixed(2), rate: numericRate.toFixed(2), amount: amount };
      });
      setInvoiceItems(newInvoiceItems);
    }
  }, [selectedEntryIds, fetchedTimeEntries, detailLevel, summarizeByRate, companyData.currency]);

  const handleTimeEntrySelect = (entryId) => {
    setSelectedEntryIds(prevIds => {
      const newIds = new Set(prevIds);
      if (newIds.has(entryId)) newIds.delete(entryId); else newIds.add(entryId);
      return newIds;
    });
  };

  const calculateSubtotal = () => invoiceItems.reduce((total, item) => total + (item.amount || 0), 0);
  const calculateTax = () => calculateSubtotal() * (companyData.taxRate / 100);
  const calculateTotal = () => calculateSubtotal() + calculateTax();

  const generateAndSetInvoiceNumber = async () => {
    const invoiceCounterRef = doc(db, "counters", "invoice");
    const currentYear = new Date().getFullYear();
    try {
      const finalInvoiceNumberString = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(invoiceCounterRef);
        let nextNumber;
        if (!counterDoc.exists()) {
          nextNumber = 1;
          transaction.set(invoiceCounterRef, { currentNumber: nextNumber, year: currentYear, updatedAt: serverTimestamp() });
        } else {
          const data = counterDoc.data();
          nextNumber = data.year === currentYear ? (data.currentNumber || 0) + 1 : 1;
          transaction.update(invoiceCounterRef, { currentNumber: nextNumber, year: currentYear, updatedAt: serverTimestamp() });
        }
        return `INV-${currentYear}-${String(nextNumber).padStart(5, '0')}`;
      });
      setInvoiceNumber(finalInvoiceNumberString);
      return finalInvoiceNumberString;
    } catch (error) {
      console.error("Invoice number generation failed: ", error);
      alert("Failed to generate invoice number. Please try again or contact support.");
      const now = new Date();
      const fallbackNum = `TEMP-ERR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${now.getTime().toString().slice(-5)}`;
      setInvoiceNumber(fallbackNum);
      return null;
    }
  };

  const downloadInvoicePDF = (currentInvoiceNumberToUse) => {
    const input = document.getElementById('invoice-preview-content');
    if (!input) { console.error("Preview element not found!"); return; }
    const originalStyles = {
      width: input.style.width, minHeight: input.style.minHeight, height: input.style.height, padding: input.style.padding, backgroundColor: input.style.backgroundColor, boxShadow: input.style.boxShadow, margin: input.style.margin, borderRadius: input.style.borderRadius, color: input.style.color, overflow: input.style.overflow
    };
    input.style.width = '190mm'; input.style.minHeight = ''; input.style.height = 'auto'; input.style.padding = '0'; input.style.backgroundColor = 'white'; input.style.boxShadow = 'none'; input.style.margin = '0 auto'; input.style.borderRadius = '0'; input.style.color = 'black'; input.style.overflow = 'visible';
    const invoiceNumberElement = input.querySelector('.pdf-invoice-number-value');
    if (invoiceNumberElement) invoiceNumberElement.textContent = currentInvoiceNumberToUse;

    html2canvas(input, {
      scale: 2, useCORS: true, logging: false, letterRendering: true, allowTaint: true, scrollY: -window.scrollY, windowWidth: input.scrollWidth, windowHeight: input.scrollHeight
    }).then((canvas) => {
      Object.keys(originalStyles).forEach(key => { input.style[key] = originalStyles[key]; });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeightA4 = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const canvasAspectRatio = imgProps.width / imgProps.height;
      let imgHeightOnPDF = pdfWidth / canvasAspectRatio;
      let heightLeft = imgHeightOnPDF;
      let position = 0;
      const pageMargin = 10;
      const effectivePageHeight = pdfHeightA4 - (2 * pageMargin);
      pdf.addImage(imgData, 'PNG', pageMargin, position + pageMargin, pdfWidth - (2 * pageMargin), imgHeightOnPDF);
      heightLeft -= effectivePageHeight;
      while (heightLeft > 0) {
        position -= effectivePageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', pageMargin, position + pageMargin, pdfWidth - (2 * pageMargin), imgHeightOnPDF);
        heightLeft -= effectivePageHeight;
      }
      const clientNameForFile = (selectedClientData?.companyName || selectedClientData?.contactName || "Client").replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');
      pdf.save(`Cogenta-Invoice-${currentInvoiceNumberToUse}_${clientNameForFile}.pdf`);
    }).catch(err => {
      console.error("PDF Generation Error:", err); alert("Failed to generate PDF. Please check the console.");
      Object.keys(originalStyles).forEach(key => { input.style[key] = originalStyles[key]; });
    });
  };

  const handleInitiateInvoiceGeneration = async () => {
    if (!selectedClientId || !selectedClientData) { alert("Please select a client."); return; }
    if (invoiceItems.length === 0) { alert("Please select at least one time entry or ensure data is processed for summarized invoice."); return; }
    const newGeneratedInvoiceNum = await generateAndSetInvoiceNumber();
    if (newGeneratedInvoiceNum) {
      downloadInvoicePDF(newGeneratedInvoiceNum);
    } else {
      console.error("Invoice generation aborted due to numbering error.");
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Invoice Generation</h1>
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="client-select-invoice" style={{ marginRight: '10px' }}>Select Client:</label>
        {loadingClients ? (<p>Loading clients...</p>) : (
          <select
            id="client-select-invoice"
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
          >
            <option value="">-- Select a Client --</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>
                {client.companyName || client.contactName || `Client ID: ${client.id}`}
                {client.companyName && client.contactName && ` (Attn: ${client.contactName})`}
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedClientId && (
        <div style={{ marginBottom: '20px' }}>
          <h2>Billable Time Entries for {selectedClientData?.companyName || selectedClientData?.contactName || 'Selected Client'}</h2>
          {loadingTimeEntries ? (<p>Loading time entries...</p>)
            : fetchedTimeEntries.length === 0 ? (<p>No time entries found for this client.</p>)
            : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{border: '1px solid #ddd', padding: '8px'}}><input type="checkbox"
                    onChange={(e) => {
                        const newSelectedIds = new Set();
                        if (e.target.checked) fetchedTimeEntries.forEach(entry => newSelectedIds.add(entry.id));
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
                      <input type="checkbox" checked={selectedEntryIds.has(entry.id)} onChange={() => handleTimeEntrySelect(entry.id)}/>
                    </td>
                    <td style={{border: '1px solid #ddd', padding: '8px'}}>{entry.startTime ? new Date(entry.startTime).toLocaleDateString() : 'N/A'}</td>
                    <td style={{border: '1px solid #ddd', padding: '8px'}}>{`${entry.categoryName} > ${entry.taskName} > ${entry.detailName}`}</td>
                    <td style={{border: '1px solid #ddd', padding: '8px'}}>{entry.duration ? (entry.duration / 3600).toFixed(2) : '0.00'} hrs</td>
                    <td style={{border: '1px solid #ddd', padding: '8px'}}>
                        {typeof entry.rate === 'number' ? `${companyData.currency}${parseFloat(entry.rate).toFixed(2)}` : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
        </div>
      )}

      {selectedClientId && (
          <div style={{ marginBottom: '20px' }}>
            <h3>Invoice Options</h3>
            {!summarizeByRate && (
                <div style={{ marginBottom: '10px' }}>
                    <label htmlFor="detail-level-select" style={{ marginRight: '10px' }}>Level of Detail on Invoice:</label>
                    <select id="detail-level-select" value={detailLevel} onChange={(e) => setDetailLevel(e.target.value)}>
                        <option value="detail">Category &gt; Task &gt; Detail</option>
                        <option value="task">Category &gt; Task</option>
                        <option value="category">Category Only</option>
                    </select>
                </div>
            )}
            <div>
              <input
                type="checkbox"
                id="summarize-by-rate-checkbox"
                checked={summarizeByRate}
                onChange={(e) => setSummarizeByRate(e.target.checked)}
              />
              <label htmlFor="summarize-by-rate-checkbox" style={{ marginLeft: '5px' }}>Summarize by Hourly Rate</label>
            </div>
          </div>
      )}

      {selectedClientId && (
        <div style={{ marginTop: '20px' }}>
          <button onClick={handleInitiateInvoiceGeneration} disabled={selectedEntryIds.size === 0 || invoiceItems.length === 0}>
            Generate & Download Invoice PDF
          </button>
        </div>
      )}

      {/* Hidden Div for PDF Content */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
        <div id="invoice-preview-content" style={{ fontFamily: 'Arial, sans-serif', fontSize: '10pt', color: 'black', backgroundColor: 'white', padding: '20mm', width: '210mm', boxSizing: 'border-box' }}>

          {/* Section 1: Your Company Info (Left) and Invoice Meta (Right) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10mm' }}>
            <div style={{ flex: 1.5, textAlign: 'left' }}>
              {companyData.logoUrl && <img src={companyData.logoUrl} alt="Company Logo" style={{ width: '50mm', marginBottom: '5mm' }} />}
              <p style={{ fontWeight: 'bold', fontSize: '11pt', margin: '0 0 1.5mm 0' }}>{companyData.companyName}</p>
              <p style={{ margin: '0 0 0.5mm 0', whiteSpace: 'pre-line' }}>{companyData.companyAddress}</p>
              <p style={{ margin: '0 0 0.5mm 0' }}>VAT: {companyData.companyNumber}</p>
              <p style={{ margin: '0 0 0.5mm 0' }}>Bank: {companyData.bankAccount}</p>
              <p style={{ margin: '0 0 0.5mm 0' }}>Email: {companyData.companyEmail}</p>
              <p style={{ margin: '0 0 0.5mm 0' }}>Web: {companyData.companyWebsite}</p>
            </div>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <h1 style={{ fontSize: '24pt', margin: '0 0 5mm 0', color: '#333333', textTransform: 'uppercase' }}>INVOICE</h1>
              <p style={{ margin: '0 0 1.5mm 0' }}><strong>Invoice #:</strong> <span className="pdf-invoice-number-value">{invoiceNumber}</span></p>
              <p style={{ margin: '0 0 1.5mm 0' }}><strong>Date:</strong> {invoiceDate ? new Date(invoiceDate + 'T00:00:00').toLocaleDateString() : 'N/A'}</p>
              <p style={{ margin: '0 0 1.5mm 0' }}><strong>Due Date:</strong> {invoiceDueDate ? new Date(invoiceDueDate + 'T00:00:00').toLocaleDateString() : 'N/A'}</p>
            </div>
          </div>

          {/* Section 2: Bill To Information */}
          {selectedClientData && (
            <div style={{ marginBottom: '12mm', textAlign: 'left' }}>
              <h3 style={{ margin: '0 0 3mm 0', fontSize: '10pt', borderBottom: '0.5px solid #cccccc', paddingBottom: '1.5mm', color: '#555555', display: 'inline-block' }}>BILL TO:</h3>
              {selectedClientData.companyName && (
                <p style={{ fontWeight: 'bold', margin: '2mm 0 1.5mm 0' }}>{selectedClientData.companyName}</p>
              )}
              {selectedClientData.contactName && (
                <p style={{ margin: `0 0 ${selectedClientData.address || selectedClientData.vatNumber || selectedClientData.email ? '0.5mm' : '1.5mm'} 0` }}>
                  {selectedClientData.companyName ? `Attn: ${selectedClientData.contactName}` : selectedClientData.contactName}
                </p>
              )}
              {!selectedClientData.companyName && !selectedClientData.contactName && selectedClientData.name && (
                 <p style={{ fontWeight: 'bold', margin: '2mm 0 1.5mm 0' }}>{selectedClientData.name}</p>
              )}
               {!selectedClientData.companyName && !selectedClientData.contactName && !selectedClientData.name && (
                 <p style={{ fontWeight: 'bold', margin: '2mm 0 1.5mm 0' }}>Client Name Not Available</p>
              )}
              {selectedClientData.address && (
                <p style={{ margin: '0 0 0.5mm 0', whiteSpace: 'pre-line' }}>{selectedClientData.address}</p>
              )}
              {selectedClientData.vatNumber &&
                <p style={{ margin: '0 0 0.5mm 0' }}>VAT: {selectedClientData.vatNumber}</p>
              }
              {selectedClientData.email && <p style={{ margin: '0 0 0.5mm 0' }}>Email: {selectedClientData.email}</p>}
            </div>
          )}

          {/* Section 3: Invoice Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8mm', fontSize: '9pt' }}>
            <thead>
              <tr>
                <th style={{ border: '0.5px solid #dddddd', padding: '2.5mm', textAlign: 'left' }}>Description</th>
                <th style={{ border: '0.5px solid #dddddd', padding: '2.5mm', textAlign: 'right', width: '25mm' }}>{summarizeByRate ? 'Total Hours' : 'Hours/Qty'}</th>
                <th style={{ border: '0.5px solid #dddddd', padding: '2.5mm', textAlign: 'right', width: '25mm' }}>Rate</th>
                <th style={{ border: '0.5px solid #dddddd', padding: '2.5mm', textAlign: 'right', width: '30mm' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoiceItems.map((item, index) => (
                <tr key={index}>
                  <td style={{ border: '0.5px solid #dddddd', padding: '2.5mm', whiteSpace: 'pre-line' }}>{item.description}</td>
                  <td style={{ border: '0.5px solid #dddddd', padding: '2.5mm', textAlign: 'right' }}>{item.quantity}</td>
                  <td style={{ border: '0.5px solid #dddddd', padding: '2.5mm', textAlign: 'right' }}>
                    {item.rate === "0.00" && summarizeByRate && item.description.toLowerCase().includes("unspecified rate")
                        ? "N/A"
                        : `${companyData.currency}${item.rate}`
                    }
                  </td>
                  <td style={{ border: '0.5px solid #dddddd', padding: '2.5mm', textAlign: 'right' }}>{companyData.currency}{(item.amount || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Section 4: Totals Section */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8mm' }}>
            <div style={{ width: '75mm', fontSize: '9pt' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1.5mm 0', borderBottom: '0.25px solid #eeeeee' }}><span>Subtotal:</span><span>{companyData.currency}{calculateSubtotal().toFixed(2)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1.5mm 0', borderBottom: '0.25px solid #eeeeee' }}><span>Tax (VAT {companyData.taxRate}%):</span><span>{companyData.currency}{calculateTax().toFixed(2)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2mm 0', fontWeight: 'bold', fontSize: '10pt', borderTop: '1px solid #555555', marginTop: '1mm' }}><span>TOTAL:</span><span>{companyData.currency}{calculateTotal().toFixed(2)}</span></div>
            </div>
          </div>

          {/* Section 5: Notes and Footer */}
          {invoiceNotes && (
            <div style={{ marginBottom: '15mm', fontSize: '8.5pt', borderTop: '0.5px solid #eeeeee', paddingTop: '3mm', textAlign: 'left' }}>
                <h4 style={{ margin: '0 0 1.5mm 0', fontSize: '9pt' }}>Notes:</h4>
                <p style={{ margin: '0', whiteSpace: 'pre-line' }}>{invoiceNotes}</p>
            </div>
          )}
          <div style={{ fontSize: '8pt', color: '#666666', textAlign: 'center', paddingTop: '5mm', borderTop: '0.5px solid #cccccc', marginTop: 'auto' }}>
            <p>{companyData.companyName} | {companyData.companyTagline}</p>
          </div>
        </div> {/* Closes #invoice-preview-content */}
      </div> {/* Closes the outer hidden div */}
    </div> // Closes the main component div
  );
}

export default InvoicePage;