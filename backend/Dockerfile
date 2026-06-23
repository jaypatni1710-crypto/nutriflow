FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source and build
COPY . .
RUN npm run build

# Create uploads directories
RUN mkdir -p uploads/progress-photos uploads/lab-reports

EXPOSE 4000

CMD ["node", "dist/index.js"]
