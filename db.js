/**
 * db.js - Capa de acceso a datos con sql.js (WebAssembly)
 * Gestiona la base de datos SQLite en el navegador con persistencia en localStorage
 */

const DB_KEY = 'projecthub.db';

let db = null;
let SQL = null;

// Schema de la base de datos
const SCHEMA = `
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'planning',
        technologies TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS global_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Insertar nota global por defecto si no existe
    INSERT OR IGNORE INTO global_notes (id, content) VALUES (1, '');
`;

/**
 * Inicializa la base de datos
 * Carga desde localStorage o crea una nueva
 */
async function initDB() {
    try {
        // Configurar sql.js
        const config = {
            locateFile: filename => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${filename}`
        };
        
        SQL = await initSqlJs(config);
        
        // Intentar cargar desde localStorage
        const savedDB = localStorage.getItem(DB_KEY);
        
        if (savedDB) {
            const uint8Array = new Uint8Array(JSON.parse(savedDB));
            db = new SQL.Database(uint8Array);
        } else {
            // Crear nueva base de datos
            db = new SQL.Database();
            db.run(SCHEMA);
            saveDB();
        }
        
        console.log('Database initialized successfully');
        return db;
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
}

/**
 * Guarda la base de datos en localStorage
 */
function saveDB() {
    if (!db) return;
    
    try {
        const data = db.export();
        const arr = Array.from(data);
        localStorage.setItem(DB_KEY, JSON.stringify(arr));
        console.log('Database saved to localStorage');
    } catch (error) {
        console.error('Error saving database:', error);
        // Manejar quota excedida
        if (error.name === 'QuotaExceededError') {
            alert('Almacenamiento lleno. Limpiando datos antiguos...');
            // Podríamos implementar lógica para limpiar datos antiguos
        }
        throw error;
    }
}

/**
 * Ejecuta una consulta SQL
 * @param {string} query - Consulta SQL
 * @param {array} params - Parámetros para la consulta
 * @returns {array} Resultados
 */
function runQuery(query, params = []) {
    if (!db) throw new Error('Database not initialized');
    
    try {
        db.run(query, params);
        saveDB();
        return { success: true };
    } catch (error) {
        console.error('Query error:', error);
        throw error;
    }
}

/**
 * Ejecuta una consulta SELECT
 * @param {string} query - Consulta SQL
 * @param {array} params - Parámetros para la consulta
 * @returns {array} Resultados como array de objetos
 */
function selectQuery(query, params = []) {
    if (!db) throw new Error('Database not initialized');
    
    try {
        const stmt = db.prepare(query);
        
        if (params.length > 0) {
            stmt.bind(params);
        }
        
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        
        stmt.free();
        return results;
    } catch (error) {
        console.error('Select error:', error);
        throw error;
    }
}

// ==================== PROJECTS ====================

/**
 * Obtiene todos los proyectos
 */
function getProjects() {
    const query = `
        SELECT * FROM projects 
        ORDER BY updated_at DESC
    `;
    return selectQuery(query);
}

/**
 * Obtiene un proyecto por ID
 */
function getProjectById(id) {
    const query = `SELECT * FROM projects WHERE id = ?`;
    const results = selectQuery(query, [id]);
    return results[0] || null;
}

/**
 * Crea un nuevo proyecto
 */
function createProject(name, description, status, technologies) {
    const query = `
        INSERT INTO projects (name, description, status, technologies)
        VALUES (?, ?, ?, ?)
    `;
    
    runQuery(query, [name, description, status, technologies]);
    
    // Obtener el ID del proyecto creado
    const result = selectQuery('SELECT last_insert_rowid() as id');
    const projectId = result[0].id;
    
    // Registrar en historial
    addProjectHistory(projectId, 'created', 'Proyecto creado');
    
    return projectId;
}

/**
 * Actualiza un proyecto existente
 */
function updateProject(id, name, description, status, technologies) {
    const oldProject = getProjectById(id);
    
    const query = `
        UPDATE projects 
        SET name = ?, description = ?, status = ?, technologies = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;
    
    runQuery(query, [name, description, status, technologies, id]);
    
    // Registrar cambios en historial si cambió el estado
    if (oldProject.status !== status) {
        addProjectHistory(id, 'status_change', `Estado cambiado de ${oldProject.status} a ${status}`);
    }
    
    return true;
}

/**
 * Elimina un proyecto
 */
function deleteProject(id) {
    const query = `DELETE FROM projects WHERE id = ?`;
    runQuery(query, [id]);
    return true;
}

// ==================== PROJECT HISTORY ====================

/**
 * Agrega un registro al historial del proyecto
 */
function addProjectHistory(projectId, action, details) {
    const query = `
        INSERT INTO project_history (project_id, action, details)
        VALUES (?, ?, ?)
    `;
    runQuery(query, [projectId, action, details]);
    return true;
}

/**
 * Obtiene el historial de un proyecto
 */
function getProjectHistory(projectId) {
    const query = `
        SELECT * FROM project_history 
        WHERE project_id = ?
        ORDER BY created_at DESC
    `;
    return selectQuery(query, [projectId]);
}

// ==================== TEMPLATES ====================

/**
 * Obtiene todas las plantillas
 */
function getTemplates() {
    const query = `SELECT * FROM templates ORDER BY created_at DESC`;
    return selectQuery(query);
}

/**
 * Crea una nueva plantilla
 */
function createTemplate(name, description, content) {
    const query = `
        INSERT INTO templates (name, description, content)
        VALUES (?, ?, ?)
    `;
    runQuery(query, [name, description, content]);
    return true;
}

/**
 * Actualiza una plantilla
 */
function updateTemplate(id, name, description, content) {
    const query = `
        UPDATE templates 
        SET name = ?, description = ?, content = ?
        WHERE id = ?
    `;
    runQuery(query, [name, description, content, id]);
    return true;
}

/**
 * Elimina una plantilla
 */
function deleteTemplate(id) {
    const query = `DELETE FROM templates WHERE id = ?`;
    runQuery(query, [id]);
    return true;
}

// ==================== GLOBAL NOTES ====================

/**
 * Obtiene las notas globales
 */
function getGlobalNotes() {
    const query = `SELECT content FROM global_notes WHERE id = 1`;
    const results = selectQuery(query);
    return results[0] ? results[0].content : '';
}

/**
 * Actualiza las notas globales
 */
function saveGlobalNotes(content) {
    const query = `
        UPDATE global_notes 
        SET content = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
    `;
    runQuery(query, [content]);
    return true;
}

// ==================== USERS ====================

/**
 * Crea un usuario (para futura funcionalidad)
 */
function createUser(username, email) {
    try {
        const query = `INSERT INTO users (username, email) VALUES (?, ?)`;
        runQuery(query, [username, email]);
        return true;
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            throw new Error('El nombre de usuario ya existe');
        }
        throw error;
    }
}

/**
 * Obtiene todos los usuarios
 */
function getUsers() {
    const query = `SELECT id, username, email, created_at FROM users ORDER BY created_at DESC`;
    return selectQuery(query);
}

// Exportar funciones
window.DB = {
    initDB,
    saveDB,
    runQuery,
    selectQuery,
    // Projects
    getProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject,
    // History
    addProjectHistory,
    getProjectHistory,
    // Templates
    getTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    // Notes
    getGlobalNotes,
    saveGlobalNotes,
    // Users
    createUser,
    getUsers
};
