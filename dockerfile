FROM nginx:alpine
WORKDIR /usr/share/nginx/html
COPY . .
RUN ls -la
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]