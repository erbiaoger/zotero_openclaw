# Zotero Terminal Agent Bridge

Zotero plugin to send selected items to terminal AI CLIs (`codex`, `claude`, `gemini`) with provider-specific path/model/args settings.

## Install (Developer)
1. Zip the folder into an `.xpi`:

```bash
cd /Users/zhangzhiyu/Desktop/zotero_openclaw
zip -r zotero-openclaw.xpi . -x '*.DS_Store'
```

2. In Zotero 8: `Tools` → `Add-ons` → gear icon → `Install Add-on From File...`

## Usage
- Select one or more items in the item list.
- Right-click → `Send to Agent CLI` or click the `Agent CLI` toolbar button.
- In plugin preferences, configure:
- `Task template` (reusable prompt body)
- `Provider` (`codex` / `claude` / `gemini`)
- `Executable path` (per provider)
- `Model name` (replaces `{{model}}`)
- `Command args template` (supports `{{task}}`, `{{payload}}`, `{{payloadFile}}`, `{{model}}`)

## Payload
The plugin builds a JSON payload and injects it into the configured args template:

```json
{
  "schema_version": "1.0",
  "source": "zotero",
  "items": [
    {
      "itemID": 123,
      "key": "ABCD1234",
      "libraryID": 1,
      "itemJSON": { "...": "full Zotero item JSON" },
      "attachments": [
        {
          "itemID": 456,
          "key": "EFGH5678",
          "path": "/path/to/file.pdf",
          "mimeType": "application/pdf",
          "isPDF": true,
          "fileSize": 1234567
        }
      ],
      "fulltext": {
        "source": "zotero_index",
        "text": "全文文本..."
      }
    }
  ]
}
```

## Notes
- Uses Zotero fulltext cache if available; otherwise `fulltext.text` is empty.
- Only the preferred attachment (PDF/large file) is sent.
