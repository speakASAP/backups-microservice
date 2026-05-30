export default () => ({
  port: parseInt(process.env.PORT || '3398', 10),
  serviceName: process.env.SERVICE_NAME || 'backups-microservice',
  database: {
    host: process.env.DB_HOST || 'db-server-postgres',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'dbadmin',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'backups',
  },
  logging: {
    serviceUrl: process.env.LOGGING_SERVICE_URL || 'http://logging-microservice.statex-apps.svc.cluster.local:3367',
    apiPath: process.env.LOGGING_SERVICE_API_PATH || '/api/logs',
  },
  notifications: {
    serviceUrl: process.env.NOTIFICATION_SERVICE_URL || 'http://notifications-microservice.statex-apps.svc.cluster.local:3368',
  },
  auth: {
    serviceUrl: process.env.AUTH_SERVICE_URL || 'http://auth-microservice.statex-apps.svc.cluster.local:3370',
  },
  minio: {
    serviceUrl: process.env.MINIO_SERVICE_URL || 'http://minio-microservice.statex-apps.svc.cluster.local:9000',
    accessKey: process.env.MINIO_ACCESS_KEY || '',
    secretKey: process.env.MINIO_SECRET_KEY || '',
    bucket: process.env.MINIO_BACKUP_BUCKET || 'backups',
  },
});
