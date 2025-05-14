// ClientsPage.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Link } from 'react-router-dom';

function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  // State for Add New Client form
  const [newClientContactName, setNewClientContactName] = useState(''); // Changed from newClientName
  const [newClientCompanyName, setNewClientCompanyName] = useState(''); // << NEW for Company Name
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [newClientWebsite, setNewClientWebsite] = useState('');
  const [newClientVatNumber, setNewClientVatNumber] = useState('');

  // State for Edit Client form
  const [editingClient, setEditingClient] = useState(null);
  const [editContactName, setEditContactName] = useState(''); // Changed from editName
  const [editCompanyName, setEditCompanyName] = useState(''); // << NEW for Company Name
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editVatNumber, setEditVatNumber] = useState('');

  const fetchClients = async () => {
    setLoading(true);
    try {
      const clientsCollectionRef = collection(db, 'clients');
      const querySnapshot = await getDocs(clientsCollectionRef);
      const clientsList = querySnapshot.docs.map(docData => ({
        id: docData.id,
        ...docData.data()
      }));
      setClients(clientsList);
    } catch (error) {
      console.error("Error fetching clients:", error);
      alert("Failed to fetch clients. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleAddClient = async (e) => {
    e.preventDefault();
    // Company name is now the primary identifier for the "client" from a business perspective
    if (!newClientCompanyName.trim() && !newClientContactName.trim()) {
      alert("Either Company Name or Contact Name is required!");
      return;
    }
    const newClient = {
      companyName: newClientCompanyName.trim(), // << Store Company Name
      contactName: newClientContactName.trim(), // << Store Contact Person Name (was 'name')
      email: newClientEmail.trim(),
      phone: newClientPhone.trim(),
      address: newClientAddress.trim(),
      website: newClientWebsite.trim(),
      vatNumber: newClientVatNumber.trim(),
      createdAt: new Date(),
    };
    try {
      await addDoc(collection(db, 'clients'), newClient);
      console.log("New client added successfully!");
      setNewClientContactName('');
      setNewClientCompanyName('');
      setNewClientEmail('');
      setNewClientPhone('');
      setNewClientAddress('');
      setNewClientWebsite('');
      setNewClientVatNumber('');
      fetchClients();
    } catch (error) {
      console.error("Error adding client:", error);
      alert("Failed to add client. See console for details.");
    }
  };

  const handleDeleteClient = async (clientId) => {
    if (window.confirm("Are you sure you want to delete this client?")) {
      try {
        await deleteDoc(doc(db, 'clients', clientId));
        setClients(prevClients => prevClients.filter(client => client.id !== clientId));
      } catch (error) {
        console.error("Error deleting client:", error);
        alert("Failed to delete client. See console for details.");
      }
    }
  };

  const handleEditClick = (client) => {
    setEditingClient(client);
    setEditCompanyName(client.companyName || ''); // << Populate Company Name
    setEditContactName(client.contactName || ''); // << Populate Contact Name
    setEditEmail(client.email || '');
    setEditPhone(client.phone || '');
    setEditAddress(client.address || '');
    setEditWebsite(client.website || '');
    setEditVatNumber(client.vatNumber || '');
  };

  const handleEditInputChange = (e) => {
    const { id, value } = e.target;
    if (id === 'editCompanyName') setEditCompanyName(value);
    else if (id === 'editContactName') setEditContactName(value);
    else if (id === 'editEmail') setEditEmail(value);
    else if (id === 'editPhone') setEditPhone(value);
    else if (id === 'editAddress') setEditAddress(value);
    else if (id === 'editWebsite') setEditWebsite(value);
    else if (id === 'editVatNumber') setEditVatNumber(value);
  };

  const handleUpdateClient = async (e) => {
    e.preventDefault();
    if (!editCompanyName.trim() && !editContactName.trim()) {
      alert("Either Company Name or Contact Name is required!");
      return;
    }
    if (!editingClient) return;

    const updatedClientData = {
      companyName: editCompanyName.trim(), // << Update Company Name
      contactName: editContactName.trim(), // << Update Contact Name
      email: editEmail.trim(),
      phone: editPhone.trim(),
      address: editAddress.trim(),
      website: editWebsite.trim(),
      vatNumber: editVatNumber.trim(),
      updatedAt: new Date(),
    };
    try {
      await updateDoc(doc(db, 'clients', editingClient.id), updatedClientData);
      setEditingClient(null);
      fetchClients(); // Refresh client list
    } catch (error) {
      console.error("Error updating client:", error);
      alert("Failed to update client. See console for details.");
    }
  };

  const handleCancelEdit = () => {
    setEditingClient(null);
    // Clear all edit fields
    setEditCompanyName('');
    setEditContactName('');
    setEditEmail('');
    setEditPhone('');
    setEditAddress('');
    setEditWebsite('');
    setEditVatNumber('');
  };

  return (
    <div>
      <h1>Clients Management</h1>

      {!editingClient ? (
        <>
          <h2>Add New Client</h2>
          <form onSubmit={handleAddClient}>
            <div>
              <label htmlFor="newClientCompanyName">Company Name:</label>
              <input id="newClientCompanyName" type="text" value={newClientCompanyName} onChange={(e) => setNewClientCompanyName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="newClientContactName">Contact Person Name:</label>
              <input id="newClientContactName" type="text" value={newClientContactName} onChange={(e) => setNewClientContactName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="newClientEmail">Email:</label>
              <input id="newClientEmail" type="email" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} />
            </div>
            <div>
              <label htmlFor="newClientPhone">Phone:</label>
              <input id="newClientPhone" type="tel" value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} />
            </div>
            <div>
              <label htmlFor="newClientVatNumber">VAT Number:</label>
              <input id="newClientVatNumber" type="text" value={newClientVatNumber} onChange={(e) => setNewClientVatNumber(e.target.value)} />
            </div>
            <div>
              <label htmlFor="newClientAddress">Address:</label>
              <textarea id="newClientAddress" value={newClientAddress} onChange={(e) => setNewClientAddress(e.target.value)} />
            </div>
            <div>
              <label htmlFor="newClientWebsite">Website:</label>
              <input id="newClientWebsite" type="url" value={newClientWebsite} onChange={(e) => setNewClientWebsite(e.target.value)} />
            </div>
            <button type="submit">Add Client</button>
          </form>
        </>
      ) : (
        <>
          <h2>Edit Client: {editingClient.companyName || editingClient.contactName}</h2>
          <form onSubmit={handleUpdateClient}>
            <div>
              <label htmlFor="editCompanyName">Company Name:</label>
              <input id="editCompanyName" type="text" value={editCompanyName} onChange={handleEditInputChange} />
            </div>
            <div>
              <label htmlFor="editContactName">Contact Person Name:</label>
              <input id="editContactName" type="text" value={editContactName} onChange={handleEditInputChange} />
            </div>
            <div>
              <label htmlFor="editEmail">Email:</label>
              <input id="editEmail" type="email" value={editEmail} onChange={handleEditInputChange} />
            </div>
            <div>
              <label htmlFor="editPhone">Phone:</label>
              <input id="editPhone" type="tel" value={editPhone} onChange={handleEditInputChange} />
            </div>
            <div>
              <label htmlFor="editVatNumber">VAT Number:</label>
              <input id="editVatNumber" type="text" value={editVatNumber} onChange={handleEditInputChange} />
            </div>
            <div>
              <label htmlFor="editAddress">Address:</label>
              <textarea id="editAddress" value={editAddress} onChange={handleEditInputChange} />
            </div>
            <div>
              <label htmlFor="editWebsite">Website:</label>
              <input id="editWebsite" type="url" value={editWebsite} onChange={handleEditInputChange} />
            </div>
            <button type="submit">Save Changes</button>
            <button type="button" onClick={handleCancelEdit} style={{ marginLeft: '10px' }}> Cancel Edit </button>
          </form>
        </>
      )}

      <hr />

      <h2>Client List</h2>
      {loading && <p>Loading clients...</p>}
      {!loading && clients.length === 0 && <p>No clients found yet.</p>}
      {!loading && clients.length > 0 && (
        <ul>
          {clients.map(client => (
            <li key={client.id} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #eee', borderRadius: '5px' }}>
              <Link to={`/clients/${client.id}`} style={{ textDecoration: 'none', fontWeight: 'bold' }}>
                {client.companyName || client.contactName} {/* Display company name or contact name */}
              </Link>
              {client.companyName && client.contactName && ` (Contact: ${client.contactName})`}
              {' - '}
              {client.email || 'N/A'}
              {client.phone && ` (${client.phone})`}
              {client.vatNumber && ` - VAT: ${client.vatNumber}`}
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