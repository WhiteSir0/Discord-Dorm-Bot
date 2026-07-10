FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential python3 pkg-config \
      libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev libpixman-1-dev \
      fonts-nanum fonts-noto-color-emoji \
      ca-certificates \
    && fc-cache -f \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY . .

CMD ["npm", "start"]
