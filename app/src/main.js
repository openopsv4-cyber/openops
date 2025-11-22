import './storage.js';

const storage = window.storage;

if (!storage) {
  throw new Error('Storage module failed to load.');
}

const STATUS_BADGES = {
  Pending: 'bg-warning-subtle text-warning-emphasis',
  'In Progress': 'bg-info-subtle text-info-emphasis',
  Completed: 'bg-success-subtle text-success-emphasis',
};

const STATUS_ICONS = {
  Pending: '⏳',
  'In Progress': '🚧',
  Completed: '✔',
};

const STATUS_OPTIONS = Object.keys(STATUS_BADGES);

const FILTER_OPTIONS_BY_ROLE = {
  admin: ['all', 'my', 'public', 'admin'],
  user: ['all', 'my', 'public'],
};

// Authentication state
let currentUser = storage.getSession();
storage.normalizeTasks();

const AI_SERVER_URL = 'http://localhost:3001/ai';
const AI_OFFLINE_MESSAGE = "⚠ AI server offline. Make sure 'npm run ai-server' is running.";

const isEventPublic = (event) => {
  if (!event) return false;
  return event.visibility !== 'admin';
};

function buildAIContext() {
  const session = storage.getSession();
  if (!session) {
    return { user: null, role: null, data: { tasks: [], events: [], complaints: [], permissions: [], feedback: [] } };
  }

  const role = session.role || 'user';
  const username = session.username;

  if (!username) {
    console.warn('⚠️ No username in session');
    return { user: session, role, data: { tasks: [], events: [], complaints: [], permissions: [], feedback: [] } };
  }

  const data = {
    tasks: [],
    events: [],
    complaints: [],
    permissions: [],
    feedback: [],
  };

  try {
    // Get all data from storage
    const allEvents = typeof storage.getEvents === 'function' ? storage.getEvents() : [];
    const allComplaints =
      typeof storage.getComplaints === 'function' ? storage.getComplaints() : [];
    const allPermissions =
      typeof storage.getPermissions === 'function' ? storage.getPermissions() : [];
    const allFeedback =
      typeof storage.getFeedback === 'function' ? storage.getFeedback() : [];
    const allTasks =
      typeof storage.getAllTasks === 'function'
        ? storage.getAllTasks()
        : [];

    // Get all users to check admin status
    const allUsers = typeof storage.getUsers === 'function' ? storage.getUsers() : [];
    const isUserAdmin = (ownerUsername) => {
      const user = allUsers.find((u) => u.username === ownerUsername);
      return user?.role === 'admin';
    };

    if (role === 'admin') {
      // Admin sees all tasks
      data.tasks = Array.isArray(allTasks) ? allTasks : [];
      data.events = Array.isArray(allEvents) ? allEvents : [];
      data.complaints = Array.isArray(allComplaints) ? allComplaints : [];
      data.permissions = Array.isArray(allPermissions) ? allPermissions : [];
      data.feedback = Array.isArray(allFeedback) ? allFeedback : [];
    } else if (role === 'coordinator') {
      // Coordinator sees: own tasks + public tasks created by admins
      data.tasks = Array.isArray(allTasks) ? allTasks.filter((task) => {
        if (task.owner === username) return true; // Own tasks
        const visibility = task.visibility || 'public';
        if (visibility === 'public' && isUserAdmin(task.owner)) return true; // Admin-created public tasks
        return false;
      }) : [];
      
      data.events = Array.isArray(allEvents) ? allEvents.filter(
        (event) => event?.createdBy === username || isEventPublic(event),
      ) : [];
      data.complaints = Array.isArray(allComplaints) ? allComplaints.filter((complaint) => complaint?.owner === username) : [];
      data.permissions = Array.isArray(allPermissions) ? allPermissions : []; // Coordinators can see all permissions
      data.feedback = Array.isArray(allFeedback) ? allFeedback.filter((feedback) => feedback?.owner === username) : [];
    } else {
      // Regular user sees: own tasks + public tasks created by admins
      data.tasks = Array.isArray(allTasks) ? allTasks.filter((task) => {
        if (task.owner === username) return true; // Own tasks
        const visibility = task.visibility || 'public';
        if (visibility === 'public' && isUserAdmin(task.owner)) return true; // Admin-created public tasks
        return false;
      }) : [];
      
      data.events = Array.isArray(allEvents) ? allEvents.filter((event) => isEventPublic(event)) : [];
      data.complaints = Array.isArray(allComplaints) ? allComplaints.filter((complaint) => complaint?.owner === username) : [];
      data.permissions = Array.isArray(allPermissions) ? allPermissions : []; // Users can see all permissions
      data.feedback = Array.isArray(allFeedback) ? allFeedback.filter((feedback) => feedback?.owner === username) : [];
    }

    // Normalize task data to ensure all required fields are present
    data.tasks = data.tasks.map((task) => ({
      text: task.text || '',
      status: task.status || 'Pending',
      owner: task.owner || username,
      visibility: task.visibility || 'public',
      createdAt: task.createdAt || Date.now(),
      id: task.id || '',
    }));

    // Normalize event data
    data.events = data.events.map((event) => ({
      title: event.title || '',
      clubName: event.clubName || '',
      description: event.description || '',
      status: event.status || 'Upcoming',
      startDate: event.startDate || '',
      endDate: event.endDate || '',
      registrationFee: event.registrationFee || '',
      createdBy: event.createdBy || '',
    }));

    // Normalize complaint data
    data.complaints = data.complaints.map((complaint) => ({
      category: complaint.category || '',
      description: complaint.description || '',
      status: complaint.status || 'Pending',
      owner: complaint.owner || username,
      createdAt: complaint.createdAt || Date.now(),
    }));

    // Normalize permission data
    data.permissions = data.permissions.map((permission) => ({
      filename: permission.filename || '',
      uploadedBy: permission.uploadedBy || '',
      createdAt: permission.createdAt || Date.now(),
    }));

    // Normalize feedback data
    data.feedback = data.feedback.map((feedback) => ({
      message: feedback.message || '',
      rating: feedback.rating || null,
      owner: feedback.owner || username,
      createdAt: feedback.createdAt || Date.now(),
    }));

  } catch (error) {
    console.error('⚠️ Error building AI context:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      username,
      role
    });
    // Return empty data structure on error, but still return user info
  }

  // Log final context summary
  console.log('✅ AI Context built successfully:', {
    user: session?.username || 'unknown',
    role: role,
    tasksCount: data.tasks?.length || 0,
    eventsCount: data.events?.length || 0,
    complaintsCount: data.complaints?.length || 0,
    permissionsCount: data.permissions?.length || 0,
    feedbackCount: data.feedback?.length || 0,
  });

  return {
    user: session,
    role,
    data,
  };
}

// UI Elements
const sections = {
  home: document.getElementById('home-section'),
  tasks: document.getElementById('tasks-section'),
  events: document.getElementById('events-section'),
  'event-detail': document.getElementById('event-detail-section'),
  'event-form': document.getElementById('event-form-section'),
  complaints: document.getElementById('complaints-section'),
  permissions: document.getElementById('permissions-section'),
  feedback: document.getElementById('feedback-section'),
  assistant: document.getElementById('assistant-section'),
  login: document.getElementById('login-section'),
};

const navLinks = Array.from(document.querySelectorAll('#nav-links .nav-link'));
const userDisplay = document.getElementById('user-display');
const usernameDisplay = document.getElementById('username-display');
const userRoleBadge = document.getElementById('user-role-badge');
const logoutBtn = document.getElementById('logout-btn');

// Login/Register elements
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const toggleRegisterBtn = document.getElementById('toggle-register');
const createAccountSection = document.getElementById('create-account-section');
const loginError = document.getElementById('login-error');

