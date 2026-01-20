# מערכת ניהול יישוב מיצד - קובץ זיכרון

## פרטי התחברות למנהלים

### משתמש ראשי (Super Admin)
```
אימייל: admin@meitzad.org.il
סיסמה: [יש להגדיר ב-Firebase Console]
תפקיד: super_admin
```

### משתמש מנהל נוסף
```
אימייל: manager@meitzad.org.il
סיסמה: [יש להגדיר ב-Firebase Console]
תפקיד: admin
```

---

## הגדרות Firebase נדרשות

### 1. יצירת פרויקט Firebase

1. כנס ל-[Firebase Console](https://console.firebase.google.com)
2. צור פרויקט חדש בשם `meitzad-nihul`
3. הפעל את השירותים הבאים:
   - **Authentication** - עם אימות Email/Password
   - **Realtime Database** - באזור `europe-west1`
   - **Storage** - לאחסון קבצים

### 2. עדכון הגדרות Firebase בקוד

ערוך את הקובץ `/public/js/firebase-config.js` והחלף את הערכים:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "meitzad-nihul.firebaseapp.com",
  databaseURL: "https://meitzad-nihul-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "meitzad-nihul",
  storageBucket: "meitzad-nihul.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 3. הגדרת חוקי מסד נתונים

צור קובץ `database.rules.json`:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid || root.child('users').child(auth.uid).child('role').val() === 'super_admin'",
        ".write": "$uid === auth.uid || root.child('users').child(auth.uid).child('role').val() === 'super_admin'"
      }
    },
    "settings": {
      ".read": "auth != null",
      ".write": "root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('role').val() === 'super_admin'"
    },
    "inquiries": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "meetings": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "employees": {
      ".read": "auth != null",
      ".write": "root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('role').val() === 'super_admin'"
    },
    "transactions": {
      ".read": "auth != null",
      ".write": "root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('role').val() === 'super_admin'"
    },
    "projects": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "protocols": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "attendance": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

### 4. יצירת משתמש ראשי

ב-Firebase Console:
1. לך ל-Authentication > Users
2. הוסף משתמש חדש עם האימייל והסיסמה הרצויים
3. העתק את ה-UID
4. לך ל-Realtime Database
5. צור נתיב `users/{UID}` עם המבנה:

```json
{
  "email": "admin@meitzad.org.il",
  "name": "מנהל ראשי",
  "role": "super_admin",
  "active": true,
  "createdAt": 1705747200000
}
```

---

## אינטגרציות חיצוניות

### 1. אינטגרציית Email (Gmail)

לקבלת פניות תושבים אוטומטית מהמייל:

#### שלב א - הגדרת Gmail

