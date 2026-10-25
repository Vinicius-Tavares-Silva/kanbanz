// Kanbanz — kanban 100% front-end, persistido no localStorage.

const USERS_KEY = 'kanbanz_users';
const SESSION_KEY = 'kanbanz_session';
const dataKey = (userId) => `kanbanz_data_${userId}`;
const DEFAULT_PHASES = ['A fazer', 'Fazendo', 'Feito'];

const app = document.getElementById('app');

// ---------- storage ----------

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function currentUser() {
  const id = localStorage.getItem(SESSION_KEY);
  return id ? load(USERS_KEY, []).find((u) => u.id === id) || null : null;
}

function getBoards() {
  return load(dataKey(currentUser().id), { boards: [] }).boards;
}

function saveBoards(boards) {
  save(dataKey(currentUser().id), { boards });
}

// Loads the boards, lets fn mutate them, then persists.
function updateBoards(fn) {
  const boards = getBoards();
  fn(boards);
  saveBoards(boards);
}

// ---------- auth ----------

async function hashPassword(password, salt) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function register(email, password) {
  email = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail inválido');
  if (password.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres');
  const users = load(USERS_KEY, []);
  if (users.some((u) => u.email === email)) throw new Error('Este e-mail já está cadastrado');
  const salt = uid();
  const user = { id: uid(), email, salt, passwordHash: await hashPassword(password, salt) };
  users.push(user);
  save(USERS_KEY, users);
  localStorage.setItem(SESSION_KEY, user.id);
}

async function login(email, password) {
  email = email.trim().toLowerCase();
  const user = load(USERS_KEY, []).find((u) => u.email === email);
  if (!user || (await hashPassword(password, user.salt)) !== user.passwordHash) {
    throw new Error('E-mail ou senha incorretos');
  }
  localStorage.setItem(SESSION_KEY, user.id);
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  location.hash = '#/login';
}

// ---------- helpers ----------

function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Deadlines are stored as 'YYYY-MM-DD' strings, so they compare lexically.
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const formatDate = (iso) => iso.split('-').reverse().join('/');

const plural =(n, one, many) => `${n} ${n === 1 ? one : many}`;

function topbar() {
  return `
    <header class="topbar">
      <a class="brand" href="#/boards">Kanbanz</a>
      <span class="spacer"></span>
      <span class="user">${esc(currentUser().email)}</span>
      <button class="btn-ghost" data-action="logout">Sair</button>
    </header>`;
}

// ---------- dialog ----------

const dialog = document.getElementById('dialog');
const dialogForm = document.getElementById('dialog-form');
let dialogHandlers = {};

/**
 * Opens the shared modal. onSubmit receives the form and returns an error
 * message to keep the dialog open, or nothing to close it.
 */
function openDialog({ title, body, submitLabel = 'Salvar', onSubmit, onDelete }) {
  document.getElementById('dialog-title').textContent = title;
  document.getElementById('dialog-body').innerHTML = body + '<div class="error" id="dialog-error"></div>';
  document.getElementById('dialog-submit').textContent = submitLabel;
  document.getElementById('dialog-delete').hidden = !onDelete;
  dialogHandlers = { onSubmit, onDelete };
  dialog.showModal();
  dialogForm.querySelector('input, textarea')?.focus();
}

dialogForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const error = dialogHandlers.onSubmit?.(dialogForm);
  if (error) {
    document.getElementById('dialog-error').textContent = error;
    return;
  }
  dialog.close();
  render();
});

document.getElementById('dialog-cancel').addEventListener('click', () => dialog.close());

document.getElementById('dialog-delete').addEventListener('click', () => {
  if (dialogHandlers.onDelete?.() === false) return;
  dialog.close();
  render();
});

// ---------- views ----------

function renderAuth(mode) {
  const isLogin = mode === 'login';
  app.innerHTML = `
    <div class="auth">
      <form class="auth-card" id="auth-form" novalidate>
        <h1>Kanbanz</h1>
        <p class="sub">${isLogin ? 'Entre na sua conta' : 'Crie sua conta'}</p>
        <label for="email">E-mail</label>
        <input id="email" name="email" type="email" autocomplete="email" required />
        <label for="password">Senha</label>
        <input id="password" name="password" type="password"
          autocomplete="${isLogin ? 'current-password' : 'new-password'}" required />
        <div class="error" id="auth-error"></div>
        <button type="submit" class="btn-primary">${isLogin ? 'Entrar' : 'Criar conta'}</button>
        <div class="auth-switch">
          ${isLogin ? 'Não tem conta?' : 'Já tem conta?'}
          <button type="button" id="auth-toggle">${isLogin ? 'Criar conta' : 'Entrar'}</button>
        </div>
      </form>
    </div>`;

  document.getElementById('email').focus();
  document.getElementById('auth-toggle').onclick = () => {
    location.hash = isLogin ? '#/register' : '#/login';
  };
  document.getElementById('auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const { email, password } = e.target.elements;
    try {
      await (isLogin ? login : register)(email.value, password.value);
      location.hash = '#/boards';
    } catch (err) {
      document.getElementById('auth-error').textContent = err.message;
    }
  };
}

