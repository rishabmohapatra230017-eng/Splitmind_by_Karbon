#!/bin/bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Build backend
cd ../backend && npm run build

# Build frontend
cd ../frontend && npm run build
