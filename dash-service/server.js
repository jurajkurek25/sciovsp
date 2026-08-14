require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.use(require('./routes/auth'));
app.use(require('./routes/overview'));
app.use(require('./routes/academy'));
app.use(require('./routes/giftcards'));
app.use(require('./routes/payouts'));
app.use(require('./routes/instructorpayouts'));
app.use(require('./routes/discountcodes'));
app.use(require('./routes/instructors'));
app.use(require('./routes/bugs'));
app.use(require('./routes/advisor'));
app.use(require('./routes/aiops'));
app.use(require('./routes/trends'));
app.use(require('./routes/courses'));
app.use(require('./routes/blog'));
app.use(require('./routes/upload'));
app.use(require('./routes/ads'));
app.use(require('./routes/giftcardsales'));
app.use(require('./routes/webinar'));
app.use(require('./routes/maintenance'));
app.use(require('./routes/reviews'));

app.use(express.static(path.join(__dirname, 'public')));
app.get('/{*splat}', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found.' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.DASH_PORT || 4000;
app.listen(PORT, () => {
  console.log(`SP Tréner dash beží na porte ${PORT}`);
});
