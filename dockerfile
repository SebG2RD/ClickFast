FROM nginx:1.20-alpine
WORKDIR /usr/share/nginx/html
COPY . .
RUN ls -la
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]