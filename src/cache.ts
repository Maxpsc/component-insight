import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import chalk from 'chalk';
import { ComponentInfo, LibraryInfo } from './types.js';

/**
 * 缓存管理器
 */
export class CacheManager {
  private cacheDir: string;
  private enabled: boolean;

  constructor(cacheDir: string = './cache', enabled: boolean = true) {
    this.cacheDir = cacheDir;
    this.enabled = enabled;
  }

  /**
   * 初始化缓存目录
   */
  async initialize(): Promise<void> {
    if (!this.enabled) return;

    try {
      await fs.ensureDir(this.cacheDir);
      await fs.ensureDir(path.join(this.cacheDir, 'repositories'));
      await fs.ensureDir(path.join(this.cacheDir, 'components'));
      await fs.ensureDir(path.join(this.cacheDir, 'libraries'));
    } catch (error) {
      console.warn(chalk.yellow(`缓存目录初始化失败: ${error instanceof Error ? error.message : String(error)}`));
      this.enabled = false;
    }
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(data: any): string {
    const hash = crypto.createHash('md5');
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
  }

  /**
   * 缓存仓库信息
   */
  async cacheRepository(
    repositoryUrl: string,
    commitHash: string,
    data: {
      files: Array<{ path: string; content: string; lastModified: string }>;
      components: string[];
    }
  ): Promise<void> {
    if (!this.enabled) return;

    try {
      const cacheKey = this.generateCacheKey({ repositoryUrl, commitHash });
      const cachePath = path.join(this.cacheDir, 'repositories', `${cacheKey}.json`);
      
      const cacheData = {
        repositoryUrl,
        commitHash,
        cachedAt: new Date().toISOString(),
        data
      };

      await fs.writeFile(cachePath, JSON.stringify(cacheData, null, 2));
      console.log(chalk.gray(`仓库信息已缓存: ${cacheKey}`));
    } catch (error) {
      console.warn(chalk.yellow(`缓存仓库信息失败: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  /**
   * 获取缓存的仓库信息
   */
  async getCachedRepository(
    repositoryUrl: string,
    commitHash: string
  ): Promise<{
    files: Array<{ path: string; content: string; lastModified: string }>;
    components: string[];
  } | null> {
    if (!this.enabled) return null;

    try {
      const cacheKey = this.generateCacheKey({ repositoryUrl, commitHash });
      const cachePath = path.join(this.cacheDir, 'repositories', `${cacheKey}.json`);
      
      if (!await fs.pathExists(cachePath)) {
        return null;
      }

      const cacheData = await fs.readJSON(cachePath);
      
      // 检查缓存是否过期（7天）
      const cachedAt = new Date(cacheData.cachedAt);
      const now = new Date();
      const daysDiff = (now.getTime() - cachedAt.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff > 7) {
        console.log(chalk.gray(`仓库缓存已过期: ${cacheKey}`));
        await fs.remove(cachePath);
        return null;
      }

      console.log(chalk.gray(`使用缓存的仓库信息: ${cacheKey}`));
      return cacheData.data;
    } catch (error) {
      console.warn(chalk.yellow(`读取仓库缓存失败: ${error instanceof Error ? error.message : String(error)}`));
      return null;
    }
  }

  /**
   * 缓存组件分析结果
   */
  async cacheComponent(
    componentName: string,
    codeHash: string,
    componentInfo: ComponentInfo
  ): Promise<void> {
    if (!this.enabled) return;

    try {
      const cacheKey = this.generateCacheKey({ componentName, codeHash });
      const cachePath = path.join(this.cacheDir, 'components', `${cacheKey}.json`);
      
      const cacheData = {
        componentName,
        codeHash,
        cachedAt: new Date().toISOString(),
        componentInfo
      };

      await fs.writeFile(cachePath, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      console.warn(chalk.yellow(`缓存组件分析失败: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  /**
   * 获取缓存的组件分析结果
   */
  async getCachedComponent(
    componentName: string,
    codeHash: string
  ): Promise<ComponentInfo | null> {
    if (!this.enabled) return null;

    try {
      const cacheKey = this.generateCacheKey({ componentName, codeHash });
      const cachePath = path.join(this.cacheDir, 'components', `${cacheKey}.json`);
      
      if (!await fs.pathExists(cachePath)) {
        return null;
      }

      const cacheData = await fs.readJSON(cachePath);
      
      // 检查缓存是否过期（3天）
      const cachedAt = new Date(cacheData.cachedAt);
      const now = new Date();
      const daysDiff = (now.getTime() - cachedAt.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff > 3) {
        await fs.remove(cachePath);
        return null;
      }

      console.log(chalk.gray(`使用缓存的组件分析: ${componentName}`));
      return cacheData.componentInfo;
    } catch (error) {
      console.warn(chalk.yellow(`读取组件缓存失败: ${error instanceof Error ? error.message : String(error)}`));
      return null;
    }
  }

  /**
   * 缓存组件库分析结果
   */
  async cacheLibrary(
    repositoryUrl: string,
    packageJsonHash: string,
    libraryInfo: LibraryInfo
  ): Promise<void> {
    if (!this.enabled) return;

    try {
      const cacheKey = this.generateCacheKey({ repositoryUrl, packageJsonHash });
      const cachePath = path.join(this.cacheDir, 'libraries', `${cacheKey}.json`);
      
      const cacheData = {
        repositoryUrl,
        packageJsonHash,
        cachedAt: new Date().toISOString(),
        libraryInfo
      };

      await fs.writeFile(cachePath, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      console.warn(chalk.yellow(`缓存组件库分析失败: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  /**
   * 获取缓存的组件库分析结果
   */
  async getCachedLibrary(
    repositoryUrl: string,
    packageJsonHash: string
  ): Promise<LibraryInfo | null> {
    if (!this.enabled) return null;

    try {
      const cacheKey = this.generateCacheKey({ repositoryUrl, packageJsonHash });
      const cachePath = path.join(this.cacheDir, 'libraries', `${cacheKey}.json`);
      
      if (!await fs.pathExists(cachePath)) {
        return null;
      }

      const cacheData = await fs.readJSON(cachePath);
      
      // 检查缓存是否过期（7天）
      const cachedAt = new Date(cacheData.cachedAt);
      const now = new Date();
      const daysDiff = (now.getTime() - cachedAt.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff > 7) {
        await fs.remove(cachePath);
        return null;
      }

      console.log(chalk.gray(`使用缓存的组件库分析: ${repositoryUrl}`));
      return cacheData.libraryInfo;
    } catch (error) {
      console.warn(chalk.yellow(`读取组件库缓存失败: ${error instanceof Error ? error.message : String(error)}`));
      return null;
    }
  }

  /**
   * 生成文件内容哈希
   */
  generateFileHash(content: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(content);
    return hash.digest('hex').substring(0, 16);
  }

  /**
   * 清理过期缓存
   */
  async cleanExpiredCache(): Promise<void> {
    if (!this.enabled) return;

    try {
      const cacheTypes = ['repositories', 'components', 'libraries'];
      const expiryDays = { repositories: 7, components: 3, libraries: 7 };
      
      for (const cacheType of cacheTypes) {
        const cacheTypeDir = path.join(this.cacheDir, cacheType);
        
        if (!await fs.pathExists(cacheTypeDir)) continue;
        
        const files = await fs.readdir(cacheTypeDir);
        let cleanedCount = 0;
        
        for (const file of files) {
          const filePath = path.join(cacheTypeDir, file);
          
          try {
            const cacheData = await fs.readJSON(filePath);
            const cachedAt = new Date(cacheData.cachedAt);
            const now = new Date();
            const daysDiff = (now.getTime() - cachedAt.getTime()) / (1000 * 60 * 60 * 24);
            
            if (daysDiff > expiryDays[cacheType as keyof typeof expiryDays]) {
              await fs.remove(filePath);
              cleanedCount++;
            }
          } catch (error) {
            // 如果文件损坏，删除它
            await fs.remove(filePath);
            cleanedCount++;
          }
        }
        
        if (cleanedCount > 0) {
          console.log(chalk.gray(`清理 ${cacheType} 缓存: ${cleanedCount} 个文件`));
        }
      }
    } catch (error) {
      console.warn(chalk.yellow(`清理缓存失败: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<{
    enabled: boolean;
    totalFiles: number;
    totalSize: number;
    byType: Record<string, { files: number; size: number }>;
  }> {
    if (!this.enabled) {
      return {
        enabled: false,
        totalFiles: 0,
        totalSize: 0,
        byType: {}
      };
    }

    try {
      const stats = {
        enabled: true,
        totalFiles: 0,
        totalSize: 0,
        byType: {} as Record<string, { files: number; size: number }>
      };

      const cacheTypes = ['repositories', 'components', 'libraries'];
      
      for (const cacheType of cacheTypes) {
        const cacheTypeDir = path.join(this.cacheDir, cacheType);
        
        if (!await fs.pathExists(cacheTypeDir)) {
          stats.byType[cacheType] = { files: 0, size: 0 };
          continue;
        }
        
        const files = await fs.readdir(cacheTypeDir);
        let typeSize = 0;
        
        for (const file of files) {
          const filePath = path.join(cacheTypeDir, file);
          const stat = await fs.stat(filePath);
          typeSize += stat.size;
        }
        
        stats.byType[cacheType] = {
          files: files.length,
          size: typeSize
        };
        
        stats.totalFiles += files.length;
        stats.totalSize += typeSize;
      }

      return stats;
    } catch (error) {
      console.warn(chalk.yellow(`获取缓存统计失败: ${error instanceof Error ? error.message : String(error)}`));
      return {
        enabled: false,
        totalFiles: 0,
        totalSize: 0,
        byType: {}
      };
    }
  }

  /**
   * 清空所有缓存
   */
  async clearCache(): Promise<void> {
    if (!this.enabled) return;

    try {
      if (await fs.pathExists(this.cacheDir)) {
        await fs.remove(this.cacheDir);
        console.log(chalk.green('所有缓存已清空'));
      }
    } catch (error) {
      console.warn(chalk.yellow(`清空缓存失败: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  /**
   * 禁用缓存
   */
  disable(): void {
    this.enabled = false;
  }

  /**
   * 启用缓存
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * 检查缓存是否启用
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}
