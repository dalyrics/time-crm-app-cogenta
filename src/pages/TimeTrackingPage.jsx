import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, addDoc, doc, getDoc, orderBy, updateDoc, deleteDoc } from 'firebase/firestore'; // Added updateDoc and deleteDoc

function TimeTrackingPage() {
  // State for lists needed for selection (kept the same)
  const [clients, setClients] = useState([]);
  const [workItemDetails, setWorkItemDetails] = useState([]);

  // State for the user's current selection (kept the same)
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedDetail, setSelectedDetail] = useState('');

  const [loadingData, setLoadingData] = useState(true); // Loading state for fetching selection data

  // State for Timer (kept the same)
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0); // in seconds

  // State for displaying Time Entries List (kept the same)
  const [timeEntriesList, setTimeEntriesList] = useState([]);
  const [loadingTimeEntries, setLoadingTimeEntries] = useState(true);

  // --- State for Manual Add/Edit Form ---
  const [isManualFormVisible, setIsManualFormVisible] = useState(false); // Is the manual form visible?
  const [editingEntry, setEditingEntry] = useState(null); // The entry being edited (or null)
  // State for manual form inputs - using strings initially for inputs
  const [manualClient, setManualClient] = useState('');
  const [manualDetail, setManualDetail] = useState('');
  const [manualStartDate, setManualStartDate] = useState(''); // e.g., "YYYY-MM-DD"
  const [manualStartTime, setManualStartTime] = useState(''); // e.g., "HH:MM"
  const [manualEndDate, setManualEndDate] = useState('');   // e.g., "YYYY-MM-DD"
  const [manualEndTime, setManualEndTime] = useState('');   // e.g., "HH:MM"
   // Optional: Could add a notes field here later


  // --- Data Fetching for Selection Dropdowns (kept the same) ---
  useEffect(() => {
     // ... (kept the same as Step 5.4)
     const fetchDataForSelection = async () => {
       setLoadingData(true);
       try {
         const clientsCollectionRef = collection(db, 'clients');
         const clientsSnapshot = await getDocs(clientsCollectionRef);
         const clientsList = clientsSnapshot.docs.map(docData => ({ id: docData.id, name: docData.data().name }));
         setClients(clientsList);

         const categoriesRef = collection(db, 'categories');
         const categoriesSnapshot = await getDocs(categoriesRef);
         let allDetails = [];

         for (const categoryDoc of categoriesSnapshot.docs) {
           const categoryData = categoryDoc.data();
           const tasksRef = collection(db, 'categories', categoryDoc.id, 'tasks');
           const tasksSnapshot = await getDocs(tasksRef);

           for (const taskDoc of tasksSnapshot.docs) {
             const taskData = taskDoc.data();
             const detailsRef = collection(db, 'categories', categoryDoc.id, 'tasks', taskDoc.id, 'details');
             const detailsSnapshot = await getDocs(detailsRef);

             detailsSnapshot.docs.forEach(detailDoc => {
               const detailData = detailDoc.data();
               allDetails.push({
                 id: detailDoc.id, categoryId: categoryDoc.id, taskId: taskDoc.id,
                 name: `${categoryData.name} > ${taskData.name} > ${detailData.name}`
               });
             });
           }
         }
         setWorkItemDetails(allDetails);
       } catch (error) { console.error("Error fetching data for selection:", error); alert("Failed to load selection options. Please try refreshing. Details in console."); } finally { setLoadingData(false); }
     };
     fetchDataForSelection();
   }, []);


  // --- Timer Logic (kept the same) ---
  useEffect(() => {
    // ... (kept the same as Step 5.4)
    let intervalId; if (isRunning) { intervalId = setInterval(() => { setElapsedTime((prevElapsedTime) => prevElapsedTime + 1); }, 1000); } else { clearInterval(intervalId); } return () => clearInterval(intervalId);
  }, [isRunning]);

  const formatTime = (totalSeconds) => {
     // ... (kept the same as Step 5.4)
     const hours = Math.floor(totalSeconds / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60); const seconds = totalSeconds % 60; const paddedHours = String(hours).padStart(2, '0'); const paddedMinutes = String(minutes).padStart(2, '0'); const paddedSeconds = String(seconds).padStart(2, '0'); return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
  };


  // --- Event Handlers ---

  // Function to handle starting the timer (kept the same)
  const handleStartTime = () => {
     // ... (kept the same as Step 5.4)
     if (!selectedClient || !selectedDetail) { alert("Please select both a Client and a Work Item Detail before starting."); return; } setStartTime(new Date()); setElapsedTime(0); setIsRunning(true);
  };

  // Function to handle stopping the timer AND saving the entry (kept the same, based on your fixed version)
  const handleStopTime = async () => {
     // ... (kept the same as your fixed version)
     setIsRunning(false);
     if (startTime && elapsedTime > 0 && selectedClient && selectedDetail) {
       const detailObject = workItemDetails.find(d => d.id === selectedDetail);
       if (!detailObject) { console.error("Selected detail (", selectedDetail, ") not found in fetched workItemDetails list:", workItemDetails); alert("Error saving entry: Could not find the selected work item's data. The list might be outdated or the ID is incorrect."); return; }
       const timeEntry = {
         startTime: startTime, endTime: new Date(), duration: elapsedTime,
         clientRef: doc(db, 'clients', selectedClient),
         detailRef: doc(db, 'categories', detailObject.categoryId, 'tasks', detailObject.taskId, 'details', selectedDetail),
         createdAt: new Date(),
       };
       try {
         const timeEntriesCollectionRef = collection(db, 'timeEntries');
         await addDoc(timeEntriesCollectionRef, timeEntry);
         console.log("Time entry saved successfully!", timeEntry);
         alert("Time entry saved!");
         setStartTime(null); setElapsedTime(0);
         fetchTimeEntries(); // Re-fetch recent entries after saving
       } catch (error) { console.error("Error saving time entry:", error); alert("Failed to save time entry. See console for details."); }
     } else {
        if (elapsedTime === 0 && startTime) { console.log("Timer stopped, but no time was recorded (elapsedTime is 0)."); alert("Timer stopped. No time was recorded."); } else if (!selectedClient || !selectedDetail) { console.log("Timer stopped, but client or detail was not selected when timer was (theoretically) started."); } else { console.log("Timer stopped, but no entry to save (conditions not met)."); }
        setStartTime(null); setElapsedTime(0);
     }
   };


  // --- Fetch and Display Time Entries (kept the same) ---

  // Function to fetch time entries and their related client/detail data
  const fetchTimeEntries = async () => {
    setLoadingTimeEntries(true);
    try {
      const timeEntriesCollectionRef = collection(db, 'timeEntries');
      // Order by createdAt timestamp to show recent entries first
      const q = query(timeEntriesCollectionRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);

      const entriesList = [];
      for (const docEntry of querySnapshot.docs) {
        const entryData = docEntry.data();

        let clientName = 'Client Not Found';
        let detailName = 'Detail Not Found';
        let detailHourlyRate = null;

        // Fetch related Client document (handle potential errors)
        if (entryData.clientRef) {
          try {
            const clientDoc = await getDoc(entryData.clientRef);
            if (clientDoc.exists()) {
              clientName = clientDoc.data().name;
            }
          } catch (error) {
             console.error("Error fetching client for entry:", docEntry.id, error);
             clientName = 'Error fetching Client';
          }
        }

        // Fetch related Work Item Detail document (handle potential errors)
        if (entryData.detailRef) {
           try {
             const detailDoc = await getDoc(entryData.detailRef);
             if (detailDoc.exists()) {
               const detailData = detailDoc.data();
               detailName = detailData.name;
               detailHourlyRate = detailData.hourlyRate;
             }
           } catch (error) {
              console.error("Error fetching detail for entry:", docEntry.id, error);
              detailName = 'Error fetching Detail';
           }
        }

        entriesList.push({
          id: docEntry.id,
          ...entryData,
          clientName: clientName,
          detailName: detailName,
          detailHourlyRate: detailHourlyRate,
          // Convert Timestamps to JS Dates for easier use in manual form later
          startTime: entryData.startTime?.toDate ? entryData.startTime.toDate() : null,
          endTime: entryData.endTime?.toDate ? entryData.endTime.toDate() : null,
        });
      }

      setTimeEntriesList(entriesList);

    } catch (error) {
      console.error("Error fetching time entries:", error);
      alert("Failed to load time entries. Please try refreshing. Details in console.");
      setTimeEntriesList([]);
    } finally {
      setLoadingTimeEntries(false);
    }
  };

  // useEffect to fetch time entries when the page loads
  useEffect(() => {
     fetchTimeEntries();
  }, []); // Empty dependency array means fetch on mount

  // Helper to format duration (kept the same)
  const formatDuration = (seconds) => {
      return formatTime(seconds);
  };

  // Helper to format date and time (kept the same, adjusted to handle JS Date or Firestore Timestamp)
  const formatDate = (timestamp) => {
      if (!timestamp) return 'N/A';
      // Check if it's a Firestore Timestamp (has toDate method) or already a JS Date
      const date = timestamp.toDate ? timestamp.toDate() : (timestamp instanceof Date ? timestamp : new Date(timestamp));
      return date.toLocaleString();
  };

   // Helper to format Date object to "YYYY-MM-DD" string
   const formatDateToISO = (date) => {
        if (!date || !(date instanceof Date)) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
   };

    // Helper to format Date object to "HH:MM" string
    const formatTimeToHHMM = (date) => {
        if (!date || !(date instanceof Date)) return '';
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    // Helper to calculate duration in seconds from start and end Date objects
    const calculateDurationInSeconds = (startDate, endDate) => {
        if (!startDate || !endDate || !(startDate instanceof Date) || !(endDate instanceof Date)) return 0;
        const diffInMilliseconds = endDate.getTime() - startDate.getTime();
        return Math.max(0, Math.floor(diffInMilliseconds / 1000)); // Ensure non-negative duration
    };


  // --- Manual Add/Edit Functions ---

  // 4. Show the manual entry form for adding
  const handleShowManualForm = () => {
      setEditingEntry(null); // Ensure we are adding, not editing
      setManualClient('');
      setManualDetail('');
      setManualStartDate('');
      setManualStartTime('');
      setManualEndDate('');
      setManualEndTime('');
      setIsManualFormVisible(true);
  };

  // 5. Show the manual entry form for editing an existing entry
  const handleEditEntryClick = (entry) => {
      setEditingEntry(entry); // Set the entry we are editing
      // Populate the manual form state with the entry's data
      setManualClient(entry.clientRef?.id || ''); // Use ID from reference
      setManualDetail(entry.detailRef?.id || ''); // Use ID from reference
      setManualStartDate(formatDateToISO(entry.startTime));
      setManualStartTime(formatTimeToHHMM(entry.startTime));
      setManualEndDate(formatDateToISO(entry.endTime));
      setManualEndTime(formatTimeToHHMM(entry.endTime));
      setIsManualFormVisible(true); // Show the form
  };

  // 6. Handle input changes in the manual form
  const handleManualInputChange = (e) => {
      const { id, value } = e.target;
      if (id === 'manualClient') setManualClient(value);
      else if (id === 'manualDetail') setManualDetail(value);
      else if (id === 'manualStartDate') setManualStartDate(value);
      else if (id === 'manualStartTime') setManualStartTime(value);
      else if (id === 'manualEndDate') setManualEndDate(value);
      else if (id === 'manualEndTime') setManualEndTime(value);
  };

  // 7. Handle submission of the manual entry form (Add or Update)
  const handleManualSubmit = async (e) => {
      e.preventDefault();

      // Basic validation
      if (!manualClient || !manualDetail || !manualStartDate || !manualStartTime || !manualEndDate || !manualEndTime) {
          alert("Please fill in all required fields for the time entry.");
          return;
      }

      // Combine date and time strings into Date objects
      const startDate = new Date(`${manualStartDate}T${manualStartTime}:00`); // Use T for ISO 8601 format
      const endDate = new Date(`${manualEndDate}T${manualEndTime}:00`);

      // Validate dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          alert("Invalid date or time format.");
          return;
      }
      if (endDate < startDate) {
          alert("End time cannot be before start time.");
          return;
      }

      const durationInSeconds = calculateDurationInSeconds(startDate, endDate);
      if (durationInSeconds === 0) {
          alert("Duration must be greater than zero.");
          return;
      }

      // Find the full detail object to get categoryId and taskId for the reference path
      const detailObject = workItemDetails.find(d => d.id === manualDetail);
       if (!detailObject) {
         console.error("Selected detail (", manualDetail, ") not found in fetched workItemDetails list:", workItemDetails);
         alert("Error saving entry: Could not find the selected work item's data.");
         return;
       }


      const entryData = {
          startTime: startDate,
          endTime: endDate,
          duration: durationInSeconds,
          clientRef: doc(db, 'clients', manualClient),
          detailRef: doc(db, 'categories', detailObject.categoryId, 'tasks', detailObject.taskId, 'details', manualDetail),
          // Notes field could be added here from another input
      };

      try {
          if (editingEntry) {
              // --- Update Existing Entry ---
              const entryDocRef = doc(db, 'timeEntries', editingEntry.id);
              await updateDoc(entryDocRef, { ...entryData, updatedAt: new Date() }); // Add updatedAt for updates
              console.log(`Time entry with ID ${editingEntry.id} updated successfully!`);
              alert("Time entry updated!");
          } else {
              // --- Add New Manual Entry ---
               // Add createdAt timestamp only for new entries
              await addDoc(collection(db, 'timeEntries'), { ...entryData, createdAt: new Date() });
              console.log("Manual time entry added successfully!");
              alert("Manual time entry added!");
          }

          // Hide form and refresh list after saving
          setIsManualFormVisible(false);
          setEditingEntry(null);
          fetchTimeEntries(); // Re-fetch list

      } catch (error) {
          console.error("Error saving manual/edited time entry:", error);
          alert("Failed to save time entry. See console for details.");
      }
  };

  // 8. Handle deleting a time entry
  const handleDeleteEntry = async (entryId) => {
      if (window.confirm("Are you sure you want to delete this time entry?")) {
          try {
              const entryDocRef = doc(db, 'timeEntries', entryId);
              await deleteDoc(entryDocRef);
              console.log(`Time entry with ID ${entryId} deleted successfully!`);
              // Remove the entry from the local list immediately for faster UI update
              setTimeEntriesList(prevList => prevList.filter(entry => entry.id !== entryId));
              // Alternatively, re-fetch the whole list: fetchTimeEntries();
          } catch (error) {
              console.error("Error deleting time entry:", error);
              alert("Failed to delete time entry. See console for details.");
          }
      }
  };

  // 9. Hide the manual entry form
  const handleCancelManualForm = () => {
      setIsManualFormVisible(false);
      setEditingEntry(null); // Clear editing state
  };


  // --- Render the UI ---
  return (
    <div>
      <h1>Time Tracking</h1>

      {/* Button to show manual entry form */}
      {!isManualFormVisible && !isRunning && !loadingData && (
           <button onClick={handleShowManualForm} style={{ marginBottom: '20px' }}>
               + Add Manual Entry
           </button>
       )}

      {loadingData && <p>Loading client and work item options...</p>}

      {!loadingData && (
        <div>
          {/* --- Manual Add/Edit Form (Conditionally shown) --- */}
           {isManualFormVisible && (
             <div style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
                 <h2>{editingEntry ? 'Edit Time Entry' : 'Add Manual Entry'}</h2>
                 <form onSubmit={handleManualSubmit}>
                      {/* Client Selection */}
                     <div style={{ marginBottom: '10px' }}>
                       <label htmlFor="manualClient" style={{ marginRight: '5px' }}>Client:</label>
                       <select
                         id="manualClient"
                         value={manualClient}
                         onChange={handleManualInputChange}
                         required
                       >
                         <option value="">-- Select a Client --</option>
                         {clients.map(client => (
                           <option key={client.id} value={client.id}>
                             {client.name}
                           </option>
                         ))}
                       </select>
                     </div>

                     {/* Work Item Detail Selection */}
                     <div style={{ marginBottom: '10px' }}>
                       <label htmlFor="manualDetail" style={{ marginRight: '5px' }}>Work Item Detail:</label>
                       <select
                         id="manualDetail"
                         value={manualDetail}
                         onChange={handleManualInputChange}
                         required
                       >
                          <option value="">-- Select a Work Item Detail --</option>
                         {workItemDetails.map(detail => (
                           <option key={detail.id} value={detail.id}>
                             {detail.name}
                           </option>
                         ))}
                       </select>
                     </div>

                      {/* Start Date and Time */}
                     <div style={{ marginBottom: '10px' }}>
                         <label htmlFor="manualStartDate" style={{ marginRight: '5px' }}>Start:</label>
                         <input type="date" id="manualStartDate" value={manualStartDate} onChange={handleManualInputChange} required style={{ marginRight: '5px' }}/>
                         <input type="time" id="manualStartTime" value={manualStartTime} onChange={handleManualInputChange} required />
                     </div>

                      {/* End Date and Time */}
                     <div style={{ marginBottom: '10px' }}>
                         <label htmlFor="manualEndDate" style={{ marginRight: '5px' }}>End:</label>
                         <input type="date" id="manualEndDate" value={manualEndDate} onChange={handleManualInputChange} required style={{ marginRight: '5px' }}/>
                         <input type="time" id="manualEndTime" value={manualEndTime} onChange={handleManualInputChange} required />
                     </div>

                      {/* Optional: Notes field could go here */}

                     <button type="submit" style={{ marginRight: '10px' }}>{editingEntry ? 'Update Entry' : 'Add Entry'}</button>
                     <button type="button" onClick={handleCancelManualForm}>Cancel</button>
                 </form>
             </div>
           )}


          {/* --- Timer Controls and Display (Only shown if manual form is NOT visible) --- */}
          {!isManualFormVisible && (
             <div>
                <h2>Start New Time Entry</h2> {/* Title for the timer section */}
                <form onSubmit={(e) => e.preventDefault()}>
                  {/* Client Selection (kept the same, disabled if timer running) */}
                  <div style={{ marginBottom: '10px' }}>
                    <label htmlFor="clientSelect" style={{ marginRight: '5px' }}>Select Client:</label>
                    <select
                      id="clientSelect" value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} required disabled={isRunning} >
                      <option value="">-- Select a Client --</option> {clients.map(client => ( <option key={client.id} value={client.id}> {client.name} </option> ))}
                    </select>
                  </div>
                  {/* Work Item Detail Selection (kept the same, disabled if timer running) */}
                  <div style={{ marginBottom: '10px' }}>
                    <label htmlFor="detailSelect" style={{ marginRight: '5px' }}>Select Work Item Detail:</label>
                    <select
                      id="detailSelect" value={selectedDetail} onChange={(e) => setSelectedDetail(e.target.value)} required disabled={isRunning} >
                      <option value="">-- Select a Work Item Detail --</option> {workItemDetails.map(detail => ( <option key={detail.id} value={detail.id}> {detail.name} </option> ))}
                    </select>
                  </div>

                  {/* Timer Controls */}
                  <div style={{ marginTop: '15px', marginBottom: '15px' }}>
                    {!isRunning ? (
                      <button type="button" onClick={handleStartTime} disabled={!selectedClient || !selectedDetail || loadingData} style={{ padding: '10px 15px', backgroundColor: 'green', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }} > Start Timer </button>
                    ) : (
                      <button type="button" onClick={handleStopTime} style={{ padding: '10px 15px', backgroundColor: 'red', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }} > Stop Timer & Save Entry </button>
                    )}
                  </div>
                </form>

                {/* Display Timer */}
                <div style={{ marginTop: '20px', padding: '10px', border: '1px solid #ccc', borderRadius: '5px', display: 'inline-block' }}>
                   <p style={{ fontSize: '1.8em', fontWeight: 'bold', margin: 0 }}> Time Elapsed: {formatTime(elapsedTime)} </p>
                   {selectedClient && workItemDetails.find(d => d.id === selectedDetail) && isRunning && (
                       <p style={{marginTop: '5px', fontSize: '0.9em'}}> Tracking for: {clients.find(c => c.id === selectedClient)?.name} - {workItemDetails.find(d => d.id === selectedDetail)?.name} </p>
                   )}
                </div>
             </div>
          )}


           <hr style={{marginTop: '30px'}}/> {/* Separator */}

           {/* --- List of Recent Time Entries --- */}
           <div style={{marginTop: '30px'}}>
             <h2>Recent Time Entries</h2>
             {loadingTimeEntries && <p>Loading time entries...</p>}
             {!loadingTimeEntries && timeEntriesList.length === 0 && <p>No time entries recorded yet.</p>}
             {!loadingTimeEntries && timeEntriesList.length > 0 && (
               <ul>
                 {timeEntriesList.map(entry => (
                   <li key={entry.id} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #eee', borderRadius: '5px' }}>
                      <div><strong>Client:</strong> {entry.clientName}</div>
                      <div><strong>Work Item:</strong> {entry.detailName}</div>
                      <div><strong>Duration:</strong> {formatDuration(entry.duration)}</div>
                      <div><strong>Started:</strong> {formatDate(entry.startTime)}</div>
                      <div><strong>Stopped:</strong> {formatDate(entry.endTime)}</div>
                      {entry.detailHourlyRate !== undefined && entry.detailHourlyRate !== null && (
                         <div><strong>Rate:</strong> {Number(entry.detailHourlyRate).toFixed(2)} €/hr</div>
                      )}
                       {/* Add Edit and Delete buttons for entries */}
                       <button onClick={() => handleEditEntryClick(entry)} style={{ marginLeft: '10px' }}>
                           Edit
                       </button>
                        <button onClick={() => handleDeleteEntry(entry.id)} style={{ marginLeft: '5px', color: 'red' }}>
                           Delete
                       </button>
                   </li>
                 ))}
               </ul>
             )}
           </div>

        </div>
      )}
    </div>
  );
}

export default TimeTrackingPage;