/* global Zotero, Services, ChromeUtils */

Openclaw = {
	id: null,
	version: null,
	rootURI: null,
	initialized: false,
	addedElementIDs: [],
	conversationHistory: [],
	
	init({ id, version, rootURI }) {
		if (this.initialized) return;
		this.id = id;
		this.version = version;
		this.rootURI = rootURI;
		this.initialized = true;
	},
	
	log(msg) {
		Zotero.debug("AgentBridge: " + msg);
	},

	logConsole(label, value) {
		try {
			let text;
			if (typeof value === 'string') {
				text = value;
			}
			else {
				text = JSON.stringify(value, null, 2);
			}
			Services.console.logStringMessage(`[AgentBridge] ${label}: ${text}`);
		}
		catch (e) {
			Services.console.logStringMessage(`[AgentBridge] ${label}: <unserializable>`);
		}
	},
	
	addToWindow(window) {
		let doc = window.document;
		
		// Context menu item on item list
		let itemMenu = doc.getElementById('zotero-itemmenu');
		if (itemMenu && !doc.getElementById('openclaw-send-to-openclaw')) {
			let menuitem = doc.createXULElement('menuitem');
			menuitem.id = 'openclaw-send-to-openclaw';
			menuitem.setAttribute('label', 'Send to Agent CLI');
			menuitem.addEventListener('command', () => {
				this.sendSelectedItemsToOpenclaw(window).catch(e => {
					Zotero.logError(e);
				});
			});
			itemMenu.appendChild(menuitem);
			this.storeAddedElement(menuitem);
		}
		
		// Toolbar button on item toolbar
		let itemToolbar = doc.getElementById('zotero-toolbar-item-tree');
		if (itemToolbar && !doc.getElementById('openclaw-toolbar-button')) {
			let button = doc.createXULElement('toolbarbutton');
			button.id = 'openclaw-toolbar-button';
			button.setAttribute('label', 'Agent CLI');
			button.setAttribute('tooltiptext', 'Send selected items to terminal AI CLI');
			button.setAttribute('class', 'toolbarbutton-1');
			button.addEventListener('command', () => {
				this.sendSelectedItemsToOpenclaw(window).catch(e => {
					Zotero.logError(e);
				});
			});
			itemToolbar.appendChild(button);
			this.storeAddedElement(button);
		}

		this.ensureConversationSidebar(window);
		this.ensureSidebarToggleButton(window);
		this.renderConversationSidebar(window);
		this.updateSidebarToggleButton(window);
	},
	
	addToAllWindows() {
		for (let win of Zotero.getMainWindows()) {
			if (!win.ZoteroPane) continue;
			this.addToWindow(win);
		}
	},
	
	removeFromWindow(window) {
		let doc = window.document;
		for (let id of this.addedElementIDs) {
			doc.getElementById(id)?.remove();
		}
	},
	
	removeFromAllWindows() {
		for (let win of Zotero.getMainWindows()) {
			if (!win.ZoteroPane) continue;
			this.removeFromWindow(win);
		}
	},
	
	storeAddedElement(elem) {
		if (!elem.id) {
			throw new Error("Element must have an id");
		}
		this.addedElementIDs.push(elem.id);
	},

	ensureConversationSidebar(window) {
		let doc = window.document;
		let deck = doc.getElementById('zotero-item-pane-content');
		if (!deck || doc.getElementById('openclaw-conversation-panel')) return;

		let panel = doc.createXULElement('vbox');
		panel.id = 'openclaw-conversation-panel';
		panel.setAttribute('flex', '1');
		panel.setAttribute('style', 'min-width: 0; min-height: 0; border-left: 1px solid #d6d6d6;');

		let header = doc.createXULElement('hbox');
		header.setAttribute('align', 'center');
		header.setAttribute('style', 'padding: 8px; border-bottom: 1px solid #e3e3e3;');
		let title = doc.createXULElement('label');
		title.setAttribute('value', 'Agent Chat');
		title.setAttribute('style', 'font-weight: 600;');
		header.appendChild(title);
		let spacer = doc.createXULElement('spacer');
		spacer.setAttribute('flex', '1');
		header.appendChild(spacer);
		let clearBtn = doc.createXULElement('toolbarbutton');
		clearBtn.id = 'openclaw-conversation-clear';
		clearBtn.setAttribute('label', 'Clear');
		clearBtn.setAttribute('class', 'zotero-tb-button');
		clearBtn.addEventListener('command', () => {
			this.conversationHistory = [];
			this.renderConversationSidebars();
		});
		header.appendChild(clearBtn);
		panel.appendChild(header);

		let list = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
		list.id = 'openclaw-conversation-list';
		list.style.cssText = 'overflow:auto; flex:1; padding:8px; display:flex; flex-direction:column; gap:8px; font-size:12px;';
		panel.appendChild(list);

		let composer = doc.createXULElement('hbox');
		composer.id = 'openclaw-chat-composer';
		composer.setAttribute('align', 'center');
		composer.setAttribute('style', 'padding: 8px; border-top: 1px solid #e3e3e3; gap: 8px;');

		let input = doc.createElementNS('http://www.w3.org/1999/xhtml', 'textarea');
		input.id = 'openclaw-chat-input';
		input.placeholder = '输入你的问题，Enter 发送，Shift+Enter 换行';
		input.style.cssText = 'flex:1; min-height: 58px; max-height: 160px; resize: vertical; font-size: 12px;';
		input.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' && !event.shiftKey) {
				event.preventDefault();
				this.sendChatInput(window).catch(e => Zotero.logError(e));
			}
		});

		let sendBtn = doc.createXULElement('toolbarbutton');
		sendBtn.id = 'openclaw-chat-send';
		sendBtn.setAttribute('label', 'Send');
		sendBtn.setAttribute('class', 'zotero-tb-button');
		sendBtn.addEventListener('command', () => {
			this.sendChatInput(window).catch(e => Zotero.logError(e));
		});

		composer.appendChild(input);
		composer.appendChild(sendBtn);
		panel.appendChild(composer);

		deck.appendChild(panel);
		this.storeAddedElement(panel);
		this.storeAddedElement(clearBtn);
		this.storeAddedElement(composer);
		this.storeAddedElement(sendBtn);
	},

	ensureSidebarToggleButton(window) {
		let doc = window.document;
		let sidenav = doc.getElementById('zotero-view-item-sidenav');
		if (!sidenav) return;
		let container = sidenav.querySelector('.inherit-flex');
		if (!container) {
			window.setTimeout(() => this.ensureSidebarToggleButton(window), 800);
			return;
		}
		if (doc.getElementById('openclaw-sidebar-toggle')) return;

		let wrapper = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
		wrapper.id = 'openclaw-sidebar-toggle-wrapper';
		wrapper.className = 'pin-wrapper';
		wrapper.setAttribute('role', 'tab');

		let button = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
		button.id = 'openclaw-sidebar-toggle';
		button.className = 'btn';
		button.setAttribute('custom', 'true');
		button.setAttribute('title', 'Agent Chat');
		button.setAttribute('aria-label', 'Agent Chat');
		button.setAttribute('tabindex', '0');
		button.style.cssText = "--custom-sidenav-icon-light: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Cpath fill='%23666' d='M10 2C5.58 2 2 5.13 2 9c0 2.2 1.17 4.16 3 5.45V18l3.24-1.77c.57.1 1.15.15 1.76.15 4.42 0 8-3.13 8-7s-3.58-7-8-7zm-4 7a1.1 1.1 0 1 1 0-2.2A1.1 1.1 0 0 1 6 9zm4 0a1.1 1.1 0 1 1 0-2.2A1.1 1.1 0 0 1 10 9zm4 0a1.1 1.1 0 1 1 0-2.2A1.1 1.1 0 0 1 14 9z'/%3E%3C/svg%3E\"); --custom-sidenav-icon-dark: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Cpath fill='%23ddd' d='M10 2C5.58 2 2 5.13 2 9c0 2.2 1.17 4.16 3 5.45V18l3.24-1.77c.57.1 1.15.15 1.76.15 4.42 0 8-3.13 8-7s-3.58-7-8-7zm-4 7a1.1 1.1 0 1 1 0-2.2A1.1 1.1 0 0 1 6 9zm4 0a1.1 1.1 0 1 1 0-2.2A1.1 1.1 0 0 1 10 9zm4 0a1.1 1.1 0 1 1 0-2.2A1.1 1.1 0 0 1 14 9z'/%3E%3C/svg%3E\");";
		let onToggle = (event) => {
			if (event && typeof event.preventDefault === 'function') {
				event.preventDefault();
			}
			if (event && typeof event.stopPropagation === 'function') {
				event.stopPropagation();
			}
			this.toggleConversationSidebar(window);
		};
		button.addEventListener('mousedown', (event) => {
			if (event.button === 0) {
				onToggle(event);
			}
		});
		button.addEventListener('click', onToggle);
		wrapper.addEventListener('click', (event) => {
			if (event.target === wrapper) {
				onToggle(event);
			}
		});
		button.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				this.toggleConversationSidebar(window);
			}
		});

		wrapper.appendChild(button);
		container.appendChild(wrapper);
		this.storeAddedElement(wrapper);
		this.storeAddedElement(button);
	},

	toggleConversationSidebar(window) {
		let doc = window.document;
		let deck = doc.getElementById('zotero-item-pane-content');
		let panel = doc.getElementById('openclaw-conversation-panel');
		if (!deck || !panel) return;
		if (deck.selectedPanel && deck.selectedPanel.id === 'openclaw-conversation-panel') {
			let defaultPanel = doc.getElementById('zotero-editpane-item-box');
			if (defaultPanel) {
				deck.selectedPanel = defaultPanel;
			}
			else {
				deck.selectedIndex = 1;
			}
		}
		else {
			deck.selectedPanel = panel;
		}
		this.updateSidebarToggleButton(window);
	},

	showConversationSidebar(window) {
		let doc = window.document;
		let deck = doc.getElementById('zotero-item-pane-content');
		let panel = doc.getElementById('openclaw-conversation-panel');
		if (!deck || !panel) return;
		deck.selectedPanel = panel;
		this.updateSidebarToggleButton(window);
	},

	updateSidebarToggleButton(window) {
		let doc = window.document;
		let button = doc.getElementById('openclaw-sidebar-toggle');
		if (!button) return;
		let deck = doc.getElementById('zotero-item-pane-content');
		let visible = !!(deck && deck.selectedPanel && deck.selectedPanel.id === 'openclaw-conversation-panel');
		button.classList.toggle('active', visible);
		button.setAttribute('aria-selected', visible ? 'true' : 'false');
	},

	async sendChatInput(window) {
		let doc = window.document;
		let input = doc.getElementById('openclaw-chat-input');
		if (!input) return;
		let text = String(input.value || '').trim();
		if (!text) return;
		input.value = '';
		await this.sendFreeformMessage(window, text);
	},

	async sendFreeformMessage(window, text) {
		this.showConversationSidebar(window);
		this.addConversationMessage('You', text);
		this.logConsole('chat.input', text);
		this.showProgress('Agent CLI', 'Sending chat message...', { durationMs: 8000 });
		let built = await this.buildSelectedItemsPayload(window, { silentIfNone: true });
		let payloadJson = '{}';
		let taskText = text;
		if (built) {
			payloadJson = JSON.stringify(built.payload);
			taskText = `用户问题：${text}\n\n当前选中文献JSON（含附件路径）：\n${payloadJson}`;
		}
		let result = await this.runAgentCommand(payloadJson, taskText);
		this.logConsole('chat.result', result);
		if (result.exitCode !== 0) {
			let err = (result.stderr || 'terminal CLI exited with a non-zero status').slice(0, 500);
			this.addConversationMessage('Agent', `ERROR\n${err}`);
			this.showProgress('Agent CLI failed', err, { error: true, durationMs: 12000 });
			return;
		}
		let summary = this.extractAssistantText(result.stdout) || (result.stdout || 'Success').trim();
		if (summary.length > 2000) {
			summary = summary.slice(0, 2000) + '...';
		}
		this.addConversationMessage('Agent', summary);
		this.showProgress('Agent CLI', 'Chat response received', { durationMs: 5000 });
	},

	renderConversationSidebars() {
		for (let win of Zotero.getMainWindows()) {
			if (!win.ZoteroPane) continue;
			this.renderConversationSidebar(win);
		}
	},

	renderConversationSidebar(window) {
		let doc = window.document;
		let list = doc.getElementById('openclaw-conversation-list');
		if (!list) return;
		while (list.firstChild) {
			list.firstChild.remove();
		}
		for (let msg of this.conversationHistory) {
			let item = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
			item.style.cssText = 'border:1px solid #e2e2e2; border-radius:6px; padding:8px; background:#fff;';
			let meta = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
			meta.textContent = `${msg.role} · ${msg.time}`;
			meta.style.cssText = 'font-size:11px; color:#666; margin-bottom:4px;';
			let body = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
			body.textContent = msg.text;
			body.style.cssText = 'white-space:pre-wrap; line-height:1.4;';
			item.appendChild(meta);
			item.appendChild(body);
			list.appendChild(item);
		}
		list.scrollTop = list.scrollHeight;
	},

	addConversationMessage(role, text) {
		let timestamp = new Date().toLocaleTimeString();
		this.conversationHistory.push({
			role,
			text: String(text || '').trim(),
			time: timestamp,
		});
		if (this.conversationHistory.length > 200) {
			this.conversationHistory.splice(0, this.conversationHistory.length - 200);
		}
		this.renderConversationSidebars();
	},
	
	showProgress(headline, description, { error = false, durationMs = 6000 } = {}) {
		try {
			let pw = new Zotero.ProgressWindow();
			pw.changeHeadline(headline);
			if (description) {
				pw.addDescription(description);
			}
			pw.show();
			pw.startCloseTimer(error ? Math.max(durationMs, 9000) : durationMs);
		}
		catch (e) {
			// Fallback to alert if ProgressWindow is unavailable
			Zotero.logError(e);
			Zotero.alert(null, headline, description || '');
		}
	},
	
	async sendSelectedItemsToOpenclaw(window) {
		try {
			this.showConversationSidebar(window);
			let built = await this.buildSelectedItemsPayload(window);
			if (!built) {
				return;
			}
			let { items, payload } = built;
			this.logConsole('selectedItems.count', items.length);
			
			this.showProgress('Agent CLI', `Preparing ${items.length} item(s)...`, { durationMs: 12000 });
			let json = JSON.stringify(payload);
			this.logConsole('payload.json', json);
			let titles = payload.items.map(i => (i.itemJSON && i.itemJSON.title) ? i.itemJSON.title : i.key).join(' | ');
			this.addConversationMessage('You', `Provider: ${this.getProvider()}\nItems: ${items.length}\n${titles}`);
			this.showProgress('Agent CLI', 'Payload ready, invoking terminal CLI...', { durationMs: 15000 });
			let result = await this.runAgentCommand(json);
			this.logConsole('result', result);
			if (result.exitCode !== 0) {
				this.showProgress(
					'Agent CLI failed',
					(result.stderr || 'terminal CLI exited with a non-zero status').slice(0, 500),
					{ error: true, durationMs: 15000 }
				);
				Zotero.logError(result.stderr || 'terminal CLI error');
				this.addConversationMessage('Agent', `ERROR\n${result.stderr || 'terminal CLI exited with a non-zero status'}`);
				return;
			}
			
			let summary = this.extractAssistantText(result.stdout) || (result.stdout || 'Success').trim();
			if (summary.length > 500) {
				summary = summary.slice(0, 500) + '...';
			}
			this.addConversationMessage('Agent', summary);
			this.showProgress(
				'Agent CLI',
				`Sent ${items.length} item(s). ${summary}`,
				{ durationMs: 12000 }
			);
		}
		catch (e) {
			Zotero.logError(e);
			this.logConsole('error', {
				message: String(e && e.message ? e.message : e),
				stack: e && e.stack ? e.stack : null
			});
			this.addConversationMessage('Agent', `ERROR\n${String(e && e.message ? e.message : e)}`);
			this.showProgress('Agent CLI error', String(e && e.message ? e.message : e), { error: true, durationMs: 15000 });
		}
	},

	async buildSelectedItemsPayload(window, { silentIfNone = false } = {}) {
		let pane = (Zotero.getActiveZoteroPane && Zotero.getActiveZoteroPane()) || window.ZoteroPane;
		if (!pane) {
			if (!silentIfNone) {
				this.showProgress('Agent CLI', 'No active Zotero pane');
			}
			return null;
		}
		let items = pane.getSelectedItems();
		if (!items || !items.length) {
			if (!silentIfNone) {
				this.showProgress('Agent CLI', 'No items selected');
			}
			return null;
		}
		let payloadItems = [];
		for (let item of items) {
			payloadItems.push(await this.buildItemPayload(item));
		}
		return {
			items,
			payload: {
				schema_version: '1.0',
				source: 'zotero',
				items: payloadItems,
			},
		};
	},
	
	async buildItemPayload(item) {
		let itemJSON = item.toJSON();
		let attachments = await this.getAttachmentInfos(item);
		let selectedAttachment = attachments.length ? attachments[0].__attachmentItem : null;
		let fulltext = await this.getFulltextForAttachment(selectedAttachment);
		return {
			itemID: item.id,
			key: item.key,
			libraryID: item.libraryID,
			itemJSON,
			attachments: attachments.map(a => {
				let { __attachmentItem, ...rest } = a;
				return rest;
			}),
			fulltext: {
				source: 'zotero_index',
				text: fulltext || ''
			}
		};
	},
	
	async getAttachmentInfos(item) {
		let attachmentItems = [];
		if (item.isAttachment && item.isAttachment()) {
			attachmentItems = [item];
		}
		else {
			let attachmentIDs = item.getAttachments();
			if (!attachmentIDs || !attachmentIDs.length) return [];
			attachmentItems = await Zotero.Items.getAsync(attachmentIDs);
		}
		let candidates = [];
		for (let attachment of attachmentItems) {
			if (!attachment.isAttachment()) continue;
			let path = await attachment.getFilePathAsync();
			if (!path) continue;
			let contentType = attachment.attachmentContentType || attachment.attachmentMIMEType || '';
			let isPDF = contentType === 'application/pdf' || path.toLowerCase().endsWith('.pdf');
			let fileSize = 0;
			try {
				let file = Zotero.File.pathToFile(path);
				if (file.exists()) {
					fileSize = file.fileSize;
				}
			}
			catch (e) {
				Zotero.logError(e);
			}
			candidates.push({
				__attachmentItem: attachment,
				itemID: attachment.id,
				key: attachment.key,
				path,
				mimeType: contentType,
				isPDF,
				fileSize,
			});
		}
		if (!candidates.length) return [];
		let preferred = candidates.filter(c => c.isPDF);
		let list = preferred.length ? preferred : candidates;
		list.sort((a, b) => (b.fileSize || 0) - (a.fileSize || 0));
		return [list[0]];
	},
	
	async getFulltextForAttachment(attachment) {
		try {
			if (!attachment || !attachment.isAttachment()) return '';
			if (!Zotero.Fulltext || !Zotero.Fulltext.getItemCacheFile) return '';
			let cacheFile = Zotero.Fulltext.getItemCacheFile(attachment);
			if (!cacheFile) return '';
			let path = cacheFile.path || cacheFile;
			if (cacheFile.exists && !cacheFile.exists()) return '';
			if (typeof path !== 'string') return '';
			if (await this.fileExists(path)) {
				return await Zotero.File.getContentsAsync(path);
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
		return '';
	},
	
	async fileExists(path) {
		try {
			let file = Zotero.File.pathToFile(path);
			return file.exists();
		}
		catch (e) {
			Zotero.logError(e);
			return false;
		}
	},
	
	async runAgentCommand(payloadJson, taskOverride = null) {
		const { Subprocess } = ChromeUtils.importESModule('resource://gre/modules/Subprocess.sys.mjs');
		let provider = this.getProvider();
		let command = Zotero.Prefs.get(`extensions.openclaw.path.${provider}`, true) || provider;
		let argsTemplate = Zotero.Prefs.get(`extensions.openclaw.args.${provider}`, true)
			|| this.getDefaultArgsTemplate(provider);
		if (argsTemplate.includes('{{payload}}') && !argsTemplate.includes('{{task}}')) {
			argsTemplate = argsTemplate.replaceAll('{{payload}}', '{{task}}');
			Zotero.Prefs.set(`extensions.openclaw.args.${provider}`, argsTemplate, true);
		}
		let model = Zotero.Prefs.get(`extensions.openclaw.model.${provider}`, true) || '';
		let taskTemplate = Zotero.Prefs.get('extensions.openclaw.taskTemplate', true) || '{{payload}}';
		let payloadFilePath = null;
		let usePayloadFile = argsTemplate.includes('{{payloadFile}}');
		if (usePayloadFile) {
			let tmp = Services.dirsvc.get("TmpD", Components.interfaces.nsIFile);
			tmp.append(`zotero-openclaw-${Date.now()}.json`);
			tmp.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0o600);
			payloadFilePath = tmp.path;
			await Zotero.File.putContentsAsync(payloadFilePath, payloadJson);
		}
		let taskText = taskOverride != null
			? String(taskOverride)
			: taskTemplate
				.replaceAll('{{payloadFile}}', payloadFilePath || '')
				.replaceAll('{{payload}}', payloadJson)
				.replaceAll('{{model}}', model);
		let args = this.parseArgs(argsTemplate).map(arg => {
			let out = arg;
			if (payloadFilePath) {
				out = out.replaceAll('{{payloadFile}}', payloadFilePath);
			}
			out = out.replaceAll('{{payload}}', payloadJson);
			out = out.replaceAll('{{model}}', model);
			out = out.replaceAll('{{task}}', taskText);
			return out;
		});
		if (provider === 'codex' && !args.includes('--skip-git-repo-check')) {
			args.push('--skip-git-repo-check');
		}
		if (provider === 'codex' && !args.includes('--ephemeral')) {
			args.push('--ephemeral');
		}
		if (provider === 'codex') {
			if (!args.includes('--sandbox')) {
				args.push('--sandbox', 'danger-full-access');
			}
			let defaultWritableDirs = this.getDefaultWritableDirs();
			for (let dir of defaultWritableDirs) {
				args.push('--add-dir', dir);
			}
			let addDirs = this.extractAttachmentParentDirs(payloadJson);
			for (let dir of addDirs) {
				args.push('--add-dir', dir);
			}
		}
		if (!args.length) {
			throw new Error('command args template is empty. Set provider args in Preferences.');
		}
		// Resolve command from PATH when not absolute.
		if (!command.includes('/')) {
			try {
				command = await Subprocess.pathSearch(command);
			}
			catch (e) {
				throw new Error(`command not found in PATH: ${command}`);
			}
		}
		this.logConsole('command', command);
		this.logConsole('args', args);
		try {
			let first = await this.execWithTimeout(Subprocess, command, args, 70000);
			if (
				first.exitCode !== 0
				&& /env:\s*node:\s*No such file or directory/i.test(first.stderr || '')
				&& command
				&& command.includes('/')
			) {
				let nodePath = command.replace(/\/[^/]+$/, '/node');
				try {
					let nodeFile = Zotero.File.pathToFile(nodePath);
					if (nodeFile.exists()) {
						this.logConsole('fallback.nodePath', nodePath);
						return await this.execWithTimeout(Subprocess, nodePath, [command, ...args], 70000);
					}
				}
				catch (e) {
					Zotero.logError(e);
				}
			}
			return first;
		}
		finally {
			if (payloadFilePath) {
				try {
					let file = Zotero.File.pathToFile(payloadFilePath);
					if (file.exists()) {
						file.remove(false);
					}
				}
				catch (e) {
					Zotero.logError(e);
				}
			}
		}
	},

	extractAttachmentParentDirs(payloadJson) {
		let out = [];
		let seen = new Set();
		try {
			let payload = JSON.parse(payloadJson);
			let items = (payload && payload.items) || [];
			for (let item of items) {
				let attachments = (item && item.attachments) || [];
				for (let att of attachments) {
					let path = att && att.path;
					if (!path || typeof path !== 'string') continue;
					let idx = path.lastIndexOf('/');
					if (idx <= 0) continue;
					let dir = path.slice(0, idx);
					if (seen.has(dir)) continue;
					seen.add(dir);
					out.push(dir);
				}
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
		return out;
	},

	getDefaultWritableDirs() {
		let out = [];
		let seen = new Set();
		let keys = ['Desk', 'Docs'];
		for (let key of keys) {
			try {
				let dir = Services.dirsvc.get(key, Components.interfaces.nsIFile);
				let path = dir && dir.path;
				if (!path || seen.has(path)) continue;
				seen.add(path);
				out.push(path);
			}
			catch (e) {
				// Ignore missing special folders
			}
		}
		return out;
	},

	getProvider() {
		let provider = Zotero.Prefs.get('extensions.openclaw.provider', true) || 'codex';
		if (provider !== 'codex' && provider !== 'claude' && provider !== 'gemini') {
			provider = 'codex';
		}
		return provider;
	},

	getDefaultArgsTemplate(provider) {
		if (provider === 'claude') {
			return '--print --output-format json --model {{model}} {{task}}';
		}
		if (provider === 'gemini') {
			return '--prompt {{task}} --output-format json --model {{model}}';
		}
		return 'exec --json --model {{model}} {{task}} --skip-git-repo-check --ephemeral';
	},

	async execProcess(Subprocess, command, args) {
		this.logConsole('exec.start', { command, args });
		let proc = await Subprocess.call({
			command,
			arguments: args,
			stdout: 'pipe',
			stderr: 'pipe',
		});
		let stdout = '';
		let stderr = '';
		let str;
		while ((str = await proc.stdout.readString())) {
			stdout += str;
		}
		while ((str = await proc.stderr.readString())) {
			stderr += str;
		}
		let result = await proc.wait();
		let exitCode = result && typeof result.exitCode === 'number' ? result.exitCode : result;
		this.logConsole('exec.end', {
			command,
			exitCode,
			stdout,
			stderr
		});
		return { stdout, stderr, exitCode };
	},

	async execWithTimeout(Subprocess, command, args, timeoutMs) {
		let timeoutId;
		let timeoutPromise = new Promise((_, reject) => {
			timeoutId = setTimeout(
				() => reject(new Error(`agent command timed out after ${Math.round(timeoutMs / 1000)}s`)),
				timeoutMs
			);
		});
		try {
			return await Promise.race([this.execProcess(Subprocess, command, args), timeoutPromise]);
		}
		finally {
			clearTimeout(timeoutId);
		}
	},

	parseArgs(argString) {
		let out = [];
		const re = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
		let match;
		while ((match = re.exec(argString)) !== null) {
			out.push(match[1] ?? match[2] ?? match[0]);
		}
		return out;
	},

	extractAssistantText(stdout) {
		if (!stdout || typeof stdout !== 'string') return '';
		let lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
		let chunks = [];
		for (let line of lines) {
			try {
				let obj = JSON.parse(line);
				if (
					obj.type === 'item.completed'
					&& obj.item
					&& obj.item.type === 'agent_message'
					&& obj.item.text
				) {
					chunks.push(obj.item.text);
				}
			}
			catch (e) {
				// Ignore non-JSONL lines
			}
		}
		return chunks.join('\n').trim();
	},


	async main() {
		this.log(`Loaded ${this.id} ${this.version}`);
	},
};
