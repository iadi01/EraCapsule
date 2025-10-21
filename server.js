require('dotenv').config();

const express = require('express');
 const bodyParser = require('body-parser');
  const mongoose = require('mongoose');
 const nodemailer = require('nodemailer');
const path = require('path');


// add  MAAAANGO 
mongoose.connect(process.env.MONGO_URI)

  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

//MAAAONGO MODEL
const letterSchema = new mongoose.Schema

  ({  recipient_email: { type: String, required: true },
         subject: { type: String, default: 'A message from your past self' },
           message: { type: String, required: true },
         send_at: { type: Number, required: true },
      sent: { type: Boolean, default: false }
  });

const Letter = mongoose.model('Letter', letterSchema);

// Dakiya wla
const transporter = nodemailer.createTransport({
  service: "gmail", // 👈 Simple setup if using Gmail
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

transporter.verify()
  .then(() => console.log('📨 Mailer ready'))
  .catch(err => console.error('Mailer error:', err.message));

// =============== ROUTE: SCHEDULE LETTER ===============
app.post('/api/send-later', async (req, res) => {
  try {
    const { recipient_email, subject, message, send_at } = req.body;

    if (!recipient_email || !message || !send_at) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const sendAt = Number(send_at);
    if (isNaN(sendAt) || sendAt <= Date.now()) {
      return res.status(400).json({ error: 'Select a future time' });
    }

    const letter = new Letter({ recipient_email, subject, message, send_at: sendAt });
    await letter.save();

    console.log('📩 Scheduled mail ID:', letter._id);
    res.json({ ok: true, id: letter._id });
  } catch (err) {
    console.error('❌ Error scheduling:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// =============== MAIL CHECKER (CRON) ===============
async function checkAndSend() {
  const now = Date.now();
  console.log('⏰ Checking pending mails at', new Date(now).toLocaleTimeString());

  const letters = await Letter.find({ sent: false, send_at: { $lte: now } });
  if (!letters.length) return;

  console.log(`🚀 Sending ${letters.length} message(s)...`);

  for (const letter of letters) {
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: letter.recipient_email,
        subject: letter.subject,
        text: letter.message
      });

      console.log('✅ Mail sent to:', letter.recipient_email);
      letter.sent = true;
      await letter.save();
    } catch (err) {
      console.error('SendMail Error:', err);
    }
  }
}

// Check every 1 min
setInterval(checkAndSend, 60 * 1000);
setTimeout(checkAndSend, 5000);

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
