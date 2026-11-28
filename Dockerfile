FROM node:24-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    git python3 make g++ pkg-config libsecret-1-dev && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app
ADD . .
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN yarn install
RUN yarn run build
# VS Code extensions from theiaPlugins in continuum-workbench/package.json, into continuum-workbench/plugins. The Kotlin
# extension is pinned by SHA-256 (pluginChecksums): install-pinned-plugins.js fails the build on a mismatch.
RUN yarn --cwd continuum-workbench download:plugins

# JRE for the Kotlin language server: a jlink-reduced Java 21 with only the modules the server needs, so the production
# image carries no full JDK. Java 21 because the pinned server runs on 21 (the node runtime stays unaffected).
# Pinned by digest so the runtime is the same on every build; to update, resolve the new digest of the tag with
# `docker buildx imagetools inspect eclipse-temurin:21-jdk-jammy` and replace it here.
FROM eclipse-temurin:21-jdk-jammy@sha256:b2711c65970c1227197c29c46e669bfdbb137524e9da0e664703a140ec25a040 AS kotlin-ls-jre
RUN jlink \
    --add-modules java.base,java.compiler,java.desktop,java.instrument,java.management,java.naming,java.net.http,java.rmi,java.scripting,java.security.jgss,java.sql,jdk.net,jdk.unsupported \
    --strip-debug --no-man-pages --no-header-files --compress=zip-6 \
    --output /opt/continuum/kotlin-ls/jre

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
# Kotlin language server and its JRE, outside the PVC-mounted home like every other image-owned file. The release is
# pinned and checksum-verified by the script (the build fails on a mismatch), so nothing is downloaded when the workbench
# runs. fwcd.kotlin (the Kotlin file-editor extension, which also serves the Script node dialog) starts it lazily when
# the first Kotlin editor opens; the JVM is capped through kotlin.java.opts and one server uses about 0.7-0.9 GB resident.
COPY --from=kotlin-ls-jre /opt/continuum/kotlin-ls/jre /opt/continuum/kotlin-ls/jre
COPY scripts/download-kotlin-ls.sh scripts/kotlin-language-server-launcher.sh /tmp/kotlin-ls-install/
RUN bash /tmp/kotlin-ls-install/download-kotlin-ls.sh /opt/continuum/kotlin-ls && rm -r /tmp/kotlin-ls-install
# Seeds the Kotlin file-editor extension's settings (bundled server and runtime, no downloads) from entrypoint.sh
COPY scripts/seed-kotlin-settings.js /opt/continuum/seed-kotlin-settings.js
ENV CONTINUUM_KOTLIN_LS_HOME=/opt/continuum/kotlin-ls
ENV CONTINUUM_JAVA_HOME=/opt/continuum/kotlin-ls/jre
# The server finds the Kotlin standard library only in a Maven repository, a Gradle cache or kotlinc; this is the copy the
# download script made. Inherited by the backend's own server and by the file-editor extension's.
ENV MAVEN_REPOSITORY=/opt/continuum/kotlin-ls/m2
RUN /opt/continuum/kotlin-ls/jre/bin/java -version
ENV SHELL=/bin/bash
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/continuum-workbench ./
# Seeds the PVC-backed home (agent, workspace folder, Claude MCP config from CONTINUUM_API_SERVER_MCP_URL), then starts Node
COPY --chmod=755 entrypoint.sh /usr/local/bin/continuum-entrypoint.sh
ENTRYPOINT [ "continuum-entrypoint.sh" ]
EXPOSE 8080
CMD [ "lib/backend/main.js", "/home/continuum/workspace", "--plugins=local-dir:/app/plugins", "-h", "0.0.0.0", "-p", "8080" ]