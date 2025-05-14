import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
// Import Link for navigation
import { Link } from 'react-router-dom'; // Added Link here

function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [newClientWebsite, setNewClientWebsite] = useState('');

  const [editingClient, setEditingClient] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editWebsite, setEditWebsite] = useState('');

  // Function to fetch clients (kept the same)
  const fetchClients = async () => {
    try {
      const clientsCollectionRef = collection(db, 'clients');
      const querySnapshot = await getDocs(clientsCollectionRef);

      const clientsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setClients(clientsList);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching clients:", error);
      alert("Failed to fetch clients. See console for details.");
      setLoading(false);
    }
  };

  // Fetch clients when the component mounts (kept the same)
  useEffect(() => {
    fetchClients();
  }, []);

  // Function to handle adding a new client (kept the same)
  const handleAddClient = async (e) => {
    e.preventDefault();

    if (!newClientName.trim()) {
      alert("Client name is required!");
      return;
    }

    const newClient = {
      name: newClientName, email: newClientEmail, phone: newClientPhone,
      address: newClientAddress, website: newClientWebsite, createdAt: new Date(),
    };

    try {
      const clientsCollectionRef = collection(db, 'clients');
      await addDoc(clientsCollectionRef, newClient);
      console.log("New client added successfully!");
      setNewClientName(''); setNewClientEmail(''); setNewClientPhone(''); setNewClientAddress(''); setNewClientWebsite('');
      fetchClients();
    } catch (error) { console.error("Error adding client:", error); alert("Failed to add client. See console for details."); }
  };

  // Function to handle deleting a client (kept the same)
  const handleDeleteClient = async (clientId) => {
    if (window.confirm("Are you sure you want to delete this client?")) {
      try {
        const clientDocRef = doc(db, 'clients', clientId);
        await deleteDoc(clientDocRef);
        console.log(`Client with ID ${clientId} deleted successfully!`);
        // Filter the client list locally for faster UI update
        setClients(prevClients => prevClients.filter(client => client.id !== clientId));
        // Or re-fetch: fetchClients();
      } catch (error) { console.error("Error deleting client:", error); alert("Failed to delete client. See console for details."); }
    }
  };

  // Function to handle clicking the Edit button (kept the same)
  const handleEditClick = (client) => {
    setEditingClient(client);
    setEditName(client.name || ''); setEditEmail(client.email || ''); setEditPhone(client.phone || '');
    setEditAddress(client.address || ''); setEditWebsite(client.website || '');
  };

  // Function to handle changes in the edit form inputs (kept the same)
  const handleEditInputChange = (e) => {
    const { id, value } = e.target;
    if (id === 'editName') setEditName(value); else if (id === 'editEmail') setEditEmail(value);
    else if (id === 'editPhone') setEditPhone(value); else if (id === 'editAddress') setEditAddress(value);
    else if (id === 'editWebsite') setEditWebsite(value);
  };

  // Function to handle saving the edited client (kept the same)
  const handleUpdateClient = async (e) => {
    e.preventDefault();
    if (!editName.trim()) { alert("Client name is required!"); return; }
    if (!editingClient) { alert("No client selected for editing."); return; }
    const updatedClientData = {
      name: editName, email: editEmail, phone: editPhone,
      address: editAddress, website: editWebsite, updatedAt: new Date(),
    };
    try {
      const clientDocRef = doc(db, 'clients', editingClient.id);
      await updateDoc(clientDocRef, updatedClientData);
      console.log(`Client with ID ${editingClient.id} updated successfully!`);
      setEditingClient(null); setEditName(''); setEditEmail(''); setEditPhone(''); setEditAddress(''); setEditWebsite('');
      fetchClients(); // Re-fetch to show updated list
    } catch (error) { console.error("Error updating client:", error); alert("Failed to update client. See console for details."); }
  };

  // Function to handle canceling editing (kept the same)
  const handleCancelEdit = () => {
    setEditingClient(null); setEditName(''); setEditEmail(''); setEditPhone(''); setEditAddress(''); setEditWebsite('');
  };


  // Render the UI (Updated to include Link to detail page)
  return (
    <div>
      <h1>Clients Management</h1>

      {/* Conditionally show the Add New Client form OR the Edit Client form */}
      {!editingClient && (
        <>
          <h2>Add New Client</h2>
          <form onSubmit={handleAddClient}>
             {/* ... Add form inputs (kept the same) ... */}
             <div> <label htmlFor="name">Name:</label> <input id="name" type="text" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} required /> </div>
             <div> <label htmlFor="email">Email:</label> <input id="email" type="email" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} /> </div>
             <div> <label htmlFor="phone">Phone:</label> <input id="phone" type="tel" value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} /> </div>
             <div> <label htmlFor="address">Address:</label> <textarea id="address" value={newClientAddress} onChange={(e) => setNewClientAddress(e.target.value)} /> </div>
             <div> <label htmlFor="website">Website:</label> <input id="website" type="url" value={newClientWebsite} onChange={(e) => setNewClientWebsite(e.target.value)} /> </div>
             <button type="submit">Add Client</button>
          </form>
        </>
      )}

      {editingClient && (
        <>
          <h2>Edit Client</h2>
           {/* ... Edit form inputs (kept the same) ... */}
           <form onSubmit={handleUpdateClient}>
             <div> <label htmlFor="editName">Name:</label> <input id="editName" type="text" value={editName} onChange={handleEditInputChange} required /> </div>
             <div> <label htmlFor="editEmail">Email:</label> <input id="editEmail" type="email" value={editEmail} onChange={handleEditInputChange} /> </div>
             <div> <label htmlFor="editPhone">Phone:</label> <input id="editPhone" type="tel" value={editPhone} onChange={handleEditInputChange} /> </div>
             <div> <label htmlFor="editAddress">Address:</label> <textarea id="editAddress" value={editAddress} onChange={handleEditInputChange} /> </div>
             <div> <label htmlFor="editWebsite">Website:</label> <input id="editWebsite" type="url" value={editWebsite} onChange={handleEditInputChange} /> </div>
             <button type="submit">Save Changes</button>
             <button type="button" onClick={handleCancelEdit} style={{ marginLeft: '10px' }}> Cancel Edit </button>
           </form>
         </>
       )}


      <hr />

      {/* Display the list of clients (Updated to include Link to detail page) */}
      <h2>Client List</h2>
      {loading && <p>Loading clients...</p>}
      {!loading && clients.length === 0 && <p>No clients found yet.</p>}
      {!loading && clients.length > 0 && (
        <ul>
          {clients.map(client => (
            <li key={client.id} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #eee', borderRadius: '5px' }}>
               {/* --- Wrap client name or a dedicated link with <Link> --- */}
               {/* The 'to' prop dynamically creates the URL using the client.id */}
               <Link to={`/clients/${client.id}`} style={{ textDecoration: 'none', fontWeight: 'bold' }}>
                 {client.name} {/* This will be the clickable text */}
               </Link>
               {' - '}
               {client.email || 'N/A'} {client.phone && `(${client.phone})`}

               {/* Add Edit and Delete buttons (kept the same) */}
               <button onClick={() => handleEditClick(client)} style={{ marginLeft: '10px' }}>
                   Edit
               </button>
               <button onClick={() => handleDeleteClient(client.id)} style={{ marginLeft: '5px', color: 'red' }}>
                   Delete
               </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ClientsPage;