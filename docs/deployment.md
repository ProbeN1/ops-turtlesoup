# Deployment

## Local Development

```powershell
npm start
```

Default URL:

```text
http://127.0.0.1:5725/
```

## Intranet Deployment

Set `.env`:

```env
HOST=0.0.0.0
PORT=5725
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=http://10.10.214.22:30002/v1
OPENAI_MODEL=b-glm-5.2
```

Start service:

```powershell
npm start
```

Users access:

```text
http://<server-intranet-ip>:5725/
```

## Windows Firewall

Allow inbound TCP on the configured `PORT`.

## Docker

Build:

```bash
docker build -t ops-turtle-soup .
```

Run:

```bash
docker run --env-file .env -p 5725:5725 ops-turtle-soup
```

## Health Check

```text
GET /api/health
```

The endpoint returns process uptime, active session count, and configured difficulty names.

## Capacity Notes

For around 100 intranet users:

- Use a stable internal host, not a developer laptop.
- Configure `HOST=0.0.0.0`.
- Keep the LLM endpoint on the same intranet or low-latency network.
- Monitor `server.err.log` or process stderr.
- Use one Node process unless session persistence is externalized.