1. כנס ל-[Google Cloud Console](https://console.cloud.google.com)
2. צור פרויקט חדש או השתמש בקיים
3. הפעל את Gmail API
4. צור OAuth 2.0 Credentials
5. הגדר את ה-Redirect URI

#### שלב ב - יצירת Cloud Function

צור Cloud Function שמאזינה לאימיילים חדשים:

```javascript
// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const {google} = require('googleapis');

admin.initializeApp();

exports.processIncomingEmail = functions.pubsub
  .topic('incoming-emails')
  .onPublish(async (message) => {
    const emailData = JSON.parse(Buffer.from(message.data, 'base64').toString());

    // Parse email and create inquiry
    await admin.database().ref('inquiries').push({
      subject: emailData.subject,
      content: emailData.body,
      senderEmail: emailData.from,
      senderName: extractName(emailData.from),
      status: 'new',
      source: 'email',
      createdAt: Date.now()
    });

    // Send WhatsApp notification (if configured)
    // await sendWhatsAppNotification(emailData);
  });
```

#### שלב ג - הגדרת Gmail Push Notifications

1. צור Pub/Sub topic בשם `incoming-emails`
2. הגדר Gmail Watch על התיבה הרצויה
3. כל מייל חדש יפעיל את ה-Cloud Function

### 2. אינטגרציית WhatsApp

#### אפשרות א - WhatsApp Business API (מומלץ לייצור)

1. צור חשבון ב-[WhatsApp Business Platform](https://business.whatsapp.com)
2. קבל Access Token
3. הוסף לקובץ ההגדרות:

```javascript
// settings/integrations
{
  "whatsapp": {
    "enabled": true,
    "accessToken": "YOUR_ACCESS_TOKEN",
    "phoneNumberId": "YOUR_PHONE_NUMBER_ID",
    "businessAccountId": "YOUR_BA_ID"
  }
}
```

#### אפשרות ב - WhatsApp Web Link (פתרון פשוט)

המערכת משתמשת כברירת מחדל בקישור ישיר:
```javascript
// פותח את WhatsApp עם הודעה מוכנה
window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`);
```

### 3. אינטגרציית תמלול ישיבות

#### Otter.ai

1. צור חשבון ב-[Otter.ai](https://otter.ai)
2. קבל API Key (דורש תוכנית עסקית)
3. הוסף להגדרות:

```javascript
{
  "transcription": {
    "enabled": true,
    "service": "otter",
    "apiKey": "YOUR_OTTER_API_KEY"
  }
}
```

#### Fireflies.ai (חלופה)

1. צור חשבון ב-[Fireflies.ai](https://fireflies.ai)
2. קבל API Key
3. עדכן את ההגדרות בהתאם

#### Google Cloud Speech-to-Text (פתרון עצמאי)

```javascript
// Cloud Function לתמלול
exports.transcribeAudio = functions.storage
  .object()
  .onFinalize(async (object) => {
    if (!object.contentType.startsWith('audio/')) return;

    const speech = require('@google-cloud/speech');
    const client = new speech.SpeechClient();

    const [response] = await client.recognize({
      config: {
        encoding: 'LINEAR16',
        languageCode: 'he-IL',
      },
      audio: { uri: `gs://${object.bucket}/${object.name}` }
    });

    // Save transcription to database
    // ...
  });
```

### 4. אינטגרציית יומן Google

1. הפעל Google Calendar API ב-Google Cloud Console
2. צור Service Account
3. שתף את היומן עם ה-Service Account
4. הוסף להגדרות:

```javascript
{
  "calendar": {
    "enabled": true,
    "calendarId": "YOUR_CALENDAR_ID@group.calendar.google.com",
    "serviceAccountKey": "path/to/service-account.json"
  }
}
```

---

## מבנה מסד הנתונים

```
meitzad-nihul/
├── users/
│   └── {uid}/
│       ├── email
│       ├── name
│       ├── role (super_admin/admin/editor/viewer)
│       ├── phone
│       ├── settings/
│       │   ├── darkMode
│       │   └── notifications/
│       └── active
│
├── settings/
│   ├── system/
│   │   ├── name
│   │   ├── email
│   │   ├── phone
│   │   └── address
│   └── integrations/
│       ├── whatsapp/
│       ├── email/
│       ├── calendar/
│       └── transcription/
│
├── inquiries/
│   └── {inquiryId}/
│       ├── subject
│       ├── content
│       ├── category
│       ├── status (new/in_progress/resolved/closed)
│       ├── priority
│       ├── senderName
│       ├── senderPhone
│       ├── senderEmail
│       ├── source (web/email/whatsapp)
│       ├── assignedTo
│       ├── createdAt
│       └── updates[]
│
├── meetings/
│   └── {meetingId}/
│       ├── title
│       ├── date
│       ├── location
│       ├── type
│       ├── agenda
│       ├── participants
│       ├── hasProtocol
│       └── protocolId
│
├── protocols/
│   └── {protocolId}/
│       ├── meetingId
│       ├── meetingDate
│       ├── meetingType
│       ├── participants
│       ├── content
│       ├── audioUrl
│       ├── status
│       └── createdAt
│
├── employees/
│   └── {employeeId}/
│       ├── name
│       ├── id_number
│       ├── position
│       ├── department
│       ├── phone
│       ├── email
│       ├── start_date
│       ├── employment_type
│       ├── salary
│       ├── status
│       ├── sendAttendanceNotifications
│       └── notes
│
├── attendance/
│   └── {recordId}/
│       ├── employeeId
│       ├── date
│       ├── checkIn
│       ├── checkOut
│       └── createdBy
│
├── transactions/
│   └── {transactionId}/
│       ├── date
│       ├── description
│       ├── category
│       ├── amount
│       ├── type (income/expense)
│       └── createdBy
│
└── projects/
    └── {projectId}/
        ├── name
        ├── category
        ├── description
        ├── start_date
        ├── end_date
        ├── budget
        ├── priority
        ├── status
        ├── owner
        └── milestones[]
```

---

## פריסה ל-Firebase Hosting

### שלב א - התקנת Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

### שלב ב - אתחול הפרויקט

```bash
cd meitzad-nihul
firebase init

# בחר:
# - Hosting
# - Realtime Database
# - Storage

# הגדר:
# - Public directory: public
# - Single-page app: Yes
```

### שלב ג - פריסה

```bash
firebase deploy
```

---

## רשימת משימות להשלמה

### חובה לפני השקה:
- [ ] עדכון API Keys ב-firebase-config.js
- [ ] יצירת משתמש ראשי ב-Firebase Auth
- [ ] הגדרת Database Rules
- [ ] הגדרת Storage Rules
- [ ] בדיקת כל הפונקציות

### אופציונלי (המלצות):
- [ ] הגדרת Cloud Functions לעיבוד מיילים
- [ ] חיבור WhatsApp Business API
- [ ] חיבור שירות תמלול (Otter.ai/Fireflies)
- [ ] הגדרת Google Calendar API
- [ ] הגדרת גיבוי אוטומטי
- [ ] הגדרת Custom Domain

---

## פתרון בעיות נפוצות

### שגיאת CORS
הוסף את הדומיין לרשימת המורשים ב-Firebase Console > Authentication > Settings > Authorized domains

### שגיאת Permission Denied
וודא שחוקי מסד הנתונים מוגדרים נכון וש-auth.uid קיים

### בעיית התחברות
1. וודא שה-API Key תקין
2. וודא שהמשתמש קיים ב-Firebase Auth
3. בדוק את ה-Console לשגיאות

---

## תמיכה ועדכונים

- גרסה נוכחית: 1.0.0
- תאריך בנייה: 2026-01-20
- מפתח: Claude Code

לשאלות נוספות או בעיות, צור קשר עם צוות הפיתוח.
