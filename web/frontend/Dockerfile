FROM node:8.6.0

ENV HOME=/home/app

COPY package.json $HOME/frontend/package.json
COPY package-lock.json $HOME/frontend/package-lock.json

WORKDIR $HOME/frontend

RUN npm config set registry http://registry.npmjs.org/ && npm install --loglevel=warn --ignore-scripts

COPY . $HOME/frontend/

EXPOSE 3000

CMD npm start
