/**
 * app.js - Lógica principal de ProjectHub
 * Gestiona la UI, eventos y renderizado de la SPA
 */

// Estado de la aplicación
const AppState = {
    currentTab: 'projects',
    editingProjectId: null,
    projects: [],
    templates: [],
    isLoading: true
};

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Inicializar base de datos
        await DB.initDB();
        
        // Cargar datos iniciales
        await loadAllData();
        
        // Configurar event listeners
        setupEventListeners();
        
        // Renderizar vista inicial
        renderProjects();
        
        AppState.isLoading = false;
        console.log('ProjectHub initialized');
    } catch (error) {
        console.error('Error initializing app:', error);
        showError('Error al inicializar la aplicación');
    }
});

/**
 * Carga todos los datos desde la base de datos
 */
async function loadAllData() {
    AppState.projects = DB.getProjects();
    AppState.templates = DB.getTemplates();
}

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
    // Navegación por tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
    });
    
    // Nuevo proyecto
    document.getElementById('btn-new-project').addEventListener('click', () => openProjectModal());
    
    // Guardar proyecto (submit del formulario)
    document.querySelector('#project-modal form').addEventListener('submit', handleSaveProject);
    
    // Cancelar proyecto
    document.getElementById('btn-cancel-project').addEventListener('click', closeProjectModal);
    
    // Cerrar modal al hacer click fuera
    document.getElementById('project-modal').addEventListener('click', (e) => {
        if (e.target.id === 'project-modal') closeProjectModal();
    });
    
    // Cerrar detalle de proyecto
    document.getElementById('btn-close-detail').addEventListener('click', closeProjectDetail);
    
    // Guardar notas globales
    document.getElementById('btn-save-notes').addEventListener('click', handleSaveNotes);
    
    // Nueva plantilla
    document.getElementById('btn-new-template').addEventListener('click', handleNewTemplate);
}

// ==================== TAB NAVIGATION ====================

function switchTab(tabName) {
    // Actualizar estado
    AppState.currentTab = tabName;
    
    // Actualizar botones de navegación
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Actualizar contenido visible
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabName);
    });
    
    // Cargar datos específicos del tab
    if (tabName === 'templates') {
        renderTemplates();
    } else if (tabName === 'notes') {
        loadGlobalNotes();
    }
}

// ==================== PROJECTS ====================

/**
 * Renderiza la lista de proyectos en el grid
 */
