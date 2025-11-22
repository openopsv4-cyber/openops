const STORAGE_KEY = 'ieeeHackathonData';
const USERS_KEY = 'ieeeHackathonUsers';
const SESSION_KEY = 'ieeeHackathonSession';
const COMPLAINTS_KEY = 'ieeeHackathonComplaints';
const PERMISSIONS_KEY = 'ieeeHackathonPermissions';
const FEEDBACK_KEY = 'ieeeHackathonFeedback';
const EVENTS_KEY = 'ieeeHackathonEvents';
const REGISTRATIONS_KEY = 'ieeeHackathonRegistrations';
const COMPLAINT_REACTIONS_KEY = 'ieeeHackathonComplaintReactions';
const DEFAULT_STATUS = 'Pending';
const STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed'];
const VISIBILITY_OPTIONS = ['public', 'admin'];
const DEFAULT_VISIBILITY = 'public';
const APP_VERSION = '1.0';
const REQUIRED_BACKUP_KEYS = ['users', 'tasks', 'appVersion', 'exportedAt'];

// Complaint statuses
const COMPLAINT_STATUSES = ['Pending', 'Under Review', 'Resolved'];
const COMPLAINT_CATEGORIES = ['Academic', 'Infrastructure', 'Administrative', 'Other'];

// Event statuses
const EVENT_STATUSES = ['Upcoming', 'Started', 'Ended'];

// Generate unique ID for tasks
const generateTaskId = () => {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const createTask = ({
  id,
  text,
  status = DEFAULT_STATUS,
  visibility = DEFAULT_VISIBILITY,
  createdAt = Date.now(),
  owner = 'unknown',
}) => ({
  id: id && String(id).trim().length ? String(id).trim() : generateTaskId(),
  text: String(text ?? '').trim(),
  createdAt: Number.isFinite(Number(createdAt)) ? Number(createdAt) : Date.now(),
  status: STATUS_OPTIONS.includes(status) ? status : DEFAULT_STATUS,
  visibility: VISIBILITY_OPTIONS.includes(visibility) ? visibility : DEFAULT_VISIBILITY,
  owner: String(owner || 'unknown'),
});

const ensureTaskShape = (task, fallbackOwner = 'unknown') => {
  if (!task || typeof task !== 'object') {
    return createTask({ text: task, owner: fallbackOwner });
  }

  return createTask({
    id: task.id,
    text: task.text,
    status: task.status,
    visibility: task.visibility,
    createdAt: task.createdAt,
    owner: task.owner || fallbackOwner,
  });
};

const normalizeData = (items, defaultOwner = 'unknown') => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ensureTaskShape(item, defaultOwner))
    .filter(Boolean);
};

const getTaskStorageKeys = () => {
  const keys = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key === STORAGE_KEY || key.startsWith(`${STORAGE_KEY}_`)) {
      keys.push(key);
    }
  }
  return keys;
};

const clearAllTaskData = () => {
  const keys = getTaskStorageKeys();
  keys.forEach((key) => localStorage.removeItem(key));
};

const getOwnerFromKey = (key) => {
  if (!key || !key.startsWith(`${STORAGE_KEY}_`)) {
    return null;
  }
  return key.slice(`${STORAGE_KEY}_`.length);
};

const normalizeTasks = () => {
  try {
    const sessionUser = getSession();
    const fallbackOwner = sessionUser?.username || 'unknown';
    const users = getUsers();

    const targetKeys = new Set();
    targetKeys.add(STORAGE_KEY);
    users.forEach((user) => {
      targetKeys.add(`${STORAGE_KEY}_${user.username}`);
    });

    targetKeys.forEach((key) => {
      const stored = localStorage.getItem(key);
      if (!stored) return;

      let parsed;
      try {
        parsed = JSON.parse(stored);
      } catch {
        parsed = [];
      }

      if (!Array.isArray(parsed)) {
        localStorage.setItem(key, JSON.stringify([]));
        return;
      }

      const normalized = parsed.map((task) => {
        const ownerHint = task?.owner || getOwnerFromKey(key) || fallbackOwner;
        return ensureTaskShape(task, ownerHint || fallbackOwner);
      });

      localStorage.setItem(key, JSON.stringify(normalized));
    });
  } catch (error) {
    console.error('Error normalizing tasks:', error);
  }
};

const getData = (username) => {
  try {
    const key = username ? `${STORAGE_KEY}_${username}` : STORAGE_KEY;
    const stored = localStorage.getItem(key);
    const parsed = stored ? JSON.parse(stored) : [];
    return normalizeData(parsed, username || 'unknown');
  } catch (error) {
    console.error('Unable to read from localStorage', error);
    return [];
  }
};

