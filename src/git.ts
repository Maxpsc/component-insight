import simpleGit from 'simple-git';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import ora from 'ora';

/**
 * Git仓库管理器
 */
export class GitManager {
  private tempDir: string;

  constructor(tempDir?: string) {
    this.tempDir = tempDir || path.join(os.tmpdir(), 'component-insight');
  }

  /**
   * 克隆仓库到本地临时目录
   */
  async cloneRepository(repositoryUrl: string): Promise<string> {
    const spinner = ora('正在克隆仓库...').start();
    
    try {
      // 确保临时目录存在
      await fs.ensureDir(this.tempDir);
      
      // 生成唯一的项目目录名
      const projectName = this.extractProjectName(repositoryUrl);
      const timestamp = Date.now();
      const projectDir = path.join(this.tempDir, `${projectName}-${timestamp}`);
      
      // 克隆仓库
      const git = simpleGit();
      await git.clone(repositoryUrl, projectDir, {
        '--depth': 1, // 浅克隆，只获取最新提交
        '--single-branch': null // 只克隆默认分支
      });
      
      spinner.succeed(chalk.green(`仓库克隆成功: ${projectDir}`));
      return projectDir;
    } catch (error) {
      spinner.fail(chalk.red('仓库克隆失败'));
      throw new Error(`克隆仓库失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 清理临时目录
   */
  async cleanup(projectDir?: string): Promise<void> {
    try {
      const targetDir = projectDir || this.tempDir;
      
      if (await fs.pathExists(targetDir)) {
        await fs.remove(targetDir);
        console.log(chalk.gray(`已清理临时目录: ${targetDir}`));
      }
    } catch (error) {
      console.warn(chalk.yellow(`清理临时目录失败: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  /**
   * 检查目录是否为Git仓库
   */
  async isGitRepository(dir: string): Promise<boolean> {
    try {
      const git = simpleGit(dir);
      await git.status();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取仓库信息
   */
  async getRepositoryInfo(dir: string): Promise<{
    branch: string;
    lastCommit: string;
    remoteUrl?: string;
  }> {
    try {
      const git = simpleGit(dir);
      const status = await git.status();
      const log = await git.log({ maxCount: 1 });
      const remotes = await git.getRemotes(true);
      
      return {
        branch: status.current || 'unknown',
        lastCommit: log.latest?.hash.substring(0, 8) || 'unknown',
        remoteUrl: remotes.find((r: any) => r.name === 'origin')?.refs?.fetch
      };
    } catch (error) {
      throw new Error(`获取仓库信息失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 从Git URL提取项目名称
   */
  private extractProjectName(repositoryUrl: string): string {
    try {
      // 处理不同格式的Git URL
      let projectName: string;
      
      if (repositoryUrl.includes('github.com') || repositoryUrl.includes('gitlab.com')) {
        // https://github.com/user/repo.git 或 git@github.com:user/repo.git
        const match = repositoryUrl.match(/[\/:]([^\/]+)\/([^\/]+?)(?:\.git)?$/);
        if (match) {
          projectName = match[2];
        } else {
          projectName = 'unknown-project';
        }
      } else {
        // 其他格式，尝试从URL末尾提取
        const parts = repositoryUrl.split('/');
        projectName = parts[parts.length - 1].replace('.git', '') || 'unknown-project';
      }
      
      // 清理项目名称，确保是有效的目录名
      return projectName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
    } catch {
      return 'unknown-project';
    }
  }

  /**
   * 验证Git URL格式
   */
  static validateGitUrl(url: string): boolean {
    const gitUrlPatterns = [
      /^https?:\/\/.+\.git$/,
      /^git@.+:.+\.git$/,
      /^https?:\/\/github\.com\/.+\/.+$/,
      /^https?:\/\/gitlab\.com\/.+\/.+$/,
      /^https?:\/\/.+\/.+$/
    ];
    
    return gitUrlPatterns.some(pattern => pattern.test(url));
  }
}
