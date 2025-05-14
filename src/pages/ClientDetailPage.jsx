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
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // State variables for adding/editing activity form
  const [isActivityFormVisible, setIsActivityFormVisible] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [activityType, setActivityType] = useState('Note');
  const [activityDate, setActivityDate] = useState('');
  const [activityContent, setActivityContent] = useState('');

  // --- State for Time Entries for this Client ---
  const [clientTimeEntries, setClientTimeEntries] = useState([]); // State for time entries for THIS client
  const [loadingTimeEntries, setLoadingTimeEntries] = useState(false); // Loading state for time entries


  // --- Fetching Client Data ---
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
  }, [clientId]);


  // --- Fetching Activities for this Client ---
  const fetchActivities = async () => {
    if (!clientId) return;
    setLoadingActivities(true);
    try {
      const activitiesRef = collection(db, 'activities');
      const clientDocRef = doc(db, 'clients', clientId);
      const q = query(activitiesRef, where('clientRef', '==', clientDocRef), orderBy('date', 'desc'));
      const querySnapshot = await getDocs(q);
      const activitiesList = querySnapshot.docs.map(docData => ({
        id: docData.id,
        ...docData.data(),
        date: docData.data().date?.toDate ? docData.data().date.toDate() : (docData.data().date instanceof Date ? docData.data().date : null)
      }));
      setActivities(activitiesList);
    } catch (error) {
      console.error("Error fetching activities:", error);
      alert("Failed to fetch activities. See console for details.");
      setActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      fetchActivities();
    }
  }, [clientId]);


  // --- Fetching Time Entries for this Client ---
  const fetchTimeEntriesForClient = async () => {
    if (!clientId) return;
    setLoadingTimeEntries(true);
    try {
      const timeEntriesRef = collection(db, 'timeEntries');
      const clientDocRef = doc(db, 'clients', clientId);
      // Query time entries where 'clientRef' field is equal to this client's document reference
      const q = query(timeEntriesRef, where('clientRef', '==', clientDocRef), orderBy('startTime', 'desc'));
      const querySnapshot = await getDocs(q);

      const entriesList = [];
      for (const docEntry of querySnapshot.docs) {
        const entryData = docEntry.data();
        let detailName = 'Detail Not Found';
        let detailHourlyRate = null;

        // Fetch related Work Item Detail document
        if (entryData.detailRef) {
          try {
            const detailDoc = await getDoc(entryData.detailRef);
            if (detailDoc.exists()) {
              const detailData = detailDoc.data();
              detailName = detailData.name; // Assuming the detail document has a 'name' field
              detailHourlyRate = detailData.hourlyRate; // Assuming it has an 'hourlyRate'
            }
          } catch (detailError) {
            console.error("Error fetching detail for time entry:", docEntry.id, detailError);
            detailName = 'Error fetching Detail';
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
      // Check if it's an index error
      if (error.code === 'failed-precondition' && error.message.includes('index')) {
        alert("Firestore index required for time entries. Please check the console for a link to create it.");
      } else {
        alert("Failed to load time entries for this client. See console.");
      }
      setClientTimeEntries([]);
    } finally {
      setLoadingTimeEntries(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      fetchTimeEntriesForClient();
    }
  }, [clientId]);


  // --- Activity Management Functions ---
  const formatDateToISO = (date) => {
    if (!date || !(date instanceof Date)) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateReadable = (dateTimestamp) => {
    if (!dateTimestamp) return 'N/A';
    const date = dateTimestamp.toDate ? dateTimestamp.toDate() : (dateTimestamp instanceof Date ? dateTimestamp : new Date(dateTimestamp));
    return date.toLocaleString();
  };

  const handleShowActivityForm = (activity = null) => {
    setEditingActivity(activity);
    setActivityType(activity?.type || 'Note');
    setActivityDate(activity?.date ? formatDateToISO(activity.date) : formatDateToISO(new Date()));
    setActivityContent(activity?.content || '');
    setIsActivityFormVisible(true);
  };

  const handleActivityInputChange = (e) => {
    const { id, value } = e.target;
    if (id === 'activityType') setActivityType(value);
    else if (id === 'activityDate') setActivityDate(value);
    else if (id === 'activityContent') setActivityContent(value);
  };

  const handleActivitySubmit = async (e) => {
    e.preventDefault();
    if (!activityType || !activityDate || !activityContent.trim()) {
      alert("Please fill in activity type, date, and content.");
      return;
    }
    if (!clientId) {
      alert("Error: Client ID not available. Cannot link activity.");
      return;
    }
    try {
      const clientDocRef = doc(db, 'clients', clientId);
      const activityData = {
        clientRef: clientDocRef,
        type: activityType,
        date: new Date(activityDate),
        content: activityContent,
      };
      if (editingActivity) {
        const activityDocRef = doc(db, 'activities', editingActivity.id);
        await updateDoc(activityDocRef, { ...activityData, updatedAt: new Date() });
        alert("Activity updated successfully!");
      } else {
        await addDoc(collection(db, 'activities'), { ...activityData, createdAt: new Date() });
        alert("Activity added successfully!");
      }
      setIsActivityFormVisible(false);
      setEditingActivity(null);
      fetchActivities();
    } catch (error) {
      console.error("Error saving activity:", error);
      alert("Failed to save activity. See console for details.");
    }
  };

  const handleDeleteActivity = async (activityId) => {
    if (window.confirm("Are you sure you want to delete this activity?")) {
      try {
        const activityDocRef = doc(db, 'activities', activityId);
        await deleteDoc(activityDocRef);
        setActivities(prevActivities => prevActivities.filter(activity => activity.id !== activityId));
      } catch (error) {
        console.error("Error deleting activity:", error);
        alert("Failed to delete activity. See console for details.");
      }
    }
  };

  const handleCancelActivityForm = () => {
    setIsActivityFormVisible(false);
    setEditingActivity(null);
  };

  // Helper to format duration
  const formatDuration = (totalSeconds) => {
    if (typeof totalSeconds !== 'number' || totalSeconds < 0) return 'N/A';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const paddedHours = String(hours).padStart(2, '0');
    const paddedMinutes = String(minutes).padStart(2, '0');
    const paddedSeconds = String(seconds).padStart(2, '0');
    return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
  };

  // --- Render the UI ---
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
      <h1>Client Detail: {client.name}</h1>
      <p>Client ID: {client.id}</p>
      {client.email && <p>Email: {client.email}</p>}
      {client.phone && <p>Phone: {client.phone}</p>}
      {client.address && <p>Address: {client.address}</p>}
      {client.website && <p>Website: {client.website}</p>}

      <hr style={{ margin: '20px 0' }} />

      <section>
        <h2>Activities</h2>
        {!isActivityFormVisible && (
          <button onClick={() => handleShowActivityForm()} style={{ marginBottom: '15px' }}>
            + Add Activity
          </button>
        )}
        {isActivityFormVisible && (
          <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
            <h3>{editingActivity ? 'Edit Activity' : 'Add New Activity'}</h3>
            <form onSubmit={handleActivitySubmit}>
              <div style={{ marginBottom: '10px' }}>
                <label htmlFor="activityType" style={{ marginRight: '5px' }}>Type:</label>
                <select id="activityType" value={activityType} onChange={handleActivityInputChange} required>
                  <option value="Note">Note</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Call">Call</option>
                </select>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label htmlFor="activityDate" style={{ marginRight: '5px' }}>Date:</label>
                <input type="date" id="activityDate" value={activityDate} onChange={handleActivityInputChange} required />
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label htmlFor="activityContent" style={{ display: 'block', marginBottom: '5px' }}>Content:</label>
                <textarea
                  id="activityContent"
                  value={activityContent}
                  onChange={handleActivityInputChange}
                  required
                  rows="4"
                  style={{ width: '98%', padding: '5px' }}
                />
              </div>
              <button type="submit" style={{ marginRight: '10px' }}>{editingActivity ? 'Update Activity' : 'Add Activity'}</button>
              <button type="button" onClick={handleCancelActivityForm}>Cancel</button>
            </form>
          </div>
        )}
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
                  <button onClick={() => handleShowActivityForm(activity)} style={{ marginRight: '5px' }}>Edit</button>
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
        {loadingTimeEntries && <p>Loading time entries...</p>}
        {!loadingTimeEntries && clientTimeEntries.length === 0 ? (
          <p>No time entries found for this client.</p>
        ) : (
          !loadingTimeEntries && clientTimeEntries.length > 0 && (
            <ul>
              {clientTimeEntries.map(entry => (
                <li key={entry.id} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #eee', borderRadius: '5px' }}>
                  <div><strong>Work Item:</strong> {entry.detailName}</div>
                  <div><strong>Duration:</strong> {formatDuration(entry.duration)}</div>
                  <div><strong>Started:</strong> {formatDateReadable(entry.startTime)}</div>
                  <div><strong>Stopped:</strong> {formatDateReadable(entry.endTime)}</div>
                  {entry.detailHourlyRate !== undefined && entry.detailHourlyRate !== null && (
                    <div><strong>Rate:</strong> {Number(entry.detailHourlyRate).toFixed(2)} €/hr</div>
                  )}
                  {/* Add Edit/Delete buttons for time entries here if needed on this page later */}
                </li>
              ))}
            </ul>
          )
        )}
      </section>
    </div>
  );
}

export default ClientDetailPage;