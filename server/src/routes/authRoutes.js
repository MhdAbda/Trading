/**
 * Authentication Routes
 * Handles user registration, login, profile management
 */

const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { authenticate } = require('../middleware/auth');

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, phoneNumber } = req.body;

    const user = await authService.register({
      username,
      email,
      password,
      phoneNumber
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: user
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post('/login', async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;

    const result = await authService.login(usernameOrEmail, password);

    res.json({
      success: true,
      message: 'Login successful',
      data: result
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/auth/profile
 * Get current user's profile (requires authentication)
 */
router.get('/profile', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      data: req.user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve profile'
    });
  }
});

/**
 * PUT /api/auth/profile
 * Update current user's profile (requires authentication)
 */
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { email, phoneNumber } = req.body;
    
    const updates = {};
    if (email !== undefined) updates.email = email;
    if (phoneNumber !== undefined) updates.phone_number = phoneNumber;

    const updatedUser = await authService.updateUser(req.user.id, updates);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auth/change-password
 * Change user's password (requires authentication)
 */
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Old password and new password are required'
      });
    }

    await authService.changePassword(req.user.id, oldPassword, newPassword);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auth/verify
 * Verify JWT token validity
 */
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token is required'
      });
    }

    const decoded = authService.verifyToken(token);
    const user = await authService.getUserById(decoded.userId);

    res.json({
      success: true,
      message: 'Token is valid',
      data: { user }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user (alias for /profile)
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      data: req.user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user data'
    });
  }
});
/**
 * POST /api/auth/demo
 * Get a demo token for testing without registration
 * Creates or retrieves a demo user account
 */
router.post('/demo', async (req, res) => {
  try {
    const demoUsername = 'demo_user';
    const demoEmail = 'demo@trading-bot.local';
    const demoPassword = 'demo_password_123';

    // Try to login with demo credentials
    try {
      const result = await authService.login(demoUsername, demoPassword);
      return res.json({
        success: true,
        message: 'Demo login successful',
        data: result
      });
    } catch (err) {
      // Demo user doesn't exist, create it
      if (err.message === 'Invalid credentials') {
        const newUser = await authService.register({
          username: demoUsername,
          email: demoEmail,
          password: demoPassword,
          phoneNumber: '+1-555-0100'
        });

        // Now login to get token
        const result = await authService.login(demoUsername, demoPassword);
        return res.json({
          success: true,
          message: 'Demo user created and logged in',
          data: result
        });
      }
      throw err;
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});
module.exports = router;
