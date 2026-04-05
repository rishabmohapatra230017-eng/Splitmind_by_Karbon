# SplitMint - Your Gateway to Karbon

<div align="center">
  <h3>🪙 A Modern Expense Splitting Application</h3>
  <p>Track, split, and settle expenses with friends and groups effortlessly</p>
  <p><strong>Now powered by Supabase (PostgreSQL)!</strong></p>
</div>

## ✨ Features

### ✅ Implemented Features

- **Authentication** 
  - User registration and login
  - JWT-based authentication
  - Secure password hashing

- **Groups Management**
  - Create groups (max 4 participants total)
  - Edit group names
  - Delete groups with cascade handling
  - View group-level totals and balance summaries

- **Participants**
  - Add participants to groups (max 4 per group)
  - Edit participant names
  - Remove participants (with expense validation)
  - Optional color coding

- **Expenses**
  - Add expenses with description, amount, date, and payer
  - Equal split mode (automatic calculation)
  - Edit and delete expenses
  - Automatic balance recalculation
  - Consistent rounding for uneven splits

- **Balance Engine**
  - Real-time balance calculation
  - Net balance per participant
  - Minimal settlement suggestions
  - Directional owed amounts

- **Visualizations**
  - Summary cards (total spent, participants, expenses)
  - Balance table with color coding
  - Transaction history
  - Group dashboard

- **Search & Filters**
  - Search expenses by text
  - Filter by participant
  - Filter by date range
  - Filter by amount range

### 🚧 Future Enhancements

- Custom amount splits
- Percentage-based splits
- MintSense AI feature (natural language expense parsing)
- Export capabilities
- Receipt uploads
- Multi-currency support

## 🏗️ Tech Stack

### Backend
- **Node.js** with **Express**
- **TypeScript** for type safety
- **Supabase** (PostgreSQL) for scalable database
- **JWT** for authentication
- **Zod** for validation

### Frontend
- **React 18** with **TypeScript**
- **Vite** for blazing fast builds
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Axios** for API calls
- **Lucide React** for icons

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Installation

1. **Clone or navigate to the repository**
   ```bash
   cd SplitMint
   ```

2. **Install all dependencies**
   ```bash
   npm run install:all
   ```

3. **Set up backend environment**
   ```bash
   cd backend
   cp .env.example .env
   ```
   
   Edit `.env` and update the `JWT_SECRET`:
   ```env
   PORT=3001
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   NODE_ENV=development
   DATABASE_PATH=./data/splitmint.db
   ```

4. **Initialize the database**
   ```bash
   npm run db:setup
   ```

5. **Return to root and start the application**
   ```bash
   cd ..
   npm run dev
   ```

This will start:
- Backend API on `http://localhost:3001`
- Frontend on `http://localhost:3000`

## 📖 API Documentation

### Authentication Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Groups Endpoints

- `GET /api/groups` - Get all groups for user
- `GET /api/groups/:id` - Get group by ID
- `POST /api/groups` - Create new group
- `PUT /api/groups/:id` - Update group
- `DELETE /api/groups/:id` - Delete group

### Participants Endpoints

- `GET /api/participants/group/:groupId` - Get participants for group
- `POST /api/participants` - Add participant
- `PUT /api/participants/:id` - Update participant
- `DELETE /api/participants/:id` - Delete participant

### Expenses Endpoints

