const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data/app.db');
console.log('Database path:', dbPath);

const db = new Database(dbPath);
const rows = db.prepare('SELECT id, user_id, conversation_history FROM sessions LIMIT 5').all();
console.log(JSON.stringify(rows, null, 2));
db.close();
