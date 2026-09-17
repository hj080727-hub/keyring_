# 키링공방 ♡

GitHub Pages에서 바로 올릴 수 있는 정적 웹사이트 데모입니다.

## 포함 기능
- 자캐 이미지 업로드
- 브라우저 기반 간단 누끼 미리보기
- 선화 추출 미리보기
- 오로라 / 펄 / 투명 / 선화 / 불투명 재질
- 아크릴 외곽 여백 조절
- 구멍 위치 프리셋 + 드래그 지정
- 열쇠고리 모양/금속 색상 선택
- 3D 느낌의 자동 회전 및 마우스 회전
- 버튼 클릭 뿅뿅 스파클 효과
- 움직이는 배경 반짝이
- 둥둥 떠다니는 제목
- 업로드한 DreamHeumulKR.ttf 폰트 적용

## GitHub Pages 배포
1. 이 폴더의 파일을 GitHub 저장소에 업로드합니다.
2. Settings → Pages → Deploy from a branch를 선택합니다.
3. main / root를 선택하고 저장합니다.

## OpenAI API 연결
현재 데모는 API 키를 포함하지 않습니다.
OpenAI API 키는 `script.js` 같은 프론트엔드 파일에 넣으면 방문자에게 노출될 수 있으므로,
추후 누끼/선화 AI 기능을 붙일 때는 서버리스 함수(예: Cloudflare Workers, Vercel Functions 등)에 키를 보관하세요.

## 참고
브라우저만으로 GIF 파일을 완전한 GIF로 인코딩하는 기능은 브라우저별 지원 차이가 있어,
현재 저장 버튼은 회전 WebM 영상으로 안전하게 동작하도록 구성했습니다.
원하면 다음 단계에서 GIF 인코더 라이브러리를 포함해 실제 `.gif` 저장으로 교체할 수 있습니다.


## 2차 버전: AI 연결 구조
프론트엔드에는 API 키를 넣지 않습니다.

1. `worker.js`를 Cloudflare Workers에 배포합니다.
2. Worker 환경변수/Secret에 `OPENAI_API_KEY`를 등록합니다.
3. Worker에서 현재 OpenAI 이미지 API를 호출해 `cutout`/`line` 결과 PNG 또는 WebP를 반환하도록 구현합니다.
4. `script.js`의 `AI_ENDPOINT`에 Worker URL을 입력합니다.
5. GitHub Pages에는 `index.html`, `style.css`, `script.js`, `assets/`만 올려도 됩니다.

이 패키지의 Worker는 **API 키 노출을 막는 안전한 연결 골격**입니다. OpenAI API의 모델/엔드포인트는 변경될 수 있으므로 특정 모델명을 프론트에 고정하지 않았습니다.

### 개인정보
AI 처리 기능을 활성화하면 사용자가 선택한 이미지가 서버리스 백엔드를 거쳐 외부 AI API로 전달됩니다.
사이트 공개 전에는 개인정보 안내문에 이 처리 사실과 보관 정책을 명시하세요.


## 3차 버전 메모 — OpenAI 연결
OpenAI의 현재 모델 카탈로그에는 이미지 생성/편집용 GPT-Image-2가 제공됩니다.
AI 누끼/선화는 브라우저에서 API 키를 노출하지 않고, 서버리스 백엔드에서
현재 OpenAI 이미지 API를 호출하는 형태로 연결하세요.

공식 문서:
https://platform.openai.com/docs/models

중요: `OPENAI_API_KEY`를 `index.html`, `script.js`, GitHub Pages 환경에 넣지 마세요.


## 4차 버전 — 3D + 실제 GIF
- Three.js 기반 WebGL 3D 미리보기 추가
- 실제 금속 링/아크릴 두께/조명 표현
- GIF.js를 이용한 360° GIF 렌더링
- GIF는 `키링공방_360.gif`로 저장됩니다.
- AI Worker는 JSON `{ image: dataURL, mode: "cutout"|"line" }`를 받도록 변경했습니다.

### 주의
AI 이미지 편집 모델은 '정확한 누끼 마스크 생성기'와 동일하지 않습니다.
원본 캐릭터를 완전히 보존해야 하는 굿즈 제작에서는 AI 결과를 바로 확정하지 말고,
미리보기/재시도/수동 마스크 확인 단계를 두는 것을 권장합니다.
