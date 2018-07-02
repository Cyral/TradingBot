FROM node:8.6.0

ENV HOME=/home/app/common

COPY package.json $HOME/package.json
COPY package-lock.json $HOME/package-lock.json

WORKDIR $HOME

RUN npm config set registry http://registry.npmjs.org/ && \
    npm config set unsafe-perm true && \
    npm install --loglevel=warn --ignore-scripts

COPY . $HOME/