// Task elements
const listElement = document.getElementById('output-list');
const input = document.getElementById('input-field');
const saveBtn = document.getElementById('save-btn');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const visibilityControl = document.getElementById('visibility-control');
const taskVisibility = document.getElementById('task-visibility');
const visibilityFilters = document.querySelectorAll('input[name="visibility-filter"]');
const adminDataTools = document.getElementById('admin-data-tools');
const exportDataBtn = document.getElementById('export-data-btn');
const importDataBtn = document.getElementById('import-data-btn');
const importFileInput = document.getElementById('import-file-input');
const aiInput = document.getElementById('ai-input');
const aiResponseBox = document.getElementById('ai-response');
const aiSaveTaskBtn = document.getElementById('ai-save-task-btn');
const aiVisibilityWrapper = document.getElementById('ai-admin-visibility');
const aiVisibilitySelect = document.getElementById('ai-visibility-select');

// Event form elements
const eventForm = document.getElementById('event-form');
const eventFormHeading = document.getElementById('event-form-heading');
const eventFormError = document.getElementById('event-form-error');
const eventFormBackBtn = document.getElementById('event-form-back-btn');
const eventClubNameInput = document.getElementById('event-club-name');
const eventTitleInput = document.getElementById('event-title');
const eventDescriptionInput = document.getElementById('event-description');
const eventRegistrationFeeInput = document.getElementById('event-registration-fee');
const attendanceAllowedInputs = document.querySelectorAll('input[name="attendance-allowed"]');
const attendanceTimingGroup = document.getElementById('attendance-timing-group');
const attendanceTimingInput = document.getElementById('attendance-timing');
const eventDurationInput = document.getElementById('event-duration');
const eventStartTimeInput = document.getElementById('event-start-time');
const eventEndTimeInput = document.getElementById('event-end-time');
const eventRegistrationLinkInput = document.getElementById('event-registration-link');
const eventPosterInput = document.getElementById('event-poster');
const eventStatusInput = document.getElementById('event-status');
const eventsSearchInput = document.getElementById('events-search-input');

let items = [];
let searchTerm = '';
let sortOrder = sortSelect?.value || 'newest';
let visibilityFilter = 'all'; // Default to 'all' for normal users
let lastAIResponse = '';
let editingEventId = null;
let editingEventImage = '';
let editingEventOwner = '';
let eventsSearchTerm = '';

// Role helper functions (defined early for use in other functions)
const isAdmin = () => currentUser?.role === 'admin';
const isCoordinator = () => currentUser?.role === 'coordinator';
const canEditEvent = (event) => isAdmin() || (isCoordinator() && event?.createdBy === currentUser?.username);
const canEditComplaint = (complaint) => isAdmin() || complaint?.owner === currentUser?.username;

const updateAdminDataToolsVisibility = () => {
  if (adminDataTools) {
    adminDataTools.classList.toggle('d-none', !isAdmin());
  }
  if (!isAdmin() && importFileInput) {
    importFileInput.value = '';
  }
};

const updateAIVisibilityControl = () => {
  if (aiVisibilityWrapper) {
    aiVisibilityWrapper.classList.toggle('d-none', !isAdmin());
  }
  if (!isAdmin() && aiVisibilitySelect) {
    aiVisibilitySelect.value = 'public';
  }
};

const resetAIState = () => {
  lastAIResponse = '';
  if (aiInput) {
    aiInput.value = '';
  }
  if (aiResponseBox) {
    aiResponseBox.textContent = 'No response yet. Type a prompt and press Send.';
    aiResponseBox.classList.add('text-muted');
  }
  if (aiVisibilitySelect) {
    aiVisibilitySelect.value = 'public';
  }
};

// Authentication functions
const updateUIForAuth = () => {
  if (currentUser) {
    // Show user info and logout
    userDisplay?.classList.remove('d-none');
    logoutBtn?.classList.remove('d-none');
    usernameDisplay.textContent = currentUser.name || currentUser.username;
    const role = currentUser.role || 'user';
    const roleLabels = { admin: 'Admin', coordinator: 'Coordinator', user: 'User' };
    const roleClasses = {
      admin: 'bg-warning text-dark',
      coordinator: 'bg-info text-dark',
      user: 'bg-light text-dark',
    };
    userRoleBadge.textContent = roleLabels[role] || 'User';
    userRoleBadge.className = `badge ms-2 ${roleClasses[role] || roleClasses.user}`;
    updateAdminDataToolsVisibility();
    updateAIVisibilityControl();

    // Show main sections, hide login
    sections.login?.classList.remove('active');
    Object.keys(sections).forEach((key) => {
      if (key !== 'login') {
        sections[key]?.classList.remove('active');
      }
    });
    switchPage('home');
  } else {
    // Hide user info and logout
    userDisplay?.classList.add('d-none');
    logoutBtn?.classList.add('d-none');

    // Show login, hide main sections
    Object.keys(sections).forEach((key) => {
      if (key !== 'login') {
        sections[key]?.classList.remove('active');
      }
    });
    sections.login?.classList.add('active');
    updateAdminDataToolsVisibility();
    updateAIVisibilityControl();
    resetAIState();
  }
};

const handleLogin = (username, password) => {
  const user = storage.authenticateUser(username, password);
  if (user) {
    currentUser = storage.setSession(user);
    loadUserTasks();
    updateUIForAuth();
    clearLoginForm();
    return true;
  }
  return false;
};

const handleRegister = (name, usn, email, password, role) => {
  try {
    storage.createUser(email, password, role, { name, usn, email });
    return handleLogin(email, password);
  } catch (error) {
    showError(error.message);
    return false;
  }
};

const handleLogout = () => {
  storage.clearSession();
  currentUser = null;
  items = [];
  visibilityFilter = 'all';
  const defaultRadio = document.getElementById('filter-all');
  if (defaultRadio) {
    defaultRadio.checked = true;
  }
  updateFilterVisibility();
  updateAdminDataToolsVisibility();
  updateAIVisibilityControl();
  resetAIState();
  renderItems();
  updateUIForAuth();
  clearLoginForm();
};

const showError = (message) => {
  if (loginError) {
    loginError.textContent = message;
    loginError.classList.remove('d-none');
    setTimeout(() => {
      loginError.classList.add('d-none');
    }, 5000);
  }
};

const clearLoginForm = () => {
  if (loginForm) loginForm.reset();
  if (registerForm) registerForm.reset();
  if (createAccountSection) createAccountSection.classList.add('d-none');
  if (loginError) loginError.classList.add('d-none');
};

// Navigation
const switchPage = (targetPage) => {
  if (!currentUser && targetPage !== 'login') {
    updateUIForAuth();
    return;
  }

  Object.entries(sections).forEach(([key, section]) => {
    if (!section) return;
    section.classList.toggle('active', key === targetPage);
    if (key === targetPage) {
      section.scrollTop = 0;
    }
  });

  navLinks.forEach((link) => {
    // Keep Events nav active when viewing event-detail or event-form
    const isActive = link.dataset.page === targetPage || 
                     (link.dataset.page === 'events' && (targetPage === 'event-detail' || targetPage === 'event-form'));
    link.classList.toggle('active', isActive);
    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });

  if (targetPage === 'tasks') {
    loadUserTasks();
  } else if (targetPage === 'events') {
    loadEvents();
  } else if (targetPage === 'complaints') {
    loadComplaints();
  } else if (targetPage === 'permissions') {
    loadPermissions();
  } else if (targetPage === 'feedback') {
    loadFeedback();
    setTimeout(initStarRating, 100);
  }
};

// Navigation handler function
const handlePageLinkClick = (event) => {
  event.preventDefault();
  const page = event.currentTarget.dataset.page;
  if (page) {
    switchPage(page);
  }
};

navLinks.forEach((link) => {
  link.addEventListener('click', handlePageLinkClick);
});

// Add event listeners for all other links with data-page attribute (footer, hero buttons, etc.)
// Use event delegation for dynamically added content
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-page]');
  if (link && !navLinks.includes(link)) {
    handlePageLinkClick(event);
  }
});

const canUserSeeTask = (task, user) => {
  if (!user || !task) return false;
  const visibility = task.visibility || 'public';
  if (visibility === 'admin' && user.role !== 'admin') {
    return false;
  }
  return true;
};