function renderBoards() {
  const boards = getBoards();
  const cards = boards.map((b) => {
    const taskCount = b.columns.reduce((n, c) => n + c.tasks.length, 0);
    return `
      <a class="board-card" href="#/board/${b.id}">
        <h3>${esc(b.name)}</h3>
        <span class="meta">${plural(b.columns.length, 'fase', 'fases')} · ${plural(taskCount, 'tarefa', 'tarefas')}</span>
      </a>`;
  }).join('');

  app.innerHTML = `
    ${topbar()}
    <main class="page">
      <div class="page-header">
        <h1>Meus quadros</h1>
      </div>
      <div class="boards-grid">
        ${cards}
        <button class="board-card new" data-action="new-board">+ Novo quadro</button>
      </div>
      ${boards.length ? '' : '<p class="empty">Você ainda não tem quadros. Crie o primeiro!</p>'}
    </main>`;
}

// Tags get a stable color derived from their name.
function tagHue(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

function renderTaskTags(board, task) {
  const tags = (task.tags || []).map((id) => (board.tags || []).find((t) => t.id === id)).filter(Boolean);
  if (!tags.length) return '';
  return `<div class="tags">${tags.map((t) => `<span class="tag" style="--tag-hue:${tagHue(t.name)}">${esc(t.name)}</span>`).join('')}</div>`;
}

function renderBoard(boardId) {
  const board = getBoards().find((b) => b.id === boardId);
  if (!board) {
    location.hash = '#/boards';
    return;
  }

  const columns = board.columns.map((col) => `
    <section class="column" data-column-id="${col.id}">
      <div class="column-header">
        <h2>${esc(col.name)}</h2>
        <span class="count">${col.tasks.length}</span>
        <button class="icon-btn" title="Editar fase" data-action="edit-column" data-column-id="${col.id}">⋯</button>
      </div>
      <div class="task-list">
        ${col.tasks.map((t) => `
          <div class="task" draggable="true" role="button" tabindex="0" data-task-id="${t.id}" data-action="edit-task">
            ${renderTaskTags(board, t)}
            <div class="title">${esc(t.title)}</div>
            ${t.description ? `<div class="desc">${esc(t.description)}</div>` : ''}
            ${t.deadline ? `<div class="deadline${t.deadline < today() ? ' overdue' : ''}">📅 ${formatDate(t.deadline)}</div>` : ''}
          </div>`).join('')}
      </div>
      <button class="btn-ghost add-task" data-action="new-task" data-column-id="${col.id}">+ Adicionar tarefa</button>
    </section>`).join('');

  app.innerHTML = `
    ${topbar()}
    <main class="board-view" data-board-id="${board.id}">
      <div class="board-header">
        <a class="btn-ghost" href="#/boards">← Quadros</a>
        <h1>${esc(board.name)}</h1>
        <button class="icon-btn" title="Editar quadro" data-action="edit-board">✎</button>
      </div>
      <div class="columns">
        ${columns}
        <button class="add-column" data-action="new-column">+ Adicionar fase</button>
      </div>
    </main>`;

  setupDragAndDrop(board.id);
}

// ---------- actions ----------

function phaseRow(value = '') {
  return `
    <div class="phase-row">
      <input name="phase" value="${esc(value)}" placeholder="Nome da fase" />
      <button type="button" class="icon-btn" data-action="remove-phase" title="Remover">✕</button>
    </div>`;
}

function newBoardDialog() {
  openDialog({
    title: 'Novo quadro',
    submitLabel: 'Criar quadro',
    body: `
      <label for="board-name">Nome do quadro</label>
      <input id="board-name" name="name" placeholder="Ex.: Projeto do site" />
      <label>Fases</label>
      <div id="phases">${DEFAULT_PHASES.map(phaseRow).join('')}</div>
      <button type="button" class="link-btn" data-action="add-phase">+ Adicionar fase</button>`,
    onSubmit(form) {
      const name = form.elements.name.value.trim();
      if (!name) return 'Informe o nome do quadro';
      const phases = [...form.querySelectorAll('input[name="phase"]')].map((i) => i.value.trim()).filter(Boolean);
      if (!phases.length) return 'Adicione pelo menos uma fase';
      const board = {
        id: uid(),
        name,
        createdAt: new Date().toISOString(),
        columns: phases.map((p) => ({ id: uid(), name: p, tasks: [] })),
      };
      updateBoards((boards) => boards.push(board));
      location.hash = `#/board/${board.id}`;
    },
  });
}

function editBoardDialog(boardId) {
  const board = getBoards().find((b) => b.id === boardId);
  openDialog({
    title: 'Editar quadro',
    body: `
      <label for="board-name">Nome do quadro</label>
      <input id="board-name" name="name" value="${esc(board.name)}" />`,
    onSubmit(form) {
      const name = form.elements.name.value.trim();
      if (!name) return 'Informe o nome do quadro';
      updateBoards((boards) => { boards.find((b) => b.id === boardId).name = name; });
    },
    onDelete() {
      if (!confirm(`Excluir o quadro "${board.name}" e todas as suas tarefas?`)) return false;
      updateBoards((boards) => boards.splice(boards.findIndex((b) => b.id === boardId), 1));
      location.hash = '#/boards';
    },
  });
}

function columnDialog(boardId, columnId) {
  const board = getBoards().find((b) => b.id === boardId);
  const column = columnId && board.columns.find((c) => c.id === columnId);
  openDialog({
    title: column ? 'Editar fase' : 'Nova fase',
    submitLabel: column ? 'Salvar' : 'Adicionar',
    body: `
      <label for="column-name">Nome da fase</label>
      <input id="column-name" name="name" value="${esc(column?.name || '')}" placeholder="Ex.: Em revisão" />`,
    onSubmit(form) {
      const name = form.elements.name.value.trim();
      if (!name) return 'Informe o nome da fase';
      updateBoards((boards) => {
        const b = boards.find((x) => x.id === boardId);
        if (column) b.columns.find((c) => c.id === columnId).name = name;
        else b.columns.push({ id: uid(), name, tasks: [] });
      });
    },
    onDelete: column && (() => {
      const msg = column.tasks.length
        ? `Excluir a fase "${column.name}" e suas ${plural(column.tasks.length, 'tarefa', 'tarefas')}?`
        : `Excluir a fase "${column.name}"?`;
      if (!confirm(msg)) return false;
      updateBoards((boards) => {
        const b = boards.find((x) => x.id === boardId);
        b.columns = b.columns.filter((c) => c.id !== columnId);
      });
    }),
  });
}

function taskDialog(boardId, columnId, taskId) {
  const board = getBoards().find((b) => b.id === boardId);
  const task = taskId && board.columns.flatMap((c) => c.tasks).find((t) => t.id === taskId);
  const tagOptions = (board.tags || []).length
    ? `<div class="tag-options">${board.tags.map((t) => `
        <label class="tag-option">
          <input type="checkbox" name="tag" value="${t.id}"${task?.tags?.includes(t.id) ? ' checked' : ''} />
          <span class="tag" style="--tag-hue:${tagHue(t.name)}">${esc(t.name)}</span>
        </label>`).join('')}</div>`
    : '';
  openDialog({
    title: task ? 'Editar tarefa' : 'Nova tarefa',
    submitLabel: task ? 'Salvar' : 'Adicionar',
    body: `
      <label for="task-title">Título</label>
      <input id="task-title" name="title" value="${esc(task?.title || '')}" placeholder="O que precisa ser feito?" />
      <label for="task-desc">Descrição</label>
      <textarea id="task-desc" name="description" placeholder="Detalhes (opcional)">${esc(task?.description || '')}</textarea>
      <label for="task-deadline">Deadline</label>
      <input id="task-deadline" name="deadline" type="date" value="${esc(task?.deadline || '')}" />
      <label>Tags</label>
      ${tagOptions}
      <input name="newTags" placeholder="Nova tag (separe várias com vírgula)" />`,
    onSubmit(form) {
      const title = form.elements.title.value.trim();
      const description = form.elements.description.value.trim();
      const deadline = form.elements.deadline.value;
      if (!title) return 'Informe o título da tarefa';
      const checked = [...form.querySelectorAll('input[name="tag"]:checked')].map((i) => i.value);
      const newNames = form.elements.newTags.value.split(',').map((n) => n.trim()).filter(Boolean);
      updateBoards((boards) => {
        const b = boards.find((x) => x.id === boardId);
        b.tags ||= [];
        const tags = [...checked];
        for (const name of newNames) {
          let tag = b.tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
          if (!tag) {
            tag = { id: uid(), name };
            b.tags.push(tag);
          }
          if (!tags.includes(tag.id)) tags.push(tag.id);
        }
        if (task) {
          Object.assign(b.columns.flatMap((c) => c.tasks).find((t) => t.id === taskId), { title, description, deadline, tags });
        } else {
          b.columns.find((c) => c.id === columnId).tasks.push({ id: uid(), title, description, deadline, tags });
        }
      });
    },
    onDelete: task && (() => {
      if (!confirm(`Excluir a tarefa "${task.title}"?`)) return false;
      updateBoards((boards) => {
        for (const c of boards.find((x) => x.id === boardId).columns) {
          c.tasks = c.tasks.filter((t) => t.id !== taskId);
        }
      });
    }),
  });
}

function moveTask(boardId, taskId, toColumnId, index) {
  updateBoards((boards) => {
    const board = boards.find((b) => b.id === boardId);
    let task;
    for (const c of board.columns) {
      const i = c.tasks.findIndex((t) => t.id === taskId);
      if (i !== -1) [task] = c.tasks.splice(i, 1);
    }
    board.columns.find((c) => c.id === toColumnId).tasks.splice(index, 0, task);
  });
}

// One delegated click handler for every data-action button.
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const boardId = document.querySelector('.board-view')?.dataset.boardId;
  const columnId = el.dataset.columnId;

  switch (el.dataset.action) {
    case 'logout': return logout();
    case 'new-board': return newBoardDialog();
    case 'edit-board': return editBoardDialog(boardId);
    case 'new-column': return columnDialog(boardId);
    case 'edit-column': return columnDialog(boardId, columnId);
    case 'new-task': return taskDialog(boardId, columnId);
    case 'edit-task': return taskDialog(boardId, null, el.dataset.taskId);
    case 'add-phase': {
      document.getElementById('phases').insertAdjacentHTML('beforeend', phaseRow());
      return document.querySelector('#phases .phase-row:last-child input').focus();
    }
    case 'remove-phase': return el.closest('.phase-row').remove();
  }
});

