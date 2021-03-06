import fs from 'fs';
import launch from 'appcd-dump-viewer';
import os from 'os';
import path from 'path';

import { createRequest, loadConfig } from './common';
import { debounce } from 'appcd-util';

const cmd = {
	desc: 'dumps the config, status, health, and debug logs to a file',
	args: [
		{ name: 'file', desc: 'the file to dump the info to, otherwise stdout' },
	],
	options: {
		'--view': { desc: 'open the dump in the web browser' }
	},
	action({ argv, _ }) {
		const cfg = loadConfig(argv);
		const results = {
			config: {},
			status: {},
			health: [],
			log: []
		};
		const envRegExp = /^ANDROID.*|APPC.*|ComSpec|HOME|HOMEPATH|LANG|PATH|PWD|USERPROFILE$/;
		let [ file ] = _;

		return Promise.resolve()
			// get the logs first to avoid noise from getting the config, status, and health
			.then(() => new Promise(resolve => {
				const { client, request } = createRequest(cfg, '/appcd/logcat', { colors: false });
				const done = debounce(() => {
					client.disconnect();
					resolve();
				});

				request
					.on('response', (message, response) => {
						results.log.push({
							args:      response.args,
							typeStyle: response.typeStyle,
							typeLabel: response.typeLabel,
							ns:        response.ns,
							nsStyle:   response.nsStyle,
							ts:        response.ts
						});
						done();
					})
					.once('error', () => resolve());
			}))
			.then(() => Promise.all([
				new Promise(resolve => {
					const { client, request } = createRequest(cfg, '/appcd/config');
					request
						.on('response', config => {
							client.disconnect();
							results.config = config;
							resolve();
						})
						.once('error', () => {
							results.config = cfg;
							resolve();
						});
				}),

				new Promise(resolve => {
					const { client, request } = createRequest(cfg, '/appcd/health');
					request
						.on('response', health => {
							client.disconnect();
							results.health = health;
							resolve();
						})
						.once('error', () => resolve());
				}),

				new Promise(resolve => {
					const { client, request } = createRequest(cfg, '/appcd/status');
					request
						.on('response', status => {
							client.disconnect();

							for (const key of Object.keys(status.process.env)) {
								if (!envRegExp.test(key)) {
									delete status.process.env[key];
								}
							}

							for (const proc of status.subprocesses) {
								for (const key of Object.keys(proc.options.env)) {
									if (!envRegExp.test(key)) {
										delete proc.options.env[key];
									}
								}
							}

							status.dumpTime = new Date();
							results.status = status;
							resolve();
						})
						.once('error', err => {
							results.status = err;
							resolve();
						});
				})
			]))
			.then(() => results)
			.catch(err => err)
			.then(results => {
				if (argv.view && !file) {
					file = path.join(os.tmpdir(), 'appcd-dump.json');
				}

				if (file) {
					file = path.resolve(file);
					fs.writeFileSync(file, JSON.stringify(results, null, 2));
					console.log(`Wrote dump to ${file}`);

					if (argv.view) {
						launch(file);
					}
				} else {
					console.log(JSON.stringify(results, null, 2));
				}
			});
	}
};

export default cmd;
