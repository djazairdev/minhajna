# SPDX-FileCopyrightText: 2026 The Minhajna contributors
# SPDX-License-Identifier: AGPL-3.0-or-later

# The demo server's image (#633, answer 550): the server and PostgreSQL in
# one container, with WAL-G archiving the database to an S3-compatible
# bucket (R2 for the demo) and restoring it when a container starts on an
# empty disk. Build it from the repository's root:
#   docker build -f apps/server/Dockerfile -t minhajna-server .
# Every image is pinned by version and digest, and WAL-G by its release's
# SHA-256. The bucket's address and credentials come from the environment
# when the container runs, never from the image (README.md). The start
# script runs as root only to start PostgreSQL as postgres and the server
# as minhajna. TypeScript and its types, which npm keeps as an optional
# peer of Prisma's client, are dropped from the image.

FROM node:22.23.4-trixie-slim@sha256:2117f713a417f3aff682ac8f5bc2ebbdf1beed51f36e67ab1e0fd3866b6d2d8f AS build
WORKDIR /minhajna
COPY tsconfig.base.json ./
WORKDIR /minhajna/apps/server
COPY apps/server/package.json apps/server/package-lock.json apps/server/.npmrc ./
RUN npm ci --no-audit --no-fund
COPY apps/server/tools/prisma tools/prisma
RUN npm run tools
COPY apps/server/tsconfig.json ./
COPY apps/server/prisma prisma
COPY apps/server/src src
RUN npm run build && npm prune --omit=dev --no-audit --no-fund && rm -rf node_modules/typescript node_modules/@types

FROM scratch AS wal-g-amd64
ADD --checksum=sha256:4f03ee4679db7f660bfd1b2b8291ac5df247cd2ec48074b60c112f4897299f24 \
    https://github.com/wal-g/wal-g/releases/download/v3.0.9/wal-g-pg-22.04-amd64.tar.gz /wal-g.tar.gz

FROM scratch AS wal-g-arm64
ADD --checksum=sha256:20191a37ad091a880c25f4cc907e6f0deb7f12bdd8a53fd62dbc7fcbf2eac712 \
    https://github.com/wal-g/wal-g/releases/download/v3.0.9/wal-g-pg-22.04-aarch64.tar.gz /wal-g.tar.gz

FROM wal-g-${TARGETARCH} AS wal-g

FROM postgres:18.6-trixie@sha256:979bccfde35445db618c65107d27d08c6c21339d8dc3ad4c830c6633947be0e4
COPY --from=build /usr/local/bin/node /usr/local/bin/node
RUN --mount=type=bind,from=wal-g,target=/wal-g \
    tar -xzf /wal-g/wal-g.tar.gz -C /tmp && install -m 755 /tmp/wal-g-pg-* /usr/local/bin/wal-g && rm /tmp/wal-g-pg-*
WORKDIR /srv/minhajna
COPY --from=build /minhajna/apps/server/package.json ./
COPY --from=build /minhajna/apps/server/node_modules node_modules
COPY --from=build /minhajna/apps/server/dist/src dist/src
COPY apps/server/prisma/migrations prisma/migrations
COPY apps/server/container/start.sh /usr/local/bin/minhajna-start
COPY apps/server/container/wal-g.sh /usr/local/bin/minhajna-wal-g
COPY apps/server/container/wal-fetch.sh /usr/local/bin/minhajna-wal-fetch
RUN useradd --system --no-create-home --shell /usr/sbin/nologin minhajna
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
EXPOSE 8080
STOPSIGNAL SIGTERM
ENTRYPOINT ["minhajna-start"]
