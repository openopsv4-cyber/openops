import { get, add, remove, update } from './storage.js';

const listElement = document.getElementById('output-list');
const input = document.getElementById('input-field');
const saveBtn = document.getElementById('save-btn');

let items = get();

const clearInput = () => {
  input.value = '';
  input.focus();
};

const renderItems = () => {
  listElement.innerHTML = '';

  if (!items.length) {
    listElement.innerHTML = `
      <li class="list-group-item text-muted text-center">
        No entries yet. Start by adding something above.
      </li>
    `;
    return;
  }

  items.forEach((item, index) => {
    const listItem = document.createElement('li');
    listItem.className = 'list-group-item d-flex justify-content-between align-items-center gap-2';
    listItem.innerHTML = `
      <span class="text-wrap">${item}</span>
      <div class="btn-group btn-group-sm" role="group">
        <button class="btn btn-outline-primary" data-action="edit" data-index="${index}">Edit</button>
        <button class="btn btn-outline-danger" data-action="delete" data-index="${index}">Delete</button>
      </div>
    `;
    listElement.appendChild(listItem);
  });
};

const handleSave = () => {
  const value = input.value.trim();
  if (!value) {
    alert('Please enter some text before saving.');
    return;
  }
  items = add(value);
  clearInput();
  renderItems();
};

saveBtn.addEventListener('click', handleSave);

input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    handleSave();
  }
});

listElement.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.action;
  if (!action) return;

  const index = Number(target.dataset.index);

  if (Number.isNaN(index)) return;

  if (action === 'delete') {
    items = remove(index);
    renderItems();
    return;
  }

  if (action === 'edit') {
    const currentValue = items[index] ?? '';
    const newValue = prompt('Update item:', currentValue);
    if (newValue === null) {
      return;
    }
    const trimmed = newValue.trim();
    if (!trimmed) {
      alert('Cannot save an empty value.');
      return;
    }
    items = update(index, trimmed);
    renderItems();
  }
});

renderItems();
