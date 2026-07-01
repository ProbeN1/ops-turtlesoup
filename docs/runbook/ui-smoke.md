# UI Smoke Runbook

Use this runbook to verify the browser experience before sharing the intranet game link.

## Preconditions

- Service is running.
- `npm run verify:deploy` passes without `FAIL`.
- `npm run smoke:app` passes.
- Open the game URL in a real browser from the release host or a coworker intranet machine.

## Manual Browser Flow

1. Open:

```text
http://<server-intranet-ip>:5725/
```

2. Confirm the first screen shows:

- title: `运维海龟汤`;
- status: `待开始`;
- difficulty selector with `简单`, `中等`, `困难`;
- disabled question input before a game starts.

3. 选择 `中等`, then click `开始`.

Expected:

- status changes to `进行中`;
- the incident opening is replaced with a concrete story;
- question input and `提问` button are enabled;
- `揭晓` button is enabled.

4. Ask:

```text
这和用户量暴涨有关吗？
```

Expected:

- player message appears;
- host returns one allowed answer for the selected difficulty;
- input clears and remains usable.

5. Click `收起对话`, then `展开对话`.

Expected:

- button text toggles between `展开对话` and `收起对话`;
- `aria-expanded` toggles between `false` and `true`;
- previous messages remain present.

6. Click `揭晓`.

Expected:

- status changes to `已揭晓`;
- answer payload appears;
- `基础设施：` is readable text, not `[object Object]`;
- `真相：`, `关键点：`, and `经验：` are visible;
- question input and `提问` button are disabled.

7. Start an easy round until the `/data` backup scenario appears, then submit:

```text
备份压缩包落在 /data，上传完成后临时压缩文件被删除，所以磁盘自动回落。
```

Expected:

- status changes to `已破案`;
- reveal message appears with title `破案`;
- 庆祝动画短暂出现;
- `揭晓` button is disabled after solve.

## Current Verification Record

Date: 2026-07-01

Environment:

- URL: `http://127.0.0.1:5725/`
- Browser: in-app browser

Observed:

- page title and H1: `运维海龟汤`;
- medium game started successfully;
- question returned allowed answer: `否`;
- chat collapsed and expanded correctly;
- reveal rendered infrastructure without `[object Object]`;
- solved easy `/data` backup scenario;
- celebration layer showed 28 pieces and then hid;
- final status: `已破案`.

## Notes

Standalone Playwright automation was not added because the bundled Playwright browser binary was not installed on this machine. Keep this runbook as the release gate until browser binaries are available on the verification host.
