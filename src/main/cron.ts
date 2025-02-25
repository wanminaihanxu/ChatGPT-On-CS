import axios from 'axios';
import { BrowserWindow } from 'electron';
import { setCron } from './system/cron';
import type BackendServiceManager from './system/backend';

let developmentPort: number | null = null;

export const setDevelopmentPort = (port: number) => {
  developmentPort = port;
};

const setupCron = (mainWindow: BrowserWindow, bsm: BackendServiceManager) => {
  const baseURL = (url: string) => {
    if (process.env.NODE_ENV === 'development') {
      if (!developmentPort) {
        throw new Error('Development port not set');
      }
      return `http://127.0.0.1:${developmentPort}/${url}`;
    }
    return `http://127.0.0.1:${bsm.getPort()}/${url}`;
  };

  // 每隔 5 秒执行一次，通知和渲染进程刷新配置
  setCron('*/5 * * * * *', () => {
    mainWindow.webContents.send('refresh-config');
  });

  // 每隔 5 秒执行一次检查后端服务是否健康
  setCron('*/5 * * * * *', async () => {
    try {
      const {
        data: { data },
      } = await axios.get(baseURL(`api/v1/base/health`));
      mainWindow.webContents.send('check-health', data);
    } catch (error) {
      console.error('Health check failed:', error);
    }
  });

  // 每隔 5 秒同步一次 Backend 服务的状态
  setCron('*/20 * * * * *', async () => {
    try {
      await axios.post(baseURL('api/v1/base/sync'), {});
    } catch (error) {
      console.error('Error syncing backend service status:', error);
    }
  });
};

export default setupCron;
