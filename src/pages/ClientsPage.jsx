import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
// Import Firestore functions for data fetching and manipulation
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore'; // Added addDoc, updateDoc, deleteDoc, orderBy, where

function ClientDetailPage() {
  // 1. Use useParams to get the dynamic 'clientId' from the URL (kept the same)
  const { clientId } = useParams();

  // --- State for Client Details --- (kept the same)
  const [client, setClient] = useState(null);
  const [loadingClient, setLoadingClient] = useState(true);
  const [clientNotFound, setClientNotFound] = useState(false);

  // --- State for Activities ---
  const [activities, setActivities] = useState([]); // State for activities related to this client
  const [loadingActivities, setLoadingActivities] = useState(false); // Loading state for activities

  // State variables for adding/editing activity form
  const [isActivityFormVisible, setIsActivityFormVisible] = useState(false); // Is the activity form visible?
  const [editingActivity, setEditingActivity] = useState(null); // The activity being edited (or null)
  const [activityType, setActivityType] = useState(''); // e.g., Meeting, Call, Note
  const [activityDate, setActivityDate] = useState(''); // Date for the activity (YYYY-MM-DD)
  const [activityContent, setActivityContent] = useState(''); // Content/Notes of the activity


  // --- State for Time Entries (Placeholder - will implement fetching later) ---
  // const [timeEntries, setTimeEntries] = useState([]);
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
  useEffect(() => {
    const fetchActivities = async () => {
      if (!clientId) return; // Only fetch if clientId is available

      setLoadingActivities(true);
      try {
        const activitiesRef = collection(db, 'activities');
        // 2. Create a document reference for the current client
        const clientDocRef = doc(db, 'clients', clientId);
        // 3. Query activities where 'clientRef' field is equal to this client's document reference
        const q = query(activitiesRef, where('clientRef', '==', clientDocRef), orderBy('date', 'desc')); // Order by date, needs index later
        const querySnapshot = await getDocs(q);

        // Map activity documents to objects
        const activitiesList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Convert Timestamp to JS Date for form
          date: doc.data().date?.toDate ? doc.data().date.toDate() : (doc.data().date instanceof Date ? doc.data().date : null)
        }));

        setActivities(activitiesList);

      } catch (error) {
        console.error("Error fetching activities:", error);
        // Handle error
        setActivities([]);
      } finally {
        setLoadingActivities(false);
      }
    };

    // Call the fetch function when the client ID is available or changes
    if (clientId) {
      fetchActivities();
    }

  }, [clientId]); // Re-run this effect if the clientId changes


  // --- Activity Management Functions ---

  // 4. Show form for adding/editing activity
  const handleShowActivityForm = (activity = null) => { // Pass activity object if editing
    setEditingActivity(activity); // Set activity if editing, null if adding
    // Populate form if editing, clear if adding
    setActivityType(activity?.type || 'Note'); // Default to 'Note' or use existing type
    setActivityDate(activity?.date ? formatDateToISO(activity.date) : formatDateToISO(new Date())); // Default to today
    setActivityContent(activity?.content || '');
    setIsActivityFormVisible(true); // Show the form
  };

  // 5. Handle input changes in the activity form
  const handleActivityInputChange = (e) => {
    const { id, value } = e.target;
    if (id === 'activityType') setActivityType(value);
    else if (id === 'activityDate') setActivityDate(value);
    else if (id === 'activityContent') setActivityContent(value);
  };

  // 6. Handle saving/updating activity
  const handleActivitySubmit = async (e) => {
    e.preventDefault();

    // Basic validation
    if (!activityType || !activityDate || !activityContent.trim()) {
      alert("Please fill in activity type, date, and content.");
      return;
    }
    if (!clientId) {
      alert("Error: Client ID not available."); // Should not happen if form is shown correctly
      return;
    }

    try {
      // Create a document reference for the current client
      const clientDocRef = doc(db, 'clients', clientId);

      const activityData = {
        clientRef: clientDocRef, // Link to the client document
        type: activityType,
        date: new Date(activityDate), // Convert date string to Date object for Firestore Timestamp
        content: activityContent,
      };

      if (editingActivity) {
        // --- Update Existing Activity ---
        const activityDocRef = doc(db, 'activities', editingActivity.id);
        await updateDoc(activityDocRef, { ...activityData, updatedAt: new Date() });
        console.log(`Activity with ID ${editingActivity.id} updated successfully!`);
        alert("Activity updated!");
      } else {
        // --- Add New Activity ---
        await addDoc(collection(db, 'activities'), { ...activityData, createdAt: new Date() });
        console.log("New activity added successfully!");
        alert("Activity added!");
      }

      // Hide form and refresh list after saving
      setIsActivityFormVisible(false);
      setEditingActivity(null);
      fetchActivities(); // Re-fetch activities list

    } catch (error) {
      console.error("Error saving activity:", error);
      alert("Failed to save activity. See console for details.");
    }
  };

  // 7. Handle deleting an activity
  const handleDeleteActivity = async (activityId) => {
    if (window.confirm("Are you sure you want to delete this activity?")) {
      try {
        const activityDocRef = doc(db, 'activities', activityId);
        await deleteDoc(activityDocRef);
        console.log(`Activity with ID ${activityId} deleted successfully!`);
        // Filter the local list for faster UI update
        setActivities(prevActivities => prevActivities.filter(activity => activity.id !== activityId));
        // Or re-fetch: fetchActivities();
      } catch (error) {
        console.error("Error deleting activity:", error);
        alert("Failed to delete activity. See console for details.");
      }
    }
  };

  // 8. Hide the activity form
  const handleCancelActivityForm = () => {
    setIsActivityFormVisible(false);
    setEditingActivity(null);
  };

  // --- Helper Date Formatting Functions (reused from TimeTrackingPage, simplified) ---
  const formatDateToISO = (date) => {
       if (!date || !(date instanceof Date)) return '';
       const year = date.getFullYear();
       const month = String(date.getMonth() + 1).padStart(2, '0');
       const day = String(date.getDate()).padStart(2, '0');
       return `${year}-${month}-${day}`;
  };
  // Note: formatTimeToHHMM and calculateDurationInSeconds are not needed for Activity forms

  // --- Render the UI ---
  // Conditionally render based on loading and client state (kept the same)
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
      {/* Display fetched client details (kept the same) */}
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
                    <strong>{activity.type}</strong> on {activity.date ? formatDate(activity.date) : 'N/A'}
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

      {/* Placeholder for Time Entries Section (Will fetch/implement filtering later) */}
      <section>
        <h2>Time Entries for this Client</h2>
        {/* TODO: Fetch time entries specifically for this client and display */}
        <p>Time entries filtered by this client will appear here later.</p>
          {/* Example list rendering would go here */}
      </section>
    </div>
  );
}

export default ClientDetailPage;