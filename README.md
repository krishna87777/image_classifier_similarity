# AI Image Classification & Search System

A full-stack application for image classification and similarity search using FastAPI backend and React frontend, fully containerized with Docker.

## Project Structure

```
pythonProject/
├── backend/
│   ├── data/
│   │   ├── embed2img_idx.npy
│   │   ├── image_paths.pkl
│   │   └── shop_index.faiss
│   ├── models/
│   │   └── deit_shopnotshop1.pth
│   ├── main.py
│   ├── task1_model.py
│   ├── task2_model.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .dockerignore
├── image-frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── Dockerfile
│   ├── nginx.conf
│   └── .dockerignore
├── docker-compose.yml
├── docker-compose.prod.yml
└── README.md
```

##  Features

- **Image Classification**: Detect whether uploaded images contain shops
- **Similarity Search**: Find similar images in the database using FAISS
- **Multi-format Support**: JPG, PNG, WEBP, GIF, BMP, TIFF, HEIC, HEIF
- **Real-time Processing**: Fast inference with optimized models
- **Modern UI**: Responsive React frontend with drag-and-drop upload
- **Containerized**: Full Docker support for easy deployment

##  Prerequisites

- Docker (version 20.0 or higher)
- Docker Compose (version 2.0 or higher)
- At least 4GB RAM (for ML models)
- 10GB free disk space

##  Setup Instructions

### 1. Clone and Prepare

```bash
# Clone the repository (if not already done)
git clone <your-repo-url>
cd pythonProject

# Ensure your ML models and data are in place:
# backend/models/deit_shopnotshop1.pth
# backend/data/shop_index.faiss
# backend/data/image_paths.pkl
# backend/data/embed2img_idx.npy
```

### 2. Create Docker Files

Create the following files in your project:

**backend/Dockerfile** - [Use the Backend Dockerfile artifact above]

**image-frontend/Dockerfile** - [Use the Frontend Dockerfile artifact above]

**image-frontend/nginx.conf** - [Use the Nginx Configuration artifact above]

**docker-compose.yml** - [Use the Docker Compose Configuration artifact above]

**backend/.dockerignore** - [Use the Backend .dockerignore artifact above]

**image-frontend/.dockerignore** - [Use the Frontend .dockerignore artifact above]

### 3. Build and Run (Development)

```bash
# Build and start all services
docker-compose up --build

# Or run in background
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### 4. Build and Run (Production)

For production deployment, use the production-optimized configuration:

```bash
# Create production docker-compose file
cp docker-compose.yml docker-compose.prod.yml

# Edit docker-compose.prod.yml to use production settings
# Then build and run
docker-compose -f docker-compose.prod.yml up --build -d
```

## 🌐 Access the Application

Once the containers are running:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

## 🔧 Configuration

### Environment Variables

Create `.env` file in the root directory for custom configuration:

```env
# Backend Configuration
BACKEND_PORT=8000
BACKEND_HOST=0.0.0.0

# Frontend Configuration
FRONTEND_PORT=3000

# API Configuration
API_BASE_URL=http://localhost:8000
```

### Port Configuration

To change default ports, modify `docker-compose.yml`:

```yaml
services:
  backend:
    ports:
      - "8080:8000"  # Change 8080 to your desired port
  
  frontend:
    ports:
      - "3001:80"    # Change 3001 to your desired port
```

## 📊 API Endpoints

### Main Endpoints

- `GET /` - API status and information
- `GET /health` - Health check for monitoring
- `POST /api/task1/classify` - Image classification
- `POST /api/task2/search` - Image similarity search

### Example Usage

```bash
# Health check
curl http://localhost:8000/health

# Image classification
curl -X POST "http://localhost:8000/api/task1/classify" \
  -H "Content-Type: multipart/form-data" \
  -F "image=@/path/to/your/image.jpg"

# Image search
curl -X POST "http://localhost:8000/api/task2/search" \
  -H "Content-Type: multipart/form-data" \
  -F "image=@/path/to/your/image.jpg"
```

## 🐛 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Find and kill process using the port
   lsof -ti:8000 | xargs kill -9
   lsof -ti:3000 | xargs kill -9
   ```

2. **Model Files Missing**
   ```bash
   # Ensure these files exist:
   ls -la backend/models/deit_shopnotshop1.pth
   ls -la backend/data/shop_index.faiss
   ls -la backend/data/image_paths.pkl
   ls -la backend/data/embed2img_idx.npy
   ```

3. **Memory Issues**
   ```bash
   # Increase Docker memory limit to at least 4GB
   # Check Docker settings -> Resources -> Memory
   
   # Or reduce worker count in production
   # Edit docker-compose.yml backend command:
   CMD ["gunicorn", "main:app", "-w", "2", ...]
   ```

4. **CORS Issues**
   ```bash
   # Check if backend allows frontend origin
   # Verify backend logs: docker-compose logs backend
   ```

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend

# Last 100 lines
docker-compose logs --tail=100 backend
```

## 🔄 Development Workflow

### Hot Reload (Development)

To enable hot reload for development:

```yaml
# Add to docker-compose.yml under backend service
volumes:
  - ./backend:/app
  - ./backend/models:/app/models
  - ./backend/data:/app/data

# Add to docker-compose.yml under frontend service
volumes:
  - ./image-frontend/src:/app/src
```

### Rebuilding After Changes

```bash
# Rebuild specific service
docker-compose build backend
docker-compose build frontend

# Rebuild and restart
docker-compose up --build

# Force rebuild (no cache)
docker-compose build --no-cache
```

## 📈 Performance Optimization

### Backend Optimizations

1. **Use Production Dockerfile**:
   - Multi-stage builds
   - Non-root user
   - Gunicorn with multiple workers

2. **Resource Limits**:
   ```yaml
   # Add to docker-compose.yml
   deploy:
     resources:
       limits:
         memory: 2G
         cpus: '1.0'
   ```

### Frontend Optimizations

1. **Nginx Configuration**:
   - Gzip compression enabled
   - Static asset caching
   - Security headers

2. **Build Optimizations**:
   - Multi-stage Docker build
   - Only production dependencies

## 🔒 Security Considerations

1. **Non-root Users**: Containers run with non-root users
2. **Security Headers**: Added in nginx configuration
3. **Input Validation**: File type and size validation
4. **Network Isolation**: Services communicate through Docker network
5. **Resource Limits**: Prevent resource exhaustion

## 📝 Production Deployment

### Using Docker Swarm

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.prod.yml ai-image-app

# Scale services
docker service scale ai-image-app_backend=3
```

### Using Kubernetes

```bash
# Convert to Kubernetes manifests
kompose convert -f docker-compose.prod.yml

# Apply to cluster
kubectl apply -f .
```

## 🏷️ Version Info

- **Docker**: >= 20.0
- **Docker Compose**: >= 2.0
- **Python**: 3.9
- **Node.js**: 18
- **FastAPI**: Latest
- **React**: 19.1.1
