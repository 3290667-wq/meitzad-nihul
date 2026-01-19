# תיעוד העלאה ל-GitHub ו-Render

## תאריך: 2026-01-19

## סטטוס כללי: בתהליך

---

## שלב 1: בדיקת מבנה הפרויקט ✅
- [x] פרויקט Node.js עם Express
- [x] קיים `package.json` עם כל ה-dependencies
- [x] קיים `.gitignore` תקין
- [x] קיים `render.yaml` מוכן להעלאה
- [x] git repository מקומי קיים עם commit אחד

**מבנה הפרויקט:**
```
meitzad-nihul/
├── public/          # Frontend
├── server/          # Backend (Express)
├── data/            # Database (SQLite)
├── config/          # Configuration
├── package.json
├── render.yaml      # Render configuration
└── CLAUDE.md
```

---

## שלב 2: העלאה ל-GitHub 🔄
**סטטוס:** ממתין ל-GitHub token

### מה נדרש:
1. יצירת repository חדש בשם `meitzad-nihul`
2. הוספת remote origin
3. Push של הקוד

### פקודות להרצה לאחר קבלת token:
```bash
# יצירת repo ו-push
git remote add origin https://github.com/USERNAME/meitzad-nihul.git
git branch -M main
git push -u origin main
```

---

## שלב 3: העלאה ל-Render ⏳
**סטטוס:** ממתין להשלמת שלב 2

### הגדרות Render (מתוך render.yaml):
- **שם השירות:** meitzad-nihul
- **Runtime:** Node.js
- **Region:** Frankfurt
- **Plan:** Free
- **Disk:** 1GB for SQLite data

### משתני סביבה נדרשים:
- `JWT_SECRET` - מפתח סודי ל-JWT
- `ADMIN_EMAIL` - מייל מנהל
- `WHATSAPP_GROUP_ID` - מזהה קבוצת WhatsApp
- `WHATSAPP_BRIDGE_URL` - כתובת גשר WhatsApp
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` - הגדרות מייל

---

## הערות

### התאמות נדרשות לפני העלאה לייצור:
1. לוודא שנתיב ה-database ב-server מצביע ל-`/var/data/meitzad.db` בסביבת Render
2. להגדיר את כל משתני הסביבה ב-Render Dashboard

---

*עדכון אחרון: 2026-01-19*
