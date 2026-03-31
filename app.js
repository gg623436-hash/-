// app.js - полная логика приложения с уведомлениями
let currentFilter = 'all';
let editingTaskId = null;

// ============ КЛАСС ДЛЯ РАБОТЫ С ДАННЫМИ ============
class TaskManager {
    constructor() {
        this.dbName = 'TaskFlow';
        this.dbVersion = 1;
        this.db = null;
        this.storeName = 'tasks';
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ База данных готова');
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    store.createIndex('date_time', 'date_time');
                    store.createIndex('completed', 'completed');
                    store.createIndex('created_at', 'created_at');
                    console.log('✅ Хранилище создано');
                }
            };
        });
    }

    async getAllTasks() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();
            
            request.onsuccess = () => {
                const tasks = request.result;
                tasks.sort((a, b) => new Date(a.date_time) - new Date(b.date_time));
                resolve(tasks);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async addTask(title, dateTime) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            const task = {
                title: title,
                date_time: dateTime,
                completed: 0,
                created_at: new Date().toISOString()
            };
            
            const request = store.add(task);
            request.onsuccess = () => resolve({ success: true, id: request.result });
            request.onerror = () => reject(request.error);
        });
    }

    async toggleTask(id, completed) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            const request = store.get(id);
            request.onsuccess = () => {
                const task = request.result;
                if (task) {
                    task.completed = completed;
                    const updateRequest = store.put(task);
                    updateRequest.onsuccess = () => resolve({ success: true });
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    reject(new Error('Task not found'));
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async deleteTask(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);
            
            request.onsuccess = () => resolve({ success: true });
            request.onerror = () => reject(request.error);
        });
    }

    async updateTaskTitle(id, title) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            const request = store.get(id);
            request.onsuccess = () => {
                const task = request.result;
                if (task) {
                    task.title = title;
                    const updateRequest = store.put(task);
                    updateRequest.onsuccess = () => resolve({ success: true });
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    reject(new Error('Task not found'));
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async clearAllTasks() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();
            
            request.onsuccess = () => resolve({ success: true });
            request.onerror = () => reject(request.error);
        });
    }

    async exportData() {
        const tasks = await this.getAllTasks();
        return JSON.stringify(tasks, null, 2);
    }

    async importData(jsonData) {
        try {
            const tasks = JSON.parse(jsonData);
            await this.clearAllTasks();
            
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            for (const task of tasks) {
                const newTask = { ...task };
                delete newTask.id;
                await new Promise((resolve, reject) => {
                    const request = store.add(newTask);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

const taskManager = new TaskManager();

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============
function formatDate(dateTimeStr) {
    const date = new Date(dateTimeStr);
    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getTimeRemaining(dateTimeStr) {
    try {
        const date = new Date(dateTimeStr);
        const now = new Date();
        const diff = date - now;
        
        if (diff < 0) return '📅 Просрочено';
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % 86400000) / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        
        if (days > 0) return `⏰ Через ${days} д. ${hours} ч.`;
        if (hours > 0) return `⏰ Через ${hours} ч. ${minutes} мин.`;
        if (minutes > 0) return `⏰ Через ${minutes} мин.`;
        return '🔔 Скоро!';
    } catch(e) {
        return '❌ Ошибка';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.style.background = isError ? '#ef4444' : '#1e293b';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function setDefaultDateTime() {
    const input = document.getElementById('taskDateTime');
    if (!input) return;
    const now = new Date();
    now.setHours(now.getHours() + 1);
    now.setMinutes(0);
    input.value = now.toISOString().slice(0, 16);
}

function updateStats(tasks) {
    const total = tasks.length;
    const active = tasks.filter(t => t.completed == 0).length;
    const completed = tasks.filter(t => t.completed == 1).length;
    
    const statTotal = document.getElementById('statTotal');
    const statActive = document.getElementById('statActive');
    const statCompleted = document.getElementById('statCompleted');
    
    if (statTotal) statTotal.querySelector('.stat-value').textContent = total;
    if (statActive) statActive.querySelector('.stat-value').textContent = active;
    if (statCompleted) statCompleted.querySelector('.stat-value').textContent = completed;
}

// ============ ФУНКЦИИ УВЕДОМЛЕНИЙ ============
async function requestNotificationPermission() {
    console.log('🔄 Запрос разрешения на уведомления');
    
    if (!('Notification' in window)) {
        showToast('❌ Ваш браузер не поддерживает уведомления', true);
        return;
    }
    
    if (Notification.permission === 'granted') {
        showToast('✅ Уведомления уже включены');
        updateNotificationButton(true);
        return;
    }
    
    if (Notification.permission === 'denied') {
        showToast('❌ Уведомления запрещены. Разрешите в настройках браузера', true);
        return;
    }
    
    try {
        const permission = await Notification.requestPermission();
        console.log('Результат запроса:', permission);
        
        if (permission === 'granted') {
            updateNotificationButton(true);
            showToast('✅ Уведомления включены');
            
            // Тестовое уведомление
            new Notification('🔔 Уведомления включены', {
                body: 'Вы будете получать напоминания о задачах',
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%236366f1"/><text x="50" y="70" text-anchor="middle" fill="white" font-size="50">🔔</text></svg>'
            });
        } else {
            updateNotificationButton(false);
            showToast('❌ Разрешение не получено', true);
        }
    } catch (error) {
        console.error('Ошибка при запросе:', error);
        showToast('Ошибка при запросе уведомлений', true);
    }
}

function updateNotificationButton(enabled) {
    const btn = document.getElementById('notificationBtn');
    if (!btn) return;
    
    if (enabled) {
        btn.textContent = '🔔 Уведомления включены';
        btn.style.background = '#22c55e';
        btn.style.borderColor = '#22c55e';
        btn.style.color = 'white';
    } else {
        btn.textContent = '🔔 Включить уведомления';
        btn.style.background = 'rgba(99,102,241,0.2)';
        btn.style.borderColor = 'rgba(99,102,241,0.5)';
        btn.style.color = '#a5b4fc';
    }
}

function showBrowserNotification(title, body) {
    if (Notification.permission === 'granted') {
        new Notification(title, { body: body });
        console.log(`🔔 Уведомление: ${title} - ${body}`);
    }
}

// Проверка напоминаний (запускается каждую минуту)
async function checkReminders() {
    console.log('🕐 Проверка напоминаний...', new Date().toLocaleTimeString());
    
    if (Notification.permission !== 'granted') {
        console.log('❌ Нет разрешения на уведомления');
        return;
    }
    
    try {
        const tasks = await taskManager.getAllTasks();
        const now = new Date();
        let reminderCount = 0;
        
        for (const task of tasks) {
            // Пропускаем выполненные задачи
            if (task.completed == 1) continue;
            
            const taskTime = new Date(task.date_time);
            const diff = taskTime - now;
            const key = `reminded_${task.id}`;
            
            // Уведомление за 5 минут до задачи
            if (diff > 0 && diff <= 5 * 60 * 1000 && !localStorage.getItem(key)) {
                const minutesLeft = Math.ceil(diff / 60000);
                console.log(`🔔 Напоминание для "${task.title}" через ${minutesLeft} мин.`);
                
                showBrowserNotification('🔔 Напоминание о задаче', 
                    `"${task.title}" через ${minutesLeft} минут!`);
                
                localStorage.setItem(key, 'true');
                reminderCount++;
            }
            
            // Очищаем флаг, если задача просрочена
            if (diff < 0 && localStorage.getItem(key)) {
                localStorage.removeItem(key);
            }
        }
        
        if (reminderCount > 0) {
            console.log(`✅ Отправлено ${reminderCount} напоминаний`);
        }
    } catch (error) {
        console.error('Ошибка проверки напоминаний:', error);
    }
}

// ============ ОСНОВНЫЕ ФУНКЦИИ ПРИЛОЖЕНИЯ ============
async function loadTasks() {
    try {
        const tasks = await taskManager.getAllTasks();
        updateStats(tasks);
        
        let filteredTasks = tasks;
        if (currentFilter === 'active') {
            filteredTasks = tasks.filter(t => t.completed == 0);
        } else if (currentFilter === 'completed') {
            filteredTasks = tasks.filter(t => t.completed == 1);
        }
        
        const formattedTasks = filteredTasks.map(task => ({
            ...task,
            formatted_date: formatDate(task.date_time),
            time_remaining: getTimeRemaining(task.date_time)
        }));
        
        renderTasks(formattedTasks);
    } catch (error) {
        console.error('Error loading tasks:', error);
        showToast('Ошибка загрузки задач', true);
    }
}

function renderTasks(tasks) {
    const tasksList = document.getElementById('tasksList');
    if (!tasksList) return;
    
    if (tasks.length === 0) {
        tasksList.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M12 8v4l3 3M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                </svg>
                <h3>Нет задач</h3>
                <p>Добавьте свою первую задачу!</p>
            </div>
        `;
        return;
    }
    
    tasksList.innerHTML = tasks.map(task => `
        <div class="task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
            <div class="task-header">
                <input type="checkbox" class="task-checkbox" data-id="${task.id}" ${task.completed ? 'checked' : ''}>
                <div class="task-title">${escapeHtml(task.title)}</div>
            </div>
            <div class="task-datetime">
                📅 ${task.formatted_date}
                <span class="time-badge">${task.time_remaining}</span>
            </div>
            <div class="task-actions">
                <button class="edit-btn" data-id="${task.id}" data-title="${escapeHtml(task.title)}">✏️ Редактировать</button>
                <button class="delete-btn" data-id="${task.id}">🗑️ Удалить</button>
            </div>
        </div>
    `).join('');
    
    // Обработчики
    document.querySelectorAll('.task-checkbox').forEach(cb => {
        cb.addEventListener('change', () => toggleTask(parseInt(cb.dataset.id), cb.checked));
    });
    
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => showEditModal(parseInt(btn.dataset.id), btn.dataset.title));
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteTask(parseInt(btn.dataset.id)));
    });
}

async function addTask() {
    const title = document.getElementById('taskTitle').value;
    const dateTime = document.getElementById('taskDateTime').value;
    
    if (!title.trim()) {
        showToast('Введите название задачи', true);
        return;
    }
    
    if (!dateTime) {
        showToast('Выберите дату и время', true);
        return;
    }
    
    try {
        await taskManager.addTask(title.trim(), dateTime);
        document.getElementById('taskTitle').value = '';
        setDefaultDateTime();
        await loadTasks();
        showToast('✅ Задача добавлена');
    } catch (error) {
        console.error('Error adding task:', error);
        showToast('Ошибка при добавлении', true);
    }
}

async function toggleTask(id, completed) {
    try {
        await taskManager.toggleTask(id, completed ? 1 : 0);
        await loadTasks();
        if (completed) {
            showToast('✅ Задача выполнена!');
            showBrowserNotification('🎉 Задача выполнена', 'Отличная работа!');
        }
    } catch (error) {
        console.error('Error toggling task:', error);
        showToast('Ошибка', true);
    }
}

async function deleteTask(id) {
    if (!confirm('Удалить задачу?')) return;
    
    try {
        await taskManager.deleteTask(id);
        await loadTasks();
        showToast('🗑️ Задача удалена');
    } catch (error) {
        console.error('Error deleting task:', error);
        showToast('Ошибка при удалении', true);
    }
}

async function editTask(id, title) {
    if (!title.trim()) {
        showToast('Название не может быть пустым', true);
        return;
    }
    
    try {
        await taskManager.updateTaskTitle(id, title.trim());
        await loadTasks();
        closeModal();
        showToast('✏️ Задача обновлена');
    } catch (error) {
        console.error('Error editing task:', error);
        showToast('Ошибка при редактировании', true);
    }
}

function showEditModal(id, title) {
    editingTaskId = id;
    document.getElementById('editTitle').value = title;
    document.getElementById('editModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('editModal').style.display = 'none';
    editingTaskId = null;
}

async function exportData() {
    try {
        const data = await taskManager.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `taskflow_backup_${new Date().toISOString().slice(0,19)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('📥 Данные экспортированы');
    } catch (error) {
        console.error('Error exporting:', error);
        showToast('Ошибка экспорта', true);
    }
}

async function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const result = await taskManager.importData(event.target.result);
                if (result.success) {
                    await loadTasks();
                    showToast('📥 Данные импортированы');
                } else {
                    showToast('Ошибка: ' + result.error, true);
                }
            } catch (error) {
                showToast('Ошибка импорта', true);
            }
        };
        reader.readAsText(file);
    };
    
    input.click();
}

async function clearAllTasks() {
    if (!confirm('⚠️ Удалить ВСЕ задачи? Это действие нельзя отменить!')) return;
    
    try {
        await taskManager.clearAllTasks();
        await loadTasks();
        showToast('🗑️ Все задачи удалены');
    } catch (error) {
        showToast('Ошибка при очистке', true);
    }
}

// ============ ИНИЦИАЛИЗАЦИЯ ============
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Приложение запускается...');
    
    await taskManager.init();
    setDefaultDateTime();
    await loadTasks();
    
    // Обработчики кнопок
    const addBtn = document.getElementById('addTaskBtn');
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const clearBtn = document.getElementById('clearAllBtn');
    const saveBtn = document.getElementById('saveEditBtn');
    const closeBtn = document.getElementById('closeModalBtn');
    const modalClose = document.querySelector('.modal-close');
    const notificationBtn = document.getElementById('notificationBtn');
    const taskTitleInput = document.getElementById('taskTitle');
    
    if (addBtn) addBtn.addEventListener('click', addTask);
    if (exportBtn) exportBtn.addEventListener('click', exportData);
    if (importBtn) importBtn.addEventListener('click', importData);
    if (clearBtn) clearBtn.addEventListener('click', clearAllTasks);
    if (saveBtn) saveBtn.addEventListener('click', () => {
        if (editingTaskId) editTask(editingTaskId, document.getElementById('editTitle').value);
    });
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (modalClose) modalClose.addEventListener('click', closeModal);
    
    if (notificationBtn) {
        notificationBtn.addEventListener('click', requestNotificationPermission);
        console.log('✅ Кнопка уведомлений найдена');
    } else {
        console.log('❌ Кнопка уведомлений НЕ найдена');
    }
    
    // Фильтры
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            loadTasks();
        });
    });
    
    // Enter в поле ввода
    if (taskTitleInput) {
        taskTitleInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addTask();
        });
    }
    
    // Закрытие модалки по клику вне
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }
    
    // Проверка статуса уведомлений при загрузке
    if (Notification.permission === 'granted') {
        updateNotificationButton(true);
        console.log('✅ Уведомления уже разрешены');
    } else {
        console.log('⚠️ Статус уведомлений:', Notification.permission);
    }
    
    // Запуск проверки напоминаний каждую минуту
    setInterval(checkReminders, 60000);
    console.log('✅ Таймер напоминаний запущен (каждую минуту)');
});
