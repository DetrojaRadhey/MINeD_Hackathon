const express = require('express');
const path = require('path');
const apiRoutes = require('./routes/api');
const app = express();
const port = 8080 || 3000;

// Set up EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use('/public', express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api', apiRoutes);

// Render the upload form
app.get('/', (req, res) => {
  res.render('index');
});

// Handle form submission
app.post('/optimize', apiRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).send('Internal Server Error');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 