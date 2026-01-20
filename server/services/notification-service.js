const nodemailer = require('nodemailer');
const { createNotification, updateNotificationStatus, getSetting } = require('../database/db');

// Email transporter (configured via environment variables)
let emailTransporter = null;

function initializeEmailTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    console.log('Email transporter initialized');
  } else {
    console.log('Email transporter not configured (missing SMTP settings)');
  }
}

// Initialize on module load
initializeEmailTransporter();

// Format request for display
function formatRequestForNotification(request) {
  const statusMap = {
    new: 'חדש',
    in_progress: 'בטיפול',
    pending: 'ממתין',
    resolved: 'נפתר',
    closed: 'סגור'
  };

  const priorityMap = {
    low: 'נמוכה',
    normal: 'רגילה',
    high: 'גבוהה',
    urgent: 'דחופה'
  };

  return {
    ...request,
    statusHe: statusMap[request.status] || request.status,
    priorityHe: priorityMap[request.priority] || request.priority
  };
}

// Send email notification
async function sendEmail(to, subject, html) {
  if (!emailTransporter) {
    console.log('Email not sent - transporter not configured');
    return false;
  }

  try {
    await emailTransporter.sendMail({
      from: process.env.SMTP_FROM || '"מערכת פניות מיצד" <pniyot@meitzad.org.il>',
      to,
      subject,
      html
    });
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

// Send WhatsApp notification via bridge (if configured)
async function sendWhatsAppToGroup(message) {
  const whatsappEnabled = getSetting.get('whatsapp_notifications');
  if (!whatsappEnabled || whatsappEnabled.value !== 'true') {
    return false;
  }

  const groupId = process.env.WHATSAPP_GROUP_ID;
  const bridgeUrl = process.env.WHATSAPP_BRIDGE_URL || 'http://localhost:3001';

  if (!groupId) {
    console.log('WhatsApp not sent - group ID not configured');
    return false;
  }

  try {
    const response = await fetch(`${bridgeUrl}/api/send-group`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId,
        message
      })
    });

    return response.ok;
  } catch (error) {
    console.error('WhatsApp send error:', error);
    return false;
  }
}

// Send notification for new request
async function sendNewRequestNotification(request) {
  const formatted = formatRequestForNotification(request);

  // 1. Send email confirmation to submitter
  const emailEnabled = getSetting.get('email_notifications');
  if (emailEnabled && emailEnabled.value === 'true' && request.submitter_email) {
    const emailSubject = `פנייה מספר ${request.request_number} התקבלה`;
    const emailHtml = `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>הפנייה שלך התקבלה בהצלחה</h2>

        <p>שלום ${request.submitter_name},</p>

        <p>תודה על פנייתך. להלן פרטי הפנייה:</p>

        <table style="border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>מספר פנייה:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${request.request_number}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>נושא:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${request.subject}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>קטגוריה:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${request.category_name || ''}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>סטטוס:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${formatted.statusHe}</td>
          </tr>
        </table>

        <p>תוכל/י לעקוב אחרי סטטוס הפנייה באמצעות מספר הפנייה.</p>

        <p>בברכה,<br>צוות מערכת הפניות - יישוב מיצד</p>
      </div>
    `;

    // Record notification
    const notifResult = createNotification.run({
      request_id: request.id,
      user_id: request.user_id,
      type: 'email',
      recipient: request.submitter_email,
      subject: emailSubject,
      content: emailHtml,
      status: 'pending'
    });

    const sent = await sendEmail(request.submitter_email, emailSubject, emailHtml);

    updateNotificationStatus.run({
      id: notifResult.lastInsertRowid,
      status: sent ? 'sent' : 'failed',
      error: sent ? null : 'Failed to send email'
    });
  }

  // 2. Send WhatsApp to committee group
  const whatsappMessage = `
📬 *פנייה חדשה #${request.request_number}*

👤 *מגיש:* ${request.submitter_name}
📧 *אימייל:* ${request.submitter_email}
📱 *טלפון:* ${request.submitter_phone || 'לא צוין'}

📂 *קטגוריה:* ${request.category_icon || ''} ${request.category_name || ''}
📋 *נושא:* ${request.subject}
📍 *מיקום:* ${request.location || 'לא צוין'}
⚡ *דחיפות:* ${formatted.priorityHe}

📝 *תיאור:*
${request.description ? request.description.substring(0, 300) : 'ללא תיאור'}${request.description && request.description.length > 300 ? '...' : ''}

⏰ ${new Date().toLocaleString('he-IL')}
  `.trim();

  // Record WhatsApp notification
  const whatsappNotifResult = createNotification.run({
    request_id: request.id,
    user_id: null,
    type: 'whatsapp',
    recipient: 'vaad_group',
    subject: `פנייה חדשה #${request.request_number}`,
    content: whatsappMessage,
    status: 'pending'
  });

  const whatsappSent = await sendWhatsAppToGroup(whatsappMessage);

  updateNotificationStatus.run({
    id: whatsappNotifResult.lastInsertRowid,
    status: whatsappSent ? 'sent' : 'failed',
    error: whatsappSent ? null : 'Failed to send WhatsApp message'
  });

  return {
    email: emailEnabled && emailEnabled.value === 'true',
    whatsapp: whatsappSent
  };
}

// Send notification for status change
async function sendStatusChangeNotification(request, oldStatus, newStatus) {
  const formatted = formatRequestForNotification({ ...request, status: newStatus });

  const statusMapHe = {
    new: 'חדש',
    in_progress: 'בטיפול',
    pending: 'ממתין',
    resolved: 'נפתר',
    closed: 'סגור'
  };

  // Send email to submitter
  if (request.submitter_email) {
    const emailSubject = `עדכון בפנייה ${request.request_number}`;
    const emailHtml = `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>עדכון סטטוס בפנייה שלך</h2>

        <p>שלום ${request.submitter_name},</p>

        <p>חל עדכון בסטטוס הפנייה שלך:</p>

        <table style="border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>מספר פנייה:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${request.request_number}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>נושא:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${request.subject}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>סטטוס קודם:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${statusMapHe[oldStatus]}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>סטטוס חדש:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd; color: #2e7d32;"><strong>${statusMapHe[newStatus]}</strong></td>
          </tr>
        </table>

        ${newStatus === 'resolved' ? '<p style="color: #2e7d32;">הפנייה שלך טופלה בהצלחה!</p>' : ''}

        <p>בברכה,<br>צוות מערכת הפניות - יישוב מיצד</p>
      </div>
    `;

    await sendEmail(request.submitter_email, emailSubject, emailHtml);
  }
}

module.exports = {
  sendNewRequestNotification,
  sendStatusChangeNotification,
  sendEmail,
  sendWhatsAppToGroup,
  initializeEmailTransporter
};