function renderProjects() {
    const container = document.getElementById('projects-list');
    
    if (AppState.projects.length === 0) {
        container.innerHTML = `
            <div class="bento-card empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">📁</div>
                <h3>No hay proyectos aún</h3>
                <p>Crea tu primer proyecto para comenzar a organizar tu trabajo</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = AppState.projects.map(project => `
        <div class="bento-card project-card" data-id="${project.id}" data-status="${project.status}">
            <div class="project-card-header">
                <h3 class="project-card-title">${escapeHtml(project.name)}</h3>
                <span class="project-card-status status-${project.status}">${getStatusLabel(project.status)}</span>
            </div>
            <p class="project-card-description">${escapeHtml(project.description) || 'Sin descripción'}</p>
            ${project.technologies ? `
                <div class="project-card-tech">
                    ${project.technologies.split(',').map(tech => `
                        <span class="tech-tag">${escapeHtml(tech.trim())}</span>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `).join('');
    
    // Agregar event listeners a las tarjetas
    container.querySelectorAll('.project-card').forEach(card => {
        card.addEventListener('click', () => openProjectDetail(parseInt(card.dataset.id)));
    });
}

/**
 * Abre el modal para crear/editar proyecto
 */
function openProjectModal(projectId = null) {
    const modal = document.getElementById('project-modal');
    const title = document.getElementById('modal-title');
    const idField = document.getElementById('project-id');
    const nameField = document.getElementById('project-name');
    const descField = document.getElementById('project-description');
    const statusField = document.getElementById('project-status');
    const techField = document.getElementById('project-tech');
    
    AppState.editingProjectId = projectId;
    
    if (projectId) {
        // Modo edición
        const project = DB.getProjectById(projectId);
        title.textContent = 'Editar Proyecto';
        idField.value = project.id;
        nameField.value = project.name;
        descField.value = project.description || '';
        statusField.value = project.status;
        techField.value = project.technologies || '';
    } else {
        // Modo creación
        title.textContent = 'Nuevo Proyecto';
        idField.value = '';
        nameField.value = '';
        descField.value = '';
        statusField.value = 'planning';
        techField.value = '';
    }
    
    modal.showModal();
}

/**
 * Cierra el modal de proyecto
 */
function closeProjectModal() {
    const modal = document.getElementById('project-modal');
    modal.close();
    AppState.editingProjectId = null;
}

/**
 * Maneja el guardado de un proyecto
 */
function handleSaveProject(e) {
    e.preventDefault();
    
    const id = document.getElementById('project-id').value;
    const name = document.getElementById('project-name').value.trim();
    const description = document.getElementById('project-description').value.trim();
    const status = document.getElementById('project-status').value;
    const technologies = document.getElementById('project-tech').value.trim();
    
    if (!name) {
        showError('El nombre del proyecto es requerido');
        return;
    }
    
    try {
        if (id) {
            // Actualizar existente
            DB.updateProject(parseInt(id), name, description, status, technologies);
            addProjectHistory(parseInt(id), 'updated', 'Proyecto actualizado');
        } else {
            // Crear nuevo
            DB.createProject(name, description, status, technologies);
        }
        
        // Recargar datos y renderizar
        AppState.projects = DB.getProjects();
        renderProjects();
        closeProjectModal();
        
    } catch (error) {
        console.error('Error saving project:', error);
        showError('Error al guardar el proyecto');
    }
}

/**
 * Abre el panel de detalle de un proyecto
 */
function openProjectDetail(projectId) {
    const project = DB.getProjectById(projectId);
    const history = DB.getProjectHistory(projectId);
    const detailPanel = document.getElementById('project-detail');
    const content = document.getElementById('detail-content');
    
    if (!project) return;
    
    content.innerHTML = `
        <h2>${escapeHtml(project.name)}</h2>
        
        <div class="detail-section">
            <div class="detail-label">Estado</div>
            <div class="detail-value">
                <span class="project-card-status status-${project.status}">${getStatusLabel(project.status)}</span>
            </div>
        </div>
        
        <div class="detail-section">
            <div class="detail-label">Descripción</div>
            <div class="detail-value">${escapeHtml(project.description) || 'Sin descripción'}</div>
        </div>
        
        ${project.technologies ? `
            <div class="detail-section">
                <div class="detail-label">Tecnologías</div>
                <div class="detail-value">
                    <div class="project-card-tech">
                        ${project.technologies.split(',').map(tech => `
                            <span class="tech-tag">${escapeHtml(tech.trim())}</span>
                        `).join('')}
                    </div>
                </div>
            </div>
        ` : ''}
        
        <div class="detail-section">
            <div class="detail-label">Fechas</div>
            <div class="detail-value">
                <p>Creado: ${formatDate(project.created_at)}</p>
                <p>Actualizado: ${formatDate(project.updated_at)}</p>
            </div>
        </div>
        
        <div class="detail-section">
            <div class="detail-label">Historial</div>
            <div class="history-timeline">
                ${history.length > 0 ? history.map(item => `
                    <div class="history-item">
                        <div class="history-date">${formatDate(item.created_at)}</div>
                        <div class="history-action">${escapeHtml(item.details)}</div>
                    </div>
                `).join('') : '<p style="color: var(--color-text-secondary);">Sin historial</p>'}
            </div>
        </div>
        
        <div class="modal-actions" style="margin-top: 2rem;">
            <button onclick="deleteProjectAction(${project.id})" class="btn-secondary" style="border-color: var(--color-danger); color: var(--color-danger);">Eliminar</button>
            <button onclick="openProjectModal(${project.id})" class="btn-primary">Editar</button>
        </div>
    `;
    
    detailPanel.classList.add('open');
}

/**
 * Cierra el panel de detalle
 */
function closeProjectDetail() {
    document.getElementById('project-detail').classList.remove('open');
}

/**
 * Elimina un proyecto
 */
function deleteProjectAction(projectId) {
    if (!confirm('¿Estás seguro de que deseas eliminar este proyecto?')) return;
    
    try {
        DB.deleteProject(projectId);
        AppState.projects = DB.getProjects();
        renderProjects();
        closeProjectDetail();
    } catch (error) {
        console.error('Error deleting project:', error);
        showError('Error al eliminar el proyecto');
    }
}

// ==================== TEMPLATES ====================

/**
 * Renderiza la lista de plantillas
 */
function renderTemplates() {
    const container = document.getElementById('templates-list');
    
    if (AppState.templates.length === 0) {
        container.innerHTML = `
            <div class="bento-card empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">📋</div>
                <h3>No hay plantillas aún</h3>
                <p>Crea plantillas para reutilizar en tus proyectos</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = AppState.templates.map(template => `
        <div class="bento-card template-card" data-id="${template.id}">
            <div class="project-card-header">
                <h3 class="project-card-title">${escapeHtml(template.name)}</h3>
            </div>
            <p class="project-card-description">${escapeHtml(template.description) || 'Sin descripción'}</p>
            <div class="modal-actions" style="margin-top: 1rem;">
                <button onclick="deleteTemplateAction(${template.id})" class="btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">Eliminar</button>
                <button onclick="editTemplateAction(${template.id})" class="btn-primary" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">Editar</button>
            </div>
        </div>
    `).join('');
}

/**
 * Maneja la creación de nueva plantilla
 */
function handleNewTemplate() {
    const name = prompt('Nombre de la plantilla:');
    if (!name) return;
    
    const description = prompt('Descripción (opcional):') || '';
    const content = prompt('Contenido de la plantilla:') || '';
    
    try {
        DB.createTemplate(name, description, content);
        AppState.templates = DB.getTemplates();
        renderTemplates();
    } catch (error) {
        console.error('Error creating template:', error);
        showError('Error al crear la plantilla');
    }
}

/**
 * Edita una plantilla existente
 */
function editTemplateAction(templateId) {
    const template = DB.selectQuery('SELECT * FROM templates WHERE id = ?', [templateId])[0];
    if (!template) return;
    
    const name = prompt('Nombre de la plantilla:', template.name);
    if (!name) return;
    
    const description = prompt('Descripción:', template.description || '') || '';
    const content = prompt('Contenido:', template.content || '') || '';
    
    try {
        DB.updateTemplate(templateId, name, description, content);
        AppState.templates = DB.getTemplates();
        renderTemplates();
    } catch (error) {
        console.error('Error updating template:', error);
        showError('Error al actualizar la plantilla');
    }
}

/**
 * Elimina una plantilla
 */
function deleteTemplateAction(templateId) {
    if (!confirm('¿Eliminar esta plantilla?')) return;
    
    try {
        DB.deleteTemplate(templateId);
        AppState.templates = DB.getTemplates();
        renderTemplates();
    } catch (error) {
        console.error('Error deleting template:', error);
        showError('Error al eliminar la plantilla');
    }
}

// ==================== GLOBAL NOTES ====================

/**
 * Carga las notas globales en el editor
 */
function loadGlobalNotes() {
    const notes = DB.getGlobalNotes();
    document.getElementById('global-notes-editor').value = notes;
}

/**
 * Maneja el guardado de notas globales
 */
function handleSaveNotes() {
    const content = document.getElementById('global-notes-editor').value;
    
    try {
        DB.saveGlobalNotes(content);
        showNotification('Notas guardadas correctamente');
    } catch (error) {
        console.error('Error saving notes:', error);
        showError('Error al guardar las notas');
    }
}

// ==================== UTILITIES ====================

/**
 * Escapa HTML para prevenir XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Obtiene la etiqueta legible para un estado
 */
function getStatusLabel(status) {
    const labels = {
        'planning': 'Planificación',
        'active': 'Activo',
        'on-hold': 'En Pausa',
        'completed': 'Completado'
    };
    return labels[status] || status;
}

/**
 * Formatea una fecha
 */
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Muestra un mensaje de error
 */
function showError(message) {
    alert('❌ ' + message);
}

/**
 * Muestra una notificación
 */
function showNotification(message) {
    // Implementación simple, podría mejorarse con un toast
    console.log('✓', message);
}

/**
 * Agrega un registro al historial del proyecto
 */
function addProjectHistory(projectId, action, details) {
    DB.addProjectHistory(projectId, action, details);
}
