# Discord-Dorm-Bot

기숙사 관리용 디스코드 봇입니다. 슬래시 명령어 중심이고, 필요하면 프리픽스 커맨드도 켤 수 있습니다.

## 주요 기능
- `/ping`: 봇 응답 속도 확인
- `/help`: 명령어 목록 안내
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