const saveData = (data, username) => {
  try {
    const key = username ? `${STORAGE_KEY}_${username}` : STORAGE_KEY;
    localStorage.setItem(key, JSON.stringify(normalizeData(data, username || 'unknown')));
  } catch (error) {
    console.error('Unable to save to localStorage', error);
  }
};

const getUsers = () => {
  try {
    const stored = localStorage.getItem(USERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Unable to read users from localStorage', error);
    return [];
  }
};

const saveUsers = (users) => {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch (error) {
    console.error('Unable to save users to localStorage', error);
  }
};

const getSession = () => {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Unable to read session from localStorage', error);
    return null;
  }
};

const saveSession = (user) => {
  try {
    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch (error) {
    console.error('Unable to save session to localStorage', error);
  }
};

const collectAllTasks = () => {
  const users = getUsers();
  const allTasks = [];
  users.forEach((user) => {
    const userTasks = getData(user.username);
    userTasks.forEach((task) => {
      const normalizedTask = {
        ...task,
        owner: task.owner || user.username,
        visibility: task.visibility || 'public',
        id: task.id || generateTaskId(),
      };
      allTasks.push(normalizedTask);
    });
  });
  return allTasks;
};

const ensureUniqueTaskId = (task, existingIds) => {
  let candidate = task.id;
  while (!candidate || existingIds.has(candidate)) {
    candidate = generateTaskId();
  }
  existingIds.add(candidate);
  return { ...task, id: candidate };
};

const bucketTasksByOwner = (tasks, defaultOwner = 'unknown') => {
  return tasks.reduce((acc, task) => {
    const normalized = ensureTaskShape(task, task.owner || defaultOwner);
    const ownerKey = normalized.owner || defaultOwner;
    if (!acc[ownerKey]) {
      acc[ownerKey] = [];
    }
    acc[ownerKey].push(normalized);
    return acc;
  }, {});
};

const validateBackupPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid backup format.');
  }

  const hasAllKeys = REQUIRED_BACKUP_KEYS.every((key) =>
    Object.prototype.hasOwnProperty.call(payload, key),
  );

  if (!hasAllKeys) {
    throw new Error('Backup file is missing required keys.');
  }

  const { users, tasks } = payload;
  if (!Array.isArray(users) || !Array.isArray(tasks)) {
    throw new Error('Backup file has invalid users or tasks format.');
  }

  return { users, tasks };
};

const replaceAllData = (users, tasks) => {
  saveUsers(users);
  clearAllTaskData();
  const buckets = bucketTasksByOwner(tasks, 'unknown');
  Object.entries(buckets).forEach(([owner, ownerTasks]) => {
    saveData(ownerTasks, owner);
  });
};

const mergeUsers = (importedUsers) => {
  const existingUsers = getUsers();
  const usernameSet = new Set(existingUsers.map((u) => u.username.toLowerCase()));
  const mergedUsers = [...existingUsers];

  importedUsers.forEach((user) => {
    if (!user || typeof user.username !== 'string') return;
    const username = user.username.trim();
    if (!username) return;
    const key = username.toLowerCase();
    if (usernameSet.has(key)) return;
    mergedUsers.push({ ...user, username });
    usernameSet.add(key);
  });

  saveUsers(mergedUsers);
};

const mergeTasks = (importedTasks) => {
  const existingIds = new Set(collectAllTasks().map((task) => task.id));
  const ownerBuckets = new Map();

  importedTasks.forEach((task) => {
    const normalized = ensureTaskShape(task, task.owner || 'unknown');
    const uniqueTask = ensureUniqueTaskId(normalized, existingIds);
    const ownerKey = uniqueTask.owner || 'unknown';
    if (!ownerBuckets.has(ownerKey)) {
      ownerBuckets.set(ownerKey, getData(ownerKey));
    }
    ownerBuckets.get(ownerKey).push(uniqueTask);
  });

  ownerBuckets.forEach((bucket, owner) => {
    saveData(bucket, owner);
  });
};

const mergeData = (users, tasks) => {
  mergeUsers(users);
  mergeTasks(tasks);
};

