FROM node:22-slim

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
RUN npm rebuild sqlite3 --build-from-source

COPY . .

RUN mkdir -p database public/uploads/posts public/uploads/gallery/thumbnails public/gallery-img/thumbnails

EXPOSE 3000

CMD ["node", "server/server.js"]