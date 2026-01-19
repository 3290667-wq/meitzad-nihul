# פרויקט אתר ניהולי - יישוב מיצד

**שם קוד: meitzad-nihul**

## תיאור הפרויקט
אתר ניהולי מקיף ליישוב מיצד המשמש כמרכז שליטה ובקרה לוועד היישוב.

### תכונות עיקריות
- מערכת פניות תושבים (CRM)
- תיכלול תקשורת מרובת ערוצים (אימייל, WhatsApp, טופס)
- שליחה אוטומטית לקבוצת WhatsApp של ועד היישוב
- Dashboard ניהולי
- דוחות וסטטיסטיקות

## Tech Stack
- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Node.js + Express.js
- **Database**: SQLite (better-sqlite3)
- **Real-time**: Socket.io
- **Auth**: JWT + bcrypt

## מבנה הפרויקט
```
meitzad-nihul/
├── public/                    # Frontend - קבצים סטטיים
│   ├── index.html            # דף ראשי
│   ├── admin/                # ממשק ניהול
│   │   ├── dashboard.html    # לוח מחוונים
│   │   └── requests.html     # ניהול פניות
│   ├── citizen/              # ממשק תושב
│   │   ├── portal.html       # פורטל תושב
│   │   └── submit.html       # הגשת פנייה
│   ├── css/                  # עיצוב
│   │   └── styles.css
│   ├── js/                   # JavaScript
│   │   └── main.js
│   └── assets/images/
├── server/                   # Backend
│   ├── index.js             # Entry point
│   ├── routes/
│   │   ├── auth.js          # אימות
│   │   ├── requests.js      # API פניות
│   │   └── users.js         # API משתמשים
│   ├── services/
│   │   ├── email-service.js
│   │   ├── whatsapp-service.js
│   │   ├── realtime.js
│   │   └── backup.js
│   ├── database/
│   │   ├── db.js            # חיבור SQLite
│   │   └── schema.sql
│   └── middleware/
│       └── auth.js
├── data/
│   ├── meitzad.db           # קובץ בסיס הנתונים
│   └── backups/
├── config/                   # הגדרות (gitignored)
│   └── .env.example
├── package.json
├── CLAUDE.md                 # קובץ זה
├── RESEARCH.md              # מחקר עומק
└── DATABASE-COMPARISON.md    # השוואת בסיסי נתונים
```

## פקודות נפוצות
```bash
# התקנת dependencies
npm install

# הרצה בפיתוח
npm run dev

# הרצה בייצור
npm start

# גיבוי בסיס נתונים
npm run backup
```

## הגדרות סביבה (.env)
```
PORT=3000
JWT_SECRET=your-secret-key
ADMIN_EMAIL=admin@meitzad.org.il

# WhatsApp
WHATSAPP_GROUP_ID=your-group-id

# Email
SMTP_HOST=smtp.gmail.com
SMTP_USER=pniyot@meitzad.org.il
SMTP_PASS=your-app-password
```

## רמות הרשאה
- `super_admin` - מנהל ראשי (גישה מלאה)
- `admin` - חבר ועד (צפייה וטיפול בפניות)
- `staff` - מזכירות (טיפול בפניות)
- `citizen` - תושב (הגשה ומעקב)

## קטגוריות פניות
1. תשתיות
2. סביבה ונוף
3. בטחון ובטיחות
4. קהילה ורווחה
5. מינהל
6. חירום

## תיעוד נוסף
- `RESEARCH.md` - מחקר עומק על אתרי ניהול קהילתיים
- `DATABASE-COMPARISON.md` - השוואת אפשרויות בסיס נתונים

---

*נוצר: 2026-01-19*
