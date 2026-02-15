var Openclaw;

function log(msg) {
	Zotero.debug("AgentBridge: " + msg);
}

function install() {
	log("Installed");
}

async function startup({ id, version, rootURI }) {
	log("Starting");
	Zotero.PreferencePanes.register({
		pluginID: 'zotero-openclaw@local',
		src: rootURI + 'preferences.xhtml',
		scripts: [rootURI + 'preferences.js']
	});

	Services.scriptloader.loadSubScript(rootURI + 'openclaw.js');
	Openclaw.init({ id, version, rootURI });
	Openclaw.addToAllWindows();
	await Openclaw.main();
}

function onMainWindowLoad({ window }) {
	Openclaw.addToWindow(window);
}

function onMainWindowUnload({ window }) {
	Openclaw.removeFromWindow(window);
}

function shutdown() {
	log("Shutting down");
	if (Openclaw) {
		Openclaw.removeFromAllWindows();
		Openclaw = undefined;
	}
}

function uninstall() {
	log("Uninstalled");
}
