FROM node:lts-alpine

WORKDIR /app

# Zero runtime dependencies: copy only what the app needs.
COPY scripts/ scripts/
COPY skills/ skills/
COPY docs/quantum-trader.md docs/quantum-trader.md

# Persistent state lives on the /data volume:
#   /data/vault         generated Obsidian notes (QT_VAULT_DIR)
#   /data/cache         Alpha Vantage daily cache (QT_CACHE_DIR)
#   /data/portfolio.json  your portfolio (QT_PORTFOLIO_PATH)
ENV QT_VAULT_DIR=/data/vault \
    QT_CACHE_DIR=/data/cache \
    QT_PORTFOLIO_PATH=/data/portfolio.json \
    QT_PORT=8787

VOLUME /data
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:8787/healthz || exit 1

CMD ["node", "scripts/qt/web-server.mjs"]
