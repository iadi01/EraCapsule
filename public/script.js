const form = document.getElementById('letterForm');
const status = document.getElementById('status');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  status.textContent = 'Scheduling your letter...';
  status.className = 'info';

  const data = {
    recipient_email: form.email.value,
    subject: form.subject.value,
    message: form.message.value,
    send_at: new Date(form.date.value).getTime()
  };

  try {
    const res = await fetch('/api/send-later', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await res.json();
    if (result.ok) {
      status.textContent = '✅ Your letter is scheduled successfully!';
      status.className = 'success';
      form.reset();
    } else {
      throw new Error(result.error || 'Unknown error');
    }
  } catch (err) {
    status.textContent = '❌ Failed to schedule. Please try again.';
    status.className = 'error';
    console.error(err);
  }
});
