import axios, { type AxiosInstance } from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';

let cached: AxiosInstance | null = null;

export function getHttpClient(): AxiosInstance {
  if (cached) return cached;

  const server = process.env.PROXY_SERVER;
  const user = process.env.PROXY_USERNAME;
  const pass = process.env.PROXY_PASSWORD;

  if (server) {
    const url = user && pass
      ? server.replace('://', `://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@`)
      : server;
    const agent = new SocksProxyAgent(url);
    cached = axios.create({ httpAgent: agent, httpsAgent: agent });
  } else {
    cached = axios.create();
  }
  return cached;
}
