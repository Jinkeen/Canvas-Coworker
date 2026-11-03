# Canvas Coworker MVP

This directory is an independent Node.js application. It does not use the legacy Python project or its build tasks. Use `npm start`, `npm test`, and `npm run check` here. No installation is required because the application uses Node built-ins and browser APIs only.

- public/core.mjs: validated workspace schema, grouping, layout and handoff exports.
- public/app.js: interaction, undo/redo, local storage and optional AI suggestions.
- public/styles.css and index.html: responsive canvas UI and printable handoff.
- server.mjs: loopback-only server and optional compatible chat-completion proxy.
- tests/: data integrity, exports and API integration checks with a local mock provider.

Keep excerpt text intact when applying AI suggestions. Treat model responses as untrusted data. Never persist or log API keys. Do not claim local keyword grouping uses a language model. JSON imports append validated projects without replacing existing work. Do not commit or push without explicit user instruction.