// Lets keyboard users open a task card with Enter.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches?.('.task')) e.target.click();
});

// ---------- drag and drop ----------

function setupDragAndDrop(boardId) {
  const placeholder = document.createElement('div');
  placeholder.className = 'placeholder';
  let dragged = null;

  document.querySelectorAll('.task').forEach((task) => {
    task.addEventListener('dragstart', (e) => {
      dragged = task;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', task.dataset.taskId);
      placeholder.style.height = `${task.offsetHeight}px`;
      requestAnimationFrame(() => task.classList.add('dragging'));
    });
    task.addEventListener('dragend', () => {
      task.classList.remove('dragging');
      placeholder.remove();
      document.querySelectorAll('.drag-over').forEach((c) => c.classList.remove('drag-over'));
      dragged = null;
    });
  });

  document.querySelectorAll('.column').forEach((column) => {
    const list = column.querySelector('.task-list');

    column.addEventListener('dragover', (e) => {
      if (!dragged) return;
      e.preventDefault();
      document.querySelectorAll('.drag-over').forEach((c) => c !== column && c.classList.remove('drag-over'));
      column.classList.add('drag-over');

      // Insert the placeholder before the first task whose midpoint is below the cursor.
      const siblings = [...list.querySelectorAll('.task:not(.dragging)')];
      const next = siblings.find((t) => {
        const r = t.getBoundingClientRect();
        return e.clientY < r.top + r.height / 2;
      });
      if (next) list.insertBefore(placeholder, next);
      else list.appendChild(placeholder);
    });

    column.addEventListener('drop', (e) => {
      if (!dragged) return;
      e.preventDefault();
      const index = [...list.children]
        .filter((el) => el !== dragged)
        .indexOf(placeholder);
      moveTask(boardId, dragged.dataset.taskId, column.dataset.columnId, Math.max(0, index));
      render();
    });
  });
}

// ---------- router ----------

function render() {
  const [, route, param] = location.hash.split('/');
  const user = currentUser();

  if (!user) {
    return renderAuth(route === 'register' ? 'register' : 'login');
  }
  if (route === 'board' && param) return renderBoard(param);
  if (route !== 'boards') {
    location.hash = '#/boards';
    return;
  }
  renderBoards();
}

window.addEventListener('hashchange', render);
render();
