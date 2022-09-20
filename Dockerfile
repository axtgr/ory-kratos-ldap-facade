FROM node:18-alpine

LABEL maintainer="me@schneider.ax"

WORKDIR /var/www/app
EXPOSE 80

COPY ./package.json /var/www/app/package.json
COPY ./package-lock.json /var/www/app/package-lock.json

ENV NODE_ENV=production
RUN npm ci

COPY ./src /var/www/app/src

CMD npm run start
