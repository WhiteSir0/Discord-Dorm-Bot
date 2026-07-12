# Discord-Dorm-Bot

기숙사 관리용 디스코드 봇입니다. 슬래시 명령어 중심이고, 필요하면 프리픽스 커맨드도 켤 수 있습니다.

## 주요 기능
- `/학번등록 학번 이름`: 학번(5자리)과 실명 등록 — 회의실 신청 전 필수
- `/채널-세팅 타입:회의실`: 현재 채널을 회의실 현황 채널로 지정 (관리자)
- `/회의실신청 회의실 날짜 목적`: 회의실 사용 신청 → 서버 사용자 검색 메뉴에서 추가 인원 선택(최대 24명) → 관리자가 승인/거절
- `/회의실취소 회의실 날짜`: 본인 예약 취소 (관리자는 전체 취소 가능)
- `/회의실현황 날짜`: 해당 날짜의 방별 예약 상세와 전체 인원 명단 조회 (비우면 오늘)
- `/학습영상신청`: 영상 링크, 학습 목적, 시간을 모달로 신청 → 관리자가 승인/거절
- 회의실·학습 영상 승인과 거절은 Discord 관리자 권한이 있어야 하며, 권한이 없으면 비공개로 안내
- 회의실 현황 채널에 월간 예약 현황 이미지가 상시 게시되고 예약 변동 시 자동 갱신
- 승인된 예약은 구글 캘린더에 종일 일정으로 자동 등록 (서비스 계정 연동 시)
- `/ping`, `/help`, `/정보`: 기본 유틸과 제작자·소스 정보
- 명령어 파일 자동 로드: `src/commands/` 아래 파일을 추가하면 재시작 시 자동 등록
- 부팅 시 슬래시 명령어 전체 재등록: 코드에서 삭제한 명령어는 디스코드에서도 제거됨
- JSON 파일 기반 데이터 저장 (`database/`)

## 기술 스택
- Node.js 22+
- discord.js v14
- dotenv
- Docker / Docker Compose

## 구조
```
src/
├── index.js              # 진입점
├── config.js             # 환경변수 로드
├── bootstrap/            # 명령어·이벤트 로더, 슬래시 배포
├── commands/
│   ├── general/          # ping, help
│   └── dorm/             # 기숙사 기능 명령어
├── events/               # ready, interactionCreate, messageCreate
└── utils/                # logger, jsonStore
```

## 명령어 추가
`src/commands/<카테고리>/<이름>.js` 파일을 만들면 자동 로드됩니다.

```js
import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder().setName('점호').setDescription('점호를 시작합니다.'),
  aliases: ['점호'],
  async execute(interaction) {},
  async executePrefix(message, args) {},
};
```

`executePrefix`를 생략하면 슬래시 전용 명령어가 됩니다. 수동 재배포는 `npm run deploy`.

## 환경변수
`.env.example`을 참고해 `.env`를 구성하세요.

- `DISCORD_TOKEN`: 디스코드 봇 토큰
- `DISCORD_CLIENT_ID`: 애플리케이션 클라이언트 ID
- `DISCORD_GUILD_ID`(선택): 길드 단위 슬래시 등록용, 쉼표로 여러 개 지정 가능. 비우면 글로벌 등록
- `BOT_PREFIX`(선택): 프리픽스 커맨드 접두사(예: `!`). 비우면 슬래시 전용으로 동작
- `GOOGLE_CALENDAR_ID`(선택): 예약을 등록할 구글 캘린더 ID. 비우면 캘린더 연동 없이 동작
- `GOOGLE_SERVICE_ACCOUNT_FILE`(선택): 서비스 계정 키 JSON 경로, 기본값 `secrets/google-service-account.json`

## 실행
```bash
cp .env.example .env
docker compose up -d --build
docker compose logs -f
```

Docker 없이 실행하려면:
```bash
npm install
npm start
```

## 주의
`BOT_PREFIX`를 설정해 프리픽스 커맨드를 쓸 경우, 개발자 포털의 Bot 설정에서
**MESSAGE CONTENT INTENT**를 켜야 합니다. 꺼진 상태로 프리픽스를 켜면 로그인이 실패합니다.
슬래시 전용(기본값)일 때는 필요 없습니다.

## 출처 및 라이선스
이 프로젝트의 원본 소스는 [WhiteSir0/Discord-Dorm-Bot](https://github.com/WhiteSir0/Discord-Dorm-Bot)이며, 제작자는 WhiteSir0입니다.

이 프로젝트는 [MIT License](LICENSE)로 배포됩니다. 복사하거나 수정해 배포할 때는 저작권 표시와 라이선스 전문을 함께 유지해야 합니다.
