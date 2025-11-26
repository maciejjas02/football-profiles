import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- KONFIGURACJA ---

const dbPath = path.join(__dirname, 'server', 'app.sqlite');
const uploadsDir = path.join(__dirname, 'public', 'gallery-img');

const db = new Database(dbPath);
console.log(`🔌 Połączono z bazą danych: ${dbPath}`);

let files = [];
try {
    if (fs.existsSync(uploadsDir)) {
        files = fs.readdirSync(uploadsDir).filter(file => {
            return /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
        });
    } else {
        console.error(`❌ Katalog nie istnieje: ${uploadsDir}`);
        process.exit(1);
    }
} catch (e) {
    console.error("Błąd odczytu katalogu:", e);
    process.exit(1);
}

if (files.length === 0) {
    console.log(`⚠️ Folder '${uploadsDir}' jest pusty.`);
    process.exit(0);
}

console.log(`📂 Znaleziono ${files.length} plików w folderze.`);

const insertImage = db.prepare(`
    INSERT INTO gallery_images (filename, title, description, width, height) 
    VALUES (?, ?, ?, ?, ?)
`);

const updateImage = db.prepare(`
    UPDATE gallery_images 
    SET description = ?, title = ?
    WHERE id = ?
`);

const checkImage = db.prepare('SELECT id FROM gallery_images WHERE filename = ?');
const imageIds = [];

const NEW_DESCRIPTION = 'Opis zdjęcia';

const imgTransaction = db.transaction((fileList) => {
    for (const filename of fileList) {
        let row = checkImage.get(filename);
        let id;

        const title = `Zdjęcie ${filename}`;

        if (!row) {
            const info = insertImage.run(
                filename,
                title,
                NEW_DESCRIPTION,
                800,
                600
            );
            id = info.lastInsertRowid;
            console.log(`➕ Dodano do bazy: ${filename}`);
        } else {

            updateImage.run(NEW_DESCRIPTION, title, id);
            console.log(`🔄 Zaktualizowano opis dla: ${filename}`);
        }
        imageIds.push(id);
    }
});

imgTransaction(files);


const collectionName = 'Galeria (g1, g2, g3...)';
const collectionDesc = 'Automatycznie wygenerowana galeria z Twoich zdjęć.';

try {

    db.prepare('UPDATE gallery_collections SET is_active = 0').run();


    const stmt = db.prepare(`
        INSERT INTO gallery_collections (name, description, is_active) 
        VALUES (?, ?, 1)
    `);
    const info = stmt.run(collectionName, collectionDesc);
    const collectionId = info.lastInsertRowid;

    console.log(`✅ Utworzono kolekcję: "${collectionName}" (ID: ${collectionId})`);


    const insertItem = db.prepare('INSERT INTO gallery_items (collection_id, image_id, position) VALUES (?, ?, ?)');

    const itemsTransaction = db.transaction((ids) => {
        for (let i = 0; i < ids.length; i++) {
            insertItem.run(collectionId, ids[i], i);
        }
    });

    itemsTransaction(imageIds);
    console.log(`🔗 Przypisano ${imageIds.length} zdjęć do galerii.`);
    console.log(`✨ Gotowe! Odśwież stronę.`);

} catch (error) {
    console.error('❌ Błąd podczas tworzenia galerii:', error.message);
}

db.close();