# Deployment

Use Docker Compose for a production preview and a managed MySQL 8/S3 service for production. Terminate TLS at the edge, set strict CORS origins, rotate database/JWT/S3 credentials, disable development bypass and decide whether Swagger is exposed.

1. Copy `.env.example` to `.env` and replace every secret placeholder.
2. Build immutable API and Admin Web images.
3. Run Prisma deploy migrations before starting new API replicas.
4. Mount durable local uploads only for previews; use S3-compatible storage for multi-replica deployments.
5. Expose only Nginx, keep MySQL private, and monitor `/api/v1/health` plus `/api/v1/ready`.

Back up MySQL with `mysqldump` and object storage together. Test restore and token-secret rotation before go-live. MySQL must use `utf8mb4`, `utf8mb4_unicode_ci` and UTC in every environment.
