FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --include=dev
COPY . .
RUN npm run build
RUN npm prune --production
EXPOSE 3000
CMD ["node", "dist/main"]
