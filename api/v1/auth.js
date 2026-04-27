import express from 'express';
import cors from 'cors';
import axios from 'axios';
import crypto from 'crypto';
import {
  generatePKCE,
  verifyPKCEChallenge,
  generateTokens,
  generateOAuthState,
} from '../../lib/auth.js';
import {
  createOrUpdateUser,
  getUserByGithubId,
  storeToken,
} from '../../lib/db-extended.js';

const router = express.Router();
router.use(cors());
router.use(express.json());

const oauthStates = new Map();
const pkceStore = new Map();

// Initiate OAuth flow with PKCE
router.get('/oauth/initiate', (req, res) => {
  try {
    const { codeVerifier, codeChallenge } = generatePKCE();
    const state = generateOAuthState();

    oauthStates.set(state, { timestamp: Date.now() });
    pkceStore.set(state, codeVerifier);

    const authUrl = new URL(`${process.env.GITHUB_OAUTH_URL}/authorize`);
    authUrl.searchParams.append('client_id', process.env.GITHUB_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', process.env.GITHUB_REDIRECT_URI);
    authUrl.searchParams.append('scope', 'user:email');
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('allow_signup', 'true');

    res.json({
      status: 'success',
      authorization_url: authUrl.toString(),
      state,
    });
  } catch (error) {
    console.error('OAuth initiate error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to initiate OAuth' });
  }
});

// OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({ status: 'error', message: 'Missing code or state' });
    }

    // Verify state
    const stateData = oauthStates.get(state);
    if (!stateData || Date.now() - stateData.timestamp > 600000) {
      return res.status(400).json({ status: 'error', message: 'Invalid or expired state' });
    }

    // Exchange code for token
    const tokenResponse = await axios.post(
      `${process.env.GITHUB_OAUTH_URL}/access_token`,
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_REDIRECT_URI,
      },
      { headers: { Accept: 'application/json' } }
    );

    const { access_token } = tokenResponse.data;
    if (!access_token) {
      return res.status(400).json({ status: 'error', message: 'Failed to get access token' });
    }

    // Get GitHub user info
    const userResponse = await axios.get(`${process.env.GITHUB_API_URL}/user`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const githubUser = userResponse.data;

    // Create or update user in database
    const user = await createOrUpdateUser(githubUser);

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);

    // Store token hash
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await storeToken(user.id, tokenHash, 'refresh', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

    // Clean up
    oauthStates.delete(state);
    pkceStore.delete(state);

    res.json({
      status: 'success',
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ status: 'error', message: 'OAuth callback failed' });
  }
});

// Refresh token
router.post('/refresh', (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ status: 'error', message: 'Refresh token required' });
    }

    // Verify and decode refresh token
    const decoded = verifyRefreshToken(refresh_token);
    if (!decoded) {
      return res.status(401).json({ status: 'error', message: 'Invalid refresh token' });
    }

    // Generate new access token
    const newAccessToken = generateTokens({ id: decoded.sub, username: decoded.username }).accessToken;

    res.json({
      status: 'success',
      access_token: newAccessToken,
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ status: 'error', message: 'Token refresh failed' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  res.json({ status: 'success', message: 'Logged out successfully' });
});

export default router;
