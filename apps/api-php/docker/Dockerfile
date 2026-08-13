FROM php:5.6-apache

RUN sed -ri \
      -e 's!deb.debian.org/debian!archive.debian.org/debian!g' \
      -e 's!security.debian.org/debian-security!archive.debian.org/debian-security!g' \
      -e '/stretch-updates/d' \
      /etc/apt/sources.list \
    && printf 'Acquire::Check-Valid-Until "false";\n' > /etc/apt/apt.conf.d/99archive \
    && apt-get update \
    && apt-get install -y --allow-unauthenticated --no-install-recommends libjpeg62-turbo-dev libpng-dev \
    && a2enmod headers rewrite \
    && docker-php-ext-configure gd --with-jpeg-dir=/usr --with-png-dir=/usr \
    && docker-php-ext-install gd pdo_mysql \
    && rm -rf /var/lib/apt/lists/*

ENV APACHE_DOCUMENT_ROOT=/var/www/html/public

RUN sed -ri 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' \
      /etc/apache2/sites-available/*.conf \
      /etc/apache2/apache2.conf \
      /etc/apache2/conf-available/*.conf \
    && printf '<Directory /var/www/html/public>\nAllowOverride All\nRequire all granted\n</Directory>\n' \
      > /etc/apache2/conf-available/police-api.conf \
    && a2enconf police-api \
    && mkdir -p /var/www/html/public/image_emer

COPY deploy/image.htaccess /var/www/html/public/image_emer/.htaccess

RUN chown -R www-data:www-data /var/www/html/public/image_emer \
    && find /var/www/html/public/image_emer -type d -exec chmod 0755 {} \; \
    && find /var/www/html/public/image_emer -type f -exec chmod 0644 {} \;

WORKDIR /var/www/html
