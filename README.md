# Transora
Extract the ZIP before starting. On Windows, install Python 3.10+ and double-click Start-Transora.cmd. Keep its terminal open. On macOS/Linux run python3 server.py --open. The app opens on http://127.0.0.1:8000. Set PORT to choose another port.

The supplied Transora landing page is the home screen. Create an account with a display name, email and password. Choose a course card to enter the visual studio. Its editor, interpreter recording panel, challenges, drafts, completion counts and community replies share the same account. React, database and Tech ASL starter lessons use short-answer checks. This edition includes ten introductory exercises. The landing page's broader catalogue, testimonials and institutional references are inherited prototype content. Paid subscriptions, certificates and live study rooms are not implemented.

The Python backend serves both pages and stores users, sessions, progress and discussions in studio.sqlite3. Email identifies accounts; passwords are salted and hashed with scrypt. The browser holds an HTTP-only session cookie. Keep this local demo on the loopback interface. Signed recordings are supplied by instructors; attach a local video and optionally a three-cue WebVTT file in the companion panel.

JavaScript and HTML exercises run locally in the browser. Python exercises download Pyodide; syntax tools and the original Three.js scene also use CDN assets. The homepage has an offline CSS 3D fallback. Java requires a running Docker engine and docker pull eclipse-temurin:21-jdk.

For open-ended AI answers, set OPENAI_API_KEY in the server environment before launch. In PowerShell use $env:OPENAI_API_KEY = 'your-key' and then run py server.py --open. OPENAI_MODEL optionally overrides gpt-4o-mini. Only submitted questions, lesson context and relevant editor text are sent to the provider. Without credentials the guide serves authored help. Keys belong on the server.
