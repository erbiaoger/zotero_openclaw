/* global Zotero */

(async function () {
	const providerPref = 'extensions.openclaw.provider';
	const taskPref = 'extensions.openclaw.taskTemplate';
	const providers = ['codex', 'claude', 'gemini'];
	const pathPref = provider => `extensions.openclaw.path.${provider}`;
	const argsPref = provider => `extensions.openclaw.args.${provider}`;
	const modelPref = provider => `extensions.openclaw.model.${provider}`;
	const providerInput = document.getElementById('openclaw-provider');
	const taskInput = document.getElementById('openclaw-task-template');
	const pathInput = document.getElementById('openclaw-path');
	const argsInput = document.getElementById('openclaw-args');
	const modelInput = document.getElementById('openclaw-model');
	if (!providerInput || !taskInput || !pathInput || !argsInput || !modelInput) return;

	let provider = Zotero.Prefs.get(providerPref, true) || 'codex';
	if (!providers.includes(provider)) {
		provider = 'codex';
		Zotero.Prefs.set(providerPref, provider, true);
	}

	const loadProviderValues = () => {
		providerInput.value = provider;
		pathInput.value = Zotero.Prefs.get(pathPref(provider), true) || '';
		let argsValue = Zotero.Prefs.get(argsPref(provider), true) || '';
		// Auto-migrate legacy templates that injected raw payload directly.
		if (argsValue.includes('{{payload}}') && !argsValue.includes('{{task}}')) {
			argsValue = argsValue.replaceAll('{{payload}}', '{{task}}');
			Zotero.Prefs.set(argsPref(provider), argsValue, true);
		}
		argsInput.value = argsValue;
		modelInput.value = Zotero.Prefs.get(modelPref(provider), true) || '';
	};

	loadProviderValues();
	taskInput.value = Zotero.Prefs.get(taskPref, true) || '';

	const onProviderChanged = () => {
		provider = providerInput.value;
		Zotero.Prefs.set(providerPref, provider, true);
		loadProviderValues();
	};
	providerInput.addEventListener('change', onProviderChanged);
	providerInput.addEventListener('command', onProviderChanged);

	pathInput.addEventListener('input', () => {
		Zotero.Prefs.set(pathPref(provider), pathInput.value, true);
	});
	argsInput.addEventListener('input', () => {
		Zotero.Prefs.set(argsPref(provider), argsInput.value, true);
	});
	modelInput.addEventListener('input', () => {
		Zotero.Prefs.set(modelPref(provider), modelInput.value, true);
	});
	taskInput.addEventListener('input', () => {
		Zotero.Prefs.set(taskPref, taskInput.value, true);
	});
})();
