/**
 * Authentication Service
 * Handles user registration, login, and authentication logic
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../utils/db');
const config = require('../config/env');

const SALT_ROUNDS = 10;

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @param {string} userData.username - Username
 * @param {string} userData.email - Email address
 * @param {string} userData.password - Plain text password
 * @param {string} userData.phoneNumber - Phone number (optional)
 * @returns {Promise<Object>} Created user (without password)
 */
const register = async ({ username, email, password, phoneNumber }) => {
  try {
    // Validate input
    if (!username || !email || !password) {
      throw new Error('Username, email, and password are required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // Validate password strength (minimum 8 characters)
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('Username or email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert user
    const result = await db.query(
      `INSERT INTO users (username, email, password_hash, phone_number)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, email, phone_number, created_at`,
      [username, email, passwordHash, phoneNumber || null]
    );

    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

/**
 * Authenticate user and generate JWT token
 * @param {string} usernameOrEmail - Username or email
 * @param {string} password - Plain text password
 * @returns {Promise<Object>} User data and JWT token
 */
const login = async (usernameOrEmail, password) => {
  try {
    // Validate input
    if (!usernameOrEmail || !password) {
      throw new Error('Username/email and password are required');
    }

    // Find user by username or email
    const result = await db.query(
      'SELECT * FROM users WHERE username = $1 OR email = $1',
      [usernameOrEmail]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username,
        email: user.email 
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );


    // Return user data (without password) and token
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phoneNumber: user.phone_number,
        createdAt: user.created_at
      }
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Get user by ID
 * @param {number} userId - User ID
 * @returns {Promise<Object>} User data (without password)
 */
const getUserById = async (userId) => {
  try {
    const result = await db.query(
      'SELECT id, username, email, phone_number, created_at, updated_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return {
      id: result.rows[0].id,
      username: result.rows[0].username,
      email: result.rows[0].email,
      phoneNumber: result.rows[0].phone_number,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Update user profile
 * @param {number} userId - User ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated user data
 */
const updateUser = async (userId, updates) => {
  try {
    const allowedFields = ['email', 'phone_number'];
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    // Build dynamic UPDATE query
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updateFields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(userId);
    const query = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, username, email, phone_number, created_at, updated_at
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return {
      id: result.rows[0].id,
      username: result.rows[0].username,
      email: result.rows[0].email,
      phoneNumber: result.rows[0].phone_number,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Change user password
 * @param {number} userId - User ID
 * @param {string} oldPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<boolean>} Success status
 */
const changePassword = async (userId, oldPassword, newPassword) => {
  try {
    // Get user with password
    const result = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    // Verify old password
    const isValidPassword = await bcrypt.compare(oldPassword, result.rows[0].password_hash);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password
    await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, userId]
    );

    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object} Decoded token payload
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

module.exports = {
  register,
  login,
  getUserById,
  updateUser,
  changePassword,
  verifyToken
};
