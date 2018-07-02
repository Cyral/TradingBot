FROM node:8.6.0

ENV HOME=/home/app/web

COPY package.json $HOME/backend/package.json
COPY package-lock.json $HOME/backend/package-lock.json

WORKDIR $HOME/backend

RUN npm config set registry http://registry.npmjs.org/ && \
    npm config set unsafe-perm true && \
    npm install --loglevel=warn --ignore-scripts

COPY . $HOME/backend/

EXPOSE 3000

CMD npm start 
