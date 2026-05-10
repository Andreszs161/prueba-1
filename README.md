# ProjectHub

SPA para organizar proyectos de software e IA con arquitectura vanilla web y WebAssembly.

## Stack Técnico

- **HTML5** - Estructura semántica
- **CSS3** - Custom Properties para diseño tipo "Bento Box"
- **JavaScript Vanilla (ES6+)** - Sin frameworks ni librerías externas de UI
- **sql.js (WebAssembly)** - SQLite en el navegador
- **localStorage** - Persistencia de la base de datos

## Arquitectura

```
Cliente-side puro:
├── index.html      # Estructura y markup semántico
├── styles.css      # Diseño con CSS Custom Properties
├── app.js          # Lógica de la aplicación y UI
└── db.js           # Capa de acceso a datos (SQLite/WASM)
```

## Esquema de Base de Datos

- **users** - Usuarios del sistema
- **projects** - Proyectos de software/IA
- **project_history** - Historial de cambios por proyecto
- **templates** - Plantillas reutilizables
- **global_notes** - Notas globales persistentes

## Características

✅ CRUD completo de proyectos  
✅ Historial automático de cambios  
✅ Sistema de plantillas  
✅ Notas globales persistentes  
✅ Diseño responsive "Bento Box"  
✅ 100% cliente-side, sin backend  
✅ Persistencia en localStorage  

## Uso

Abrir `index.html` en un navegador moderno. La aplicación carga sql.js desde CDN e inicializa la base de datos automáticamente.

## Persistencia

La base de datos SQLite se serializa y guarda en `localStorage` bajo la clave `projecthub.db`. Los datos persisten entre sesiones.