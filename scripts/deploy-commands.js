// 봇을 켜지 않고 슬래시 명령어만 수동으로 재배포: npm run deploy
import { assertConfig } from '../src/config.js';
import { loadCommands } from '../src/bootstrap/loadCommands.js';
import { deployCommands } from '../src/bootstrap/deployCommands.js';
import { log } from '../src/utils/logger.js';

assertConfig();
const { commands } = await loadCommands();
await deployCommands(commands);
log('info', '수동 배포 완료');
