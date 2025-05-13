import React, { useState, useEffect } from 'react';
import { db } from '../firebase'; // Make sure this path is correct
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

function WorkItemsPage() {
  // State for list of categories
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // State variables for adding/editing category form
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryDescription, setEditCategoryDescription] = useState('');

  // State for Tasks
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // State variables for adding/editing task form
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [editTaskName, setEditTaskName] = useState('');
  const [editTaskDescription, setEditTaskDescription] = useState('');

  // --- State for Details ---
  const [selectedTask, setSelectedTask] = useState(null);
  const [details, setDetails] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // State variables for adding a new detail form
  const [newDetailName, setNewDetailName] = useState('');
  const [newDetailDescription, setNewDetailDescription] = useState('');
  const [newDetailHourlyRate, setNewDetailHourlyRate] = useState('');

  // State variables for editing detail
  const [editingDetail, setEditingDetail] = useState(null);
  const [editDetailName, setEditDetailName] = useState('');
  const [editDetailDescription, setEditDetailDescription] = useState('');
  const [editDetailHourlyRate, setEditDetailHourlyRate] = useState('');

  // --- Category Management Functions ---
  const fetchCategories = async () => {
    setLoadingCategories(true);
    try {
      const categoriesCollectionRef = collection(db, 'categories');
      const querySnapshot = await getDocs(categoriesCollectionRef);
      const categoriesList = querySnapshot.docs.map(docData => ({ id: docData.id, ...docData.data() }));
      setCategories(categoriesList);
    } catch (error) {
      console.error("Error fetching categories:", error);
      alert("Failed to fetch categories. See console for details.");
    } finally {
      setLoadingCategories(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      alert("Category name is required!");
      return;
    }
    const newCategory = {
      name: newCategoryName,
      description: newCategoryDescription,
      createdAt: new Date()
    };
    try {
      const categoriesCollectionRef = collection(db, 'categories');
      await addDoc(categoriesCollectionRef, newCategory);
      console.log("New category added successfully!");
      setNewCategoryName('');
      setNewCategoryDescription('');
      fetchCategories(); // Re-fetch to update list
    } catch (error) {
      console.error("Error adding category:", error);
      alert("Failed to add category. See console for details.");
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (window.confirm("Are you sure you want to delete this category? Warning: This will not automatically delete associated tasks or details if they exist!")) {
      try {
        const categoryDocRef = doc(db, 'categories', categoryId);
        await deleteDoc(categoryDocRef);
        console.log(`Category with ID ${categoryId} deleted successfully!`);
        fetchCategories(); // Re-fetch to update list
        if (selectedCategory && selectedCategory.id === categoryId) {
          setSelectedCategory(null);
          setTasks([]);
          setSelectedTask(null);
          setDetails([]);
        }
      } catch (error) {
        console.error("Error deleting category:", error);
        alert("Failed to delete category. See console for details.");
      }
    }
  };

  const handleEditClickCategory = (category) => {
    setEditingCategory(category);
    setEditCategoryName(category.name || '');
    setEditCategoryDescription(category.description || '');
  };

  const handleEditInputChangeCategory = (e) => {
    const { id, value } = e.target;
    if (id === 'editCategoryName') setEditCategoryName(value);
    else if (id === 'editCategoryDescription') setEditCategoryDescription(value);
  };

  const handleUpdateCategory = async (e) => {
    e.preventDefault();
    if (!editCategoryName.trim()) {
      alert("Category name is required!");
      return;
    }
    if (!editingCategory) {
        alert("No category selected for editing.");
        return;
    }
    const updatedCategoryData = {
      name: editCategoryName,
      description: editCategoryDescription,
      updatedAt: new Date()
    };
    try {
      const categoryDocRef = doc(db, 'categories', editingCategory.id);
      await updateDoc(categoryDocRef, updatedCategoryData);
      console.log(`Category with ID ${editingCategory.id} updated successfully!`);
      setEditingCategory(null);
      setEditCategoryName('');
      setEditCategoryDescription('');
      fetchCategories();
      if (selectedCategory && selectedCategory.id === editingCategory.id) {
        setSelectedCategory({ ...selectedCategory, ...updatedCategoryData });
      }
    } catch (error) {
      console.error("Error updating category:", error);
      alert("Failed to update category. See console for details.");
    }
  };

  const handleCancelEditCategory = () => {
    setEditingCategory(null);
    setEditCategoryName('');
    setEditCategoryDescription('');
  };

  // --- Task Management Functions ---
  const handleSelectCategory = (category) => {
    setSelectedCategory(category);
    setSelectedTask(null);
    setDetails([]);
    setTasks([]); // Clear previous tasks before loading new ones
    // setLoadingTasks(true); // Set in useEffect
  };

  useEffect(() => {
    if (selectedCategory) {
      const fetchTasks = async () => {
        setLoadingTasks(true);
        try {
          const tasksCollectionRef = collection(db, 'categories', selectedCategory.id, 'tasks');
          const querySnapshot = await getDocs(tasksCollectionRef);
          const tasksList = querySnapshot.docs.map(docData => ({ id: docData.id, ...docData.data() }));
          setTasks(tasksList);
        } catch (error) {
          console.error("Error fetching tasks:", error);
          alert("Failed to fetch tasks. See console for details.");
          setTasks([]); // Clear tasks on error
        } finally {
          setLoadingTasks(false);
        }
      };
      fetchTasks();
    } else {
      setTasks([]);
      setLoadingTasks(false);
    }
  }, [selectedCategory]);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskName.trim()) {
      alert("Task name is required!");
      return;
    }
    if (!selectedCategory) {
      alert("Please select a category first.");
      return;
    }
    const newTask = {
      name: newTaskName,
      description: newTaskDescription,
      createdAt: new Date()
    };
    try {
      const tasksCollectionRef = collection(db, 'categories', selectedCategory.id, 'tasks');
      await addDoc(tasksCollectionRef, newTask);
      console.log("New task added successfully!");
      setNewTaskName('');
      setNewTaskDescription('');
      // Re-fetch tasks for the currently selected category
      if (selectedCategory) { // Trigger the useEffect for tasks
        setSelectedCategory(prev => ({...prev})); // Create a new object reference to trigger useEffect
      }
    } catch (error) {
      console.error("Error adding task:", error);
      alert("Failed to add task. See console for details.");
    }
  };

  const handleEditClickTask = (task) => {
    setEditingTask(task);
    setEditTaskName(task.name || '');
    setEditTaskDescription(task.description || '');
  };

  const handleEditInputChangeTask = (e) => {
    const { id, value } = e.target;
    if (id === 'editTaskName') setEditTaskName(value);
    else if (id === 'editTaskDescription') setEditTaskDescription(value);
  };

  const handleUpdateTask = async (e) => {
    e.preventDefault();
    if (!editTaskName.trim()) {
      alert("Task name is required!");
      return;
    }
    if (!selectedCategory || !editingTask) {
      alert("Error: Category or Task not selected for update.");
      return;
    }
    const updatedTaskData = {
      name: editTaskName,
      description: editTaskDescription,
      updatedAt: new Date()
    };
    try {
      const taskDocRef = doc(db, 'categories', selectedCategory.id, 'tasks', editingTask.id);
      await updateDoc(taskDocRef, updatedTaskData);
      console.log(`Task with ID ${editingTask.id} updated successfully!`);
      setEditingTask(null);
      setEditTaskName('');
      setEditTaskDescription('');
      // Re-fetch tasks
      if (selectedCategory) {
        setSelectedCategory(prev => ({...prev}));
      }
    } catch (error) {
      console.error("Error updating task:", error);
      alert("Failed to update task. See console for details.");
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm("Are you sure you want to delete this task? Warning: This will not automatically delete associated details if they exist!")) {
      if (!selectedCategory) {
        alert("Error: Category not selected.");
        return;
      }
      try {
        const taskDocRef = doc(db, 'categories', selectedCategory.id, 'tasks', taskId);
        await deleteDoc(taskDocRef);
        console.log(`Task with ID ${taskId} deleted successfully!`);
        // Re-fetch tasks
        if (selectedCategory) {
            setSelectedCategory(prev => ({...prev}));
        }
        if (selectedTask && selectedTask.id === taskId) {
            setSelectedTask(null); // Clear selected task if it was the one deleted
            setDetails([]);
        }
      } catch (error) {
        console.error("Error deleting task:", error);
        alert("Failed to delete task. See console for details.");
      }
    }
  };

  const handleCancelEditTask = () => {
    setEditingTask(null);
    setEditTaskName('');
    setEditTaskDescription('');
  };

  // --- Detail Management Functions ---
  const handleSelectTask = (task) => {
    setSelectedTask(task);
    setDetails([]);
    // setLoadingDetails(true); // Set in useEffect
  };

  useEffect(() => {
    if (selectedCategory && selectedTask) {
      const fetchDetails = async () => {
        setLoadingDetails(true);
        try {
          const detailsCollectionRef = collection(db, 'categories', selectedCategory.id, 'tasks', selectedTask.id, 'details');
          const querySnapshot = await getDocs(detailsCollectionRef);
          const detailsList = querySnapshot.docs.map(docData => ({
            id: docData.id,
            ...docData.data()
          }));
          setDetails(detailsList);
        } catch (error) {
          console.error("Error fetching details:", error);
          alert("Failed to fetch details. See console for details.");
          setDetails([]);
        } finally {
          setLoadingDetails(false);
        }
      };
      fetchDetails();
    } else {
      setDetails([]);
      setLoadingDetails(false);
    }
  }, [selectedCategory, selectedTask]);

  const handleAddDetail = async (e) => {
    e.preventDefault();
    if (!newDetailName.trim()) {
      alert("Detail name is required!");
      return;
    }
    if (!selectedCategory || !selectedTask) {
      alert("Please select a category and a task first.");
      return;
    }

    const hourlyRateValue = newDetailHourlyRate ? parseFloat(newDetailHourlyRate) : null;
    if (newDetailHourlyRate && isNaN(hourlyRateValue)) {
      alert("Hourly Rate must be a valid number.");
      return;
    }

    const newDetail = {
      name: newDetailName,
      description: newDetailDescription,
      hourlyRate: hourlyRateValue,
      createdAt: new Date(),
    };

    try {
      const detailsCollectionRef = collection(db, 'categories', selectedCategory.id, 'tasks', selectedTask.id, 'details');
      await addDoc(detailsCollectionRef, newDetail);
      console.log("New detail added successfully!");
      setNewDetailName('');
      setNewDetailDescription('');
      setNewDetailHourlyRate('');
      // Re-fetch details
      if (selectedTask) {
        setSelectedTask(prev => ({...prev})); // Trigger useEffect for details
      }
    } catch (error) {
      console.error("Error adding detail:", error);
      alert("Failed to add detail. See console for details.");
    }
  };

  const handleEditClickDetail = (detail) => {
    setEditingDetail(detail);
    setEditDetailName(detail.name || '');
    setEditDetailDescription(detail.description || '');
    setEditDetailHourlyRate(detail.hourlyRate !== undefined && detail.hourlyRate !== null ? String(detail.hourlyRate) : '');
  };

  const handleEditInputChangeDetail = (e) => {
    const { id, value } = e.target;
    if (id === 'editDetailName') setEditDetailName(value);
    else if (id === 'editDetailDescription') setEditDetailDescription(value);
    else if (id === 'editDetailHourlyRate') setEditDetailHourlyRate(value);
  };

  const handleUpdateDetail = async (e) => {
    e.preventDefault();
    if (!editDetailName.trim()) {
      alert("Detail name is required!");
      return;
    }
    if (!selectedCategory || !selectedTask || !editingDetail) {
      alert("Error: Category, Task, or Detail not selected for update.");
      return;
    }

    const hourlyRateValue = editDetailHourlyRate ? parseFloat(editDetailHourlyRate) : null;
    if (editDetailHourlyRate && isNaN(hourlyRateValue)) {
      alert("Hourly Rate must be a valid number.");
      return;
    }

    const updatedDetailData = {
      name: editDetailName,
      description: editDetailDescription,
      hourlyRate: hourlyRateValue,
      updatedAt: new Date(),
    };

    try {
      const detailDocRef = doc(db, 'categories', selectedCategory.id, 'tasks', selectedTask.id, 'details', editingDetail.id);
      await updateDoc(detailDocRef, updatedDetailData);
      console.log(`Detail with ID ${editingDetail.id} updated successfully!`);
      setEditingDetail(null);
      setEditDetailName('');
      setEditDetailDescription('');
      setEditDetailHourlyRate('');
      // Re-fetch details
       if (selectedTask) {
        setSelectedTask(prev => ({...prev}));
      }
    } catch (error) {
      console.error("Error updating detail:", error);
      alert("Failed to update detail. See console for details.");
    }
  };

  const handleDeleteDetail = async (detailId) => {
    if (window.confirm("Are you sure you want to delete this detail?")) {
      if (!selectedCategory || !selectedTask) {
        alert("Error: Category or Task not selected.");
        return;
      }
      try {
        const detailDocRef = doc(db, 'categories', selectedCategory.id, 'tasks', selectedTask.id, 'details', detailId);
        await deleteDoc(detailDocRef);
        console.log(`Detail with ID ${detailId} deleted successfully!`);
        // Re-fetch details
        if (selectedTask) {
            setSelectedTask(prev => ({...prev}));
        }
      } catch (error) {
        console.error("Error deleting detail:", error);
        alert("Failed to delete detail. See console for details.");
      }
    }
  };

  const handleCancelEditDetail = () => {
    setEditingDetail(null);
    setEditDetailName('');
    setEditDetailDescription('');
    setEditDetailHourlyRate('');
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setSelectedTask(null);
    setDetails([]);
    setTasks([]);
  };

  const handleBackToTasks = () => {
    setSelectedTask(null);
    setDetails([]);
    // Tasks for the selectedCategory will remain loaded as selectedCategory hasn't changed.
    // If you want to force re-fetch tasks, you'd call fetchTasks or adjust selectedCategory state.
  };

  // --- Render the UI ---
  return (
    <div>
      <h1>Work Item Structure</h1>

      {/* --- Section for managing Categories --- */}
      {!selectedCategory && (
        <div>
          <h2>Manage Categories</h2>
          {!editingCategory ? (
            <>
              <h3>Add New Category</h3>
              <form onSubmit={handleAddCategory}>
                <div>
                  <label htmlFor="categoryName">Name:</label>
                  <input id="categoryName" type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} required />
                </div>
                <div>
                  <label htmlFor="categoryDescription">Description:</label>
                  <textarea id="categoryDescription" value={newCategoryDescription} onChange={(e) => setNewCategoryDescription(e.target.value)} />
                </div>
                <button type="submit">Add Category</button>
              </form>
            </>
          ) : (
            <>
              <h3>Edit Category: {editingCategory.name}</h3>
              <form onSubmit={handleUpdateCategory}>
                <div>
                  <label htmlFor="editCategoryName">Name:</label>
                  <input id="editCategoryName" type="text" value={editCategoryName} onChange={handleEditInputChangeCategory} required />
                </div>
                <div>
                  <label htmlFor="editCategoryDescription">Description:</label>
                  <textarea id="editCategoryDescription" value={editCategoryDescription} onChange={handleEditInputChangeCategory} />
                </div>
                <button type="submit">Save Changes</button>
                <button type="button" onClick={handleCancelEditCategory} style={{ marginLeft: '10px' }}>Cancel Edit</button>
              </form>
            </>
          )}
          <hr />
          <h3>Category List</h3>
          {loadingCategories && <p>Loading categories...</p>}
          {!loadingCategories && categories.length === 0 && <p>No categories found yet. Add one above.</p>}
          {!loadingCategories && categories.length > 0 && (
            <ul>
              {categories.map(category => (
                <li key={category.id}>
                  {category.name} {category.description && `(${category.description})`}
                  <button onClick={() => handleSelectCategory(category)} style={{ marginLeft: '10px' }}>
                    Select
                  </button>
                  <button onClick={() => handleEditClickCategory(category)} style={{ marginLeft: '5px' }}>Edit</button>
                  <button onClick={() => handleDeleteCategory(category.id)} style={{ marginLeft: '5px', color: 'red' }}>Delete</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* --- Section for managing Tasks --- */}
      {selectedCategory && !selectedTask && (
        <div>
          <h2>Tasks for: {selectedCategory.name}</h2>
          <button onClick={handleBackToCategories} style={{ marginBottom: '10px' }}>
            ← Back to Categories
          </button>

          {!editingTask ? (
            <>
              <h3>Add New Task</h3>
              <form onSubmit={handleAddTask}>
                <div>
                  <label htmlFor="taskName">Name:</label>
                  <input id="taskName" type="text" value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} required />
                </div>
                <div>
                  <label htmlFor="taskDescription">Description:</label>
                  <textarea id="taskDescription" value={newTaskDescription} onChange={(e) => setNewTaskDescription(e.target.value)} />
                </div>
                <button type="submit">Add Task</button>
              </form>
            </>
          ) : (
            <>
              <h3>Edit Task: {editingTask.name}</h3>
              <form onSubmit={handleUpdateTask}>
                <div>
                  <label htmlFor="editTaskName">Name:</label>
                  <input id="editTaskName" type="text" value={editTaskName} onChange={handleEditInputChangeTask} required />
                </div>
                <div>
                  <label htmlFor="editTaskDescription">Description:</label>
                  <textarea id="editTaskDescription" value={editTaskDescription} onChange={handleEditInputChangeTask} />
                </div>
                <button type="submit">Save Changes</button>
                <button type="button" onClick={handleCancelEditTask} style={{ marginLeft: '10px' }}>Cancel Edit</button>
              </form>
            </>
          )}
          <hr />
          <h3>Task List</h3>
          {loadingTasks && <p>Loading tasks...</p>}
          {!loadingTasks && tasks.length === 0 && <p>No tasks found for this category yet. Add one above.</p>}
          {!loadingTasks && tasks.length > 0 && (
            <ul>
              {tasks.map(task => (
                <li key={task.id} style={{ fontWeight: selectedTask && selectedTask.id === task.id ? 'bold' : 'normal' }}>
                  {task.name} {task.description && `(${task.description})`}
                  <button onClick={() => handleSelectTask(task)} style={{ marginLeft: '10px' }}>
                    Select
                  </button>
                  <button onClick={() => handleEditClickTask(task)} style={{ marginLeft: '5px' }}>Edit</button>
                  <button onClick={() => handleDeleteTask(task.id)} style={{ marginLeft: '5px', color: 'red' }}>Delete</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* --- Section for managing Details --- */}
      {selectedCategory && selectedTask && (
        <div>
          <h2>Details for Task: {selectedTask.name} (in {selectedCategory.name})</h2>
          <button onClick={handleBackToTasks} style={{ marginBottom: '10px' }}>
            ← Back to Tasks
          </button>

          {!editingDetail ? (
            <>
              <h3>Add New Detail</h3>
              <form onSubmit={handleAddDetail}>
                <div>
                  <label htmlFor="detailName">Name:</label>
                  <input
                    id="detailName"
                    type="text"
                    value={newDetailName}
                    onChange={(e) => setNewDetailName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="detailDescription">Description:</label>
                  <textarea
                    id="detailDescription"
                    value={newDetailDescription}
                    onChange={(e) => setNewDetailDescription(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="detailHourlyRate">Hourly Rate (€):</label>
                  <input
                    id="detailHourlyRate"
                    type="number"
                    step="0.01"
                    value={newDetailHourlyRate}
                    onChange={(e) => setNewDetailHourlyRate(e.target.value)}
                    placeholder="Optional e.g., 25.50"
                  />
                </div>
                <button type="submit">Add Detail</button>
              </form>
            </>
          ) : (
            <>
              <h3>Edit Detail: {editingDetail.name}</h3>
              <form onSubmit={handleUpdateDetail}>
                <div>
                  <label htmlFor="editDetailName">Name:</label>
                  <input
                    id="editDetailName"
                    type="text"
                    value={editDetailName}
                    onChange={handleEditInputChangeDetail}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="editDetailDescription">Description:</label>
                  <textarea
                    id="editDetailDescription"
                    value={editDetailDescription}
                    onChange={handleEditInputChangeDetail}
                  />
                </div>
                <div>
                  <label htmlFor="editDetailHourlyRate">Hourly Rate (€):</label>
                  <input
                    id="editDetailHourlyRate"
                    type="number"
                    step="0.01"
                    value={editDetailHourlyRate}
                    onChange={handleEditInputChangeDetail}
                    placeholder="Optional e.g., 25.50"
                  />
                </div>
                <button type="submit">Save Changes</button>
                <button type="button" onClick={handleCancelEditDetail} style={{ marginLeft: '10px' }}>
                  Cancel Edit
                </button>
              </form>
            </>
          )}

          <hr />
          <h3>Detail List</h3>
          {loadingDetails && <p>Loading details...</p>}
          {!loadingDetails && details.length === 0 && <p>No details found for this task yet. Add one above.</p>}
          {!loadingDetails && details.length > 0 && (
            <ul>
              {details.map(detail => (
                <li key={detail.id}>
                  {detail.name} {detail.description && `(${detail.description})`}
                  {detail.hourlyRate !== undefined && detail.hourlyRate !== null && ` - ${Number(detail.hourlyRate).toFixed(2)} €/hr`}
                  <button onClick={() => handleEditClickDetail(detail)} style={{ marginLeft: '10px' }}>
                    Edit
                  </button>
                  <button onClick={() => handleDeleteDetail(detail.id)} style={{ marginLeft: '5px', color: 'red' }}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Messages for navigation guidance */}
      {!selectedCategory && !loadingCategories && categories.length > 0 && (
        <p style={{ marginTop: '20px', fontStyle: 'italic' }}>Select a category above to see its tasks or add a new category.</p>
      )}
      {selectedCategory && !selectedTask && !loadingTasks && tasks.length > 0 && (
        <p style={{ marginTop: '20px', fontStyle: 'italic' }}>Select a task above to see its details or add a new task to '{selectedCategory.name}'.</p>
      )}
       {selectedCategory && !selectedTask && !loadingTasks && tasks.length === 0 && !editingTask &&(
         <p style={{ marginTop: '20px', fontStyle: 'italic' }}>This category has no tasks yet. Add one above.</p>
       )}
    </div>
  );
}

export default WorkItemsPage;