// Generate unique ID for any entity
const generateId = () => {
  return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Complaints management
const getComplaints = () => {
  try {
    const stored = localStorage.getItem(COMPLAINTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Unable to read complaints from localStorage', error);
    return [];
  }
};

const saveComplaints = (complaints) => {
  try {
    localStorage.setItem(COMPLAINTS_KEY, JSON.stringify(complaints));
  } catch (error) {
    console.error('Unable to save complaints to localStorage', error);
  }
};

const createComplaint = ({ id, owner, category, description, createdAt, status }) => ({
  id: id || generateId(),
  owner: String(owner || 'unknown'),
  category: COMPLAINT_CATEGORIES.includes(category) ? category : COMPLAINT_CATEGORIES[0],
  description: String(description || '').trim(),
  createdAt: Number.isFinite(Number(createdAt)) ? Number(createdAt) : Date.now(),
  status: COMPLAINT_STATUSES.includes(status) ? status : COMPLAINT_STATUSES[0],
});

// Permissions (PDFs) management
const getPermissions = () => {
  try {
    const stored = localStorage.getItem(PERMISSIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Unable to read permissions from localStorage', error);
    return [];
  }
};

const savePermissions = (permissions) => {
  try {
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions));
  } catch (error) {
    console.error('Unable to save permissions to localStorage', error);
  }
};

const createPermission = ({ id, filename, fileData, uploadedBy, createdAt }) => ({
  id: id || generateId(),
  filename: String(filename || '').trim() || 'untitled.pdf',
  fileData: String(fileData || ''),
  uploadedBy: String(uploadedBy || 'unknown'),
  createdAt: Number.isFinite(Number(createdAt)) ? Number(createdAt) : Date.now(),
});

// Feedback management
const getFeedback = () => {
  try {
    const stored = localStorage.getItem(FEEDBACK_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Unable to read feedback from localStorage', error);
    return [];
  }
};

const saveFeedback = (feedback) => {
  try {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedback));
  } catch (error) {
    console.error('Unable to save feedback to localStorage', error);
  }
};

const createFeedback = ({ id, owner, message, rating, createdAt }) => ({
  id: id || generateId(),
  owner: String(owner || 'unknown'),
  message: String(message || '').trim(),
  rating: Number.isFinite(Number(rating)) && rating >= 1 && rating <= 5 ? Number(rating) : null,
  createdAt: Number.isFinite(Number(createdAt)) ? Number(createdAt) : Date.now(),
});

