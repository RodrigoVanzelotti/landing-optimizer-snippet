# syntax=docker/dockerfile:1

FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci 
COPY . .
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /srv
ENV NODE_ENV=production
RUN npm install -g serve@14 && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/site ./site
COPY --from=build /app/sites ./sites

USER node

EXPOSE 3005 4000

CMD ["serve", "dist", "-l", "4000"]