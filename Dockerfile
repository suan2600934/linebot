FROM node:20-alpine

RUN apk add --update python3 make g++ cairo-dev jpeg-dev libpng-dev giflib-dev pango-dev

WORKDIR /app

COPY package*.json ./

RUN npm install --ignore-scripts

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
