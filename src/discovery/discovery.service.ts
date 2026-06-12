import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as https from 'https';

type K8sItem = {
  metadata?: {
    name?: string;
    namespace?: string;
    labels?: Record<string, string>;
  };
  spec?: any;
  status?: any;
};

@Injectable()
export class DiscoveryService {
  async kubernetes() {
    try {
      const [services, deployments, statefulSets] = await Promise.all([
        this.kubernetesJson('/api/v1/services'),
        this.kubernetesJson('/apis/apps/v1/deployments'),
        this.kubernetesJson('/apis/apps/v1/statefulsets'),
      ]);

      const serviceRows = services.map((item) => this.serviceRow(item));
      const workloads = [...deployments.map((item) => this.workloadRow(item, 'deployment')), ...statefulSets.map((item) => this.workloadRow(item, 'statefulset'))];
      const databases = serviceRows.filter((service) => service.backup_kind === 'postgres');

      return {
        available: true,
        generated_at: new Date().toISOString(),
        databases,
        services: serviceRows,
        workloads,
      };
    } catch (error) {
      return {
        available: false,
        generated_at: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unable to inspect Kubernetes services',
        databases: [],
        services: [],
        workloads: [],
      };
    }
  }

  private async kubernetesJson(path: string): Promise<K8sItem[]> {
    const host = process.env.KUBERNETES_SERVICE_HOST;
    const port = process.env.KUBERNETES_SERVICE_PORT || '443';
    const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
    const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
    if (!host || !fs.existsSync(tokenPath)) throw new Error('Kubernetes service account is not available');

    const token = fs.readFileSync(tokenPath, 'utf8');
    const ca = fs.existsSync(caPath) ? fs.readFileSync(caPath) : undefined;
    const parsed = await new Promise<any>((resolve, reject) => {
      const request = https.request({
        host,
        port,
        path,
        method: 'GET',
        ca,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        timeout: 6000,
      }, (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => {
          if (!response.statusCode || response.statusCode >= 400) {
            reject(new Error(`Kubernetes API ${path} failed with ${response.statusCode}: ${body.slice(0, 180)}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      });
      request.on('error', reject);
      request.on('timeout', () => request.destroy(new Error(`Kubernetes API ${path} timed out`)));
      request.end();
    });
    return Array.isArray(parsed.items) ? parsed.items : [];
  }

  private serviceRow(item: K8sItem) {
    const name = item.metadata?.name || '';
    const namespace = item.metadata?.namespace || '';
    const labels = item.metadata?.labels || {};
    const ports = Array.isArray(item.spec?.ports) ? item.spec.ports : [];
    const portNumbers = ports.map((port) => Number(port.port)).filter(Boolean);
    const joined = `${name} ${Object.values(labels).join(' ')}`.toLowerCase();
    const isPostgres = portNumbers.includes(5432) || /postgres|postgresql|pg-/.test(joined);
    const backupKind = isPostgres ? 'postgres' : /mysql|mariadb|mongo|redis/.test(joined) ? 'database' : 'service';
    const primaryPort = portNumbers[0] || null;

    return {
      name,
      namespace,
      type: item.spec?.type || 'ClusterIP',
      cluster_ip: item.spec?.clusterIP || null,
      host: namespace ? `${name}.${namespace}.svc.cluster.local` : name,
      ports: portNumbers,
      app: labels.app || labels['app.kubernetes.io/name'] || null,
      backup_kind: backupKind,
      backup_ready: backupKind === 'postgres',
      suggested_database: this.suggestDatabaseName(name),
      suggested_port: isPostgres ? 5432 : primaryPort,
    };
  }

  private workloadRow(item: K8sItem, kind: string) {
    const containers = item.spec?.template?.spec?.containers || [];
    return {
      kind,
      name: item.metadata?.name || '',
      namespace: item.metadata?.namespace || '',
      ready: item.status?.readyReplicas || 0,
      replicas: item.status?.replicas || item.spec?.replicas || 0,
      images: containers.map((container) => container.image).filter(Boolean),
    };
  }

  private suggestDatabaseName(serviceName: string): string {
    const cleaned = serviceName
      .replace(/-?(postgres|postgresql|database|db|service|svc)$/i, '')
      .replace(/^postgres-?/i, '')
      .replace(/[^a-zA-Z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return cleaned || 'postgres';
  }
}