// Helper to check if a user is an admin
const isUserAdmin = (username) => {
  const users = storage.getUsers();
  const user = users.find((u) => u.username === username);
  return user?.role === 'admin';
};

const getVisibleTasksForUser = (
  allTasks,
  user,
  activeFilter = 'all',
  searchQuery = '',
  sortOption = 'newest',
) => {
  if (!user || !Array.isArray(allTasks)) {
    return [];
  }

  const isAdmin = user.role === 'admin';
  
  // STEP 1: Filter tasks based on user role
  // Regular users: see their own tasks + admin-created public tasks
  // Admins: see all tasks
  let working = allTasks.filter((task) => {
    if (isAdmin) return true; // Admin sees all
    
    // Regular users see:
    // 1. Their own tasks
    // 2. Admin-created public tasks
    if (task.owner === user.username) return true;
    if ((task.visibility || 'public') === 'public' && isUserAdmin(task.owner)) return true;
    
    return false;
  });

  // STEP 2: Apply active filter
  const normalizedFilter = activeFilter || 'all';

  if (normalizedFilter === 'my') {
    working = working.filter((task) => task.owner === user.username);
  } else if (normalizedFilter === 'public') {
    working = working.filter((task) => (task.visibility || 'public') === 'public');
  } else if (isAdmin && normalizedFilter === 'admin') {
    working = working.filter((task) => task.visibility === 'admin');
  }

  // STEP 3: search
  const normalizedQuery = (searchQuery || '').trim().toLowerCase();
  if (normalizedQuery) {
    working = working.filter((task) => (task.text || '').toLowerCase().includes(normalizedQuery));
  }

  // STEP 4: sorting
  const sorted = [...working];
  switch (sortOption) {
    case 'az':
      sorted.sort((a, b) =>
        (a.text || '').localeCompare(b.text || '', undefined, { sensitivity: 'base' }),
      );
      break;
    case 'za':
      sorted.sort((a, b) =>
        (b.text || '').localeCompare(a.text || '', undefined, { sensitivity: 'base' }),
      );
      break;
    case 'oldest':
      sorted.sort((a, b) => a.createdAt - b.createdAt);
      break;
    case 'newest':
    default:
      sorted.sort((a, b) => b.createdAt - a.createdAt);
      break;
  }

  return sorted;
};

// Task management
const loadUserTasks = () => {
  if (!currentUser) return;

  // Load all tasks (will be filtered by getVisibleTasksForUser)
  items = storage.getAllTasks();
  
  // Show/hide visibility control for admins
  if (visibilityControl) {
    visibilityControl.classList.toggle('d-none', currentUser.role !== 'admin');
  }
  
  // Update filter visibility for admins
  updateFilterVisibility();
  renderItems();
};

const setFilterAvailability = (filterId, enabled) => {
  const input = document.getElementById(filterId);
  const label = document.querySelector(`label[for="${filterId}"]`);
  if (input) {
    input.disabled = !enabled;
    input.classList.toggle('d-none', !enabled);
  }
  if (label) {
    label.classList.toggle('d-none', !enabled);
  }
};

const updateFilterVisibility = () => {
  const role = currentUser?.role === 'admin' ? 'admin' : 'user';
  const allowedFilters = FILTER_OPTIONS_BY_ROLE[role];

  setFilterAvailability('filter-all', true);
  setFilterAvailability('filter-my', true);
  setFilterAvailability('filter-public', true);
  setFilterAvailability('filter-admin', role === 'admin');

  if (!allowedFilters.includes(visibilityFilter)) {
    visibilityFilter = 'all';
    const defaultRadio = document.getElementById('filter-all');
    if (defaultRadio) {
      defaultRadio.checked = true;
    }
  }
};

const clearInput = () => {
  if (!input) return;
  input.value = '';
  input.focus();
};

const formatTimestamp = (timestamp) => {
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return '';
  }
};

const getDisplayItems = () => {
  if (!currentUser) return [];
  
  // Use the clean filtering pipeline
  const visibleTasks = getVisibleTasksForUser(
    items,
    currentUser,
    visibilityFilter,
    searchTerm,
    sortOrder
  );
  
  // Map to format expected by renderItems (with index for reference)
  return visibleTasks.map((item, displayIndex) => {
    // Find original index in items array for operations
    const originalIndex = items.findIndex((t) => t.id === item.id);
    return { item, index: originalIndex >= 0 ? originalIndex : displayIndex };
  });
};

const canModifyTask = (task) => {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true; // Admin can modify all tasks
  
  // Regular users can only modify their own tasks
  // They CANNOT modify admin-created public tasks
  if (task.owner === currentUser.username) {
    return true; // User owns this task
  }
  
  // If task is public but owned by admin, user cannot modify
  if ((task.visibility || 'public') === 'public' && isUserAdmin(task.owner)) {
    return false; // Admin-created public task - user cannot modify
  }
  
  // Default: user cannot modify tasks they don't own
  return false;
};

const renderItems = () => {
  if (!listElement) return;

  listElement.innerHTML = '';

  const displayItems = getDisplayItems();

  if (!displayItems.length) {
    const emptyMessage = document.createElement('li');
    emptyMessage.className = 'list-group-item text-center text-muted';
    emptyMessage.textContent = items.length
      ? 'No tasks match your search.'
      : 'No entries yet. Start by adding something above.';
    listElement.appendChild(emptyMessage);
    return;
  }

  displayItems.forEach(({ item, index }) => {
    const listItem = document.createElement('li');
    listItem.className =
      'list-group-item d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3';

    const badgeClass = STATUS_BADGES[item.status] || STATUS_BADGES.Pending;
    const statusIcon = STATUS_ICONS[item.status] || STATUS_ICONS.Pending;
    const dropdownId = `statusDropdown-${item.id}`;
    const canModify = canModifyTask(item);
    const owner = item.owner || currentUser?.username || '';
    const ownerLabel = item.owner && item.owner !== currentUser?.username ? ` (${item.owner})` : '';
    const visibilityBadge = item.visibility === 'admin' 
      ? '<span class="badge bg-danger ms-2">Admin Only</span>' 
      : '<span class="badge bg-success ms-2">Public</span>';

    const statusMenu = STATUS_OPTIONS.map(
      (status) => `
        <li>
          <button
            class="dropdown-item d-flex align-items-center gap-2 ${status === item.status ? 'active' : ''}"
            data-action="status"
            data-status-value="${status}"
            data-task-id="${item.id}"
            data-owner="${owner}"
            ${!canModify ? 'disabled' : ''}
          >
            <span>${STATUS_ICONS[status] || ''}</span>
            <span>${status}</span>
          </button>
        </li>
      `,
    ).join('');

    listItem.innerHTML = `
      <div class="task-item-content">
        <p class="mb-2 fw-semibold text-break">${item.text}${ownerLabel}${visibilityBadge}</p>
        <small class="text-muted d-flex align-items-center gap-1">
          <span>📅</span>
          <span>Added ${formatTimestamp(item.createdAt)}</span>
        </small>
      </div>
      <div class="task-actions d-flex align-items-center gap-2 flex-wrap">
        <div class="dropdown dropstart">
          <button
            class="badge rounded-pill border-0 ${badgeClass} dropdown-toggle d-flex align-items-center gap-1 px-3 py-2"
            type="button"
            id="${dropdownId}"
            data-bs-toggle="dropdown"
            aria-expanded="false"
            data-task-id="${item.id}"
            data-owner="${owner}"
            ${!canModify ? 'disabled' : ''}
          >
            <span>${statusIcon}</span>
            <span>${item.status}</span>
          </button>
          <ul class="dropdown-menu dropdown-menu-end shadow-sm" aria-labelledby="${dropdownId}">
            ${statusMenu}
          </ul>
        </div>
        <div class="btn-group btn-group-sm" role="group">
          <button class="btn btn-outline-primary d-flex align-items-center gap-1" data-action="edit" data-task-id="${item.id}" data-owner="${owner}" title="Edit task" ${!canModify ? 'disabled' : ''}>
            <span>📝</span>
            <span class="d-none d-sm-inline">Edit</span>
          </button>
          <button class="btn btn-outline-danger d-flex align-items-center gap-1" data-action="delete" data-task-id="${item.id}" data-owner="${owner}" title="Delete task" ${!canModify ? 'disabled' : ''}>
            <span>❌</span>
            <span class="d-none d-sm-inline">Delete</span>
          </button>
    </div>
  </div>
    `;

    listElement.appendChild(listItem);
  });
};

