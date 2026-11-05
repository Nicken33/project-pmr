# Витрина Talentro (Next 16, App Router). Контекст — папка web.
#   docker build -t talentro-web web        # из корня репозитория
# NEXT_PUBLIC_* встраиваются в клиентский бандл на этапе build, поэтому адрес API
# меняется только пересборкой (см. docs/deploy.md §4.1).

ARG NODE_VERSION=24

# Зависимости ставятся внутри Linux-слоя: на хосте (Windows/macOS) npm ставит
# glibc-сборки sharp и @next/swc-*, а в alpine нужен musl.
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
RUN npm run build

FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
# node_modules целиком: без `output: "standalone"` в next.config.ts рантайму нужен
# весь установленный пак.
COPY --from=build --chown=nextjs:nextjs /app/.next ./.next
COPY --from=build --chown=nextjs:nextjs /app/node_modules ./node_modules
COPY --from=build --chown=nextjs:nextjs /app/public ./public
COPY --from=build --chown=nextjs:nextjs /app/package.json ./package.json
COPY --from=build --chown=nextjs:nextjs /app/next.config.ts ./next.config.ts
USER nextjs
EXPOSE 3000
# next start читает PORT (по умолчанию 3000); в compose PORT=3000 выставлен явно.
CMD ["npm", "run", "start"]

# Проверка живости не трогает главную: та тянет каталог из API и зависит от состояния
# базы, а /sw.js — статики из public.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/sw.js').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
