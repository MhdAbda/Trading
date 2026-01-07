# Trading Bot Database Setup

This project automatically sets up a PostgreSQL database for the trading bot application, including user authentication tables.

## Features

- ✅ Automatic database creation if it doesn't exist
- ✅ Automatic table creation with proper schema
- ✅ User authentication table with password hashing support
- ✅ Automatic timestamp updates using triggers
- ✅ Indexed columns for better query performance

## Database Schema

### Users Table

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing user ID |
| username | VARCHAR(255) | UNIQUE, NOT NULL | Unique username |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Unique email address |
| password_hash | VARCHAR(255) | NOT NULL | Hashed password |
| phone_number | VARCHAR(20) | NULL | User phone number |
| created_at | TIMESTAMP | DEFAULT NOW | Account creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW | Last update timestamp |

**Indexes:**
- `idx_users_email` on email column
- `idx_users_username` on username column

**Triggers:**
- Automatic `updated_at` timestamp update on row modification

## Prerequisites

- PostgreSQL installed and running
- PostgreSQL user credentials (default: user=`postgre`, password=`password`)

## Setup Instructions

1. **Install Dependencies**
   ```bash
   cd database
   npm install
   ```

2. **Configure Database Connection** (Optional)
   
   The default configuration uses:
   - Host: `localhost`
   - Port: `5432`
   - User: `postgre`
   - Password: `password`
   - Database: `trading_bot_db`

   To customize, edit the `.env` file or copy from `.env.example`:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Initialize Database**
   ```bash
   npm run init
   ```
   
   or
   
   ```bash
   npm start
   ```

   This will:
   - Connect to PostgreSQL server
   - Create the `trading_bot_db` database (if it doesn't exist)
   - Create all required tables
   - Set up indexes and triggers
   - Display confirmation of created tables

## Usage

### Running the Initialization Script

```bash
npm run init
```

Expected output:
```
Starting database initialization...

Configuration:
  Host: localhost
  Port: 5432
  User: postgre
  Database: trading_bot_db

Connected to PostgreSQL server
✓ Database 'trading_bot_db' created successfully
Connected to database 'trading_bot_db'
✓ All tables and triggers created successfully

Created tables:
  - users

✓ Database initialization completed successfully!
```

### Connecting to the Database

Example connection code:

```javascript
import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgre',
  password: 'password',
  database: 'trading_bot_db'
});

await client.connect();
// Use client to query database
await client.end();
```

## Project Structure

```
database/
├── package.json          # Dependencies and scripts
├── .env                  # Database credentials (gitignored)
├── .env.example          # Example environment variables
├── README.md             # This file
└── src/
    ├── init-db.js        # Main initialization script
    ├── config.js         # Database configuration
    └── schema.js         # SQL schema definitions
```

## Adding More Tables

To add additional tables:

1. Open [src/schema.js](src/schema.js)
2. Add your table creation SQL as a new constant
3. Add the constant to the `allSchemas` array

Example:
```javascript
export const createSessionsTableSQL = `
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

export const allSchemas = [
  createUsersTableSQL,
  createUpdatedAtTriggerSQL,
  createSessionsTableSQL  // Add new table here
];
```

Then run `npm run init` again to create the new table.

## Troubleshooting

### Connection Refused
- Ensure PostgreSQL is running: `pg_ctl status` or check your system services
- Verify the host and port in `.env` are correct

### Authentication Failed
- Check that the username and password in `.env` match your PostgreSQL credentials
- Verify the user has CREATE DATABASE permissions

### Database Already Exists
- This is normal! The script will skip database creation and proceed to table creation
- Tables are created using `CREATE TABLE IF NOT EXISTS`, so it's safe to run multiple times

## Security Notes

⚠️ **Important**: Never commit the `.env` file to version control. It contains sensitive credentials.

The `.gitignore` file should include:
```
.env
node_modules/
```

## License

ISC