const handleSave = () => {
  if (!currentUser) return;
  const value = input?.value.trim();
  if (!value) {
    alert('Please enter some text before saving.');
    return;
  }
  
  // Get visibility for admins, always 'public' for regular users
  const visibility = currentUser.role === 'admin' && taskVisibility 
    ? taskVisibility.value 
    : 'public';
  
  // Add the task and reload all tasks to preserve tasks from all users
  storage.add(value, currentUser.username, visibility);
  loadUserTasks(); // Reload all tasks to refresh the list
  clearInput();
};

const handleSearch = (event) => {
  searchTerm = event.target.value;
  renderItems();
};

const handleSortChange = (event) => {
  sortOrder = event.target.value;
  renderItems();
};

const getAIInputValue = () => (aiInput?.value.trim() ?? '');

const renderAIOutput = (text) => {
  lastAIResponse = text;
  if (aiResponseBox) {
    aiResponseBox.textContent = text || 'No response yet. Type a prompt and press Send.';
    aiResponseBox.classList.toggle('text-muted', !text);
  }
};

const sendChatMessage = async (message) => {
  if (!currentUser) {
    alert('Please log in to use the AI Assistant.');
    return;
  }

  const responseBox = document.getElementById('ai-response');
  if (!responseBox) return;

  responseBox.textContent = '⏳ Thinking...';
  responseBox.classList.remove('text-muted');

  try {
    const trimmed = message?.trim();
    if (!trimmed) {
      responseBox.textContent = '⚠ Please enter a prompt before sending.';
      return;
    }

    const context = buildAIContext();
    if (!context?.user) {
      responseBox.textContent = '⚠ Please log in to use the AI Assistant.';
      return;
    }

    // Ensure context has proper structure
    if (!context.data) {
      context.data = {
        tasks: [],
        events: [],
        complaints: [],
        permissions: [],
        feedback: [],
      };
    }

    // Log detailed context for debugging
    console.log('➡️ AI Context Summary:', {
      user: context.user?.username || 'unknown',
      role: context.role || 'unknown',
      tasksCount: context.data?.tasks?.length || 0,
      eventsCount: context.data?.events?.length || 0,
      complaintsCount: context.data?.complaints?.length || 0,
      feedbackCount: context.data?.feedback?.length || 0,
      permissionsCount: context.data?.permissions?.length || 0,
    });

    // Log sample tasks to verify data is being fetched
    if (context.data?.tasks?.length > 0) {
      console.log('➡️ Sample tasks:', context.data.tasks.slice(0, 3).map(t => ({
        text: t.text,
        owner: t.owner,
        visibility: t.visibility,
        status: t.status
      })));
    } else {
      console.warn('⚠️ No tasks found in context. Checking storage...');
      const allTasks = storage.getAllTasks ? storage.getAllTasks() : [];
      console.log('➡️ All tasks in storage:', allTasks.length);
      if (allTasks.length > 0) {
        console.log('➡️ Sample tasks from storage:', allTasks.slice(0, 3));
      }
    }

    const payload = { message: trimmed, context };
    console.log('➡️ Sending payload to AI server...');

    const res = await fetch(AI_SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const errorMsg = errorData?.error || '⚠ Error contacting AI server.';
      responseBox.textContent = errorMsg;
      responseBox.classList.add('text-muted');
      return;
    }

    const data = await res.json();
    const aiText =
      (typeof data?.response === 'string' && data.response) ||
      (typeof data === 'string' && data) ||
      (typeof data?.message === 'string' && data.message) ||
      (typeof data?.message?.content === 'string' && data.message.content) ||
      (Array.isArray(data?.messages) && data.messages[0]?.content) ||
      JSON.stringify(data);

    if (!aiText || (typeof aiText === 'string' && aiText.trim().length === 0)) {
      responseBox.textContent = '⚠ No response received from AI.';
      responseBox.classList.add('text-muted');
      return;
    }

    renderAIOutput(aiText);
  } catch (error) {
    console.error('AI assistant request failed:', error);
    responseBox.textContent = AI_OFFLINE_MESSAGE;
  }
};

const resolveAIVisibility = () => {
  if (currentUser?.role === 'admin') {
    const selection = aiVisibilitySelect?.value === 'admin' ? 'admin' : 'public';
    return selection;
  }
  return 'public';
};

const handleAISaveTask = () => {
  if (!currentUser) {
    alert('Please log in to save AI responses.');
    return;
  }
  if (!lastAIResponse) {
    alert('Generate an AI response before saving.');
    return;
  }

  try {
    const visibility = resolveAIVisibility();
    storage.add(lastAIResponse, currentUser.username, visibility);
    loadUserTasks();
    alert('AI response saved as a new task.');
  } catch (error) {
    console.error('Failed to save AI task', error);
    alert('Unable to save AI response. Please try again.');
  }
};

const downloadBlob = (content, filename, mimeType = 'application/json') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const handleExportData = () => {
  if (!currentUser || currentUser.role !== 'admin') {
    alert('Permission denied. Admin access is required.');
    return;
  }

  try {
    const payload = storage.exportData();
    const pretty = JSON.stringify(payload, null, 2);
    const dateStamp = new Date().toISOString().split('T')[0];
    const filename = `campus-app-backup-${dateStamp}.json`;
    downloadBlob(pretty, filename);
    alert('Export successful. Your download should begin shortly.');
  } catch (error) {
    console.error('Export failed', error);
    alert('Unable to export data. Please try again.');
  }
};

const resetImportInput = () => {
  if (importFileInput) {
    importFileInput.value = '';
  }
};

const handleImportButtonClick = () => {
  if (!currentUser || currentUser.role !== 'admin') {
    alert('Permission denied. Admin access is required.');
    return;
  }
  if (importFileInput) {
    importFileInput.click();
  }
};

const handleImportFileChange = (event) => {
  if (!currentUser || currentUser.role !== 'admin') {
    alert('Permission denied. Admin access is required.');
    resetImportInput();
    return;
  }

  const file = event.target.files?.[0];
  if (!file) {
    alert('No file selected.');
    return;
  }

  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith('.json')) {
    alert('Invalid file type. Please select a .json backup file.');
    resetImportInput();
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const replaceMode = confirm(
        'Import Mode:\n- OK = Replace All Existing Data\n- Cancel = Merge With Existing Data Instead',
      );
      const mode = replaceMode ? 'replace' : 'merge';
      storage.importData(parsed, { mode });
      const successMessage = replaceMode
        ? 'Import successful. Reloading to apply changes.'
        : 'Merge successful. Reloading to apply changes.';
      alert(successMessage);
      window.location.reload();
    } catch (error) {
      console.error('Import failed', error);
      alert('Bad JSON file. Please verify the backup and try again.');
      resetImportInput();
    }
  };
  reader.onerror = () => {
    alert('Unable to read the selected file.');
    resetImportInput();
  };
  reader.readAsText(file);
};

// Event listeners
saveBtn?.addEventListener('click', handleSave);

input?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    handleSave();
  }
});

searchInput?.addEventListener('input', handleSearch);
sortSelect?.addEventListener('change', handleSortChange);
exportDataBtn?.addEventListener('click', handleExportData);
importDataBtn?.addEventListener('click', handleImportButtonClick);
importFileInput?.addEventListener('change', handleImportFileChange);

// Visibility filter handlers
visibilityFilters.forEach((filter) => {
  filter.addEventListener('change', (event) => {
    visibilityFilter = event.target.value;
    renderItems();
  });
});

