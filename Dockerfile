# Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Build backend
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    sqlite3 \
    build-essential \
    libffi-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY . .

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Expose port
EXPOSE 8000

# Set environment variables
ENV HOST=0.0.0.0
ENV PORT=8000

# Run the application
CMD sh -c "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"
