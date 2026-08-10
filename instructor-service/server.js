require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '2mb' }));

app.use(require('./routes/auth'));
app.use(require('./routes/courses'));
app.use(require('./routes/comments'));
app.use(require('./routes/submissions'));
app.use(require('./routes/earnings'));
app.use(require('./routes/upload'));
app.use(require('./routes/discountcodes'));

app.use(express.static(path.join(__dirname, 'public')));
app.get('/{*splat}', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found.' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.INSTRUCTOR_PORT || 4100;
app.listen(PORT, () => {
  console.log(`SP Tréner instructor portál beží na porte ${PORT}`);
});
