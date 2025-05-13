import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
// Import Firestore functions for data fetching and manipulation
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';

function ClientDetailPage() {
  // Get the dynamic 'clientId' from the URL
  const { clientId } = useParams();

  // --- State for Client Details ---
  const [client, setClient] = useState(null);
  const [loadingClient, setLoadingClient] = useState(true);
  const [clientNotFound, setClientNotFound] = useState(false);

  // --- State for Activities ---
  const [activities, setActivities] = useState([]); // State for activities related to this client
  const [loadingActivities, setLoadingActivities] = useState(false); // Loading state for activities

  // State variables for adding/editing activity form
  const [isActivityFormVisible, setIsActivityFormVisible] = useState(false); // Is the activity form visible?
  const [editingActivity, setEditingActivity] = useState(null); // The activity being edited (or null)
  const [activityType, setActivityType] = useState('Note'); // Default to 'Note'
  const [activityDate, setActivityDate] = useState(''); // Date for the activity (YYYY-MM-DD)
  const [activityContent, setActivityContent] = useState(''); // Content/Notes of the activity


  // --- State for Time Entries (Placeholder - will implement fetching later) ---
  // const [clientTimeEntries, setClientTimeEntries] = useState([]);
  // const [loadingTimeEntries, setLoadingTimeEntries] = useState(false);


  // --- Fetching Client Data (kept the same) ---
  useEffect(() => {
    const fetchClientData = async () => {
      if (!clientId) return;

      setLoadingClient(true);
      setClientNotFound(false);
      try {
        const clientDocRef = doc(db, 'clients', clientId);
        const clientDocSnap = await getDoc(clientDocRef);

        if (clientDocSnap.exists()) {
          setClient({ id: clientDocSnap.id, ...clientDocSnap.data() });
        } else {
          console.log("No such client document found for ID:", clientId);
          setClient(null);
          setClientNotFound(true);
        }
      } catch (error) {
        console.error("Error fetching client data:", error);
        setClient(null);
      } finally {
        setLoadingClient(false);
      }
    };

    fetchClientData();

  }, [clientId]); // Re-run this effect if the clientId changes


  // --- Fetching Activities for this Client ---
   // Define fetchActivities OUTSIDE of the useEffect so it's callable from elsewhere
  const fetchActivities = async () => {
    if (!clientId) return; // Only fetch if clientId is available

    setLoadingActivities(true);
    try {
      const activitiesRef = collection(db, 'activities');
      // Create a document reference for the current client
      const clientDocRef = doc(db, 'clients', clientId);
      // Query activities where 'clientRef' field is equal to this client's document reference
      const q = query(activitiesRef, where('clientRef', '==', clientDocRef), orderBy('date', 'desc')); // Needs index later
      const querySnapshot = await getDocs(q);

      // Map activity documents to objects
      const activitiesList = querySnapshot.docs.map(docData => ({
        id: docData.id,
        ...docData.data(),
        // Convert Timestamp to JS Date for form (if it has a toDate method, means it's a Timestamp)
        date: docData.data().date?.toDate ? docData.data().date.toDate() : (docData.data().date instanceof Date ? docData.data().date : null)
      }));

      setActivities(activitiesList);

    } catch (error) {
      console.error("Error fetching activities:", error);
      alert("Failed to fetch activities. See console for details."); // User feedback on error
      setActivities([]); // Clear activities on error
    } finally {
      setLoadingActivities(false);
    }
  };

  // useEffect to call fetchActivities when the client ID is available or changes
  useEffect(() => {
    if (clientId) {
      fetchActivities(); // Call the function defined above
    }
  }, [clientId]); // Re-run this effect if the clientId changes (e.g., navigate to another client's page)


  // --- Activity Management Functions ---

  // Helper to format Date object to "YYYY-MM-DD" string for date inputs
  const formatDateToISO = (date) => {
        if (!date || !(date instanceof Date)) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
  };

  // Helper to format Date object to readable string (e.g., "May 13, 2025 at 10:30 AM")
  const formatDateReadable = (dateTimestamp) => {
    if (!dateTimestamp) return 'N/A';
    // Convert Firestore Timestamp (or JS Date) to a readable string
    const date = dateTimestamp.toDate ? dateTimestamp.toDate() : (dateTimestamp instanceof Date ? dateTimestamp : new Date(dateTimestamp));
    return date.toLocaleString(); // Format nicely based on locale
  };


  // Show the manual entry form for adding/editing activity
  const handleShowActivityForm = (activity = null) => { // Pass activity object if editing, null if adding
    setEditingActivity(activity); // Set the activity being edited (or null if adding)
    // Populate form fields if editing, otherwise clear them
    setActivityType(activity?.type || 'Note'); // Default to 'Note' if adding, or use existing type
    setActivityDate(activity?.date ? formatDateToISO(activity.date) : formatDateToISO(new Date())); // Default to today's date for new, or use existing
    setActivityContent(activity?.content || '');
    setIsActivityFormVisible(true); // Show the form
  };

  // Handle input changes in the activity form
  const handleActivityInputChange = (e) => {
    const { id, value } = e.target;
    if (id === 'activityType') setActivityType(value);
    else if (id === 'activityDate') setActivityDate(value);
    else if (id === 'activityContent') setActivityContent(value);
  };

  // Handle saving/updating activity
  const handleActivitySubmit = async (e) => {
    e.preventDefault(); // Prevent default form submission behavior (page reload)

    // Basic validation: Ensure required fields are filled
    if (!activityType || !activityDate || !activityContent.trim()) {
      alert("Please fill in activity type, date, and content.");
      return;
    }
    if (!clientId) {
      alert("Error: Client ID not available. Cannot link activity."); // Should not happen if form is shown correctly
      return;
    }

    try {
      // Create a Firestore Document Reference for the current client
      const clientDocRef = doc(db, 'clients', clientId);

      // Prepare the activity data object
      const activityData = {
        clientRef: clientDocRef, // Link to the client document
        type: activityType,
        date: new Date(activityDate), // Convert date string from input to Date object for Firestore Timestamp
        content: activityContent,
      };

      if (editingActivity) {
        // --- Update Existing Activity ---
        const activityDocRef = doc(db, 'activities', editingActivity.id);
        await updateDoc(activityDocRef, { ...activityData, updatedAt: new Date() }); // Add updatedAt for updates
        console.log(`Activity with ID ${editingActivity.id} updated successfully!`);
        alert("Activity updated successfully!");
      } else {
        // --- Add New Activity ---
        // Add createdAt timestamp only for new entries
        await addDoc(collection(db, 'activities'), { ...activityData, createdAt: new Date() });
        console.log("New activity added successfully!");
        alert("Activity added successfully!");
      }

      // Hide form and refresh list after saving/updating
      setIsActivityFormVisible(false);
      setEditingActivity(null); // Clear editing state
      fetchActivities(); // <-- THIS CALL NOW WORKS!

    } catch (error) {
      console.error("Error saving activity:", error);
      alert("Failed to save activity. See console for details.");
    }
  };

  // Handle deleting an activity
  const handleDeleteActivity = async (activityId) => {
    if (window.confirm("Are you sure you want to delete this activity?")) {
      try {
        const activityDocRef = doc(db, 'activities', activityId); // Get reference to the specific activity document
        await deleteDoc(activityDocRef); // Delete the document
        console.log(`Activity with ID ${activityId} deleted successfully!`);
        // Remove the activity from the local list immediately for faster UI update
        setActivities(prevActivities => prevActivities.filter(activity => activity.id !== activityId));
        // Optionally, re-fetch the entire list: fetchActivities(); // <-- THIS CALL ALSO WORKS NOW

      } catch (error) {
        console.error("Error deleting activity:", error);
        alert("Failed to delete activity. See console for details.");
      }
    }
  };

  // Hide the activity form
  const handleCancelActivityForm = () => {
    setIsActivityFormVisible(false);
    setEditingActivity(null);
  };


  // --- Time Entries Section (Placeholder - will implement fetching later) ---
  // const [clientTimeEntries, setClientTimeEntries] = useState([]);
  // const [loadingTimeEntries, setLoadingTimeEntries] = useState(false);


   // --- Fetching Time Entries for this Client ---
   // We will implement fetching and displaying time entries for this client in the next step (Step 6.5)
   /*
   useEffect(() => {
       const fetchTimeEntriesForClient = async () => {
           if (!clientId) return; // Only fetch if clientId is available

           setLoadingTimeEntries(true);
           try {
               const timeEntriesRef = collection(db, 'timeEntries');
               const clientDocRef = doc(db, 'clients', clientId);
               const q = query(timeEntriesRef, where('clientRef', '==', clientDocRef), orderBy('startTime', 'desc'));

               const querySnapshot = await getDocs(q);

               const entriesList = [];
               for (const docEntry of querySnapshot.docs) {
                   const entryData = docEntry.data();
                   let detailName = 'Detail Not Found';
                   let detailHourlyRate = null;

                   if (entryData.detailRef) {
                       const detailDoc = await getDoc(entryData.detailRef);
                       if (detailDoc.exists()) {
                           const detailData = detailDoc.data();
                           detailName = detailData.name;
                           detailHourlyRate = detailData.hourlyRate;
                       }
                   }

                   entriesList.push({
                       id: docEntry.id,
                       ...entryData,
                       detailName: detailName,
                       detailHourlyRate: detailHourlyRate,
                       startTime: entryData.startTime?.toDate ? entryData.startTime.toDate() : null,
                       endTime: entryData.endTime?.toDate ? entryData.endTime.toDate() : null,
                   });
               }
               setClientTimeEntries(entriesList);

           } catch (error) {
               console.error("Error fetching time entries for client:", error);
               alert("Failed to load time entries for this client. See console.");
               setClientTimeEntries([]);
           } finally {
               setLoadingTimeEntries(false);
           }
       };

       if (clientId) {
           // fetchTimeEntriesForClient(); // Would call here
       }
   }, [clientId]);
   */

    // Helper to format duration (reused from TimeTrackingPage)
    // const formatDuration = (totalSeconds) => { ... };
    // Helper to format Date object to readable string (reused from TimeTrackingPage)
    // const formatDateReadable = (dateTimestamp) => { ... };



  // --- Render the UI ---
  // Conditionally render based on loading and client state
  if (loadingClient) {
    return <div style={{ padding: '20px' }}>Loading client details...</div>;
  }

  if (clientNotFound) {
    return <div style={{ padding: '20px' }}>Client with ID "{clientId}" not found.</div>;
  }

  if (!client && !loadingClient) {
    return <div style={{ padding: '20px' }}>Error loading client details.</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      {/* Display fetched client details */}
      <h1>Client Detail: {client.name}</h1>
      <p>Client ID: {client.id}</p>
      {client.email && <p>Email: {client.email}</p>}
      {client.phone && <p>Phone: {client.phone}</p>}
      {client.address && <p>Address: {client.address}</p>}
      {client.website && <p>Website: {client.website}</p>}

      <hr style={{ margin: '20px 0' }} />

      {/* --- Activities Section --- */}
      <section>
        <h2>Activities</h2>

         {/* Button to show the Add Activity form (only if form is not visible) */}
         {!isActivityFormVisible && (
             <button onClick={() => handleShowActivityForm()} style={{ marginBottom: '15px' }}>
                 + Add Activity
             </button>
         )}

         {/* Add/Edit Activity Form (Conditionally shown) */}
         {isActivityFormVisible && (
             <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
                 <h3>{editingActivity ? 'Edit Activity' : 'Add New Activity'}</h3>
                 <form onSubmit={handleActivitySubmit}>
                     {/* Activity Type */}
                     <div style={{ marginBottom: '10px' }}>
                         <label htmlFor="activityType" style={{ marginRight: '5px' }}>Type:</label>
                         <select id="activityType" value={activityType} onChange={handleActivityInputChange} required>
                             <option value="Note">Note</option>
                             <option value="Meeting">Meeting</option>
                             <option value="Call">Call</option>
                             {/* Add other types as needed */}
                         </select>
                     </div>

                      {/* Activity Date */}
                      <div style={{ marginBottom: '10px' }}>
                         <label htmlFor="activityDate" style={{ marginRight: '5px' }}>Date:</label>
                         <input type="date" id="activityDate" value={activityDate} onChange={handleActivityInputChange} required />
                     </div>

                      {/* Activity Content */}
                      <div style={{ marginBottom: '10px' }}>
                         <label htmlFor="activityContent" style={{ display: 'block', marginBottom: '5px' }}>Content:</label>
                         <textarea
                            id="activityContent"
                            value={activityContent}
                            onChange={handleActivityInputChange}
                            required
                            rows="4" // Adjust rows as needed
                            style={{ width: '98%', padding: '5px' }} // Simple styling
                         />
                     </div>

                     {/* Form Buttons */}
                     <button type="submit" style={{ marginRight: '10px' }}>{editingActivity ? 'Update Activity' : 'Add Activity'}</button>
                     <button type="button" onClick={handleCancelActivityForm}>Cancel</button>
                 </form>
             </div>
         )}


        {/* Activity List */}
        <h3>Activity List</h3>
        {loadingActivities ? <p>Loading activities...</p> : (
          activities.length === 0 ? <p>No activities found for this client.</p> : (
            <ul>
              {activities.map(activity => (
                <li key={activity.id} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #eee', borderRadius: '5px' }}>
                  <div>
                    <strong>{activity.type}</strong> on {activity.date ? formatDateReadable(activity.date) : 'N/A'}
                  </div>
                  <p style={{ margin: '5px 0 10px 0' }}>{activity.content}</p>
                  {/* Edit and Delete buttons for activity */}
                  <button onClick={() => handleShowActivityForm(activity)} style={{ marginRight: '5px' }}>Edit</button> {/* Use handleShowActivityForm to populate form */}
                  <button onClick={() => handleDeleteActivity(activity.id)} style={{ color: 'red' }}>Delete</button>
                </li>
              ))}
            </ul>
          )
        )}
      </section>

      <hr style={{ margin: '20px 0' }} />

      {/* --- Time Entries Section for this Client --- */}
      <section>
        <h2>Time Entries for this Client</h2>
        {/* TODO: Implement filtering and display */}
        <p>Time entries filtered by this client will appear here later.</p>
          {/* Example list rendering would go here */}
      </section>
    </div>
  );
}

export default ClientDetailPage;