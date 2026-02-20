/**
 * Figma API 서비스
 * 
 * Figma REST API를 호출하여 기획서 정보를 조회합니다.
 */

import axios, { AxiosInstance } from 'axios';

export interface FigmaFile {
  key: string;
  name: string;
  lastModified: string;
}

export interface FigmaScreen {
  screenId: string;
  pageTitle: string;
  author: string;
  nodeId: string;
  description: string;
  fileKey: string;
  version: string;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  characters?: string;
}

export class FigmaService {
  private api: AxiosInstance;
  private teamId: string;

  constructor(token: string, teamId: string) {
    this.teamId = teamId;
    this.api = axios.create({
      baseURL: 'https://api.figma.com/v1',
      headers: {
        'X-Figma-Token': token,
      },
    });
  }

  /**
   * 팀의 프로젝트 목록 조회
   */
  async getProjects(): Promise<any[]> {
    try {
      const response = await this.api.get(`/teams/${this.teamId}/projects`);
      return response.data.projects || [];
    } catch (error) {
      throw new Error(`Figma 프로젝트 조회 실패: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * 프로젝트의 파일 목록 조회
   */
  async getProjectFiles(projectId: string): Promise<FigmaFile[]> {
    try {
      const response = await this.api.get(`/projects/${projectId}/files`);
      return response.data.files || [];
    } catch (error) {
      throw new Error(`Figma 파일 목록 조회 실패: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * 프로젝트명으로 프로젝트 찾기
   */
  async findProjectByName(projectName: string): Promise<any | null> {
    const projects = await this.getProjects();
    return projects.find(p => 
      p.name.toLowerCase().includes(projectName.toLowerCase())
    ) || null;
  }

  /**
   * 버전으로 파일 찾기
   */
  async findFileByVersion(projectId: string, version: string): Promise<FigmaFile | null> {
    const files = await this.getProjectFiles(projectId);
    return files.find(f => f.name.includes(version)) || null;
  }

  /**
   * Figma 파일 내용 조회
   */
  async getFileContent(fileKey: string, nodeId?: string, depth: number = 5): Promise<any> {
    try {
      const params: any = { depth };
      if (nodeId) {
        params.ids = nodeId;
      }
      
      const response = await this.api.get(`/files/${fileKey}`, { params });
      return response.data;
    } catch (error) {
      throw new Error(`Figma 파일 내용 조회 실패: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * 특정 노드 내용 조회
   */
  async getNodeContent(fileKey: string, nodeId: string): Promise<any> {
    try {
      const response = await this.api.get(`/files/${fileKey}/nodes`, {
        params: { ids: nodeId },
      });
      return response.data.nodes[nodeId];
    } catch (error) {
      throw new Error(`Figma 노드 조회 실패: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * 화면 ID로 화면 찾기
   */
  async findScreenById(
    fileKey: string,
    screenId: string
  ): Promise<FigmaScreen | null> {
    try {
      const fileContent = await this.getFileContent(fileKey, undefined, 5);
      
      if (!fileContent || !fileContent.document) {
        return null;
      }

      let foundScreen: FigmaScreen | null = null;

      const traverse = (node: FigmaNode): boolean => {
        if (node.type === 'FRAME' || node.type === 'CANVAS' || node.type === 'SECTION') {
          // Screen ID 노드 찾기
          const screenIdNode = this.findTextNodeWithContent(node, screenId);
          const pageTitleNode = node.children?.find(c => 
            c.name === 'Page Title' && c.children?.some(gc => 
              gc.name === 'page title' && gc.children?.some(ggc => 
                ggc.type === 'TEXT'
              )
            )
          );

          if (screenIdNode && pageTitleNode) {
            const titleTextNode = this.findDeepTextNode(pageTitleNode);
            const authorNode = node.children?.find(c => 
              c.name === 'Frame 10' && c.children?.some(gc => 
                gc.name === 'name'
              )
            );
            const authorText = authorNode ? this.findDeepTextNode(authorNode)?.characters : 'N/A';

            foundScreen = {
              screenId,
              pageTitle: titleTextNode?.characters || 'Unknown',
              author: authorText || 'N/A',
              nodeId: node.id,
              description: '', // Will be fetched separately
              fileKey,
              version: '',
            };
            return true;
          }
        }

        if (node.children) {
          for (const child of node.children) {
            if (traverse(child)) {
              return true;
            }
          }
        }
        return false;
      };

      traverse(fileContent.document);
      return foundScreen;
    } catch (error) {
      throw new Error(`화면 검색 실패: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * 화면 상세 설명 가져오기
   */
  async getScreenDescription(fileKey: string, nodeId: string): Promise<string> {
    try {
      const nodeContent = await this.getNodeContent(fileKey, nodeId);
      
      if (!nodeContent || !nodeContent.document) {
        return '';
      }

      // Description Frame 찾기
      const descriptionFrame = this.findDescriptionFrame(nodeContent.document);
      if (!descriptionFrame) {
        return '';
      }

      // 텍스트 추출
      const texts = this.extractAllTexts(descriptionFrame);
      return texts.join('\n');
    } catch (error) {
      console.error('설명 조회 오류:', error);
      return '';
    }
  }

  /**
   * Description Frame 찾기
   */
  private findDescriptionFrame(node: FigmaNode): FigmaNode | null {
    if (node.name === 'Description Frame') {
      return node;
    }

    if (node.name === 'Paper' && node.children) {
      const mainFrame = node.children.find(c => c.name === 'Main & Descriprion Frame');
      if (mainFrame && mainFrame.children) {
        return mainFrame.children.find(c => c.name === 'Description Frame') || null;
      }
    }

    if (node.children) {
      for (const child of node.children) {
        const found = this.findDescriptionFrame(child);
        if (found) return found;
      }
    }

    return null;
  }

  /**
   * 모든 텍스트 추출
   */
  private extractAllTexts(node: FigmaNode): string[] {
    const texts: string[] = [];

    if (node.type === 'TEXT' && node.characters && node.characters.trim().length > 1) {
      // 불필요한 레이블 제외
      const excludeLabels = ['Screen ID', 'Page Title', 'Author', 'Description', 'Changelog', 'CONTRABASS'];
      if (!excludeLabels.includes(node.characters)) {
        texts.push(node.characters);
      }
    }

    if (node.children) {
      for (const child of node.children) {
        texts.push(...this.extractAllTexts(child));
      }
    }

    return texts;
  }

  /**
   * 특정 텍스트를 포함하는 TEXT 노드 찾기
   */
  private findTextNodeWithContent(node: FigmaNode, searchText: string): FigmaNode | null {
    if (node.type === 'TEXT' && node.characters === searchText) {
      return node;
    }

    if (node.children) {
      for (const child of node.children) {
        const found = this.findTextNodeWithContent(child, searchText);
        if (found) return found;
      }
    }

    return null;
  }

  /**
   * 깊이 우선 탐색으로 첫 TEXT 노드 찾기
   */
  private findDeepTextNode(node: FigmaNode): FigmaNode | null {
    if (node.type === 'TEXT' && node.characters) {
      return node;
    }

    if (node.children) {
      for (const child of node.children) {
        const found = this.findDeepTextNode(child);
        if (found) return found;
      }
    }

    return null;
  }

  /**
   * 에러 메시지 추출
   */
  private getErrorMessage(error: any): string {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        return `HTTP ${error.response.status}: ${error.response.data.err || error.response.data.message || error.message}`;
      }
      return error.message;
    }
    return String(error);
  }

  /**
   * 실시간 화면 검색 (Fallback)
   * metadata에 없는 화면을 Figma API에서 직접 검색
   */
  async searchScreensInRealtime(
    keywords: string[],
    projectName?: string,
    versionPattern?: string,
    maxResults: number = 5
  ): Promise<FigmaScreen[]> {
    const results: FigmaScreen[] = [];

    try {
      // 프로젝트 목록 가져오기
      const projects = await this.getProjects();
      
      // 프로젝트 필터링
      const filteredProjects = projectName
        ? projects.filter(p => p.name === projectName)
        : projects;

      for (const project of filteredProjects) {
        // 파일 목록 가져오기
        const files = await this.getProjectFiles(project.id);

        // 버전 패턴으로 필터링
        const filteredFiles = versionPattern
          ? files.filter(f => f.name.includes(versionPattern))
          : files;

        for (const file of filteredFiles) {
          try {
            // 파일 내용 가져오기 (depth=10)
            const fileContent = await this.getFileContent(file.key, undefined, 10);
            
            if (!fileContent?.document) continue;

            // 모든 FRAME 노드 찾기
            const frames = this.findAllFrames(fileContent.document);

            for (const frame of frames) {
              // 화면 ID 패턴 확인
              const screenIdPattern = /^([A-Z]+-\d{2}_\d{2}_\d{2})/;
              const match = frame.name?.match(screenIdPattern);
              
              if (!match) continue;

              // 화면 정보 추출
              const screenInfo = this.extractScreenInfoFromNode(frame, file, project.name);
              
              if (!screenInfo) continue;

              // 키워드 매칭 확인
              const searchText = `
                ${screenInfo.screenId}
                ${screenInfo.pageTitle}
                ${screenInfo.description}
              `.toLowerCase();

              const matchCount = keywords.filter(k => searchText.includes(k.toLowerCase())).length;

              if (matchCount > 0) {
                results.push(screenInfo);
                
                if (results.length >= maxResults) {
                  return results;
                }
              }
            }
          } catch (error) {
            // 파일별 에러는 무시하고 계속 진행
            console.error(`파일 검색 실패 (${file.name}):`, this.getErrorMessage(error));
          }

          // Rate limit 방지
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      return results;
    } catch (error) {
      throw new Error(`실시간 검색 실패: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * 모든 FRAME 노드 찾기
   */
  private findAllFrames(node: FigmaNode): FigmaNode[] {
    const frames: FigmaNode[] = [];

    if (node.type === 'FRAME' || node.type === 'SECTION') {
      frames.push(node);
    }

    if (node.children) {
      for (const child of node.children) {
        frames.push(...this.findAllFrames(child));
      }
    }

    return frames;
  }

  /**
   * 노드에서 화면 정보 추출
   */
  private extractScreenInfoFromNode(
    node: FigmaNode,
    file: FigmaFile,
    _projectName: string
  ): FigmaScreen | null {
    const screenIdPattern = /^([A-Z]+-\d{2}_\d{2}_\d{2})/;
    const match = node.name?.match(screenIdPattern);
    
    if (!match) return null;

    const screenId = match[1];

    // Page Title 찾기
    let pageTitle = 'Unknown';
    const pageTitleValue = this.findNextTextValue(node, 'Page Title');
    if (pageTitleValue) {
      pageTitle = pageTitleValue;
    }

    // Author 찾기
    let author = 'N/A';
    const authorValue = this.findNextTextValue(node, 'Author');
    if (authorValue) {
      author = authorValue;
    }

    // Description 수집
    const descriptions = this.collectDescriptionsFromNode(node);
    const description = descriptions.join('\n').trim();

    // 버전 추출
    const versionMatch = file.name.match(/(\d+\.\d+\.\d+)/);
    const version = versionMatch ? versionMatch[1] : 'unknown';

    return {
      screenId,
      pageTitle,
      author,
      nodeId: node.id,
      description,
      fileKey: file.key,
      version,
    };
  }

  /**
   * 라벨 다음의 TEXT 값 찾기
   */
  private findNextTextValue(node: FigmaNode, labelName: string): string | null {
    let foundLabel = false;
    let result = '';

    const traverse = (n: FigmaNode): void => {
      if (result) return;

      if (n.type === 'TEXT' && n.characters) {
        if (n.name === labelName || n.characters === labelName) {
          foundLabel = true;
          return;
        }
        if (foundLabel && n.characters !== labelName) {
          result = n.characters;
          return;
        }
      }

      if (n.children) {
        for (const child of n.children) {
          if (result) break;
          traverse(child);
        }
      }
    };

    traverse(node);
    return result || null;
  }

  /**
   * Description 수집
   */
  private collectDescriptionsFromNode(node: FigmaNode): string[] {
    const descriptions: string[] = [];
    let inDescriptionSection = false;

    const traverse = (n: FigmaNode): void => {
      if (n.type === 'TEXT' && n.characters) {
        if (n.name === 'Description' || n.characters === 'Description') {
          inDescriptionSection = true;
          return;
        }

        if (inDescriptionSection && n.characters.length > 20) {
          descriptions.push(n.characters);
        }

        if (inDescriptionSection && (n.name === 'Changelog' || n.characters === 'Changelog')) {
          inDescriptionSection = false;
        }
      }

      if (n.children) {
        for (const child of n.children) {
          traverse(child);
        }
      }
    };

    traverse(node);
    return descriptions;
  }

  /**
   * 개별 화면의 상세 정보 조회 (지연 로딩용)
   * 
   * @param fileKey Figma 파일 키
   * @param nodeId 화면 노드 ID
   * @returns 화면 상세 정보 (pageTitle, author, description)
   */
  async getScreenDetail(fileKey: string, nodeId: string): Promise<{
    pageTitle: string;
    author: string;
    description: string;
  }> {
    try {
      // 특정 노드만 조회 (depth=10으로 충분한 정보 가져오기)
      const fileContent = await this.getFileContent(fileKey, nodeId, 10);
      
      if (!fileContent?.nodes?.[nodeId]) {
        console.warn(`⚠️ 노드를 찾을 수 없음: ${nodeId}`);
        return {
          pageTitle: 'Unknown',
          author: 'N/A',
          description: '',
        };
      }

      const node = fileContent.nodes[nodeId];
      
      /**
       * 특정 라벨 다음의 TEXT 노드 내용 찾기
       */
      const findNextTextNode = (parent: FigmaNode, afterName: string): string | null => {
        let foundLabel = false;
        let foundContent = '';
        
        const traverse = (n: FigmaNode): void => {
          if (foundContent) return;
          
          if (n.type === 'TEXT' && n.characters) {
            if (n.name === afterName || n.characters === afterName) {
              foundLabel = true;
              return;
            }
            
            if (foundLabel && n.characters !== afterName) {
              foundContent = n.characters;
              return;
            }
          }
          
          if (n.children) {
            for (const child of n.children) {
              if (foundContent) break;
              traverse(child);
            }
          }
        };
        
        traverse(parent);
        return foundContent || null;
      };
      
      // Page Title 찾기
      let pageTitle = 'Unknown';
      const pageTitleValue = findNextTextNode(node, 'Page Title');
      if (pageTitleValue) {
        pageTitle = pageTitleValue.trim();
      }

      // Author 찾기
      let author = 'N/A';
      const authorValue = findNextTextNode(node, 'Author');
      if (authorValue) {
        author = authorValue.trim();
      }

      // Description 수집
      const descriptions = this.collectDescriptionsFromNode(node);
      const description = descriptions.join('\n').trim();

      console.log(`   ✓ 상세 정보 조회 완료: ${pageTitle}`);

      return {
        pageTitle,
        author,
        description,
      };
    } catch (error) {
      console.error(`❌ 화면 상세 정보 조회 실패: ${this.getErrorMessage(error)}`);
      return {
        pageTitle: 'Unknown',
        author: 'N/A',
        description: '',
      };
    }
  }
}