const assistantSubmitBtn = document.getElementById('assistant-submit-btn');
if (assistantSubmitBtn) {
  assistantSubmitBtn.onclick = () => {
    const message = getAIInputValue();
    if (message.length > 0) {
      sendChatMessage(message);
    }
  };
}

aiSaveTaskBtn?.addEventListener('click', handleAISaveTask);

listElement?.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  // Find the closest element with data-action attribute (handles clicks on child elements like icons)
  const actionElement = target.closest('[data-action]');
  if (!actionElement || actionElement.disabled) return;

  const action = actionElement.dataset.action;
  if (!action) return;

  const taskId = actionElement.dataset.taskId;
  if (!taskId) return;

  // Find task by ID in the owner's task list
  const owner = actionElement.dataset.owner || currentUser?.username;
  const ownerTasks = storage.get(owner);
  const taskIndex = ownerTasks.findIndex((t) => t.id === taskId);

  if (taskIndex === -1) {
    console.error('Task not found');
    return;
  }

  const task = ownerTasks[taskIndex];
  if (!task || !canModifyTask({ ...task, owner })) return;

  if (action === 'delete') {
    storage.remove(taskIndex, owner);
    loadUserTasks(); // Reload to refresh the list
    return;
  }

  if (action === 'edit') {
    const currentValue = task.text ?? '';
    let newValue = prompt('Update task:', currentValue);
    if (newValue === null) {
      return;
    }
    const trimmed = newValue.trim();
    if (!trimmed) {
      alert('Cannot save an empty value.');
      return;
    }
    
    // For admins, also allow changing visibility
    let visibility = task.visibility || 'public';
    if (currentUser?.role === 'admin') {
      const currentVisibilityText = task.visibility === 'admin' ? 'Admin Only' : 'Public';
      const changeVisibility = confirm(`Current visibility: ${currentVisibilityText}\n\nClick OK to change visibility, or Cancel to keep it.`);
      if (changeVisibility) {
        const newVisibility = prompt('Enter new visibility:\n- Type "public" for Public\n- Type "admin" for Admin Only', task.visibility || 'public');
        if (newVisibility && (newVisibility.toLowerCase() === 'public' || newVisibility.toLowerCase() === 'admin')) {
          visibility = newVisibility.toLowerCase();
        }
      }
    } else {
      // Regular users always keep 'public' visibility
      visibility = 'public';
    }
    
    // Update task text and visibility
    storage.update(taskIndex, { text: trimmed, visibility }, owner);
    loadUserTasks(); // Reload to refresh the list
    return;
  }

  if (action === 'status') {
    const nextStatus = actionElement.dataset.statusValue;
    if (!nextStatus) return;
    storage.update(taskIndex, { status: nextStatus }, owner);
    loadUserTasks(); // Reload to refresh the list
    return;
  }
});

// Login/Register handlers
loginForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const usn = document.getElementById('login-usn').value.trim().toUpperCase();
  const password = document.getElementById('login-password').value;

  if (!usn || !password) {
    showError('Please enter both USN and password.');
    return;
  }

  if (handleLogin(usn, password)) {
    // Success handled in handleLogin
  } else {
    showError('Invalid USN or password.');
  }
});

registerForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = document.getElementById('register-name').value.trim();
  const usn = document.getElementById('register-usn').value.trim().toUpperCase();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  const role = document.getElementById('register-role').value;

  if (!name || !usn || !email || !password) {
    showError('Please fill in all fields.');
    return;
  }

  // Validate USN format: numchar charnumnumcharcharnumnumnumn (e.g., 1BM24CS001)
  const usnPattern = /^[0-9][A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{3}$/;
  if (!usnPattern.test(usn)) {
    showError('Invalid USN format. Expected format: e.g., 1BM24CS001');
    return;
  }

  // Validate email domain
  if (!email.endsWith('@bmsce.ac.in')) {
    showError('Invalid domain name');
    return;
  }

  // Validate password: at least 8 characters, one uppercase, one lowercase, one number, one special character
  const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordPattern.test(password)) {
    showError('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&).');
    return;
  }

  if (handleRegister(name, usn, email, password, role)) {
    // Success handled in handleRegister
  }
});

toggleRegisterBtn?.addEventListener('click', () => {
  createAccountSection?.classList.toggle('d-none');
  if (createAccountSection?.classList.contains('d-none')) {
    toggleRegisterBtn.textContent = 'Create Account';
  } else {
    toggleRegisterBtn.textContent = 'Back to Login';
  }
});

logoutBtn?.addEventListener('click', () => {
  handleLogout();
});

// Events page functions
const EVENT_DESCRIPTION_PREVIEW_LENGTH = 140;

const getEventDescriptionPreview = (description = '') => {
  const text = String(description || '').trim();
  if (!text) {
    return 'Description coming soon.';
  }
  if (text.length <= EVENT_DESCRIPTION_PREVIEW_LENGTH) {
    return text;
  }
  return `${text.slice(0, EVENT_DESCRIPTION_PREVIEW_LENGTH - 3)}...`;
};

const formatEventDate = (timestamp) => {
  if (!timestamp && timestamp !== 0) return 'Not set';
  return formatTimestamp(timestamp);
};

const hideEventFormError = () => {
  if (eventFormError) {
    eventFormError.classList.add('d-none');
    eventFormError.textContent = '';
  }
};

const showEventFormError = (message) => {
  if (eventFormError) {
    eventFormError.textContent = message;
    eventFormError.classList.remove('d-none');
  } else {
    alert(message);
  }
};

const getAttendanceAllowedValue = () => {
  const selected = Array.from(attendanceAllowedInputs || []).find((input) => input.checked);
  return selected?.value || 'no';
};

const updateAttendanceTimingVisibility = () => {
  const shouldShow = getAttendanceAllowedValue() === 'yes';
  if (attendanceTimingGroup) {
    attendanceTimingGroup.classList.toggle('d-none', !shouldShow);
  }
  if (attendanceTimingInput) {
    attendanceTimingInput.required = shouldShow;
    if (!shouldShow) {
      attendanceTimingInput.value = '';
    }
  }
};

const setAttendanceAllowedValue = (value) => {
  let matched = false;
  Array.from(attendanceAllowedInputs || []).forEach((input) => {
    const checked = input.value === value;
    input.checked = checked;
    if (checked) {
      matched = true;
    }
  });
  if (!matched && attendanceAllowedInputs?.length) {
    attendanceAllowedInputs[0].checked = true;
  }
  updateAttendanceTimingVisibility();
};

const toDatetimeLocalValue = (timestamp) => {
  if (!timestamp && timestamp !== 0) return '';
  const date = new Date(Number(timestamp));
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value) => String(value).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const parseDatetimeLocal = (value) => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const seedDefaultEventTimes = () => {
  const now = Date.now();
  const start = now + 3600000; // +1 hour
  const end = start + 3600000; // +1 additional hour
  if (eventStartTimeInput) {
    eventStartTimeInput.value = toDatetimeLocalValue(start);
  }
  if (eventEndTimeInput) {
    eventEndTimeInput.value = toDatetimeLocalValue(end);
  }
};

const resetEventForm = () => {
  eventForm?.reset();
  editingEventId = null;
  editingEventImage = '';
  editingEventOwner = '';
  setAttendanceAllowedValue('no');
  hideEventFormError();
  if (eventPosterInput) {
    eventPosterInput.value = '';
  }
  seedDefaultEventTimes();
};

