import fs from 'fs-extra';
import path from 'path';
import {
	coreNodeVersion,
	defaultConfig,
	makeTest
} from './common';

let _it = process.platform === 'darwin' ? it : it.skip;
const unsupportedIt = process.platform === 'darwin' ? it.skip : it;

const pluginPath = path.resolve(__dirname, '..', 'plugins', 'ios');
let pluginVersion;
try {
	pluginVersion = fs.readJsonSync(path.join(pluginPath, 'package.json')).version;
} catch (e) {
	_it = unsupportedIt = it.skip;
}

describe('plugin iOS', function () {
	this.timeout(60000);

	_it('should register the iOS plugin', makeTest(async function () {
		this.symlinkPlugin('ios', pluginVersion);
		await this.installNode();
		await this.startDaemonDebugMode(defaultConfig);

		const { status, stdout } = this.runAppcdSync([ 'exec', '/ios' ]);
		const obj = JSON.parse(stdout);

		expect(status).to.equal(0);

		expect(obj.status).to.equal(200);
		expect(obj.message).to.contain(pluginVersion);
		expect(obj.fin).to.equal(true);
		expect(obj.statusCode).to.equal('200');
	}));

	_it('should get the iOS plugin info', makeTest(async function () {
		this.symlinkPlugin('ios', pluginVersion);
		await this.installNode();
		await this.startDaemonDebugMode(defaultConfig);

		const { status, stdout } = this.runAppcdSync([ 'exec', `/ios/${pluginVersion}` ]);
		const obj = JSON.parse(stdout);

		expect(status).to.equal(0);

		expect(obj).to.be.an('object');
		expect(obj.status).to.equal(200);
		expect(obj.message).to.be.an('object');
		expect(obj.message.path).to.equal(pluginPath);
		expect(obj.message.packageName).to.equal('@appcd/plugin-ios');
		expect(obj.message.version).to.equal(pluginVersion);
		expect(obj.message.main).to.equal(path.join(pluginPath, 'dist', 'index.js'));
		expect(obj.message.name).to.equal('ios');
		expect(obj.message.type).to.equal('external');
		expect(obj.message.nodeVersion).to.equal(coreNodeVersion);
		expect(obj.message.supported).to.equal(true);
		expect(obj.message.services).to.deep.equal([ '/info', '/info/:filter*' ]);
		expect(obj.message.error).to.be.null;
		expect(obj.message.stack).to.be.null;
		expect(obj.message.pid).to.be.at.gt(0);
		expect(obj.message.exitCode).to.be.null;
		expect(obj.message.stats).to.be.an('object');
		expect(obj.message.startupTime).to.be.gt(1);
		expect(obj.message.state).to.equal('started');
		expect(obj.message.totalRequests).to.equal(1);
		expect(obj.message.activeRequests).to.equal(0);
		expect(obj.fin).to.equal(true);
		expect(obj.statusCode).to.equal('200');
	}));

	unsupportedIt('should register iOS plugin as unsupported', makeTest(async function () {
		this.symlinkPlugin('ios', pluginVersion);
		await this.installNode();
		await this.startDaemonDebugMode(defaultConfig);

		const { status, stdout } = this.runAppcdSync([ 'exec', `/appcd/plugin/registered` ]);
		const obj = JSON.parse(stdout);

		expect(status).to.equal(0);

		expect(obj).to.be.an('object');
		expect(obj.status).to.equal(200);
		expect(obj.message).to.be.an('array');
		expect(obj.message).to.deep.include({
			activeRequests: 0,
			totalRequests: 0,
			path: pluginPath,
			packageName: "@appcd/plugin-ios",
			version: pluginVersion,
			main: path.join(pluginPath, 'dist', 'index.js'),
			name: "ios",
			type: "external",
			nodeVersion: coreNodeVersion,
			error: `Unsupported platform "${process.platform}"`,
			supported: false
		});
		expect(obj.fin).to.equal(true);
		expect(obj.statusCode).to.equal('200');
	}));

	unsupportedIt('should not load iOS plugin for incompatible platform', makeTest(async function () {
		this.symlinkPlugin('ios', pluginVersion);
		await this.installNode();
		await this.startDaemonDebugMode(defaultConfig);

		const { status, stdout } = this.runAppcdSync([ 'exec', `/ios` ]);
		const obj = JSON.parse(stdout);

		expect(status).to.equal(1);

		expect(obj).to.be.an('object');
		expect(obj.stack).to.match(/^DispatcherError: Not Found/);
		expect(obj.message).to.equal('Not Found')
		expect(obj.status).to.equal(404);
		expect(obj.statusCode).to.equal('404');
		expect(obj.type).to.equal('error')
	}));
});
