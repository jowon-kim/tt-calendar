import signup from './_auth/signup.js';
import login from './_auth/login.js';
import logout from './_auth/logout.js';
import invite from './_auth/invite.js';
import account from './_auth/account.js';
import google from './_auth/google.js';
import devices from './_auth/devices.js';

/**
 * 계정 창구를 함수 하나로 묶습니다. Vercel Hobby는 배포 하나에 함수 12개까지라
 * 창구마다 파일을 두면 넘칩니다. `_`로 시작하는 폴더는 함수로 세지 않아요.
 *
 * 주소는 그대로입니다 — vercel.json이 /api/login 을 /api/auth?op=login 으로 넘겨줍니다.
 */
const routes = { signup, login, logout, invite, account, google, devices };

export default (req, res) => {
  const handler = Object.hasOwn(routes, req.query?.op) ? routes[req.query.op] : null;
  if (!handler) return res.status(404).end(); // 화면은 이 주소를 직접 부르지 않습니다
  return handler(req, res);
};
