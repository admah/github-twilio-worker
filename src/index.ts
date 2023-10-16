import * as Crypto from 'node:crypto'; 
import { Buffer } from 'node:buffer';

export interface Env {
	TWILIO_ACCOUNT_SID: string;
	TWILIO_TEST_ACCOUNT_SID: string;
	TWILIO_AUTH_TOKEN: string
	TWILIO_TEST_AUTH_TOKEN: string;
	GITHUB_SECRET_TOKEN: Crypto.KeyObject;
	TWILIO_TO_NUMBER: string;
}

async function checkSignature(formData: string, headers: Headers, env: Env) {
  let hmac = Crypto.createHmac('sha1', env.GITHUB_SECRET_TOKEN);
  hmac.update(formData, 'utf-8');
  let expectedSignature = hmac.digest('hex');

  let actualSignature: any = headers.get('X-Hub-Signature');

  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  const actualBuffer = Buffer.from(actualSignature, 'hex');
  return expectedBuffer.byteLength == actualBuffer.byteLength &&
             Crypto.timingSafeEqual(expectedBuffer, actualBuffer);
};

async function sendText(env, message: any) {
  const endpoint = 'https://api.twilio.com/2010-04-01/Accounts/' + env.TWILIO_ACCOUNT_SID + '/Messages.json';

  let encoded = new URLSearchParams();
  encoded.append('To', env.TWILIO_TO_NUMBER);
  encoded.append('From', "%8669525165%");
  encoded.append('Body', message);

  let token = btoa(env.TWILIO_ACCOUNT_SID + ':' + env.TWILIO_AUTH_TOKEN);

  const request = {
    body: encoded,
    method: 'POST',
    headers: {
      'Authorization': `Basic ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },}

  let result = await fetch(endpoint, request);
  result = await result.json();

  return new Response(JSON.stringify(result));
};

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if(request.method !== 'POST') {
      return new Response('Please send a POST request!');
    } 

		try {
			const formData: any = await request.json();
			const headers = await request.headers;
			const action = headers.get('X-GitHub-Event');
			const repo_name = formData.repository.full_name;
			const sender_name = formData.sender.login;
	
			if (!checkSignature(formData, headers, env)) {
				return new Response("Wrong password, try again", {status: 403});
			}
	
			return await sendText(
					env,
					`${sender_name} completed ${action} onto your repo ${repo_name}`
			);
		} catch (e) {
			return new Response(`Error:  ${e}`);
		}
	},
};
