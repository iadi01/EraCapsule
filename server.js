require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// =============== DATABASE SETUP ===============
const db = new sqlite3.Database('./letters.db', (err) => {
  if (err) console.error('DB Error:', err);
  else console.log('✅ Connected to SQLite');
});

db.run(`CREATE TABLE IF NOT EXISTS letters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  send_at INTEGER NOT NULL,
  sent INTEGER DEFAULT 0
)`);

// =============== MAILER SETUP ===============
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

transporter.verify()
  .then(() => console.log('📨 Mailer ready'))
  .catch(err => console.error('Mailer error:', err.message));

// =============== ROUTES ===============
app.post('/api/send-later', (req, res) => {
  const { recipient_email, subject, message, send_at } = req.body;

  if (!recipient_email || !message || !send_at) {
    return res.status(400).json({ error: 'All fields required' });
  }

  const sendAt = Number(send_at);
  if (isNaN(sendAt) || sendAt <= Date.now()) {
    return res.status(400).json({ error: 'Select a future time' });
  }

  const stmt = db.prepare(
    `INSERT INTO letters (recipient_email, subject, message, send_at)
     VALUES (?, ?, ?, ?)`
  );
  stmt.run(recipient_email, subject || 'A message from your past self', message, sendAt, function (err) {
    if (err) {
      console.error('DB Insert Error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    console.log('📩 Scheduled mail ID:', this.lastID);
    res.json({ ok: true, id: this.lastID });
  });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// =============== MAIL CHECKER ===============
async function checkAndSend() {
  const now = Date.now();
  console.log('⏰ Checking pending mails at', new Date(now).toLocaleTimeString());

  db.all(`SELECT * FROM letters WHERE sent = 0 AND send_at <= ?`, [now], (err, rows) => {
    if (err) return console.error('DB Select Error:', err);
    if (rows.length === 0) return;

    console.log(`🚀 Sending ${rows.length} message(s)...`);
    rows.forEach((row) => {
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: row.recipient_email,
        subject: row.subject,
        text: row.message
      };

      transporter.sendMail(mailOptions, (err, info) => {
        if (err) return console.error('SendMail Error:', err);
        console.log('✅ Mail sent to:', row.recipient_email, info.response);
        db.run(`UPDATE letters SET sent = 1 WHERE id = ?`, [row.id]);
      });
    });
  });
}

// Run every 1 min
setInterval(checkAndSend, 60 * 1000);
setTimeout(checkAndSend, 5000);

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
