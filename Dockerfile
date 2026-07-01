FROM node:22-alpine

WORKDIR /app

ARG RELEASE_GIT_COMMIT=unknown
ARG RELEASE_NAME=docker-image

COPY package.json ./
COPY server.js ./
COPY public ./public
COPY data ./data

ENV HOST=0.0.0.0
ENV PORT=5725
ENV RELEASE_GIT_COMMIT=$RELEASE_GIT_COMMIT
ENV RELEASE_NAME=$RELEASE_NAME

EXPOSE 5725

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "const port=process.env.PORT||5725; fetch(`http://127.0.0.1:${port}/api/health`).then((res)=>process.exit(res.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
