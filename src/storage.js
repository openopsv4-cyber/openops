const STORAGE_KEY = 'ieeeHackathonData';

const getData = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Unable to read from localStorage', error);
    return [];
  }
};

const saveData = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Unable to save to localStorage', error);
  }
};

export const get = () => getData();

export const save = (data) => {
  if (!Array.isArray(data)) {
    throw new Error('Data must be an array');
  }
  saveData(data);
  return data;
};

export const add = (item) => {
  const data = getData();
  data.push(item);
  saveData(data);
  return data;
};

export const remove = (index) => {
  const data = getData();
  if (index >= 0 && index < data.length) {
    data.splice(index, 1);
    saveData(data);
  }
  return data;
};

export const update = (index, newValue) => {
  const data = getData();
  if (index >= 0 && index < data.length) {
    data[index] = newValue;
    saveData(data);
  }
  return data;
};

