// Express is a framework for building APIs and web apps
// See also: https://expressjs.com/
import express from 'express'
// Initialize Express app
const app = express()

// New Changes
import pkg from 'express-openid-connect';
const { auth, requiresAuth } = pkg;
const config = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.secret,
  baseURL: 'http://localhost:3001',
  clientID: 'qjgg6QHCXOg71MEqsbSFbWtXJK8glyMQ',
  issuerBaseURL: 'https://dev-qdsz7zdlvmzuofqu.ca.auth0.com'
};

app.use(express.static('public'));

// req.isAuthenticated is provided from the auth router
// auth router attaches /login, /logout, and /callback routes to the baseURL
app.use(auth(config));

app.get('/', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

app.get('/login', (req, res) => {
  res.oidc.login();
});

// Serve profile page
app.get('/userprofile', requiresAuth(), (req, res) => {
  res.sendFile('profile.html', { root: 'public' });
});

// API endpoint for fetching user profile as JSON
app.get('/profile', requiresAuth(), (req, res) => {
  res.send(JSON.stringify(req.oidc.user));
});
// End of New Changes

// Enable express to parse JSON data
app.use(express.json())

// Our API is defined in a separate module to keep things tidy.
// Let's import our API endpoints and activate them.
import apiRoutes from './routes/api.js'
app.use('/', apiRoutes)


const port = 3001
app.listen(port, () => {
    console.log(`Express is live at http://localhost:${port}`)
})
