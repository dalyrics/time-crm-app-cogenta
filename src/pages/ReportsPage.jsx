// ReportsPage.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  getDoc,
  doc
} from 'firebase/firestore';

function ReportsPage() {
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filteredTimeEntries, setFilteredTimeEntries] = useState([]);
  const [loadingReport, setLoadingReport] = useState(false);

  const [totalDurationSeconds, setTotalDurationSeconds] = useState(0);
  const [totalCalculatedPrice, setTotalCalculatedPrice] = useState(0);

  // Fetch clients for the filter dropdown
  useEffect(() => {
    const fetchClientsForFilter = async () => {
      try {
        const clientsSnapshot = await getDocs(collection(db, 'clients'));
        // Ensure client data includes companyName and contactName
        setClients(clientsSnapshot.docs.map(d => ({
          id: d.id,
          ...d.data() // Spread all client data
        })));
      } catch (error) {
        console.error("Error fetching clients for filter:", error);
        // Handle error appropriately in your UI if needed
      }
    };
    fetchClientsForFilter();
  }, []);

  // Helper to format date to YYYY-MM-DD
  const formatDateToISO = (date) => {
    if (!date || !(date instanceof Date)) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const setDateRangeForCurrentMonth = () => {
    const today = new Date();
    const firstDayCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    setStartDate(formatDateToISO(firstDayCurrentMonth));
    setEndDate(formatDateToISO(lastDayCurrentMonth));
  };

  const setDateRangeForLastMonth = () => {
    const today = new Date();
    const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    setStartDate(formatDateToISO(firstDayLastMonth));
    setEndDate(formatDateToISO(lastDayLastMonth));
  };

  const handleResetFilters = () => {
    setSelectedClientId('');
    setStartDate('');
    setEndDate('');
    setFilteredTimeEntries([]);
    setTotalDurationSeconds(0);
    setTotalCalculatedPrice(0);
  };

  const handleGenerateReport = async () => {
    setLoadingReport(true);
    setFilteredTimeEntries([]);
    setTotalDurationSeconds(0);
    setTotalCalculatedPrice(0);
    try {
      let timeEntriesQuery = collection(db, 'timeEntries');
      const conditions = [];
      if (selectedClientId) {
        conditions.push(where('clientRef', '==', doc(db, 'clients', selectedClientId)));
      }
      if (startDate) {
        // Ensure startDate is at the beginning of the day
        const startDateTime = new Date(startDate);
        startDateTime.setHours(0, 0, 0, 0);
        conditions.push(where('startTime', '>=', Timestamp.fromDate(startDateTime)));
      }
      if (endDate) {
        // Ensure endDate is at the end of the day
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        conditions.push(where('startTime', '<=', Timestamp.fromDate(endDateTime)));
      }

      if (conditions.length > 0) {
        timeEntriesQuery = query(timeEntriesQuery, ...conditions, orderBy('startTime', 'desc'));
      } else {
        timeEntriesQuery = query(timeEntriesQuery, orderBy('startTime', 'desc'));
      }

      const querySnapshot = await getDocs(timeEntriesQuery);
      let currentTotalDuration = 0;
      let currentTotalPrice = 0.0;

      const entriesListPromises = querySnapshot.docs.map(async (docEntry) => {
        const entryData = docEntry.data();
        let clientNameDisplay = 'N/A'; // For the report table
        let categoryName = 'N/A', taskName = 'N/A', detailName = 'N/A', detailHourlyRate = null;

        if (entryData.clientRef) {
          try {
            const clientDocSnap = await getDoc(entryData.clientRef);
            if (clientDocSnap.exists()) {
              const clientData = clientDocSnap.data();
              // Prioritize companyName, then contactName for display in the report
              clientNameDisplay = clientData.companyName || clientData.contactName || clientData.name || 'Client Undefined';
            }
          } catch (e) {
            console.error("Error fetching client for report entry:", e);
            clientNameDisplay = "Error fetching client";
          }
        }

        if (entryData.detailRef) {
          try {
            const detailDocSnap = await getDoc(entryData.detailRef);
            if (detailDocSnap.exists()) {
              const detailData = detailDocSnap.data();
              detailName = detailData.name || 'Unk Detail';
              detailHourlyRate = detailData.hourlyRate;
              const taskRef = detailDocSnap.ref.parent.parent;
              if (taskRef) {
                const taskSnap = await getDoc(taskRef);
                if (taskSnap.exists()) {
                  taskName = taskSnap.data().name || 'Unk Task';
                  const catRef = taskSnap.ref.parent.parent;
                  if (catRef) {
                    const catSnap = await getDoc(catRef);
                    if (catSnap.exists()) categoryName = catSnap.data().name || 'Unk Cat';
                  }
                }
              }
            }
          } catch (e) {
            console.error("Error fetching work item hierarchy for report entry:", e);
          }
        }
        currentTotalDuration += entryData.duration || 0;
        if (detailHourlyRate && typeof entryData.duration === 'number' && entryData.duration > 0) {
          const hours = (entryData.duration / 3600);
          currentTotalPrice += hours * parseFloat(detailHourlyRate);
        }
        return {
          id: docEntry.id,
          ...entryData,
          clientName: clientNameDisplay, // Use the determined client name for the table
          categoryName,
          taskName,
          detailName,
          detailHourlyRate,
          startTime: entryData.startTime?.toDate(),
          endTime: entryData.endTime?.toDate()
        };
      });
      const resolvedEntriesList = await Promise.all(entriesListPromises);
      setFilteredTimeEntries(resolvedEntriesList);
      setTotalDurationSeconds(currentTotalDuration);
      setTotalCalculatedPrice(currentTotalPrice);
    } catch (error) {
      console.error("Error generating report:", error);
      if (error.code === 'failed-precondition' && error.message.includes('index')) {
        alert("A Firestore index is required. Check console for a link to create it.");
      } else {
        alert("Failed to generate report. See console.");
      }
      setFilteredTimeEntries([]);
      setTotalDurationSeconds(0);
      setTotalCalculatedPrice(0);
    } finally {
      setLoadingReport(false);
    }
  };

  const justDate = (d) => d ? new Date(d).toLocaleDateString() : 'N/A';
  const justTime = (d) => d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : 'N/A';
  const formatDuration = (s) => {
    if (s === null || s === undefined || s < 0) return '00:00:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const handleExportCSV = () => {
    if (filteredTimeEntries.length === 0) { alert("No data to export."); return; }
    const headers = ["Date", "Client", "Category", "Task", "Detail", "Duration (HH:MM:SS)", "Start Time", "End Time", "Rate (excl. VAT) (€/hr)", "Calculated Price (excl. VAT) (€)"];
    const escape = (c) => (c === null || c === undefined) ? '' : (String(c).includes(',') || String(c).includes('"') || String(c).includes('\n')) ? `"${String(c).replace(/"/g, '""')}"` : String(c);
    const csvRows = filteredTimeEntries.map(e => {
      const hours = (e.duration / 3600);
      const entryPrice = (e.detailHourlyRate && typeof e.duration === 'number' && e.duration > 0) ? (hours * parseFloat(e.detailHourlyRate)).toFixed(2) : '';
      return [
        escape(justDate(e.startTime)),
        escape(e.clientName), // This now uses companyName or contactName from handleGenerateReport
        escape(e.categoryName),
        escape(e.taskName),
        escape(e.detailName),
        escape(formatDuration(e.duration)),
        escape(justTime(e.startTime)),
        escape(justTime(e.endTime)),
        escape(e.detailHourlyRate !== undefined && e.detailHourlyRate !== null ? Number(e.detailHourlyRate).toFixed(2) : ''),
        escape(entryPrice)
      ].join(',');
    });
    const totalDurationFormatted = formatDuration(totalDurationSeconds);
    const totalPriceFormatted = totalCalculatedPrice.toFixed(2);
    const totalsCsvRow = ["", "", "", "", "TOTALS:", totalDurationFormatted, "", "", "", totalPriceFormatted].join(',');
    const csvString = [headers.join(','), ...csvRows, "", totalsCsvRow].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    let filename = "timesheet_report";
    if (selectedClientId) {
      const client = clients.find(c => c.id === selectedClientId);
      if (client) filename += `|${(client.companyName || client.contactName || client.id).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '')}`;
    } else {
      filename += `|AllClients`;
    }
    const sD = startDate?.replace(/-/g, '') || '';
    const eD = endDate?.replace(/-/g, '') || '';
    if (sD && eD) filename += `_${sD}-${eD}`;
    else if (sD) filename += `_from-${sD}`;
    else if (eD) filename += `_until-${eD}`;
    filename += ".csv";
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Reports - Timesheet</h1>
      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '5px' }}>
        <h2>Filters</h2>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="clientFilter" style={{ marginRight: '10px' }}>Client:</label>
          <select
            id="clientFilter"
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
          >
            <option value="">All Clients</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>
                {client.companyName || client.contactName || `Client ID: ${client.id}`}
                {client.companyName && client.contactName && ` (Attn: ${client.contactName})`}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="startDateFilter" style={{ marginRight: '10px' }}>Start Date:</label>
          <input type="date" id="startDateFilter" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="endDateFilter" style={{ marginRight: '10px' }}>End Date:</label>
          <input type="date" id="endDateFilter" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <button type="button" onClick={setDateRangeForCurrentMonth} style={{ marginRight: '10px' }}>Current Month</button>
          <button type="button" onClick={setDateRangeForLastMonth} style={{ marginRight: '10px' }}>Last Month</button>
        </div>
        <div style={{ marginTop: '15px' }}>
          <button onClick={handleGenerateReport} disabled={loadingReport} style={{ marginRight: '10px' }}>
            {loadingReport ? 'Generating...' : 'Generate Report'}
          </button>
          <button type="button" onClick={handleResetFilters}>
            Reset Filters
          </button>
        </div>
      </div>

      {loadingReport && <p>Loading report data...</p>}
      {!loadingReport && filteredTimeEntries.length === 0 && (
        <div style={{ marginTop: '20px' }}>
          <h2>Report Results</h2>
          <p>No time entries found for the selected filters, or no report generated yet.</p>
        </div>
      )}
      {!loadingReport && filteredTimeEntries.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h2>Report Results</h2>
          <div style={{ margin: '20px 0', padding: '15px', border: '1px solid #007bff', borderRadius: '5px', backgroundColor: '#f0f8ff', color: '#333' }}>
            <h3>Report Summary</h3>
            <p><strong>Total Duration:</strong> {formatDuration(totalDurationSeconds)}</p>
            <p><strong>Total Calculated Price (excl. VAT):</strong> €{totalCalculatedPrice.toFixed(2)}</p>
          </div>
          <button onClick={handleExportCSV} style={{ marginBottom: '15px' }}>Export to CSV</button>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Date</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Client</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Category</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Task</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Detail</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Duration</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Rate (excl. VAT) (€/hr)</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Price (excl. VAT) (€)</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Start Time</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>End Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredTimeEntries.map(entry => {
                const hours = (entry.duration / 3600);
                const entryPrice = (entry.detailHourlyRate && typeof entry.duration === 'number' && entry.duration > 0)
                  ? (hours * parseFloat(entry.detailHourlyRate))
                  : null;
                return (
                  <tr key={entry.id}>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{justDate(entry.startTime)}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{entry.clientName}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{entry.categoryName}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{entry.taskName}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{entry.detailName}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{formatDuration(entry.duration)}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{entry.detailHourlyRate?.toFixed(2) || ''}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{entryPrice !== null ? entryPrice.toFixed(2) : 'N/A'}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{justTime(entry.startTime)}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{justTime(entry.endTime)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="5" style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>TOTALS:</td>
                <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold' }}>{formatDuration(totalDurationSeconds)}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}></td> {/* Empty for Rate */}
                <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>€{totalCalculatedPrice.toFixed(2)}</td>
                <td colSpan="2" style={{ border: '1px solid #ddd', padding: '8px' }}></td> {/* Empty for Start/End Time */}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

export default ReportsPage;