# ProSBC Automation System

This project has been restructured with separate frontend and backend folders for better organization.

## Project Structure

```
prosbc-automation/
├── frontend/           # React frontend application
│   ├── src/           # React source code
│   ├── public/        # Static assets
│   ├── package.json   # Frontend dependencies
│   └── vite.config.js # Vite configuration
├── backend/           # Node.js backend application
│   ├── scripts/       # Database and utility scripts
│   ├── server.js      # Main server file
│   ├── package.json   # Backend dependencies
│   └── setup.js       # Backend setup script
├── docker-compose.yml # Docker configuration
├── package.json       # Root package.json for managing both
└── README.md          # This file
```

## Quick Start

### Install all dependencies (recommended)
```bash
npm run setup
```

### Or install separately
```bash
# Install root dependencies
npm install

# Install frontend dependencies
npm run install:frontend

# Install backend dependencies
npm run install:backend
```

## Development

### Start both frontend and backend in development mode
```bash
npm run dev
```

### Start frontend only (React + Vite)
```bash
npm run dev:frontend
```

### Start backend only (Node.js)
```bash
npm run dev:backend
```

## Production

### Build frontend
```bash
npm run build
```

### Start backend in production
```bash
npm start
```

## API Configuration

- Frontend runs on: `http://localhost:5173` (development)
- Backend runs on: `http://localhost:3001`
- Backend API is proxied through `/backend` in frontend development

## Environment Variables

Make sure to set up your `.env` file with:
- `PROSBC_URL` - Your ProSBC server URL

## Additional Information

See the documentation files for specific setup and deployment instructions:
- `DATABASE_SETUP.md` - Database configuration
- `DEPLOYMENT_GUIDE.md` - Production deployment
- `ENV_SETUP.md` - Environment setup
