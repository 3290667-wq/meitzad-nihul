# מחקר השוואתי: שרת מקומי לדאטא מול Firebase

## תוכן עניינים
1. [סקירה כללית](#סקירה-כללית)
2. [אפשרות 1: Firebase](#אפשרות-1-firebase)
3. [אפשרות 2: SQLite מקומי](#אפשרות-2-sqlite-מקומי)
4. [אפשרות 3: PostgreSQL](#אפשרות-3-postgresql)
5. [אפשרות 4: חלופות Open-Source ל-Firebase](#אפשרות-4-חלופות-open-source-ל-firebase)
6. [טבלת השוואה מסכמת](#טבלת-השוואה-מסכמת)
7. [המלצה לפרויקט מיצד](#המלצה-לפרויקט-מיצד)
8. [מימוש טכני](#מימוש-טכני)

---

## סקירה כללית

### הצורך
לפרויקט אתר ניהולי ליישוב מיצד נדרש בסיס נתונים שיתמוך ב:
- שמירת פניות תושבים
- ניהול משתמשים והרשאות
- תיעוד פעילות (Audit Log)
- Real-time updates (עדכונים בזמן אמת)
- גיבוי ושחזור

### קריטריונים להשוואה
1. **עלות** - הקמה ותחזוקה שוטפת
2. **ביצועים** - מהירות קריאה/כתיבה
3. **קלות הקמה** - זמן עד Production
4. **שליטה בנתונים** - Data Sovereignty
5. **Scalability** - יכולת גדילה
6. **Real-time** - תמיכה בעדכונים חיים

---

## אפשרות 1: Firebase

### Realtime Database + Firestore

#### יתרונות
- **Zero Configuration** - מוכן לשימוש מיידי
- **Real-time Sync** - עדכונים חיים מובנים
- **Auth מובנה** - מערכת אימות מלאה
- **Hosting כלול** - CDN גלובלי
- **SDK עשיר** - תמיכה ב-JavaScript, Mobile
- **Security Rules** - הרשאות מבוססות Rules

#### חסרונות
- **Vendor Lock-in** - תלות בגוגל, קושי במיגרציה
- **מבנה NoSQL** - לא מתאים לכל סוגי השאילתות
- **עלות גוברת** - מחירים עולים עם הגדילה
- **מגבלות Queries** - אין JOIN, אין Aggregations מורכבים
- **אין Full-text Search מובנה**

#### תמחור Firebase (2025)
| שירות | Free Tier | מחיר נוסף |
|--------|-----------|----------|
| Firestore | 1GB storage, 50K reads/day | $0.18/100K reads |
| Realtime DB | 1GB storage, 10GB/month | $1/GB storage |
| Auth | 50K users/month | $0.01/user |
| Hosting | 10GB storage | $0.026/GB |
| Functions | 2M invocations | $0.40/million |

**הערכת עלות לפרויקט מיצד:**
- עד 1000 תושבים + 50 פניות/חודש = Free Tier מספיק
- גדילה ל-5000+ פניות/חודש = ~$10-30/חודש

#### מימוש עם Firebase

```javascript
// firebase-config.js
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: "meitzad-nihul.firebaseapp.com",
  projectId: "meitzad-nihul",
  storageBucket: "meitzad-nihul.appspot.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// יצירת פנייה
async function createRequest(data) {
  return await addDoc(collection(db, 'requests'), {
    ...data,
    createdAt: new Date(),
    status: 'new'
  });
}

// האזנה לפניות חדשות (Real-time)
function subscribeToRequests(callback) {
  return onSnapshot(collection(db, 'requests'), (snapshot) => {
    const requests = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(requests);
  });
}
```

---

## אפשרות 2: SQLite מקומי

### Better-SQLite3 עם Node.js

#### יתרונות
- **חינם לחלוטין** - ללא עלויות
- **פשטות** - קובץ אחד, ללא שרת נפרד
- **ביצועים מעולים** - הכי מהיר לקריאות
- **SQL מלא** - JOINs, Aggregations, Views
- **Portable** - קל להעביר ולגבות
- **שליטה מלאה** - הנתונים אצלך

#### חסרונות
- **לא Distributed** - לא מתאים ליותר משרת אחד
- **אין Real-time מובנה** - צריך לממש עם Socket.io
- **Concurrency מוגבל** - לא מתאים להרבה כתיבות מקבילות
- **אין Auth מובנה** - צריך לממש בנפרד
- **גיבוי ידני** - צריך לארגן גיבויים

#### מתי להשתמש
- פרויקט עם שרת אחד
- עד ~10,000 משתמשים
- עד ~100 בקשות במקביל
- כשחשובה פשטות ושליטה

#### מימוש עם SQLite

```javascript
// database.js
const Database = require('better-sqlite3');
const db = new Database('meitzad.db');

// יצירת טבלאות
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT DEFAULT 'citizen',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    category TEXT NOT NULL,
    subject TEXT NOT NULL,
    description TEXT,
    location TEXT,
    priority TEXT DEFAULT 'normal',
    status TEXT DEFAULT 'new',
    assigned_to INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS request_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER REFERENCES requests(id),
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
  CREATE INDEX IF NOT EXISTS idx_requests_category ON requests(category);
`);

// פונקציות CRUD
const createRequest = db.prepare(`
  INSERT INTO requests (user_id, category, subject, description, location, priority)
  VALUES (@user_id, @category, @subject, @description, @location, @priority)
`);

const getRequestsByStatus = db.prepare(`
  SELECT r.*, u.name as submitter_name, u.email as submitter_email
  FROM requests r
  JOIN users u ON r.user_id = u.id
  WHERE r.status = ?
  ORDER BY r.created_at DESC
`);

const getRequestStats = db.prepare(`
  SELECT
    status,
    COUNT(*) as count,
    AVG(CASE WHEN resolved_at THEN
      ROUND((julianday(resolved_at) - julianday(created_at)) * 24)
    END) as avg_hours_to_resolve
  FROM requests
  GROUP BY status
`);

module.exports = { db, createRequest, getRequestsByStatus, getRequestStats };
```

---

## אפשרות 3: PostgreSQL

### PostgreSQL עם Prisma ORM

#### יתרונות
- **SQL מתקדם** - Full-text search, JSONB, Geo
- **Concurrent Writes** - מתאים להרבה כתיבות
- **יציבות מוכחת** - נמצא בשימוש בפרודקשן עצום
- **Scalable** - אפשר לגדול מאוד
- **Extensions** - PostGIS, pg_cron, ועוד

#### חסרונות
- **הקמה מורכבת יותר** - צריך שרת DB נפרד
- **עלות אירוח** - שירותי PostgreSQL עולים כסף
- **תחזוקה** - גיבויים, עדכונים, ניטור
- **Over-engineering** - אולי יותר מדי לפרויקט קטן

#### תמחור PostgreSQL Hosting
| שירות | Free Tier | מחיר התחלתי |
|--------|-----------|-------------|
| Supabase | 500MB, 2 projects | $25/month |
| Railway | $5 credits | ~$5/month |
| Neon | 500MB, 3 projects | $19/month |
| DigitalOcean | - | $15/month |
| AWS RDS | 12 months trial | $15+/month |

#### מימוש עם PostgreSQL + Prisma

```javascript
// schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int       @id @default(autoincrement())
  email     String    @unique
  name      String
  phone     String?
  role      Role      @default(CITIZEN)
  requests  Request[] @relation("Submitter")
  assigned  Request[] @relation("Assignee")
  updates   RequestUpdate[]
  createdAt DateTime  @default(now())
}

model Request {
  id          Int       @id @default(autoincrement())
  submitter   User      @relation("Submitter", fields: [submitterId], references: [id])
  submitterId Int
  category    String
  subject     String
  description String?
  location    String?
  priority    Priority  @default(NORMAL)
  status      Status    @default(NEW)
  assignee    User?     @relation("Assignee", fields: [assigneeId], references: [id])
  assigneeId  Int?
  updates     RequestUpdate[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  resolvedAt  DateTime?
}

model RequestUpdate {
  id        Int      @id @default(autoincrement())
  request   Request  @relation(fields: [requestId], references: [id])
  requestId Int
  user      User     @relation(fields: [userId], references: [id])
  userId    Int
  action    String
  comment   String?
  createdAt DateTime @default(now())
}

enum Role {
  SUPER_ADMIN
  ADMIN
  STAFF
  CITIZEN
}

enum Priority {
  LOW
  NORMAL
  HIGH
  URGENT
}

enum Status {
  NEW
  IN_PROGRESS
  PENDING
  RESOLVED
  CLOSED
}
```

---

## אפשרות 4: חלופות Open-Source ל-Firebase

### Supabase (מומלץ)

#### מה זה
פלטפורמת Backend-as-a-Service מבוססת PostgreSQL, מכונה "Firebase Open-Source Alternative".

#### יתרונות
- **PostgreSQL** - SQL מלא עם יתרונות Firebase
- **Real-time** - עדכונים חיים מובנים
- **Auth מובנה** - דומה ל-Firebase Auth
- **Storage** - אחסון קבצים
- **Self-hosting** - אפשר להריץ על השרת שלך
- **Row Level Security** - הרשאות ברמת שורה

#### חסרונות
- צעיר יותר מ-Firebase
- קהילה קטנה יותר
- Self-hosting דורש מאמץ

#### תמחור
- **Free**: 500MB DB, 1GB Storage, 50K MAU
- **Pro**: $25/month - 8GB DB, 100GB Storage

### Appwrite

#### מה זה
Backend server מקיף שרץ ב-Docker.

#### יתרונות
- **Self-hosted** - מלא שליטה
- **Docker** - קל להתקנה
- **SDKs רבים** - Web, Mobile, Server
- **Functions** - Cloud Functions מובנה

#### חסרונות
- דורש שרת משלך
- פחות Mature מהמתחרים

### PocketBase

#### מה זה
Backend בקובץ אחד - Go binary עם SQLite.

#### יתרונות
- **פשוט ביותר** - קובץ אחד
- **Real-time** - מובנה
- **Admin UI** - ממשק ניהול
- **חינם** - לגמרי

#### חסרונות
- לא מתאים ל-Scale גדול
- קהילה קטנה

---

## טבלת השוואה מסכמת

| קריטריון | Firebase | SQLite | PostgreSQL | Supabase |
|----------|----------|--------|------------|----------|
| **עלות חודשית** | $0-30 | $0 (VPS: $5) | $15-25 | $0-25 |
| **קלות הקמה** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Real-time** | ⭐⭐⭐⭐⭐ | ⭐⭐ (+ Socket.io) | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **SQL Support** | ❌ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **שליטה בנתונים** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Scalability** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Auth מובנה** | ⭐⭐⭐⭐⭐ | ❌ | ❌ | ⭐⭐⭐⭐⭐ |
| **Offline Support** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **תיעוד/קהילה** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

---

## המלצה לפרויקט מיצד

### המלצה ראשית: SQLite + Socket.io

**סיבות:**
1. **פשטות** - קובץ אחד, ללא תלויות חיצוניות
2. **עלות אפסית** - רק עלות VPS (~$5/חודש)
3. **שליטה מלאה** - הנתונים נשארים בשרת שלך
4. **מספיק ל-Scale** - יישוב של כמה מאות משפחות
5. **SQL מלא** - דוחות ושאילתות מורכבות

### המלצה חלופית: Supabase

**מתי להעדיף:**
- אם רוצים Real-time מובנה
- אם רוצים Auth מוכן
- אם מוכנים לשלם $25/חודש

### אפשרות Hybrid: SQLite + Firebase Auth

**מתי להשתמש:**
- SQLite לנתונים
- Firebase Auth לאימות (Free tier מספיק)
- Socket.io לעדכונים חיים

---

## מימוש טכני - SQLite מומלץ

### מבנה הפרויקט

```
meitzad-nihul/
├── server/
│   ├── index.js              # Entry point
│   ├── database/
│   │   ├── db.js            # SQLite connection
│   │   ├── schema.sql       # טבלאות
│   │   └── migrations/      # שינויים לDB
│   ├── routes/
│   │   ├── auth.js          # אימות
│   │   ├── requests.js      # פניות
│   │   └── users.js         # משתמשים
│   └── services/
│       ├── realtime.js      # Socket.io
│       └── backup.js        # גיבוי אוטומטי
├── data/
│   ├── meitzad.db           # קובץ DB
│   └── backups/             # גיבויים
└── public/
    └── ...
```

### קוד ליצירת Real-time עם Socket.io

```javascript
// server/services/realtime.js
const { Server } = require('socket.io');

let io;

function initializeSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // הרשמה לעדכוני פניות
    socket.on('subscribe:requests', () => {
      socket.join('requests');
    });

    // הרשמה לפניות של משתמש ספציפי
    socket.on('subscribe:my-requests', (userId) => {
      socket.join(`user:${userId}`);
    });
  });

  return io;
}

// שליחת עדכון כשפנייה משתנה
function notifyRequestUpdate(request) {
  if (io) {
    // לכל מנהלי המערכת
    io.to('requests').emit('request:updated', request);

    // לתושב הספציפי
    io.to(`user:${request.user_id}`).emit('request:updated', request);
  }
}

module.exports = { initializeSocket, notifyRequestUpdate };
```

### גיבוי אוטומטי

```javascript
// server/services/backup.js
const fs = require('fs');
const path = require('path');
const { db } = require('../database/db');

const BACKUP_DIR = path.join(__dirname, '../../data/backups');

function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `meitzad-${timestamp}.db`);

  // יצירת גיבוי
  db.backup(backupPath)
    .then(() => {
      console.log(`Backup created: ${backupPath}`);
      cleanOldBackups();
    })
    .catch(err => console.error('Backup failed:', err));
}

function cleanOldBackups() {
  // שמירת 7 גיבויים אחרונים
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.db'))
    .sort()
    .reverse();

  files.slice(7).forEach(file => {
    fs.unlinkSync(path.join(BACKUP_DIR, file));
  });
}

// גיבוי יומי בחצות
const cron = require('node-cron');
cron.schedule('0 0 * * *', createBackup);

module.exports = { createBackup };
```

---

## סיכום

| לפרויקט מיצד | המלצה |
|--------------|--------|
| **בסיס נתונים** | SQLite (better-sqlite3) |
| **Real-time** | Socket.io |
| **Auth** | JWT + bcrypt (או Firebase Auth) |
| **גיבוי** | יומי אוטומטי + ידני |
| **עלות** | ~$5/חודש (VPS) |

### יתרונות הבחירה
1. פשטות - קל לתחזוקה
2. עלות נמוכה
3. שליטה מלאה בנתונים
4. ביצועים מעולים לגודל הפרויקט
5. קל למיגרציה בעתיד אם נדרש

---

*מסמך זה נוצר ב-2026-01-19*

## מקורות

- [Better-SQLite3 - The Fastest SQLite Library for Node.js](https://dev.to/lovestaco/understanding-better-sqlite3-the-fastest-sqlite-library-for-nodejs-4n8)
- [SQLite vs PostgreSQL Comparison](https://www.slant.co/versus/304/616/~sqlite_vs_postgresql)
- [Firebase Alternatives 2025](https://www.sashido.io/en/blog/firebase-alternatives-2025)
- [Supabase vs Firebase Comparison](https://www.leanware.co/insights/supabase-vs-firebase-complete-comparison-guide)
- [Self-Hosted Firebase Alternatives](https://www.nocobase.com/en/blog/open-source-firebase-alternatives)
- [Best Databases for Node.js](https://ably.com/blog/best-nodejs-databases)
