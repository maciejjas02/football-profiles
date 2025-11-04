import Database from 'better-sqlite3';

const db = new Database('./server/app.sqlite');

const users = db.prepare('SELECT id, email, username, name, role FROM users').all();

console.log('\n📋 Użytkownicy w bazie danych:\n');
console.table(users);

// Sprawdź czy admin istnieje
const admin = users.find(u => u.role === 'admin');
if (admin) {
  console.log('\n✅ Admin znaleziony:', admin.email);
} else {
  console.log('\n❌ Brak użytkownika z rolą admin!');
  console.log('💡 Aktualizuję użytkownika admin@example.com do roli admin...\n');
  
  db.prepare("UPDATE users SET role = 'admin' WHERE email = 'admin@example.com'").run();
  
  const updated = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@example.com');
  console.log('✅ Zaktualizowano:', updated);
}

db.close();
