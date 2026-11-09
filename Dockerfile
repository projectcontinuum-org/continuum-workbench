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
    libsecret-1-0 curl ca-certificates git \
    ripgrep jq tree less nano vim-tiny file patch unzip zip wget procps \
    openssh-client python3 python3-pip make g++ bash-completion && \
    mkdir -p -m 755 /etc/apt/keyrings && \
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /etc/apt/keyrings/githubcli-archive-keyring.gpg && \
    chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list && \
    apt-get update && apt-get install -y --no-install-recommends gh && \
    rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://claude.ai/install.sh | bash && \
    ln -sf /root/.local/bin/claude /usr/local/bin/claude && \
    /usr/local/bin/claude --version
RUN npm install -g @anthropic-ai/claude-agent-sdk
COPY workflow-builder-extension/claude-code/workflow-builder.md /root/.claude/agents/workflow-builder.md
ENV PATH="/root/.local/bin:${PATH}"
ENV SHELL=/bin/bash
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/continuum-workbench ./
EXPOSE 8080
CMD [ "lib/backend/main.js", "-h", "0.0.0.0", "-p", "8080" ]