const populateEventFormFields = (eventData) => {
  if (!eventData) return;
  if (eventClubNameInput) eventClubNameInput.value = eventData.clubName || '';
  if (eventTitleInput) eventTitleInput.value = eventData.title || '';
  if (eventDescriptionInput) eventDescriptionInput.value = eventData.description || '';
  if (eventRegistrationFeeInput) eventRegistrationFeeInput.value = eventData.registrationFee || '';
  if (eventStatusInput) eventStatusInput.value = eventData.status || 'Upcoming';
  const attendanceValue = eventData.attendanceAllowed ? 'yes' : 'no';
  setAttendanceAllowedValue(attendanceValue);
  if (eventData.attendanceAllowed && attendanceTimingInput) {
    attendanceTimingInput.value = eventData.attendanceTiming || '';
  }
  if (eventDurationInput) eventDurationInput.value = eventData.duration || '';
  if (eventStartTimeInput) eventStartTimeInput.value = toDatetimeLocalValue(eventData.startDate) || eventStartTimeInput.value;
  if (eventEndTimeInput) eventEndTimeInput.value = toDatetimeLocalValue(eventData.endDate) || eventEndTimeInput.value;
  if (eventRegistrationLinkInput) eventRegistrationLinkInput.value = eventData.registrationLink || '';
};

const openCreateEventForm = () => {
  if (!currentUser || (!isAdmin() && !isCoordinator())) {
    alert('Only admins or coordinators can add events.');
    return;
  }
  resetEventForm();
  if (eventFormHeading) {
    eventFormHeading.textContent = 'Create Event';
  }
  switchPage('event-form');
};

const openEditEventForm = (eventId) => {
  if (!currentUser) return;
  const eventData = storage.getEventById(eventId);
  if (!eventData) {
    alert('Event not found.');
    return;
  }
  if (!canEditEvent(eventData)) {
    alert('You do not have permission to edit this event.');
    return;
  }
  resetEventForm();
  editingEventId = eventId;
  editingEventImage = eventData.image || '';
  editingEventOwner = eventData.createdBy || currentUser.username;
  populateEventFormFields(eventData);
  if (eventFormHeading) {
    eventFormHeading.textContent = 'Edit Event';
  }
  switchPage('event-form');
};

const readFileAsDataURL = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });
};

const handleEventFormSubmit = async (event) => {
  event.preventDefault();
  if (!currentUser || (!isAdmin() && !isCoordinator())) {
    alert('You do not have permission to perform this action.');
    return;
  }
  hideEventFormError();
  const isEditing = Boolean(editingEventId);

  const title = eventTitleInput?.value.trim() || '';
  const clubName = eventClubNameInput?.value.trim() || '';
  const description = eventDescriptionInput?.value.trim() || '';

  if (!clubName) {
    showEventFormError('Club Name is required.');
    eventClubNameInput?.focus();
    return;
  }
  if (!title) {
    showEventFormError('Event Name is required.');
    eventTitleInput?.focus();
    return;
  }
  if (!description) {
    showEventFormError('Event Description is required.');
    eventDescriptionInput?.focus();
    return;
  }

  const attendanceAllowed = getAttendanceAllowedValue() === 'yes';
  const attendanceTiming = attendanceAllowed ? (attendanceTimingInput?.value.trim() || '') : '';
  if (attendanceAllowed && !attendanceTiming) {
    showEventFormError('Please provide attendance timing when attendance is allowed.');
    attendanceTimingInput?.focus();
    return;
  }

  const startTimestamp = parseDatetimeLocal(eventStartTimeInput?.value);
  const endTimestamp = parseDatetimeLocal(eventEndTimeInput?.value);

  if (startTimestamp && endTimestamp && endTimestamp < startTimestamp) {
    showEventFormError('End Time cannot be earlier than Start Time.');
    eventEndTimeInput?.focus();
    return;
  }

  const posterFile = eventPosterInput?.files?.[0];
  let imageData = editingEventImage;
  if (posterFile) {
    try {
      imageData = await readFileAsDataURL(posterFile);
    } catch (error) {
      console.error('Poster upload failed', error);
      showEventFormError('Unable to read the poster file. Please try a different image.');
      return;
    }
  }

  const payload = {
    title,
    clubName,
    description,
    registrationFee: eventRegistrationFeeInput?.value.trim() || '',
    status: eventStatusInput?.value || 'Upcoming',
    attendanceAllowed,
    attendanceTiming,
    duration: eventDurationInput?.value.trim() || '',
    startDate: startTimestamp ?? Date.now(),
    endDate: endTimestamp ?? (startTimestamp ?? Date.now()) + 3600000,
    registrationLink: eventRegistrationLinkInput?.value.trim() || '',
    attendanceInfo: attendanceAllowed
      ? `Attendance allowed${attendanceTiming ? ` (${attendanceTiming})` : ''}`
      : 'Attendance limited to members',
    createdBy: editingEventOwner || currentUser.username,
    image: imageData || '',
  };

  try {
    if (isEditing) {
      storage.updateEvent(editingEventId, payload);
    } else {
      storage.addEvent(payload);
    }
    resetEventForm();
    loadEvents();
    switchPage('events');
    alert(`Event ${isEditing ? 'updated' : 'created'} successfully.`);
  } catch (error) {
    console.error('Failed to save event', error);
    showEventFormError('Unable to save the event. Please try again.');
  }
};

