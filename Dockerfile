# ---- build stage -----------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /build

# Install dependencies from the lockfile first so this layer is reused whenever
# only application source changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- runtime stage ---------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/dist/musicFrontend/browser /usr/share/nginx/html

EXPOSE 80

# nginx:alpine ships neither wget nor curl, so the healthcheck asks nginx itself
# rather than adding a package purely to probe the port.
HEALTHCHECK --interval=30s --timeout=4s --start-period=10s --retries=3 \
  CMD nginx -t >/dev/null 2>&1 && pgrep nginx >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
