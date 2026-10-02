FROM node:24-alpine AS frontend
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public
ARG VITE_PUBLIC_URL
ARG VITE_MAP_STYLE_URL
ENV VITE_PUBLIC_URL=$VITE_PUBLIC_URL VITE_MAP_STYLE_URL=$VITE_MAP_STYLE_URL
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend ./
COPY fixtures /fixtures
COPY --from=frontend /build/dist /app/frontend
ENV STATIC_PATH=/app/frontend STORAGE_PATH=/data/files
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
