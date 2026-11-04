FROM node:24-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    git python3 make g++ pkg-config libsecret-1-dev && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app
ADD . .
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN yarn install
RUN yarn run build

FROM node:24-slim AS production
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsecret-1-0 curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://claude.ai/install.sh | bash
ENV PATH="/root/.local/bin:${PATH}"
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/continuum-workbench ./
EXPOSE 8080
CMD [ "lib/backend/main.js", "-h", "0.0.0.0", "-p", "8080" ]