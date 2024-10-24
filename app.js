const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const cookieParser = require('cookie-parser');

const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));
app.use(cookieParser());

const JWT_SECRET = 'your_jwt_secret'; // Keep this secret in production
const MONGODB_URI = 'mongodb://localhost:27017/gr1';

// MongoDB Connection
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false // Disable deprecation warning
});

// MongoDB Models
const User = mongoose.model('User', new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
}));

const Genre = mongoose.model('Genre', new mongoose.Schema({
  name: String,
  books: [{ title: String, imageUrl: String }],
}));

const ReadingList = mongoose.model('ReadingList', new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  bookTitle: String,
  comment: String,
  rating: { type: Number, min: 1, max: 5 }, // Rating out of 5
}), 'coll4'); // Store in coll4 collection

// Prepopulate Genres and Books
const genres = [
  { name: 'Fiction', books: [{ title: 'The Great Gatsby', imageUrl: 'bookimg1.png' }, { title: '1984', imageUrl: 'D:\_SEM5_projects\wtv4\bookimg1.png' }] },
  { name: 'Mystery', books: [{ title: 'The Da Vinci Code', imageUrl: 'D:\_SEM5_projects\wtv4\bookimg1.png' }, { title: 'Gone Girl', imageUrl: 'D:\_SEM5_projects\wtv4\bookimg1.png' }] },
  { name: 'Romance', books: [{ title: 'Pride and Prejudice', imageUrl: 'D:\_SEM5_projects\wtv4\bookimg1.png' }, { title: 'Me Before You', imageUrl: 'D:\_SEM5_projects\wtv4\bookimg1.png' }] },
  { name: 'Drama', books: [{ title: 'Death of a Salesman', imageUrl: 'D:\_SEM5_projects\wtv4\bookimg1.png' }, { title: 'A Streetcar Named Desire', imageUrl: 'D:\_SEM5_projects\wtv4\bookimg1.png' }] },
  { name: 'Sci-Fi', books: [{ title: 'Dune', imageUrl: 'D:\_SEM5_projects\wtv4\bookimg1.png' }, { title: 'Ender\'s Game', imageUrl: 'D:\_SEM5_projects\wtv4\bookimg1.png' }] },
];

Genre.find({}).then(existingGenres => {
  if (existingGenres.length === 0) {
    Genre.insertMany(genres);
  }
});

// Root Route
app.get('/', (req, res) => {
  res.redirect('/login'); // Redirect to login page by default
});

// Signup Routes
app.get('/signup', (req, res) => {
  res.render('signup');
});

app.post('/signup', [
  check('username', 'Username is required').notEmpty(),
  check('password', 'Password should be 6 characters or more').isLength({ min: 6 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('signup', { errors: errors.array() });
  }

  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    await new User({ username, password: hashedPassword }).save();
    res.redirect('/login');
  } catch (err) {
    res.render('signup', { errors: [{ msg: 'User already exists' }] });
  }
});

// Login Routes
app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.render('login', { errors: [{ msg: 'Invalid credentials' }] });
  }

  const token = jwt.sign({ userId: user._id }, JWT_SECRET);
  res.cookie('token', token, { httpOnly: true }).redirect('/dashboard');
});

// Middleware to Protect Routes
function auth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.redirect('/login');

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded.userId;
    next();
  } catch (err) {
    res.redirect('/login');
  }
}

// Dashboard Route
app.get('/dashboard', auth, async (req, res) => {
  const genres = await Genre.find({});
  const readingList = await ReadingList.find({ userId: req.user });
  res.render('dashboard', { genres, readingList });
});

// Select Genre and Show Book Recommendations
app.post('/select-genre', auth, async (req, res) => {
  const { genre } = req.body;
  const selectedGenre = await Genre.findOne({ name: genre });
  res.render('recommendations', { books: selectedGenre.books, selectedGenre: genre });
});

// Add to Reading List
app.post('/add-to-list', auth, async (req, res) => {
  const { bookTitle } = req.body;
  await new ReadingList({ userId: req.user, bookTitle }).save();
  res.redirect('/dashboard');
});

// Remove from Reading List
app.post('/remove-from-list', auth, async (req, res) => {
  await ReadingList.findOneAndDelete({ userId: req.user, bookTitle: req.body.bookTitle });
  res.redirect('/dashboard');
});

// Add Review/Comment
app.post('/add-review', auth, async (req, res) => {
  const { bookTitle, comment, rating } = req.body;
  await ReadingList.findOneAndUpdate(
    { userId: req.user, bookTitle },
    { comment, rating },
    { new: true } // Return the updated document
  );
  res.redirect('/dashboard');
});

// Sign Out
app.post('/signout', (req, res) => {
  res.clearCookie('token').redirect('/login');
});

// Listen to Port
app.listen(3000, () => {
  console.log('Server started on http://localhost:3000');
});
