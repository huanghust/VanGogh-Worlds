FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
# Hugging Face Spaces routes traffic to port 7860; hosts like Render set
# their own PORT env var at runtime, which overrides this default.
ENV PORT=7860
EXPOSE 7860
CMD ["npm", "start"]
