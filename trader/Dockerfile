FROM node:8.6.0

ENV HOME=/home/app

COPY package.json $HOME/trader/package.json
COPY package-lock.json $HOME/trader/package-lock.json

COPY libs/gdax/package.json $HOME/trader/libs/gdax/package.json
COPY libs/gdax/package-lock.json $HOME/trader/libs/gdax/package-lock.json

WORKDIR $HOME/trader

RUN npm config set registry http://registry.npmjs.org/ && \
    npm config set unsafe-perm true && \
    npm install --loglevel=warn && \
    ls && \
    cd ./libs/gdax && \
    npm install --loglevel=warn && \
    npm link && \
    cd ../../ && \
    npm link gdax

COPY . $HOME/trader/

RUN echo "America/New_York" > /etc/timezone && dpkg-reconfigure -f noninteractive tzdata

EXPOSE 3000

# cd ./libs/gdax && npm link && cd ../../ && npm link gdax && 
CMD cd ./libs/gdax && npm link && cd ../../ && npm link gdax && npm start
