# Stage 1: Build the React application
FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm install

# Khai báo ARG trước khi sử dụng trong ENV (Bắt buộc để nhận biến từ Railway/Render)
ARG REACT_APP_SHEET_ID
ARG REACT_APP_APPSHEET_APP_ID
ARG REACT_APP_APPSHEET_ACCESS_KEY
ARG REACT_APP_APPSHEET_TABLE_NAME

# Thiết lập biến môi trường từ ARG để React có thể nhận được khi build
ENV REACT_APP_SHEET_ID=$REACT_APP_SHEET_ID
ENV REACT_APP_APPSHEET_APP_ID=$REACT_APP_APPSHEET_APP_ID
ENV REACT_APP_APPSHEET_ACCESS_KEY=$REACT_APP_APPSHEET_ACCESS_KEY
ENV REACT_APP_APPSHEET_TABLE_NAME=$REACT_APP_APPSHEET_TABLE_NAME

COPY . .
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]