- `GET /api/expenses/group/:groupId` - Get expenses for group
- `GET /api/expenses/group/:groupId/search` - Search/filter expenses
- `POST /api/expenses` - Create expense (supports equal, custom, percentage splits)
- `PUT /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Delete expense

### Balances Endpoints

- `GET /api/balances/group/:groupId` - Get balances and settlements
- `GET /api/balances/group/:groupId/participant/:participantId` - Get participant breakdown

### MintSense AI Endpoints

- `POST /api/mintsense/parse` - Parse natural language expense
- `GET /api/mintsense/summary/:groupId` - Generate AI summary

## 🗂️ Project Structure

```
SplitMint/
├── backend/
│   ├── src/
│   │   ├── database/
│   │   │   ├── db.ts           # Database connection
│   │   │   ├── schema.ts       # Database schema
│   │   │   └── setup.ts        # Setup script
│   │   ├── middleware/
│   │   │   └── auth.ts         # JWT authentication
│   │   ├── routes/
│   │   │   ├── auth.ts         # Auth routes
│   │   │   ├── groups.ts       # Groups routes
│   │   │   ├── participants.ts # Participants routes
│   │   │   ├── expenses.ts     # Expenses routes
│   │   │   └── balances.ts     # Balances routes
│   │   └── server.ts           # Express server
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── index.ts        # API client
│   │   ├── context/
│   │   │   └── AuthContext.tsx # Auth context
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   └── GroupDetail.tsx
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
└── package.json
```

## 🎯 Usage Guide

### Creating Your First Group

1. Register/Login to the application
2. Click "Create Group" on the dashboard
3. Enter a group name (e.g., "Weekend Trip")
4. Add participants (up to 4 total)

### Adding Expenses

1. Open a group
2. Click "Add Expense"
3. Fill in the details:
   - Description (e.g., "Dinner at Restaurant")
   - Amount (e.g., 120.00)
   - Who paid
   - Date
   - Split mode (Equal split supported)
4. The expense is automatically split equally among all participants

### Viewing Balances

1. Navigate to the "Balances" tab in a group
2. See who paid what and who owes what
3. View the net balance for each participant

### Settlement Suggestions

1. Go to the "Settlements" tab
2. See the minimal number of transactions needed to settle all debts
3. Follow the suggested payments to balance everyone out

## 🚢 Deployment

### Backend Deployment (e.g., Railway, Render)

1. Set environment variables:
   ```env
   PORT=3001
   JWT_SECRET=your-production-secret
   NODE_ENV=production
   DATABASE_PATH=./data/splitmint.db
   ```

2. Build command: `cd backend && npm install && npm run build`
3. Start command: `cd backend && npm start`

### Frontend Deployment (Vercel)

1. Set build settings:
   - Build command: `cd frontend && npm install && npm run build`
   - Output directory: `frontend/dist`
   
2. Environment variables:
   ```env
   VITE_API_URL=https://your-backend-url.com/api
   ```

### Full Stack Deployment Options

- **Vercel** (Frontend) + **Railway** (Backend)
- **Netlify** (Frontend) + **Render** (Backend)
- **Vercel** (Full Stack with Serverless Functions)

## 🗄️ Database

The application uses SQLite for development, which is perfect for:
- Quick setup
- Easy development
- Portable database file

For production, you can easily migrate to:
- **PostgreSQL** (Supabase, Neon, Railway)
- **MySQL** (PlanetScale)

Migration is straightforward - just update the database connection in `backend/src/database/db.ts`.

## 🔒 Security Features

- Password hashing with bcrypt
- JWT token authentication
- Protected API routes
- SQL injection prevention
- XSS protection
- CORS configuration

## 🤝 Contributing

This is a demonstration project for Karbon application. Feel free to:
- Fork the repository
- Create feature branches
- Submit pull requests
- Report issues

## 📝 License

MIT License - feel free to use this project for learning or as a base for your own applications.

## 🎓 Learning Resources

This project demonstrates:
- Full-stack TypeScript development
- RESTful API design
- React hooks and context
- JWT authentication
- Database design
- Modern CSS with Tailwind
- Component-based architecture

## 🌟 Acknowledgments

Built as a submission for Karbon's developer assessment. Special thanks to the Karbon team for this interesting challenge!

---

<div align="center">
  <p>Made with ❤️ for Karbon</p>
  <p>🪙 SplitMint - Making expense splitting simple</p>
</div>
