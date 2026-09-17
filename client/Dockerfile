FROM node:20-alpine AS build

WORKDIR /app

# API base URL is baked in at build time by Vite. Default to a same-origin
# relative path so the bundled Nginx reverse-proxies /api to the server
# (no CORS, cookies work). Override with --build-arg VITE_API_URL=...
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY vite.config.ts postcss.config.js tailwind.config.js index.html ./
COPY public ./public
COPY src ./src

RUN npm run build


FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
