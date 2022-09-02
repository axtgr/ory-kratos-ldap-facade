FROM node:18-alpine

LABEL maintainer="me@schneider.ax"

WORKDIR /var/www/app
EXPOSE 80

COPY ./.yarn/releases /var/www/app/.yarn/releases
COPY ./.yarn/plugins /var/www/app/.yarn/plugins
COPY ./.yarnrc.yml /var/www/app/.yarnrc.yml
COPY ./yarn.lock /var/www/app/yarn.lock
COPY ./package.json /var/www/app/package.json

RUN npm install --force -g yarn && \
  yarn

COPY ./src /var/www/app/src

CMD yarn start
