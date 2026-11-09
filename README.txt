BLOODCONNECT - FLUTTER-STYLE FSD VERSION
Frontend: HTML, CSS, JavaScript
Backend: Node.js + Express
Database: MySQL

IMPORTANT: This is an updated version of your FSD project. Keep your old project backup.
The UI is recreated from the Flutter screenshots you supplied. The existing account data and
blood request data remain in MySQL; run migration.sql once to add profile college ID, emergency
request support, donation history and notifications.

SETUP / UPDATE
1. Stop the old server with Ctrl+C in its terminal.
2. Make a backup before replacing anything.
3. Extract this ZIP into a NEW folder, e.g. BloodConnect-FSD-Flutter-Style.
4. Open the new folder in VS Code.
5. Open MySQL Workbench and connect to the same instance used by your app (the screenshot showed
   MySQL80 on port 3307).
6. Open migration.sql and execute it once. It adds missing columns/tables; it does not delete
   your existing users or blood requests.
7. Copy .env.example to .env. Set DB_PASSWORD to your actual MySQL password.
   Keep DB_PORT=3307 if using your Local instance MySQL80. If your active MySQL server uses 3306,
   change DB_PORT to 3306.
8. In VS Code terminal run: npm install
9. Run: npm start
10. Open http://localhost:3000

FEATURES
Welcome, login, registration, dashboard, profile editing, create blood request (including
emergency flag), browse requests, my requests/status, donor search, donor responses,
donation history records, notifications.

DEMO
Register account A and account B with the same blood group. Use account A to create a request.
Log in as account B to respond. Log in as account A to see responses and notifications.

SAFETY
This is a student demonstration, not an emergency medical service. Verify donor identity,
availability and medical suitability independently. Do not enter real sensitive patient data.
Keep .env private and never upload it to GitHub.
