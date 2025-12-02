# Smart AI CLI + webterminal container
FROM node:20-alpine

# Basis tools
RUN apk add --no-cache bash git openssh

# Werkomgeving
WORKDIR /app

# WeTTY (web-based terminal) binnenhalen
# We volgen grofweg de stappen uit de officiële docs:
# - clone repo
# - npm install
# - build
RUN git clone https://github.com/butlerx/wetty.git . \
    && npm install \
    && npm run build

# Globale CLI’s voor in je terminal:
# - ai-shell: natuurlijke taal -> shell commands
# - railway: Railway CLI
RUN npm install -g @builder.io/ai-shell @railway/cli

# Maak een niet-root gebruiker voor de shell
RUN adduser -D appuser
USER appuser
WORKDIR /home/appuser

# Standaard shell = bash
ENV SHELL=/bin/bash

# Poort waar WeTTY luistert
EXPOSE 3000

# Start WeTTY (npm start in /app, maar we zitten nu in /home/appuser),
# dus we gaan even daarheen en starten dan de app.
# WeTTY draait de shell als de huidige user (appuser).
CMD ["sh", "-lc", "cd /app && npm start"]
