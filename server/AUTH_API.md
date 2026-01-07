# Authentication API Documentation

## Overview

The trading bot backend now includes a complete user authentication system with JWT-based authentication, user registration, login, and profile management.

## Database Setup

Before using the authentication endpoints, make sure you've initialized the database:

```bash
cd database
npm install
npm run init
```

## Server Setup

1. **Install Dependencies**:
   ```bash
   cd server
   npm install
   ```

2. **Configure Environment Variables**:
   Update the `.env` file with your database credentials and JWT secret:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgre
   DB_PASSWORD=password
   DB_NAME=trading_bot_db
   JWT_SECRET=your-super-secret-key-change-in-production
   JWT_EXPIRES_IN=7d
   ```

3. **Start Server**:
   ```bash
   npm start
   ```

## API Endpoints

### Public Endpoints (No Authentication Required)

#### 1. Register New User

**Endpoint**: `POST /api/auth/register`

**Request Body**:
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securePassword123",
  "phoneNumber": "+1234567890"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "phone_number": "+1234567890",
    "created_at": "2026-01-02T10:30:00.000Z"
  }
}
```

**Validation Rules**:
- `username`: Required, must be unique
- `email`: Required, must be unique and valid email format
- `password`: Required, minimum 8 characters
- `phoneNumber`: Optional

---

#### 2. Login

**Endpoint**: `POST /api/auth/login`

**Request Body**:
```json
{
  "usernameOrEmail": "johndoe",
  "password": "securePassword123"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "johndoe",
      "email": "john@example.com",
      "phoneNumber": "+1234567890",
      "createdAt": "2026-01-02T10:30:00.000Z"
    }
  }
}
```

**Note**: Save the `token` value and use it in the `Authorization` header for protected routes.

---

#### 3. Verify Token

**Endpoint**: `POST /api/auth/verify`

**Request Body**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Token is valid",
  "data": {
    "user": {
      "id": 1,
      "username": "johndoe",
      "email": "john@example.com",
      "phoneNumber": "+1234567890",
      "createdAt": "2026-01-02T10:30:00.000Z",
      "updatedAt": "2026-01-02T10:30:00.000Z"
    }
  }
}
```

---

### Protected Endpoints (Require Authentication)

All protected endpoints require a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <your-token-here>
```

#### 4. Get User Profile

**Endpoint**: `GET /api/auth/profile`

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "phoneNumber": "+1234567890",
    "createdAt": "2026-01-02T10:30:00.000Z",
    "updatedAt": "2026-01-02T10:30:00.000Z"
  }
}
```

**Alternative Endpoint**: `GET /api/auth/me` (same functionality)

---

#### 5. Update Profile

**Endpoint**: `PUT /api/auth/profile`

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body** (all fields optional):
```json
{
  "email": "newemail@example.com",
  "phoneNumber": "+9876543210"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": 1,
    "username": "johndoe",
    "email": "newemail@example.com",
    "phoneNumber": "+9876543210",
    "createdAt": "2026-01-02T10:30:00.000Z",
    "updatedAt": "2026-01-02T11:00:00.000Z"
  }
}
```

**Note**: Username cannot be changed after registration.

---

#### 6. Change Password

**Endpoint**: `POST /api/auth/change-password`

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body**:
```json
{
  "oldPassword": "securePassword123",
  "newPassword": "newSecurePassword456"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Validation**:
- `newPassword` must be at least 8 characters
- `oldPassword` must match current password

---

## Using cURL Examples

### Register a User
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123",
    "phoneNumber": "+1234567890"
  }'
```

### Login
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "usernameOrEmail": "testuser",
    "password": "password123"
  }'
```

### Get Profile (with token)
```bash
curl http://localhost:4000/api/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Update Profile
```bash
curl -X PUT http://localhost:4000/api/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newemail@example.com",
    "phoneNumber": "+9876543210"
  }'
```

### Change Password
```bash
curl -X POST http://localhost:4000/api/auth/change-password \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "oldPassword": "password123",
    "newPassword": "newpassword456"
  }'
```

## Error Responses

All endpoints follow a consistent error format:

**400 Bad Request** (validation error):
```json
{
  "success": false,
  "error": "Username, email, and password are required"
}
```

**401 Unauthorized** (invalid credentials or token):
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

**500 Internal Server Error**:
```json
{
  "success": false,
  "error": "Internal server error"
}
```

## Security Features

- ✅ **Password Hashing**: Uses bcrypt with 10 salt rounds
- ✅ **JWT Authentication**: Secure token-based authentication
- ✅ **Input Validation**: Email format, password strength, unique constraints
- ✅ **SQL Injection Protection**: Parameterized queries
- ✅ **Connection Pooling**: Efficient database connection management
- ✅ **Automatic Timestamps**: Created/updated timestamps with triggers
- ✅ **Indexed Queries**: Optimized lookups on username and email

## Project Structure

```
server/src/
├── config/
│   └── env.js                 # Environment configuration (includes DB & JWT config)
├── middleware/
│   └── auth.js                # JWT authentication middleware
├── routes/
│   ├── authRoutes.js          # Authentication endpoints
│   ├── marketDataRoutes.js    # Market data endpoints
│   └── indicatorRoutes.js     # Technical indicators
├── services/
│   ├── authService.js         # Authentication business logic
│   ├── twelveDataStream.js    # Market data streaming
│   └── ...
├── utils/
│   ├── db.js                  # PostgreSQL connection pool
│   └── logger.js              # Logging utility
└── server.js                  # Main application entry point
```

## Production Considerations

⚠️ **Important for Production**:

1. **Change JWT Secret**: Generate a strong, random JWT secret
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Use HTTPS**: Always use HTTPS in production

3. **Rate Limiting**: Add rate limiting to prevent brute force attacks

4. **Environment Variables**: Never commit `.env` file to version control

5. **Database Backups**: Implement regular database backups

6. **Password Requirements**: Consider stricter password requirements

7. **Email Verification**: Add email verification for new registrations

8. **Refresh Tokens**: Implement refresh token mechanism for longer sessions

## Integration with Frontend

Example JavaScript/React integration:

```javascript
// Register
const register = async (userData) => {
  const response = await fetch('http://localhost:4000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  return response.json();
};

// Login
const login = async (usernameOrEmail, password) => {
  const response = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernameOrEmail, password })
  });
  const data = await response.json();
  if (data.success) {
    localStorage.setItem('token', data.data.token);
  }
  return data;
};

// Make authenticated request
const getProfile = async () => {
  const token = localStorage.getItem('token');
  const response = await fetch('http://localhost:4000/api/auth/profile', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};
```

## Support

For issues or questions, check:
- Server logs in the console
- Database connection status
- JWT token expiration
- Environment variable configuration
