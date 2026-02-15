pref("extensions.openclaw.provider", "codex");
pref("extensions.openclaw.sidebarVisible", false);
pref("extensions.openclaw.taskTemplate", "你是Zotero文献助手。请优先基于JSON中的fulltext与attachments.path分析文献。若fulltext为空，可读取attachments.path对应的PDF。输出：1) 中文摘要(120字)；2) 3个关键词；3) 研究方法一句话。JSON: {{payload}}");

pref("extensions.openclaw.path.codex", "/Users/zhangzhiyu/.nvm/versions/node/v24.12.0/bin/codex");
pref("extensions.openclaw.args.codex", "exec --json --model {{model}} {{task}} --skip-git-repo-check --ephemeral");
pref("extensions.openclaw.model.codex", "gpt-5-codex");

pref("extensions.openclaw.path.claude", "/Users/zhangzhiyu/.local/bin/claude");
pref("extensions.openclaw.args.claude", "--print --output-format json --model {{model}} {{task}}");
pref("extensions.openclaw.model.claude", "sonnet");

pref("extensions.openclaw.path.gemini", "/Users/zhangzhiyu/.nvm/versions/node/v24.12.0/bin/gemini");
pref("extensions.openclaw.args.gemini", "--prompt {{task}} --output-format json --model {{model}}");
pref("extensions.openclaw.model.gemini", "gemini-2.5-pro");
