# Archer's Forum

A community web application for DLSU students to discuss academics, organizations, events, and more.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- MongoDB Compass:
	Make a new connection with this URI - mongodb+srv://angelynchua_db_user:nINzn9KYDB60vpwH@angelynchua.ltaqo8r.mongodb.net/

## Setup & Installation

### 1.  Install dependencies

```powershell
npm install
```

This installs the project dependencies (including Express, Mongoose, and Multer).

---

### 2. Connect to the MongoDB Atlas server

Open MongoDB Compass and press 'connect' on the connection server 

---

### 3. Start the server

```powershell
npm start
```

The server will print:
```
Connected to MongoDB
Server running at http://localhost:3000
```

---

### 4. Open the application

Navigate to **http://localhost:3000** in your browser.

---

## Default Accounts

An admin account is auto-created on server startup:

| Field    | Value                      |
|----------|----------------------------|
| Email    | `admin@archersforum.com`   |
| Password | `admin1234`                |

You can also register a new account from the Register page or Login into an already existing account
- To check this go to the "users" query in MongoDB Compass and check the different accounts' email and password

## Terminal Notes

- To restart the server/close the server type this in VSCODE terminal: Get-Process node | Stop-Process -Force
