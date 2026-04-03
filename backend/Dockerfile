FROM node:20-alpine AS builder
WORKDIR /app

COPY shared/ ./shared/

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci

COPY backend/ ./

RUN node -e "\
  const c = JSON.parse(require('fs').readFileSync('tsconfig.json','utf8'));\
  c.compilerOptions.rootDir = 'src';\
  c.include = ['src'];\
  require('fs').writeFileSync('tsconfig.json', JSON.stringify(c, null, 2));"

# Shared package is types-only; create minimal compiled stubs so
# require('@nws/shared') resolves at runtime without needing tsc.
WORKDIR /app/shared
RUN mkdir -p dist && \
    echo '"use strict"; Object.defineProperty(exports,"__esModule",{value:true});' > dist/types.js && \
    echo '"use strict"; var __createBinding=Object.create; var __exportStar=function(m,e){for(var p in m)if(p!=="default"&&!Object.prototype.hasOwnProperty.call(e,p))e[p]=m[p];}; Object.defineProperty(exports,"__esModule",{value:true}); __exportStar(require("./types"),exports);' > dist/index.js && \
    node -e "\
      const p=require('./package.json');\
      p.main='dist/index.js'; p.types='src/index.ts';\
      require('fs').writeFileSync('package.json',JSON.stringify(p,null,2));"

WORKDIR /app/backend
RUN npm run build

# ── Production image ─────────────────────────────────────────────────────
FROM node:20-alpine
RUN apk add --no-cache tini python3 py3-pip

WORKDIR /app

# ── Node backend ─────────────────────────────────────────────────────────
COPY --from=builder /app/shared ./shared/
COPY --from=builder /app/backend/package*.json ./backend/

WORKDIR /app/backend
RUN npm ci --omit=dev

COPY --from=builder /app/backend/dist ./dist/
COPY --from=builder /app/backend/src ./src/
COPY --from=builder /app/backend/tsconfig.json ./
RUN mkdir -p uploads/chat uploads/training
RUN npm install -g tsx

# ── Python lead engine ───────────────────────────────────────────────────
WORKDIR /app
COPY pyproject.toml run.py ./
COPY src/ ./src/
RUN python3 -m venv .venv \
    && .venv/bin/pip install --no-cache-dir -e . \
    && .venv/bin/playwright install --with-deps chromium

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "/app/backend/dist/server.js"]
