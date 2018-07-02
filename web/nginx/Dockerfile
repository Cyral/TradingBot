FROM nginx:1.13.5

RUN rm /etc/nginx/conf.d/default.conf
COPY ./sites /etc/nginx/conf.d/

EXPOSE 80

CMD nginx -g "daemon off;"
