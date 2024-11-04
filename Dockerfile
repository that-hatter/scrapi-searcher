FROM node:22-alpine AS base

# install dependencies
COPY package*.json ./
RUN npm ci

# compile typescript source code
COPY tsconfig.json ./
COPY ./src ./src
RUN npm run build

FROM node:22-alpine AS prod

# install git and create data folder for auto-updates
RUN apk add --no-cache git
RUN mkdir -p ./data
# install production-only dependencies
COPY package*.json ./
RUN npm ci --omit=dev
# copy compiled js code
COPY --from=base ./dist ./dist

ENTRYPOINT ["node", "dist"]
