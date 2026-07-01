FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY server.js ./
COPY public ./public
COPY data ./data

ENV HOST=0.0.0.0
ENV PORT=5725

EXPOSE 5725

CMD ["node", "server.js"]
