/**
 * Figma API 테스트 스크립트
 * 
 * 사용법:
 * 1. FIGMA_TOKEN 환경변수 설정
 * 2. npm install
 * 3. node test-figma.js
 * 
 * 목적: "콘트라베이스 3.0.6 로드밸런서" 기획서를 Figma에서 가져올 수 있는지 확인
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const FIGMA_TOKEN = process.env.FIGMA_TOKEN;
const TEAM_ID = '1498602828936104321'; // 귀사 팀 ID

if (!FIGMA_TOKEN) {
  console.error('❌ FIGMA_TOKEN 환경변수가 설정되지 않았습니다.');
  console.error('📖 FIGMA_TOKEN_SETUP.md 파일을 참고하세요.');
  process.exit(1);
}

const figmaApi = axios.create({
  baseURL: 'https://api.figma.com/v1',
  headers: {
    'X-Figma-Token': FIGMA_TOKEN
  }
});

async function testFigmaAccess() {
  console.log('🚀 Figma API 테스트 시작...\n');

  try {
    // 1단계: 팀의 프로젝트 목록 조회
    console.log('📂 1단계: 팀의 프로젝트 목록 조회...');
    const projectsResponse = await figmaApi.get(`/teams/${TEAM_ID}/projects`);
    const projects = projectsResponse.data.projects;

    console.log(`✅ 총 ${projects.length}개의 프로젝트를 찾았습니다:\n`);
    projects.forEach((project, index) => {
      console.log(`   ${index + 1}. ${project.name} (ID: ${project.id})`);
    });

    // 2단계: "콘트라베이스" 프로젝트 찾기
    console.log('\n🔍 2단계: "콘트라베이스" 프로젝트 검색...');
    const contrabaseProject = projects.find(p =>
      p.name.toLowerCase().includes('콘트라베이스') ||
      p.name.toLowerCase().includes('contrabase') ||
      p.name.toLowerCase().includes('contrabass')
    );

    if (!contrabaseProject) {
      console.log('⚠️  "콘트라베이스" 프로젝트를 찾지 못했습니다.');
      console.log('💡 팁: 프로젝트 이름이 다를 수 있습니다. 위 목록에서 확인해주세요.');
      return;
    }

    console.log(`✅ 찾았습니다: ${contrabaseProject.name}`);

    // 3단계: 프로젝트의 파일 목록 조회
    console.log('\n📄 3단계: 프로젝트의 파일 목록 조회...');
    const filesResponse = await figmaApi.get(`/projects/${contrabaseProject.id}/files`);
    const files = filesResponse.data.files;

    console.log(`✅ 총 ${files.length}개의 파일을 찾았습니다:\n`);
    files.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file.name}`);
      console.log(`      - Key: ${file.key}`);
      console.log(`      - Last Modified: ${file.last_modified}`);
    });

    // 4단계: "3.0.6" 버전 파일 찾기
    console.log('\n🔍 4단계: "3.0.6" 버전 파일 검색...');
    let version306File = files.find(f =>
      f.name.includes('3.0.6') || f.name.includes('v3.0.6')
    );

    // 3.0.6이 없으면 3.0.5도 확인
    if (!version306File) {
      console.log('   3.0.6을 찾지 못해 3.0.5로 시도합니다...');
      version306File = files.find(f =>
        f.name.includes('3.0.5') || f.name.includes('v3.0.5')
      );
    }

    // 그래도 없으면 최신 파일
    if (!version306File) {
      console.log('⚠️  "3.0.6" 또는 "3.0.5" 버전 파일을 찾지 못했습니다.');
      console.log('💡 팁: 파일 이름이 다를 수 있습니다. 위 목록에서 확인해주세요.');
      console.log('\n🎯 최신 파일로 테스트를 계속합니다...\n');

      if (files.length === 0) {
        console.log('❌ 파일이 없습니다.');
        return;
      }
    }

    const targetFile = version306File || files[0];
    console.log(`✅ 대상 파일: ${targetFile.name} (${targetFile.key})`);

    // 5단계: 파일 내용 상세 조회
    console.log('\n📖 5단계: 파일 내용 조회 중...');
    console.log(`   요청 URL: /files/${targetFile.key}`);
    const fileResponse = await figmaApi.get(`/files/${targetFile.key}`);
    const fileData = fileResponse.data;

    console.log(`✅ 파일명: ${fileData.name}`);
    console.log(`✅ 버전: ${fileData.version}`);
    console.log(`✅ 최종 수정: ${fileData.lastModified}`);

    // 6단계: "로드밸런서" 관련 페이지/프레임 검색
    console.log('\n🔍 6단계: "로드밸런서" 관련 내용 검색...');

    const pages = fileData.document.children;
    console.log(`\n📄 총 ${pages.length}개의 페이지:\n`);

    let foundLoadBalancer = false;

    pages.forEach((page, pageIndex) => {
      console.log(`\n페이지 ${pageIndex + 1}: ${page.name}`);

      if (page.description) {
        console.log(`   Description: ${page.description.substring(0, 100)}${page.description.length > 100 ? '...' : ''}`);
      }

      // 로드밸런서 키워드 검색
      const isLoadBalancer =
        page.name.toLowerCase().includes('로드밸런서') ||
        page.name.toLowerCase().includes('load balancer') ||
        page.name.toLowerCase().includes('loadbalancer') ||
        (page.description && (
          page.description.includes('로드밸런서') ||
          page.description.toLowerCase().includes('load balancer')
        ));

      if (isLoadBalancer) {
        foundLoadBalancer = true;
        console.log('\n   🎯 ===== 로드밸런서 관련 페이지 발견! =====');
        console.log(`   페이지명: ${page.name}`);
        if (page.description) {
          console.log(`   \n   📝 Description 전체 내용:`);
          console.log(`   ${'-'.repeat(50)}`);
          console.log(`   ${page.description}`);
          console.log(`   ${'-'.repeat(50)}\n`);
        }

        // 하위 프레임도 확인
        if (page.children && page.children.length > 0) {
          console.log(`   \n   📦 하위 요소 ${page.children.length}개:`);
          page.children.slice(0, 10).forEach((child, childIndex) => {
            console.log(`      ${childIndex + 1}. ${child.name} (${child.type})`);
            if (child.description) {
              console.log(`         Description: ${child.description.substring(0, 80)}...`);
            }
          });
          if (page.children.length > 10) {
            console.log(`      ... 외 ${page.children.length - 10}개`);
          }
        }
      }
    });

    if (!foundLoadBalancer) {
      console.log('\n⚠️  "로드밸런서" 키워드를 포함한 페이지를 찾지 못했습니다.');
      console.log('💡 팁: 다른 키워드로 검색하거나, 파일 구조를 확인해보세요.');
    } else {
      console.log('\n✅ 성공! 로드밸런서 관련 기획 내용을 Figma API로 가져올 수 있습니다!');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ 테스트 완료!');
    console.log('='.repeat(60));
    console.log('\n💡 결론: MCP 서버에서 다음 흐름이 가능합니다:');
    console.log('   1. 사용자: "콘트라베이스 3.0.6 로드밸런서 기획 보여줘"');
    console.log('   2. MCP: 팀 프로젝트 검색');
    console.log('   3. MCP: 콘트라베이스 프로젝트의 3.0.6 파일 찾기');
    console.log('   4. MCP: 파일 내 로드밸런서 페이지/Description 추출');
    console.log('   5. MCP: 기획 내용 반환\n');

  } catch (error) {
    console.error('\n❌ 오류 발생:');
    if (error.response) {
      console.error(`   상태 코드: ${error.response.status}`);
      console.error(`   메시지: ${error.response.data?.message || error.response.statusText}`);

      if (error.response.status === 403) {
        console.error('\n💡 403 Forbidden: Token 권한을 확인해주세요.');
        console.error('   - Figma Settings에서 Token의 Scope 확인');
        console.error('   - 팀/프로젝트에 대한 접근 권한 확인');
      } else if (error.response.status === 404) {
        console.error('\n💡 404 Not Found: 팀 ID 또는 리소스가 존재하지 않습니다.');
        console.error(`   - 팀 ID: ${TEAM_ID}`);
      }
    } else {
      console.error(error.message);
    }
  }
}

// 실행
testFigmaAccess();
