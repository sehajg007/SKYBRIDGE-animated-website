FROM oven/bun:1.4.4
WORKDIR /app
COPY package.json package-lock.json ./
RUN bun install
COPY . .
RUN bun run build
ENV HOST=0.0.0.0 PORT=3001
EXPOSE 3001
CMD ["bun", "run", "server/index.ts"]
