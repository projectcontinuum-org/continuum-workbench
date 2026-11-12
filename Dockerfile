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
    libsecret-1-0 curl ca-certificates git sudo \
    ripgrep jq tree less nano vim-tiny file patch unzip zip wget procps \
    openssh-client python3 python3-pip make g++ bash-completion && \
    mkdir -p -m 755 /etc/apt/keyrings && \
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /etc/apt/keyrings/githubcli-archive-keyring.gpg && \
    chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list && \
    apt-get update && apt-get install -y --no-install-recommends gh && \
    rm -rf /var/lib/apt/lists/*
# The cluster manager runs the pod as uid 1000 (the base image's "node" user, renamed to "continuum"), so Claude Code,
# its agent and its MCP config must live in that user's home, not /root (mode 700, unreadable for uid 1000).
RUN groupmod -n continuum node && usermod -l continuum -d /home/continuum -m node && \
    echo "continuum ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/continuum && \
    chmod 0440 /etc/sudoers.d/continuum
USER continuum
RUN curl -fsSL https://claude.ai/install.sh | bash
USER root
RUN ln -sf /home/continuum/.local/bin/claude /usr/local/bin/claude && \
    /usr/local/bin/claude --version
RUN npm install -g @anthropic-ai/claude-agent-sdk
COPY --chown=continuum:continuum workflow-builder-extension/claude-code/workflow-builder.md /home/continuum/.claude/agents/workflow-builder.md
RUN mkdir -p /root/.claude/agents && \
    cp /home/continuum/.claude/agents/workflow-builder.md /root/.claude/agents/
ENV PATH="/home/continuum/.local/bin:/root/.local/bin:${PATH}"
ENV SHELL=/bin/bash
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/continuum-workbench ./
# Writes ~/.claude.json from CONTINUUM_API_SERVER_MCP_URL (same variable as the Theia WorkflowBuilder agent), then starts Node
COPY --chmod=755 entrypoint.sh /usr/local/bin/continuum-entrypoint.sh
ENTRYPOINT [ "continuum-entrypoint.sh" ]
EXPOSE 8080
CMD [ "lib/backend/main.js", "-h", "0.0.0.0", "-p", "8080" ]