// Events management
const getEvents = () => {
  try {
    const stored = localStorage.getItem(EVENTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Unable to read events from localStorage', error);
    return [];
  }
};

const saveEvents = (events) => {
  try {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  } catch (error) {
    console.error('Unable to save events to localStorage', error);
  }
};

const createEvent = ({
  id,
  title,
  clubName,
  description,
  registrationLink,
  attendanceInfo,
  startDate,
  endDate,
  status,
  createdBy,
  image,
  registrationFee,
  attendanceAllowed,
  attendanceTiming,
  duration,
}) => {
  const now = Date.now();
  const start = Number.isFinite(Number(startDate)) ? Number(startDate) : now;
  const end = Number.isFinite(Number(endDate)) ? Number(endDate) : now + 86400000;
  let eventStatus = status;
  if (!EVENT_STATUSES.includes(eventStatus)) {
    if (end < now) eventStatus = 'Ended';
    else if (start <= now && end >= now) eventStatus = 'Started';
    else eventStatus = 'Upcoming';
  }
  const safeDescription = String(description || '').trim() || 'Description coming soon.';
  const normalizedRegistrationFee = String(registrationFee || '').trim();
  const normalizedDuration = String(duration || '').trim();
  const allowed = Boolean(attendanceAllowed);
  const normalizedTiming = allowed ? String(attendanceTiming || '').trim() : '';
  let normalizedAttendanceInfo = String(attendanceInfo || '').trim();
  if (!normalizedAttendanceInfo) {
    normalizedAttendanceInfo = allowed
      ? `Attendance allowed${normalizedTiming ? ` (${normalizedTiming})` : ''}`
      : 'Attendance limited to members';
  }

  return {
    id: id || generateId(),
    title: String(title || '').trim() || 'Untitled Event',
    clubName: String(clubName || '').trim() || 'Unknown Club',
    description: safeDescription,
    registrationLink: String(registrationLink || '').trim(),
    attendanceInfo: normalizedAttendanceInfo,
    startDate: start,
    endDate: end,
    status: eventStatus,
    createdBy: String(createdBy || 'unknown'),
    image: String(image || ''),
    registrationFee: normalizedRegistrationFee,
    attendanceAllowed: allowed,
    attendanceTiming: normalizedTiming,
    duration: normalizedDuration,
  };
};

const storageAPI = {
  get: (username) => getData(username),
  save: (data, username) => {
    if (!Array.isArray(data)) {
      throw new Error('Data must be an array');
    }
    const normalized = normalizeData(data);
    saveData(normalized, username);
    return normalized;
  },
  add: (text, username, visibility = DEFAULT_VISIBILITY) => {
    const data = getData(username);
    const newTask = createTask({ text, visibility, owner: username || 'unknown' });
    data.push(newTask);
    saveData(data, username);
    return data;
  },
  remove: (index, username) => {
    const data = getData(username);
    if (index >= 0 && index < data.length) {
      data.splice(index, 1);
      saveData(data, username);
    }
    return data;
  },
  update: (index, newValue, username) => {
    const data = getData(username);
    if (index < 0 || index >= data.length) {
      return data;
    }
    const current = data[index];
    let next = current;

    if (typeof newValue === 'string') {
      // Update text only, preserve visibility
      next = createTask({ 
        ...current, 
        text: newValue, 
        createdAt: current.createdAt,
        visibility: current.visibility || 'public', // Ensure visibility is preserved
      });
    } else if (newValue && typeof newValue === 'object') {
      // Update with object, ensure visibility is set
      next = createTask({ 
        ...current, 
        ...newValue, 
        createdAt: current.createdAt,
        visibility: newValue.visibility || current.visibility || 'public', // Ensure visibility is set
      });
    }

    data[index] = next;
    saveData(data, username);
    return data;
  },
  // User management
  getUsers: () => getUsers(),
  saveUsers: (users) => {
    saveUsers(users);
    return users;
  },
  createUser: (username, password, role = 'user', metadata = {}) => {
    const users = getUsers();
    if (users.find((u) => u.username.toLowerCase() === username.toLowerCase())) {
      throw new Error('Email already exists');
    }
    const usn = (metadata.usn || '').toUpperCase();
    if (usn && users.find((u) => u.usn && u.usn.toUpperCase() === usn)) {
      throw new Error('USN already exists');
    }
    const newUser = { 
      username: username.trim(), 
      password, 
      role: role.toLowerCase(),
      name: metadata.name || '',
      usn: usn,
      email: metadata.email || username.trim()
    };
    users.push(newUser);
    saveUsers(users);
    return newUser;
  },
  authenticateUser: (usn, password) => {
    const users = getUsers();
    const usnUpper = usn.toUpperCase();
    const user = users.find(
      (u) => u.usn && u.usn.toUpperCase() === usnUpper && u.password === password,
    );
    return user ? { username: user.username, role: user.role, name: user.name, usn: user.usn, email: user.email } : null;
  },
  // Session management
  getSession: () => getSession(),
  setSession: (user) => {
    saveSession(user);
    return user;
  },
  clearSession: () => {
    saveSession(null);
  },
  // Admin: Get all tasks from all users
  getAllTasks: () => collectAllTasks(),
  // Normalize all tasks - call this at startup
  normalizeTasks: () => {
    normalizeTasks();
  },
  exportData: () => ({
    users: getUsers(),
    tasks: collectAllTasks(),
    appVersion: APP_VERSION,
    exportedAt: Date.now(),
  }),
  importData: (payload, options = {}) => {
    const { users, tasks } = validateBackupPayload(payload);
    const mode = options.mode === 'merge' ? 'merge' : 'replace';

    if (mode === 'merge') {
      mergeData(users, tasks);
    } else {
      replaceAllData(users, tasks);
    }

    normalizeTasks();
    saveSession(null);
    return true;
  },
  // Complaints API
  getComplaints: (username = null) => {
    const all = getComplaints();
    if (!username) return all;
    return all.filter((c) => c.owner === username);
  },
  addComplaint: (owner, category, description) => {
    const complaints = getComplaints();
    const newComplaint = createComplaint({ owner, category, description });
    complaints.push(newComplaint);
    saveComplaints(complaints);
    return newComplaint;
  },
  updateComplaint: (id, updates) => {
    const complaints = getComplaints();
    const index = complaints.findIndex((c) => c.id === id);
    if (index === -1) return null;
    complaints[index] = createComplaint({ ...complaints[index], ...updates });
    saveComplaints(complaints);
    return complaints[index];
  },
  deleteComplaint: (id) => {
    const complaints = getComplaints();
    const filtered = complaints.filter((c) => c.id !== id);
    saveComplaints(filtered);
    return filtered;
  },
  // Permissions API
  getPermissions: () => getPermissions(),
  addPermission: (filename, fileData, uploadedBy) => {
    const permissions = getPermissions();
    const newPermission = createPermission({ filename, fileData, uploadedBy });
    permissions.push(newPermission);
    savePermissions(permissions);
    return newPermission;
  },
  updatePermission: (id, updates) => {
    const permissions = getPermissions();
    const index = permissions.findIndex((p) => p.id === id);
    if (index === -1) return null;
    permissions[index] = createPermission({ ...permissions[index], ...updates });
    savePermissions(permissions);
    return permissions[index];
  },
  deletePermission: (id) => {
    const permissions = getPermissions();
    const filtered = permissions.filter((p) => p.id !== id);
    savePermissions(filtered);
    return filtered;
  },
  // Feedback API
  getFeedback: (username = null) => {
    const all = getFeedback();
    if (!username) return all;
    return all.filter((f) => f.owner === username);
  },
  addFeedback: (owner, message, rating = null) => {
    const feedback = getFeedback();
    const newFeedback = createFeedback({ owner, message, rating });
    feedback.push(newFeedback);
    saveFeedback(feedback);
    return newFeedback;
  },
  // Events API
  getEvents: () => getEvents(),
  addEvent: (eventData) => {
    const events = getEvents();
    const newEvent = createEvent(eventData);
    events.push(newEvent);
    saveEvents(events);
    return newEvent;
  },
  updateEvent: (id, updates) => {
    const events = getEvents();
    const index = events.findIndex((e) => e.id === id);
    if (index === -1) return null;
    events[index] = createEvent({ ...events[index], ...updates });
    saveEvents(events);
    return events[index];
  },
  deleteEvent: (id) => {
    const events = getEvents();
    const filtered = events.filter((e) => e.id !== id);
    saveEvents(filtered);
    return filtered;
  },
  getEventById: (id) => {
    const events = getEvents();
    return events.find((e) => e.id === id) || null;
  },
  // Event Registrations API
  getRegistrations: () => {
    try {
      const stored = localStorage.getItem(REGISTRATIONS_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Unable to read registrations from localStorage', error);
      return {};
    }
  },
  saveRegistrations: (registrations) => {
    try {
      localStorage.setItem(REGISTRATIONS_KEY, JSON.stringify(registrations));
    } catch (error) {
      console.error('Unable to save registrations to localStorage', error);
    }
  },
  registerForEvent: (eventId, username) => {
    const registrations = storageAPI.getRegistrations();
    if (!registrations[eventId]) {
      registrations[eventId] = [];
    }
    if (!registrations[eventId].includes(username)) {
      registrations[eventId].push(username);
      storageAPI.saveRegistrations(registrations);
    }
    return registrations[eventId];
  },
  isRegisteredForEvent: (eventId, username) => {
    const registrations = storageAPI.getRegistrations();
    return registrations[eventId]?.includes(username) || false;
  },
  getEventRegistrations: (eventId) => {
    const registrations = storageAPI.getRegistrations();
    return registrations[eventId] || [];
  },
  // Complaint Reactions API
  getComplaintReactions: () => {
    try {
      const stored = localStorage.getItem(COMPLAINT_REACTIONS_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Unable to read complaint reactions from localStorage', error);
      return {};
    }
  },
  saveComplaintReactions: (reactions) => {
    try {
      localStorage.setItem(COMPLAINT_REACTIONS_KEY, JSON.stringify(reactions));
    } catch (error) {
      console.error('Unable to save complaint reactions to localStorage', error);
    }
  },
  setComplaintReaction: (complaintId, username, reaction) => {
    const reactions = storageAPI.getComplaintReactions();
    if (!reactions[complaintId]) {
      reactions[complaintId] = {};
    }
    reactions[complaintId][username] = reaction; // 'like', 'dislike', or null
    storageAPI.saveComplaintReactions(reactions);
    return reactions[complaintId];
  },
  getComplaintReaction: (complaintId, username) => {
    const reactions = storageAPI.getComplaintReactions();
    return reactions[complaintId]?.[username] || null;
  },
  getComplaintReactionCounts: (complaintId) => {
    const reactions = storageAPI.getComplaintReactions();
    const complaintReactions = reactions[complaintId] || {};
    let likes = 0;
    let dislikes = 0;
    Object.values(complaintReactions).forEach((reaction) => {
      if (reaction === 'like') likes++;
      if (reaction === 'dislike') dislikes++;
    });
    return { likes, dislikes };
  },
};

if (typeof window !== 'undefined') {
  window.storage = storageAPI;
}

export default storageAPI;


