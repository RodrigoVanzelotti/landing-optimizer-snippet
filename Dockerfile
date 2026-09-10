# syntax=docker/dockerfile:1

FROM node:20-slim AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM dependencies AS development
ENV NODE_ENV=development
ENV CHOKIDAR_USEPOLLING=true
RUN npm install -g serve@14 && npm cache clean --force
COPY . .
EXPOSE 3005 4000
CMD ["sh", "-c", "npm run dev & exec serve dist -l 4000"]

FROM dependencies AS build
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