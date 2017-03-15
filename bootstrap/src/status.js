import Table from 'cli-table2';

import { createInstanceWithDefaults, StdioStream } from 'snooplogg';
import { banner, createRequest, loadConfig } from './common';

const logger = createInstanceWithDefaults().config({ theme: 'compact' }).enable('*').pipe(new StdioStream);
const { log } = logger;
const { alert, highlight } = logger.styles;
const { filesize } = logger.humanize;

const cmd = {
	options: {
		'--json': { desc: 'outputs the status as JSON' }
	},
	action: ({ argv }) => {
		const cfg = loadConfig(argv);
		const { client, request } = createRequest(cfg, '/appcd/status');

		request
			.once('error', err => {
				if (err.code !== 'ECONNREFUSED') {
					console.error(err.toString());
					process.exit(1);
				}

				if (argv.json) {
					log('{}');
				} else {
					log('Server not running (code 2)');
				}
				process.exit(2);
			})
			.on('response', status => {
				client.disconnect();
				if (argv.json) {
					log(status);
					return;
				}

				log(banner());

				const params = {
					chars: {
						bottom: '', 'bottom-left': '', 'bottom-mid': '', 'bottom-right': '',
						left: '', 'left-mid': '',
						mid: '', 'mid-mid': '', middle: '  ',
						right: '', 'right-mid': '',
						top: '', 'top-left': '', 'top-mid': '', 'top-right': ''
					},
					style: {
						head: ['gray'],
						'padding-left': 0,
						'padding-right': 0
					}
				};

				let table = new Table(params);
				table.push(['Core Version', highlight(`v${status.version}`)]);
				table.push(['PID',          highlight(status.pid)]);
				table.push(['Uptime',       highlight(`${(status.uptime / 60).toFixed(2)} minutes`)]);
				table.push(['Node Version', highlight(status.node.version)]);
				table.push(['Memory RSS',   highlight(filesize(status.memory.rss))]);
				table.push(['Memory Heap',  highlight(`${filesize(status.memory.heapUsed)} / ${filesize(status.memory.heapTotal)}`)]);
				log(table.toString());
				log();

				params.head = ['Plugin Name', 'Version', 'Type', 'Path', 'Node Version', 'Status'],
				table = new Table(params);
				for (const plugin of status.plugins) {
					let status = '';
					if (plugin.error) {
						status = alert(plugin.error);
					} else if (plugin.loaded) {
						if (plugin.type === 'external') {
							status = `Loaded, PID=${plugin.pid || 'null'}`;
						} else {
							status = 'Loaded';
						}
					} else {
						status = 'Unloaded';
					}

					table.push([
						highlight(plugin.name),
						plugin.version ? `v${plugin.version}` : 'null',
						plugin.type,
						plugin.path,
						`v${plugin.nodeVersion}`,
						status
					]);
				}
				log(table.toString());
				log();
			});
	}
};

export default cmd;
