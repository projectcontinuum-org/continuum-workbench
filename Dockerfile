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
# The cluster manager runs the pod as uid 1000 (the base image's "node" user, renamed to "continuum") and mounts one PVC
# at /home/continuum, which hides everything the image puts there. Image-owned files therefore live outside the home
# directory, and entrypoint.sh seeds the home on every start.
RUN groupmod -n continuum node && usermod -l continuum -d /home/continuum -m node && \
    echo "continuum ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/continuum && \
    chmod 0440 /etc/sudoers.d/continuum
RUN mkdir -p /opt/claude-home && chown continuum:continuum /opt/claude-home
USER continuum
RUN curl -fsSL https://claude.ai/install.sh | HOME=/opt/claude-home bash
USER root
RUN ln -sf /opt/claude-home/.local/bin/claude /usr/local/bin/claude && \
    /usr/local/bin/claude --version
# The install is image-owned, so it updates with the image, not in place
ENV DISABLE_AUTOUPDATER=1
RUN npm install -g @anthropic-ai/claude-agent-sdk
COPY workflow-builder-extension/claude-code/workflow-builder.md /opt/continuum/workflow-builder.md
ENV SHELL=/bin/bash
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/continuum-workbench ./
# Seeds the PVC-backed home (agent, workspace folder, Claude MCP config from CONTINUUM_API_SERVER_MCP_URL), then starts Node
COPY --chmod=755 entrypoint.sh /usr/local/bin/continuum-entrypoint.sh
ENTRYPOINT [ "continuum-entrypoint.sh" ]
EXPOSE 8080
CMD [ "lib/backend/main.js", "/home/continuum/workspace", "-h", "0.0.0.0", "-p", "8080" ]