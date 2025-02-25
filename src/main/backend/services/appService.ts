import { Sequelize, Transaction } from 'sequelize';
import { DispatchService } from './dispatchService';
import { Instance } from '../entities/instance';
import { Config } from '../entities/config';
import { Plugin } from '../entities/plugin';

export class AppService {
  private dispatchService: DispatchService;

  private sequelize: Sequelize;

  constructor(dispatchService: DispatchService, sequelize: Sequelize) {
    this.dispatchService = dispatchService;
    this.sequelize = sequelize;
  }

  public async getTasks(): Promise<
    {
      task_id: string;
      env_id: string;
      app_id: string;
    }[]
  > {
    try {
      const instances = await Instance.findAll();
      return instances.map((instance) => ({
        task_id: String(instance.id),
        env_id: instance.env_id,
        app_id: instance.app_id,
      }));
    } catch (error) {
      console.error('Error in getTasks:', error);
      return [];
    }
  }

  /**
   * 初始化全部任务
   */
  public async initTasks(): Promise<void> {
    try {
      const instances = await Instance.findAll();
      await this.dispatchService.updateTasks(instances);
    } catch (error) {
      console.error('Error in initTasks:', error);
    }
  }

  /**
   * 添加一个任务
   */
  public async addTask(appId: string): Promise<Instance | null> {
    let transaction;
    try {
      // 开始事务
      transaction = await this.sequelize.transaction();

      // 创建实例
      const instance = await Instance.create(
        {
          app_id: appId,
          created_at: new Date(),
          env_id: 'development', // 设置默认值
        },
        { transaction },
      );

      // 取得全部 Tasks 然后全部更新
      const tasks = await Instance.findAll();
      tasks.push(instance);

      try {
        const result = await this.dispatchService.updateTasks(tasks);
        if (!result) {
          throw new Error('更新任务失败：没有收到响应');
        }

        // 提交事务
        await transaction.commit();
        return instance;
      } catch (error) {
        // 如果更新任务失败，回滚事务
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      // 确保在出错时回滚事务
      if (transaction) {
        await transaction.rollback();
      }
      console.error('添加任务失败:', error);
      return null;
    }
  }

  /**
   * 移除一个任务
   */
  public async removeTask(taskId: string): Promise<boolean> {
    const instance = await Instance.findByPk(taskId);

    if (!instance) {
      return false;
    }

    await instance.destroy();

    // 找到对应的 Config 删除
    const config = await Config.findOne({
      where: { instance_id: taskId },
    });
    if (config) {
      // 检查是否使用插件
      if (config.plugin_id) {
        const plugin = await Plugin.findOne({
          where: { id: config.plugin_id },
        });
        if (plugin) {
          await plugin.destroy();
        }
      }

      await config.destroy();
    }

    // 取得全部 Tasks 然后全部更新
    const tasks = await Instance.findAll();
    await this.dispatchService.updateTasks(tasks);

    return true;
  }
}