const loadEvents = () => {
  if (!currentUser) return;
  let events = storage.getEvents();
  const eventsList = document.getElementById('events-list');
  const adminControls = document.getElementById('events-admin-controls');
  
  if (adminControls) {
    adminControls.style.display = isAdmin() || isCoordinator() ? 'block' : 'none';
  }
  
  if (!eventsList) return;
  
  // Apply search filter
  if (eventsSearchTerm) {
    const searchLower = eventsSearchTerm.toLowerCase();
    events = events.filter((event) => {
      const nameMatch = (event.title || '').toLowerCase().includes(searchLower);
      const clubMatch = (event.clubName || '').toLowerCase().includes(searchLower);
      const statusMatch = (event.status || '').toLowerCase().includes(searchLower);
      return nameMatch || clubMatch || statusMatch;
    });
  }
  
  if (events.length === 0) {
    eventsList.innerHTML = '<div class="col-12"><div class="alert alert-info">No events available yet.</div></div>';
    return;
  }
  
  eventsList.innerHTML = events.map((event) => {
    const statusBadges = {
      Upcoming: 'bg-primary',
      Started: 'bg-success',
      Ended: 'bg-danger',
    };
    const statusClass = statusBadges[event.status] || 'bg-secondary';
    const descriptionPreview = getEventDescriptionPreview(event.description);
    const clubNameLabel = event.clubName || 'Unknown Club';
    const feeBadge = event.registrationFee
      ? `<span class="badge text-bg-light text-dark ms-2">${event.registrationFee}</span>`
      : '';
    return `
      <div class="col-md-6 col-lg-4">
        <div class="card shadow-sm border-0 h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <span class="badge ${statusClass}">${event.status}</span>
              ${canEditEvent(event) ? `<button class="btn btn-sm btn-outline-danger" data-action="delete-event" data-event-id="${event.id}">Delete</button>` : ''}
            </div>
            <h5 class="card-title">${event.title}</h5>
            <p class="text-muted small mb-2">${clubNameLabel}${feeBadge}</p>
            <p class="card-text small">${descriptionPreview}</p>
            <button class="btn btn-primary btn-sm w-100" data-action="view-event" data-event-id="${event.id}">View Details</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  eventsList.querySelectorAll('[data-action="view-event"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const eventId = e.target.dataset.eventId;
      showEventDetail(eventId);
    });
  });
  
  eventsList.querySelectorAll('[data-action="delete-event"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (confirm('Are you sure you want to delete this event?')) {
        storage.deleteEvent(e.target.dataset.eventId);
        loadEvents();
      }
    });
  });
};

const showEventDetail = (eventId) => {
  const event = storage.getEventById(eventId);
  if (!event) {
    alert('Event not found');
    return;
  }
  
  const detailContent = document.getElementById('event-detail-content');
  if (!detailContent) return;
  
  const statusBadges = {
    Upcoming: 'bg-primary',
    Started: 'bg-success',
    Ended: 'bg-danger',
  };
  const statusClass = statusBadges[event.status] || 'bg-secondary';
  const attendanceLabel = event.attendanceAllowed ? 'Yes' : 'No';
  const attendanceTiming = event.attendanceAllowed && event.attendanceTiming ? ` (${event.attendanceTiming})` : '';
  
  const isRegistered = storage.isRegisteredForEvent(eventId, currentUser?.username);
  const registrations = storage.getEventRegistrations(eventId);
  const canViewRegistrations = isAdmin() || isCoordinator();
  
  detailContent.innerHTML = `
    <div class="card shadow-sm border-0">
      <div class="card-body">
        <div class="mb-4">
          <h1 class="display-6 fw-bold">${event.title}</h1>
          <p class="text-muted fs-5 mb-2">${event.clubName}</p>
          <span class="badge ${statusClass} fs-6">${event.status}</span>
        </div>
        
        <div class="row g-4 mb-4">
          <div class="col-md-5">
            ${event.image ? `<img src="${event.image}" class="img-fluid rounded shadow-sm" alt="Event poster">` : '<div class="bg-light rounded p-5 text-center text-muted">No poster available</div>'}
          </div>
          <div class="col-md-7">
            <div class="card bg-light border-0 h-100">
              <div class="card-body d-flex flex-column">
                <h5 class="card-title mb-3">Event Description</h5>
                <p class="card-text flex-grow-1">${event.description || 'No description available yet.'}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div class="row g-3 mb-4">
          <div class="col-md-6">
            <div class="card border-0 bg-light">
              <div class="card-body">
                <h6 class="card-title text-muted small mb-3">EVENT DETAILS</h6>
                <p class="mb-2"><strong>Registration Fee:</strong> ${event.registrationFee || 'Free'}</p>
                <p class="mb-2"><strong>Attendance Allowed:</strong> ${attendanceLabel}${attendanceTiming}</p>
                ${event.duration ? `<p class="mb-2"><strong>Duration:</strong> ${event.duration}</p>` : ''}
                <p class="mb-0"><strong>Created by:</strong> ${event.createdBy}</p>
              </div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="card border-0 bg-light">
              <div class="card-body">
                <h6 class="card-title text-muted small mb-3">SCHEDULE</h6>
                <p class="mb-2"><strong>Start:</strong> ${formatEventDate(event.startDate)}</p>
                <p class="mb-2"><strong>End:</strong> ${formatEventDate(event.endDate)}</p>
                ${event.registrationLink ? `<p class="mb-0"><strong>Registration Link:</strong><br><a href="${event.registrationLink}" target="_blank" rel="noopener" class="small">${event.registrationLink}</a></p>` : ''}
              </div>
            </div>
          </div>
        </div>
        
        ${event.registrationLink ? `
          <div class="mb-3">
            ${isRegistered 
              ? '<button class="btn btn-success" disabled>Registered ✔</button>'
              : `<button class="btn btn-primary" id="register-event-btn" data-event-id="${eventId}">Register</button>`
            }
          </div>
        ` : ''}
        
        ${canViewRegistrations && registrations.length > 0 ? `
          <div class="card border-0 bg-light mt-3">
            <div class="card-body">
              <h6 class="card-title">Registered Users (${registrations.length})</h6>
              <ul class="list-unstyled mb-0">
                ${registrations.map((username) => `<li>• ${username}</li>`).join('')}
              </ul>
            </div>
          </div>
        ` : ''}
        
        ${canEditEvent(event) ? `<button class="btn btn-primary mt-3" data-action="edit-event" data-event-id="${event.id}">Edit Event</button>` : ''}
      </div>
    </div>
  `;
  
  switchPage('event-detail');
  
  const editBtn = detailContent.querySelector('[data-action="edit-event"]');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      openEditEventForm(event.id);
    });
  }
  
  const registerBtn = detailContent.querySelector('#register-event-btn');
  if (registerBtn) {
    registerBtn.addEventListener('click', () => {
      if (event.registrationLink) {
        window.open(event.registrationLink, '_blank');
        storage.registerForEvent(eventId, currentUser.username);
        showEventDetail(eventId); // Refresh to show "Registered ✔"
      }
    });
  }
};

// Complaints page functions
const loadComplaints = () => {
  if (!currentUser) return;
  const complaints = isAdmin() ? storage.getComplaints() : storage.getComplaints(currentUser.username);
  const complaintsList = document.getElementById('complaints-list');
  
  if (!complaintsList) return;
  
  if (complaints.length === 0) {
    complaintsList.innerHTML = '<p class="text-muted">No complaints submitted yet.</p>';
    return;
  }
  
  const statusBadges = {
    Pending: 'bg-warning',
    'Under Review': 'bg-info',
    Resolved: 'bg-success',
  };
  
  complaintsList.innerHTML = complaints.map((complaint) => {
    const statusClass = statusBadges[complaint.status] || 'bg-secondary';
    const reactionCounts = storage.getComplaintReactionCounts(complaint.id);
    const userReaction = storage.getComplaintReaction(complaint.id, currentUser.username);
    
    return `
      <div class="card mb-3">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <span class="badge bg-primary">${complaint.category}</span>
            <span class="badge ${statusClass}">${complaint.status}</span>
          </div>
          <p class="card-text">${complaint.description}</p>
          <small class="text-muted">Submitted: ${new Date(complaint.createdAt).toLocaleString()}</small>
          ${complaint.owner !== currentUser.username ? `<small class="text-muted d-block">By: ${complaint.owner}</small>` : ''}
          
          <div class="mt-3 d-flex align-items-center gap-3">
            <button class="btn btn-sm btn-outline-primary ${userReaction === 'like' ? 'active' : ''}" 
                    data-action="like-complaint" data-complaint-id="${complaint.id}">
              👍 ${reactionCounts.likes}
            </button>
            <button class="btn btn-sm btn-outline-danger ${userReaction === 'dislike' ? 'active' : ''}" 
                    data-action="dislike-complaint" data-complaint-id="${complaint.id}">
              👎 ${reactionCounts.dislikes}
            </button>
          </div>
          
          ${isAdmin() ? `
            <div class="mt-3">
              <select class="form-select form-select-sm d-inline-block w-auto me-2" data-complaint-id="${complaint.id}">
                <option ${complaint.status === 'Pending' ? 'selected' : ''}>Pending</option>
                <option ${complaint.status === 'Under Review' ? 'selected' : ''}>Under Review</option>
                <option ${complaint.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
              </select>
              <button class="btn btn-sm btn-outline-danger" data-action="delete-complaint" data-complaint-id="${complaint.id}">Delete</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  // Handle like/dislike buttons
  complaintsList.querySelectorAll('[data-action="like-complaint"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const complaintId = e.target.dataset.complaintId;
      const currentReaction = storage.getComplaintReaction(complaintId, currentUser.username);
      const newReaction = currentReaction === 'like' ? null : 'like';
      storage.setComplaintReaction(complaintId, currentUser.username, newReaction);
      loadComplaints();
    });
  });
  
  complaintsList.querySelectorAll('[data-action="dislike-complaint"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const complaintId = e.target.dataset.complaintId;
      const currentReaction = storage.getComplaintReaction(complaintId, currentUser.username);
      const newReaction = currentReaction === 'dislike' ? null : 'dislike';
      storage.setComplaintReaction(complaintId, currentUser.username, newReaction);
      loadComplaints();
    });
  });
  
  if (isAdmin()) {
    complaintsList.querySelectorAll('select').forEach((select) => {
      select.addEventListener('change', (e) => {
        storage.updateComplaint(e.target.dataset.complaintId, { status: e.target.value });
        loadComplaints();
      });
    });
    
    complaintsList.querySelectorAll('[data-action="delete-complaint"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        if (confirm('Delete this complaint?')) {
          storage.deleteComplaint(e.target.dataset.complaintId);
          loadComplaints();
        }
      });
    });
  }
};

// Permissions page functions
let permissionsSearchTerm = '';

const loadPermissions = () => {
  if (!currentUser) return;
  let permissions = storage.getPermissions();
  const permissionsList = document.getElementById('permissions-list');
  const adminControls = document.getElementById('permissions-admin-controls');
  
  if (adminControls) {
    adminControls.style.display = isAdmin() ? 'block' : 'none';
  }
  
  if (!permissionsList) return;
  
  // Apply search filter
  if (permissionsSearchTerm) {
    const searchLower = permissionsSearchTerm.toLowerCase();
    permissions = permissions.filter((perm) => {
      return (perm.filename || '').toLowerCase().includes(searchLower);
    });
  }
  
  if (permissions.length === 0) {
    permissionsList.innerHTML = '<div class="col-12"><div class="alert alert-info">No permission letters available.</div></div>';
    return;
  }
  
  permissionsList.innerHTML = permissions.map((perm) => {
    const dataUrl = perm.fileData ? `data:application/pdf;base64,${perm.fileData}` : '';
    return `
      <div class="col-md-6 col-lg-4">
        <div class="card shadow-sm border-0 h-100">
          <div class="card-body">
            <h5 class="card-title">${perm.filename}</h5>
            <p class="text-muted small">Uploaded by: ${perm.uploadedBy}</p>
            <p class="text-muted small">Date: ${new Date(perm.createdAt).toLocaleString()}</p>
            <div class="mt-3">
              <a href="${dataUrl}" download="${perm.filename}" class="btn btn-primary btn-sm w-100 mb-2">Download</a>
              ${isAdmin() ? `
                <button class="btn btn-sm btn-outline-primary w-100 mb-2" data-action="rename-permission" data-permission-id="${perm.id}">Rename</button>
                <button class="btn btn-sm btn-outline-danger w-100" data-action="delete-permission" data-permission-id="${perm.id}">Delete</button>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  if (isAdmin()) {
    permissionsList.querySelectorAll('[data-action="rename-permission"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const perm = storage.getPermissions().find((p) => p.id === e.target.dataset.permissionId);
        if (perm) {
          const newName = prompt('New filename:', perm.filename);
          if (newName) {
            storage.updatePermission(perm.id, { filename: newName });
            loadPermissions();
          }
        }
      });
    });
    
    permissionsList.querySelectorAll('[data-action="delete-permission"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        if (confirm('Delete this permission letter?')) {
          storage.deletePermission(e.target.dataset.permissionId);
          loadPermissions();
        }
      });
    });
  }
};

// Feedback page functions
const loadFeedback = () => {
  if (!currentUser) return;
  const feedback = isAdmin() ? storage.getFeedback() : storage.getFeedback(currentUser.username);
  const feedbackList = document.getElementById('feedback-list');
  const feedbackTitle = document.getElementById('feedback-list-title');
  
  if (feedbackTitle) {
    feedbackTitle.textContent = isAdmin() ? 'All Feedback' : 'My Feedback';
  }
  
  if (!feedbackList) return;
  
  if (feedback.length === 0) {
    feedbackList.innerHTML = '<p class="text-muted">No feedback submitted yet.</p>';
    return;
  }
  
  feedbackList.innerHTML = feedback.map((item) => {
    const ratingStars = item.rating ? '⭐'.repeat(item.rating) : 'No rating';
    return `
      <div class="card mb-3">
        <div class="card-body">
          <p class="card-text">${item.message}</p>
          <div class="d-flex justify-content-between align-items-center">
            <small class="text-muted">${ratingStars}</small>
            <small class="text-muted">${new Date(item.createdAt).toLocaleString()}</small>
          </div>
          ${isAdmin() ? `<small class="text-muted d-block mt-1">From: ${item.owner}</small>` : ''}
        </div>
      </div>
    `;
  }).join('');
};

// Check if no users exist, show create account by default
const checkInitialState = () => {
  const users = storage.getUsers();
  if (users.length === 0 && createAccountSection) {
    createAccountSection.classList.remove('d-none');
    toggleRegisterBtn.textContent = 'Back to Login';
  }
};

// Event listeners for new pages
const addEventBtn = document.getElementById('add-event-btn');
const backToEventsBtn = document.getElementById('back-to-events-btn');
const complaintForm = document.getElementById('complaint-form');
const uploadPermissionBtn = document.getElementById('upload-permission-btn');
const permissionFileInput = document.getElementById('permission-file-input');
const feedbackForm = document.getElementById('feedback-form');

addEventBtn?.addEventListener('click', () => {
  openCreateEventForm();
});

backToEventsBtn?.addEventListener('click', () => {
  switchPage('events');
});

eventFormBackBtn?.addEventListener('click', () => {
  resetEventForm();
  switchPage('events');
});

eventForm?.addEventListener('submit', handleEventFormSubmit);

Array.from(attendanceAllowedInputs || []).forEach((input) => {
  input.addEventListener('change', updateAttendanceTimingVisibility);
});

eventPosterInput?.addEventListener('change', () => hideEventFormError());

eventsSearchInput?.addEventListener('input', (e) => {
  eventsSearchTerm = e.target.value;
  loadEvents();
});

updateAttendanceTimingVisibility();

complaintForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!currentUser) return;
  const category = document.getElementById('complaint-category').value;
  const description = document.getElementById('complaint-description').value;
  if (!description.trim()) {
    alert('Please enter a description');
    return;
  }
  storage.addComplaint(currentUser.username, category, description);
  document.getElementById('complaint-form').reset();
  loadComplaints();
});

uploadPermissionBtn?.addEventListener('click', () => {
  permissionFileInput?.click();
});

permissionFileInput?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.type !== 'application/pdf') {
    alert('Please select a PDF file');
    return;
  }
  const reader = new FileReader();
  reader.onload = (event) => {
    const base64 = event.target.result.split(',')[1];
    storage.addPermission(file.name, base64, currentUser.username);
    loadPermissions();
  };
  reader.readAsDataURL(file);
  e.target.value = '';
});

const permissionsSearchInput = document.getElementById('permissions-search-input');
permissionsSearchInput?.addEventListener('input', (e) => {
  permissionsSearchTerm = e.target.value;
  loadPermissions();
});

// Star rating system for feedback
let selectedRating = 0;

const initStarRating = () => {
  const starContainer = document.getElementById('feedback-star-rating');
  const ratingInput = document.getElementById('feedback-rating');
  if (!starContainer || !ratingInput) return;

  selectedRating = 0;
  ratingInput.value = '';

  const updateStars = (rating, isHover = false) => {
    const stars = starContainer.querySelectorAll('.star');
    stars.forEach((star) => {
      const starRating = parseInt(star.dataset.rating, 10);
      star.classList.remove('filled', 'active');
      if (starRating <= rating) {
        star.classList.add(isHover ? 'active' : 'filled');
        star.textContent = '★';
      } else {
        star.textContent = '☆';
      }
    });
  };

  // Remove existing listeners by cloning
  const newContainer = starContainer.cloneNode(true);
  starContainer.parentNode.replaceChild(newContainer, starContainer);

  const stars = newContainer.querySelectorAll('.star');
  stars.forEach((star) => {
    star.addEventListener('click', () => {
      selectedRating = parseInt(star.dataset.rating, 10);
      ratingInput.value = selectedRating;
      updateStars(selectedRating);
    });

    star.addEventListener('mouseenter', () => {
      const hoverRating = parseInt(star.dataset.rating, 10);
      updateStars(hoverRating, true);
    });
  });

  newContainer.addEventListener('mouseleave', () => {
    updateStars(selectedRating);
  });
};

feedbackForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!currentUser) return;
  const message = document.getElementById('feedback-message').value;
  const ratingInput = document.getElementById('feedback-rating');
  const rating = ratingInput?.value ? parseInt(ratingInput.value, 10) : null;
  if (!message.trim()) {
    alert('Please enter a message');
    return;
  }
  storage.addFeedback(currentUser.username, message, rating);
  document.getElementById('feedback-form').reset();
  // Reset star rating
  const starContainer = document.getElementById('feedback-star-rating');
  if (starContainer) {
    starContainer.querySelectorAll('.star').forEach((star) => {
      star.classList.remove('filled', 'active');
      star.textContent = '☆';
    });
  }
  if (ratingInput) ratingInput.value = '';
  loadFeedback();
});

// Initialize
updateFilterVisibility();
checkInitialState();
updateUIForAuth();

if (currentUser) {
  loadUserTasks();
}
