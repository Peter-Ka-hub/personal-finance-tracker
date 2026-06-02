FROM nginx:1.27-alpine

# envsubst is included in nginx:alpine via gettext package
RUN apk add --no-cache gettext

COPY nginx.conf /etc/nginx/nginx.conf.template

# Default values match docker-compose service names for local dev (http upstreams)
ENV UPSTREAM_SCHEME=http \
    AUTH_HOST=auth \
    AUTH_PORT=3001 \
    CATEGORIES_HOST=categories \
    CATEGORIES_PORT=3002 \
    TRANSACTIONS_HOST=transactions \
    TRANSACTIONS_PORT=3003 \
    FRONTEND_HOST=frontend \
    FRONTEND_PORT=3000

EXPOSE 80

# Substitute env vars into nginx config at container start
CMD ["/bin/sh", "-c", "envsubst '${UPSTREAM_SCHEME} ${AUTH_HOST} ${AUTH_PORT} ${CATEGORIES_HOST} ${CATEGORIES_PORT} ${TRANSACTIONS_HOST} ${TRANSACTIONS_PORT} ${FRONTEND_HOST} ${FRONTEND_PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf && nginx -g 'daemon off;'"]
